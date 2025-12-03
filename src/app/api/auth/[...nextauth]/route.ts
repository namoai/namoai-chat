// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import { getAuthOptions, validateAuthEnvAtRuntime } from "@/lib/nextauth";
import { ensureEnvVarsLoaded } from "@/lib/load-env-vars";
import type { NextRequest } from "next/server";

/**
 * リクエストから NEXTAUTH_URL を動的に設定
 * Lambda環境でリクエストヘッダーを確認して正しいURLを設定
 */
function setNextAuthUrlFromRequest(request: NextRequest) {
  // 既に設定されている場合はスキップ
  if (process.env.NEXTAUTH_URL) {
    console.log(`[NextAuth] NEXTAUTH_URL は既に設定されています: ${process.env.NEXTAUTH_URL}`);
    console.log(`[NextAuth] Google OAuth redirect URI: ${process.env.NEXTAUTH_URL}/api/auth/callback/google`);
    return;
  }

  // リクエストヘッダーからホストを確認
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 
                   (request.url.startsWith('https') ? 'https' : 'http');
  
  if (host) {
    const url = `${protocol}://${host}`;
    process.env.NEXTAUTH_URL = url;
    console.log(`[NextAuth] ✅ NEXTAUTH_URL をリクエストヘッダーから自動設定: ${url}`);
    console.log(`[NextAuth] Google OAuth redirect URI: ${url}/api/auth/callback/google`);
    console.log(`[NextAuth] ⚠️ Google Cloud Console の「Authorized redirect URIs」に以下を追加してください:`);
    console.log(`[NextAuth]    ${url}/api/auth/callback/google`);
  } else {
    console.warn('[NextAuth] ⚠️ リクエストヘッダーからホストを見つけることができませんでした。NEXTAUTH_URL が設定されていません。');
  }
}

// Next.js 15 App Router compatibility with error handling
// Next.js 15 requires params to be a Promise (not optional)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ nextauth?: string[] }> }
) {
  try {
    // Lambda 환경에서 환경 변수 로드
    await ensureEnvVarsLoaded();
    
    // NEXTAUTH_URL이 없으면 요청 헤더에서 자동 설정
    setNextAuthUrlFromRequest(req);
    
    // 실제 사용 시점에 환경 변수 검증 (Lambda 환경 대응)
    validateAuthEnvAtRuntime();
    
    // 런타임에 authOptions 생성 (환경 변수가 로드된 후)
    const authOptions = getAuthOptions();
    const handler = NextAuth(authOptions);
    return await handler(req, context);
  } catch (error) {
    if (error instanceof Error && error.message.includes('redirect_uri_mismatch')) {
      const currentUrl = process.env.NEXTAUTH_URL || 'not set';
      console.error('[NextAuth] ❌ redirect_uri_mismatch エラーが発生しました');
      console.error(`[NextAuth] 現在の NEXTAUTH_URL: ${currentUrl}`);
      console.error(`[NextAuth] 必要な redirect URI: ${currentUrl}/api/auth/callback/google`);
      console.error('[NextAuth] 解決方法:');
      console.error('[NextAuth] 1. Google Cloud Console → APIs & Services → Credentials');
      console.error('[NextAuth] 2. OAuth 2.0 Client ID をクリック');
      console.error(`[NextAuth] 3. 「Authorized redirect URIs」に以下を追加: ${currentUrl}/api/auth/callback/google`);
      console.error('[NextAuth] 4. 「Authorized JavaScript origins」に以下を追加: ' + currentUrl.replace(/\/$/, ''));
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ NextAuth GET エラー:', error);
    }
    throw error;
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ nextauth?: string[] }> }
) {
  try {
    // Lambda 환경에서 환경 변수 로드
    await ensureEnvVarsLoaded();
    
    // NEXTAUTH_URL이 없으면 요청 헤더에서 자동 설정
    setNextAuthUrlFromRequest(req);
    
    // 실제 사용 시점에 환경 변수 검증 (Lambda 환경 대응)
    validateAuthEnvAtRuntime();
    
    // 런타임에 authOptions 생성 (환경 변수가 로드된 후)
    const authOptions = getAuthOptions();
    const handler = NextAuth(authOptions);
    return await handler(req, context);
  } catch (error) {
    if (error instanceof Error && error.message.includes('redirect_uri_mismatch')) {
      const currentUrl = process.env.NEXTAUTH_URL || 'not set';
      console.error('[NextAuth] ❌ redirect_uri_mismatch エラーが発生しました');
      console.error(`[NextAuth] 現在の NEXTAUTH_URL: ${currentUrl}`);
      console.error(`[NextAuth] 必要な redirect URI: ${currentUrl}/api/auth/callback/google`);
      console.error('[NextAuth] 解決方法:');
      console.error('[NextAuth] 1. Google Cloud Console → APIs & Services → Credentials');
      console.error('[NextAuth] 2. OAuth 2.0 Client ID をクリック');
      console.error(`[NextAuth] 3. 「Authorized redirect URIs」に以下を追加: ${currentUrl}/api/auth/callback/google`);
      console.error('[NextAuth] 4. 「Authorized JavaScript origins」に以下を追加: ' + currentUrl.replace(/\/$/, ''));
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ NextAuth POST エラー:', error);
    }
    throw error;
  }
}
