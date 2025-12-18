/**
 * 管理者ページへのBasic認証
 * IP制限は不要（従業員数が変動的で管理が困難なため）
 */

import { NextRequest, NextResponse } from 'next/server';

function decodeBase64(input: string): string {
  // Middleware runs in edge runtime where Buffer may not exist.
  if (typeof atob === 'function') {
    return atob(input);
  }
  // Node fallback
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'base64').toString('utf-8');
  }
  throw new Error('Base64 decode is not supported in this runtime.');
}

/**
 * 管理者ページへのアクセスをBasic認証で制限
 * 環境変数が設定されていない場合は制限なし
 */
export function checkAdminAccess(request: NextRequest): NextResponse | null {
  const basicAuthUser = process.env.ADMIN_BASIC_AUTH_USER;
  const basicAuthPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;

  // 環境変数が設定されていない場合はBasic認証なし
  if (!basicAuthUser || !basicAuthPassword) {
    return null;
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('認証が必要です。', {
      status: 401,
      headers: {
        // Header values must be ByteString (0-255) in the Edge runtime.
        // Keep realm ASCII-only to avoid "Cannot convert argument to a ByteString" errors.
        'WWW-Authenticate': 'Basic realm="Admin Area"',
        // Avoid caching; some browsers still cache credentials per-realm.
        'Cache-Control': 'no-store',
      },
    });
  }

  // Basic認証のデコード
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = decodeBase64(base64Credentials);
  const [username, password] = credentials.split(':');

  // 認証情報の検証
  if (username === basicAuthUser && password === basicAuthPassword) {
    return null; // 認証成功
  }

  // 認証失敗
  return new NextResponse('認証に失敗しました。', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin Area"',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Same as checkAdminAccess but forces a fresh prompt on every request by varying the realm.
 * Use this ONLY when you explicitly want "prompt every time".
 */
export function checkAdminAccessAlwaysPrompt(request: NextRequest, realmSuffix: string): NextResponse | null {
  const basicAuthUser = process.env.ADMIN_BASIC_AUTH_USER;
  const basicAuthPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;

  if (!basicAuthUser || !basicAuthPassword) {
    return new NextResponse('Authentication is required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': `Basic realm="Admin Area ${realmSuffix}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const authHeader = request.headers.get('authorization');
  const realm = `Admin Area ${realmSuffix}`;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Authentication is required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': `Basic realm="${realm}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = decodeBase64(base64Credentials);
  const [username, password] = credentials.split(':');

  if (username === basicAuthUser && password === basicAuthPassword) {
    return null;
  }

  return new NextResponse('Authentication failed.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${realm}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * クライアントIPアドレスを取得（ログ用）
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  
  // NOTE:
  // Some platforms may populate `request.ip` at runtime, but NextRequest's public TypeScript type
  // does not include it, which breaks `next build` type-checking in CI (e.g. Amplify).
  // Stick to header-based extraction to keep builds stable.
  return 'unknown';
}
