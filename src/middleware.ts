import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyCorsHeaders, handlePreflight, isApiRoute } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { createErrorResponse, ErrorCode } from "@/lib/error-handler";
import { checkAdminAccess } from "@/lib/security/ip-restriction";
import { isIpBlocked } from "@/lib/security/suspicious-ip";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();

  // 管理者ページへのアクセス制限（Basic認証のみ）
  if (pathname.startsWith('/admin')) {
    const adminCheck = checkAdminAccess(request);
    if (adminCheck) {
      return adminCheck;
    }
  }

  // 疑わしいIPアドレスのブロックチェック
  const ip = getClientIp(request);
  if (await isIpBlocked(ip)) {
    return NextResponse.json(
      { error: 'アクセスが拒否されました。' },
      { status: 403 }
    );
  }

  // APIルート以外はスキップ
  if (!isApiRoute(pathname)) {
    return NextResponse.next();
  }

  // OPTIONSリクエストはCORS処理のみ
  if (request.method === "OPTIONS") {
    return handlePreflight(request);
  }

  // CSRF保護（認証エンドポイントとCSRFトークン取得エンドポイントは除外）
  if (!pathname.startsWith('/api/auth/') && pathname !== '/api/csrf-token') {
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
          ip: getClientIp(request),
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
          ip: getClientIp(request),
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

  // レスポンス後にログを記録（パフォーマンスへの影響を最小化）
  setTimeout(() => {
    const duration = Date.now() - startTime;
    const statusCode = corsResponse.status;
    
    // ユーザーIDはセッションから取得できないため、ログには記録しない
    logger.logAccess(request, statusCode);
    
    // 異常なリクエストパターンを検出
    if (statusCode >= 400) {
      logger.warn('API request failed', {
        path: pathname,
        method: request.method,
        statusCode,
        duration,
        ip: getClientIp(request),
      });
    }
  }, 0);

  return corsResponse;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

export const config = {
  matcher: ["/api/:path*"],
};


