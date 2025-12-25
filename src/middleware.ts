import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyCorsHeaders, handlePreflight, isApiRoute } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { createErrorResponse, ErrorCode } from "@/lib/error-handler";
import { isIpBlocked } from "@/lib/security/suspicious-ip";
import { getClientIpFromRequest } from "@/lib/security/client-ip";
import { getToken } from "next-auth/jwt";
import { checkAdminAccess } from "@/lib/security/ip-restriction";

function shouldLogPath(pathname: string): boolean {
  if (pathname === '/api/internal/log-access') return false;
  if (pathname === '/api/log-access') return false;
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

  // 管理者ページへのアクセス制限（管理者権限のみチェック）
  if (pathname.startsWith('/admin')) {
    // ▼▼▼ Basic認証チェック（管理者の場合のみ）▼▼▼
    // まずBasic認証をチェック（環境変数が設定されている場合）
    const basicAuthResponse = checkAdminAccess(request);
    if (basicAuthResponse) {
      // Basic認証が必要な場合（401レスポンス）
      return basicAuthResponse;
    }
    // ▲▲▲ Basic認証チェック完了 ▲▲▲
    
    // ユーザーのセッションを確認して管理者権限をチェック
    try {
      const token = await getToken({ 
        req: request,
        secret: process.env.NEXTAUTH_SECRET 
      });
      
      // セッションが存在し、ユーザーの役割を確認
      if (token && token.role) {
        // 管理者権限（MODERATOR, CHAR_MANAGER, SUPER_ADMIN）のみ許可
        const adminRoles = ['MODERATOR', 'CHAR_MANAGER', 'SUPER_ADMIN'];
        if (!adminRoles.includes(token.role as string)) {
          console.log('[middleware] Non-admin user attempted to access admin page, redirecting');
          return NextResponse.redirect(new URL('/', request.url));
        }
        // 管理者の場合はアクセス許可
        return NextResponse.next();
      } else {
        // セッションがない場合はログインページにリダイレクト（元のURLをcallbackUrlとして渡す）
        console.log('[middleware] No session found for admin page access, redirecting');
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch (error) {
      // セッション確認でエラーが発生した場合もリダイレクト（元のURLをcallbackUrlとして渡す）
      console.error('[middleware] Error checking session:', error);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
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
    try {
      logger.logAccess(request, statusCode);
    } catch (logError) {
      // Logging failure should not affect the request
      console.warn('[middleware] Failed to log access:', logError);
    }
    
    // Persist access logs for admin IP monitor (best-effort)
    if (shouldPersistAccessLog) {
      try {
        // Add timeout to prevent hanging (5 seconds max)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
          const response = await fetch(`${request.nextUrl.origin}/api/internal/log-access`, {
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
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.warn(`[middleware] Log access endpoint returned ${response.status} for ${pathname}`);
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          // Only log if it's not an abort (timeout is expected)
          if (fetchError instanceof Error && fetchError.name !== 'AbortError') {
            console.warn('[middleware] Failed to persist access log (non-critical):', fetchError.message);
          }
        }
      } catch (error) {
        // Catch any unexpected errors in the logging flow
        console.warn('[middleware] Unexpected error in access log persistence:', error);
      }
    }

    if (statusCode >= 400) {
      try {
        logger.warn('API request failed', {
          path: pathname,
          method: request.method,
          statusCode,
          duration,
          ip,
        });
      } catch (warnError) {
        console.warn('[middleware] Failed to log warning:', warnError);
      }
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


