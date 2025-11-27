// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import { authOptions } from "@/lib/nextauth";
import type { NextRequest } from "next/server";

// 환경 변수 확인
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.NEXTAUTH_SECRET) {
  console.error('❌ NextAuth 환경 변수가 설정되지 않았습니다.');
  console.error('   GOOGLE_CLIENT_ID:', !!process.env.GOOGLE_CLIENT_ID);
  console.error('   GOOGLE_CLIENT_SECRET:', !!process.env.GOOGLE_CLIENT_SECRET);
  console.error('   NEXTAUTH_SECRET:', !!process.env.NEXTAUTH_SECRET);
}

const handler = NextAuth(authOptions);

// Next.js 15 App Router compatibility with error handling
export async function GET(req: NextRequest, context: { params?: Promise<{ nextauth?: string[] }> }) {
  try {
    return await handler(req, context);
  } catch (error) {
    console.error('❌ NextAuth GET 에러:', error);
    console.error('   환경 변수 확인:');
    console.error('   - GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '설정됨' : '누락');
    console.error('   - GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '설정됨' : '누락');
    console.error('   - NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '설정됨' : '누락');
    throw error;
  }
}

export async function POST(req: NextRequest, context: { params?: Promise<{ nextauth?: string[] }> }) {
  try {
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
