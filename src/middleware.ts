import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyCorsHeaders, handlePreflight, isApiRoute } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { createErrorResponse, ErrorCode } from "@/lib/error-handler";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();

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
        logger.warn('CSRF token validation failed', {
          ip: getClientIp(request),
          path: pathname,
          method: request.method,
        });
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


