/**
 * Basic認証ミドルウェア
 * 管理者ページへのアクセス制限
 */

import { NextRequest, NextResponse } from 'next/server';

// Basic認証の認証情報（環境変数から取得）
const BASIC_AUTH_USER = process.env.ADMIN_BASIC_AUTH_USER;
const BASIC_AUTH_PASSWORD = process.env.ADMIN_BASIC_AUTH_PASSWORD;

/**
 * Basic認証を検証
 */
export function verifyBasicAuth(authHeader: string | null): boolean {
  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
    // Basic認証が設定されていない場合は検証をスキップ
    return true;
  }
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');
  
  return username === BASIC_AUTH_USER && password === BASIC_AUTH_PASSWORD;
}

/**
 * 管理者ページへのアクセス制限ミドルウェア
 * Basic認証のみチェック
 */
export function checkAdminAccess(request: NextRequest): NextResponse | null {
  // Basic認証チェック
  const authHeader = request.headers.get('authorization');
  if (!verifyBasicAuth(authHeader)) {
    return new NextResponse(null, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin Area"',
      },
    });
  }
  
  return null; // アクセス許可
}

