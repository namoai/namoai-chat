// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import { authOptions, validateAuthEnvAtRuntime } from "@/lib/nextauth";
import { ensureEnvVarsLoaded } from "@/lib/load-env-vars";
import type { NextRequest } from "next/server";

const handler = NextAuth(authOptions);

/**
 * 요청에서 NEXTAUTH_URL을 동적으로 설정
 * Lambda 환경에서 요청 헤더를 확인하여 올바른 URL 설정
 */
function setNextAuthUrlFromRequest(request: NextRequest) {
  // 이미 설정되어 있으면 스킵
  if (process.env.NEXTAUTH_URL) {
    return;
  }

  // 요청 헤더에서 호스트 확인
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 
                   (request.url.startsWith('https') ? 'https' : 'http');
  
  if (host) {
    const url = `${protocol}://${host}`;
    process.env.NEXTAUTH_URL = url;
    console.log(`[NextAuth] ✅ NEXTAUTH_URL을 요청 헤더에서 자동 설정: ${url}`);
  } else {
    console.warn('[NextAuth] ⚠️ 요청 헤더에서 호스트를 찾을 수 없습니다. NEXTAUTH_URL이 설정되지 않았습니다.');
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
    return await handler(req, context);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ NextAuth GET 에러:', error);
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
    return await handler(req, context);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ NextAuth POST 에러:', error);
    }
    throw error;
  }
}
