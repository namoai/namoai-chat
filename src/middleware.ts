import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyCorsHeaders, handlePreflight, isApiRoute } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { createErrorResponse, ErrorCode } from "@/lib/error-handler";
import { checkAdminAccessAlwaysPrompt } from "@/lib/security/ip-restriction";
import { isIpBlocked } from "@/lib/security/suspicious-ip";
import { getClientIpFromRequest } from "@/lib/security/client-ip";

type AllowlistCache = { ips: string[]; fetchedAt: number };
let adminAllowlistCache: AllowlistCache | null = null;
const ADMIN_ALLOWLIST_CACHE_MS = 30_000;

function shouldLogPath(pathname: string): boolean {
  if (pathname === '/api/internal/log-access') return false;
  if (pathname.startsWith('/_next')) return false;
  if (pathname.startsWith('/favicon')) return false;
  if (pathname.startsWith('/robots')) return false;
  if (pathname.startsWith('/sitemap')) return false;
  if (pathname.startsWith('/manifest')) return false;
  if (pathname.endsWith('.png')) return false;
  if (pathname.endsWith('.jpg')) return false;
  if (pathname.endsWith('.jpeg')) return false;
  if (pathname.endsWith('.gif')) return false;
  if (pathname.endsWith('.webp')) return false;
  if (pathname.endsWith('.svg')) return false;
  if (pathname.endsWith('.ico')) return false;
  if (pathname.endsWith('.css')) return false;
  if (pathname.endsWith('.js')) return false;
  if (pathname.endsWith('.map')) return false;
  if (pathname.endsWith('.txt')) return false;
  return true;
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();

  // Internal logging endpoint should never be logged or CSRF-checked by middleware
  if (pathname === '/api/internal/log-access') {
    return NextResponse.next();
  }

  // 管理者ページへのアクセス制限（許可IP + Basic認証）
  if (pathname.startsWith('/admin')) {
    // 1) Admin IP allowlist (if configured)
    const ip = getClientIpFromRequest(request);
    console.log('[middleware] admin gate', { pathname, ip });
    const now = Date.now();
    let allowlist = adminAllowlistCache?.ips ?? [];
    try {
      if (!adminAllowlistCache || now - adminAllowlistCache.fetchedAt > ADMIN_ALLOWLIST_CACHE_MS) {
        const res = await fetch(`${request.nextUrl.origin}/api/internal/admin-ip-allowlist`, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        });
        if (res.ok) {
          const data: unknown = await res.json().catch(() => null);
          const ips =
            data && typeof data === 'object' && Array.isArray((data as { ips?: unknown }).ips)
              ? (data as { ips: unknown[] }).ips.map((x) => String(x))
              : [];
          adminAllowlistCache = { ips, fetchedAt: now };
          allowlist = ips;
        }
      }
    } catch {
      // If fetch fails, keep the last known cache if present.
      // Only fail-closed (empty) when we have no cache at all.
      allowlist = adminAllowlistCache?.ips ?? [];
    }

      // ✅ Requested behavior:
      // - If allowlist is EMPTY: treat everyone as "not allowed" until an admin registers their IP.
      //   -> show BASIC prompt every time
      // - If allowlist has entries and IP is NOT allowed:
      //   -> show BASIC prompt every time
      // - If IP is allowed:
      //   -> do NOT show BASIC prompt
      // Match by exact/wildcard/CIDR patterns
      const { ipMatches } = await import('@/lib/security/ip-match');
      const isAllowed = allowlist.length > 0 && allowlist.some((p) => ipMatches(ip, p));

      // ✅ Requested behavior (strict):
      // - If allowlist is EMPTY: treat everyone as "not allowed" until an admin registers their IP.
      //   -> show BASIC prompt every time
      // - If allowlist has entries and IP is NOT allowed:
      //   -> show BASIC prompt every time
      // - If IP is allowed:
      //   -> do NOT show BASIC prompt
      //
      // To make browsers re-prompt reliably, vary the realm on each navigation.
      // (Browsers cache credentials per realm; changing realm invalidates that cache.)
      // If allowlist is unavailable (no cache) OR current IP isn't allowed -> require BASIC
      if (!adminAllowlistCache || !isAllowed) {
        const realmSuffix = `UnallowedIP-${Date.now()}`;
        const basicCheck = checkAdminAccessAlwaysPrompt(request, realmSuffix);
        if (basicCheck) return basicCheck;
        // BASIC succeeded -> allow access even if IP not allowlisted (as a fallback gate)
    }
  }

  // 疑わしいIPアドレスのブロックチェック
  const ip = getClientIpFromRequest(request);
  if (await isIpBlocked(ip)) {
    return NextResponse.json(
      { error: 'アクセスが拒否されました。' },
      { status: 403 }
    );
  }

  // Log every page/API access (best-effort), excluding static assets & internal endpoint.
  // We pass cookies through so the internal endpoint can resolve userId from session.
  const shouldPersistAccessLog = shouldLogPath(pathname);
  const cookieHeader = request.headers.get('cookie') || '';

  // For non-API routes we don't know final status code in middleware reliably.
  // Still persist a best-effort row so user page visits show up in IP monitor.
  if (!isApiRoute(pathname)) {
    const response = NextResponse.next();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    response.headers.set('x-request-id', requestId);

    if (shouldPersistAccessLog) {
      event.waitUntil((async () => {
        const duration = Date.now() - startTime;

        // Console/memory log
        logger.logAccess(request, 200);

        try {
          await fetch(`${request.nextUrl.origin}/api/internal/log-access`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              cookie: cookieHeader,
            },
            body: JSON.stringify({
              ip,
              userAgent: request.headers.get('user-agent') || 'unknown',
              path: pathname,
              method: request.method,
              statusCode: 200,
              duration,
            }),
          });
        } catch {
          // ignore
        }
      })());
    }

    return response;
  }

  // NOTE:
  // We only log & enforce CSRF for API routes to avoid overhead on page navigations.
  // Admin pages are handled above.
  // (non-API routes are handled above)

  // OPTIONSリクエストはCORS処理のみ
  if (request.method === "OPTIONS") {
    return handlePreflight(request);
  }

  // CSRF保護（認証エンドポイントとCSRFトークン取得エンドポイントは除外）
  if (!pathname.startsWith('/api/auth/') && pathname !== '/api/csrf-token' && pathname !== '/api/internal/log-access') {
    // 注意: ミドルウェアは非同期を直接サポートしていないため、同期チェックのみ
    // 詳細な検証は各APIルートで実施
    const cookieToken = request.cookies.get('csrf-token')?.value;
    const headerToken = request.headers.get('x-csrf-token');
    
    // POST/PUT/DELETE/PATCHリクエストのみCSRFチェック
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      if (!cookieToken || !headerToken || cookieToken.split(':')[0] !== headerToken) {
        // ▼▼▼ 디버깅: CSRF 토큰 검증 실패 상세 정보 ▼▼▼
        const hasCookie = !!cookieToken;
        const hasHeader = !!headerToken;
        const cookieParts = cookieToken ? cookieToken.split(':') : [];
        const tokenMatch = cookieToken && headerToken ? cookieToken.split(':')[0] === headerToken : false;
        
        // ▼▼▼ Lambda 환경에서도 로그가 출력되도록 console.log 추가 ▼▼▼
        console.error('[middleware] ❌ CSRF token validation failed', {
          ip: getClientIpFromRequest(request),
          path: pathname,
          method: request.method,
          hasCookie,
          hasHeader,
          cookieTokenLength: cookieToken?.length || 0,
          headerTokenLength: headerToken?.length || 0,
          cookiePartsCount: cookieParts.length,
          tokenMatch,
          cookieTokenPrefix: cookieToken ? cookieToken.substring(0, 20) + '...' : 'none',
          headerTokenPrefix: headerToken ? headerToken.substring(0, 20) + '...' : 'none',
        });
        // ▲▲▲
        
        logger.warn('CSRF token validation failed', {
          ip: getClientIpFromRequest(request),
          path: pathname,
          method: request.method,
          hasCookie,
          hasHeader,
          cookieTokenLength: cookieToken?.length || 0,
          headerTokenLength: headerToken?.length || 0,
          cookiePartsCount: cookieParts.length,
          tokenMatch,
          cookieTokenPrefix: cookieToken ? cookieToken.substring(0, 20) + '...' : 'none',
          headerTokenPrefix: headerToken ? headerToken.substring(0, 20) + '...' : 'none',
        });
        // ▲▲▲
        
        return createErrorResponse(
          ErrorCode.CSRF_TOKEN_INVALID,
          'CSRFトークンが無効です。',
          403
        );
      }
    }
  }

  // レスポンスを作成
  const response = NextResponse.next();
  
  // CORSヘッダーを適用
  const corsResponse = applyCorsHeaders(response, request);

  // アクセスログを記録（非同期で実行）
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  corsResponse.headers.set('x-request-id', requestId);

  // Log/persist asynchronously without relying on setTimeout (unreliable in middleware runtime)
  event.waitUntil((async () => {
    const duration = Date.now() - startTime;
    const statusCode = corsResponse.status;
    
    // Console/memory log
    logger.logAccess(request, statusCode);
    
    // Persist access logs for admin IP monitor (best-effort)
    if (shouldPersistAccessLog) {
      try {
        await fetch(`${request.nextUrl.origin}/api/internal/log-access`, {
          method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
        },
          body: JSON.stringify({
            ip,
            userAgent: request.headers.get('user-agent') || 'unknown',
            path: pathname,
            method: request.method,
            statusCode,
            duration,
          }),
        });
      } catch {
        // ignore
      }
    }

    if (statusCode >= 400) {
      logger.warn('API request failed', {
        path: pathname,
        method: request.method,
        statusCode,
        duration,
        ip,
      });
    }
  })());

  return corsResponse;
}

export const config = {
  // Run middleware for *all* routes so page navigations are logged too.
  // Exclude Next.js internals and common static assets to avoid overhead/log spam.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt)$).*)",
  ],
};


