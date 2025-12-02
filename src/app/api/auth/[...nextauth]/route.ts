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
