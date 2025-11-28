// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import { authOptions, validateAuthEnvAtRuntime } from "@/lib/nextauth";
import { ensureEnvVarsLoaded } from "@/lib/load-env-vars";
import type { NextRequest } from "next/server";

const handler = NextAuth(authOptions);

// Next.js 15 App Router compatibility with error handling
// Next.js 15 requires params to be a Promise (not optional)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ nextauth?: string[] }> }
) {
  try {
    // Lambda 환경에서 환경 변수 로드
    await ensureEnvVarsLoaded();
    
    // 디버깅: 모든 환경 변수 확인
    console.log('[NextAuth GET] Environment check:', {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      allEnvKeys: Object.keys(process.env).filter(k => 
        k.includes('GOOGLE') || k.includes('NEXTAUTH') || k.includes('DATABASE')
      ),
    });
    
    // 실제 사용 시점에 환경 변수 검증 (Lambda 환경 대응)
    validateAuthEnvAtRuntime();
    return await handler(req, context);
  } catch (error) {
    console.error('❌ NextAuth GET 에러:', error);
    console.error('   환경 변수 확인:');
    console.error('   - GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '설정됨' : '누락');
    console.error('   - GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '설정됨' : '누락');
    console.error('   - NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '설정됨' : '누락');
    console.error('   - 모든 환경 변수 키:', Object.keys(process.env).filter(k => 
      k.includes('GOOGLE') || k.includes('NEXTAUTH') || k.includes('DATABASE')
    ));
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
    
    // 실제 사용 시점에 환경 변수 검증 (Lambda 환경 대응)
    validateAuthEnvAtRuntime();
    return await handler(req, context);
  } catch (error) {
    console.error('❌ NextAuth POST 에러:', error);
    console.error('   환경 변수 확인:');
    console.error('   - GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '설정됨' : '누락');
    console.error('   - GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '설정됨' : '누락');
    console.error('   - NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '설정됨' : '누락');
    throw error;
  }
}
