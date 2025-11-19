/**
 * セキュリティ強化: CSRF対策強化
 * CSRFトークン強化、SameSite Cookieの最適化
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHmac } from 'crypto';

const CSRF_TOKEN_NAME = 'csrf-token';
const CSRF_SECRET = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production';

/**
 * CSRFトークンを生成
 */
export function generateCsrfToken(): string {
  const token = randomBytes(32).toString('hex');
  return token;
}

/**
 * CSRFトークンのハッシュを生成（サーバー側で検証用）
 */
function generateCsrfHash(token: string): string {
  const hmac = createHmac('sha256', CSRF_SECRET);
  hmac.update(token);
  return hmac.digest('hex');
}

/**
 * CSRFトークンを検証
 */
export function verifyCsrfToken(token: string, hash: string): boolean {
  const expectedHash = generateCsrfHash(token);
  return expectedHash === hash;
}

/**
 * CSRFトークンをクッキーに設定
 */
export async function setCsrfTokenCookie(response: NextResponse, token: string): Promise<NextResponse> {
  const hash = generateCsrfHash(token);
  
  // トークンとハッシュを結合して保存
  const tokenWithHash = `${token}:${hash}`;
  
  response.cookies.set(CSRF_TOKEN_NAME, tokenWithHash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // CSRF対策: strictに設定
    path: '/',
    maxAge: 60 * 60 * 24, // 24時間
  });

  return response;
}

/**
 * リクエストからCSRFトークンを取得
 */
export function getCsrfTokenFromRequest(request: NextRequest): string | null {
  // ヘッダーから取得を試みる
  const headerToken = request.headers.get('x-csrf-token');
  if (headerToken) {
    return headerToken;
  }

  // クッキーから取得
  const cookieToken = request.cookies.get(CSRF_TOKEN_NAME)?.value;
  return cookieToken || null;
}

/**
 * CSRFトークンを検証（ミドルウェア用）
 */
export async function validateCsrfToken(request: NextRequest): Promise<boolean> {
  // GET、HEAD、OPTIONSリクエストは検証をスキップ
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }

  // NextAuthのセッションエンドポイントはスキップ（NextAuthが管理）
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/auth/')) {
    return true;
  }

  // クッキーからトークンを取得
  const cookieValue = request.cookies.get(CSRF_TOKEN_NAME)?.value;
  if (!cookieValue) {
    return false;
  }

  const [token, hash] = cookieValue.split(':');
  if (!token || !hash) {
    return false;
  }

  // リクエストヘッダーからトークンを取得
  const headerToken = request.headers.get('x-csrf-token');
  if (!headerToken) {
    return false;
  }

  // トークンが一致するか確認
  if (token !== headerToken) {
    return false;
  }

  // ハッシュを検証
  return verifyCsrfToken(token, hash);
}

/**
 * CSRFトークンを生成してレスポンスに設定（APIルート用）
 */
export async function generateAndSetCsrfToken(): Promise<{ token: string; response: NextResponse }> {
  const token = generateCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  await setCsrfTokenCookie(response, token);
  return { token, response };
}

