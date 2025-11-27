// src/app/api/auth/[...nextauth]/route.ts

export const runtime = 'nodejs'; // Prisma를 사용하므로 Node.js runtime 필요

import NextAuth from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { NextResponse } from "next/server";

const handler = NextAuth(authOptions);

// エラーハンドリングを追加
const wrappedHandler = {
  GET: async (req: Request) => {
    try {
      return await handler.GET(req);
    } catch (error) {
      console.error('[NextAuth] GET error:', error);
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      );
    }
  },
  POST: async (req: Request) => {
    try {
      return await handler.POST(req);
    } catch (error) {
      console.error('[NextAuth] POST error:', error);
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      );
    }
  },
};

export { wrappedHandler as GET, wrappedHandler as POST };
