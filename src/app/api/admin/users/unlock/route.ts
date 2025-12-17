export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse, safeJsonParse } from "@/lib/api-helpers";

// POST: ユーザーアカウントのロックを解除
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const parseResult = await safeJsonParse<{ userId: number }>(request);
    if (!parseResult.success) return parseResult.error;
    const { userId } = parseResult.data;

    if (!userId) {
      return NextResponse.json({ error: "ユーザーIDが必要です。" }, { status: 400 });
    }

    const prisma = await getPrisma();
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        lockedUntil: null,
        loginAttempts: 0,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "アカウントのロックを解除しました。",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
      }
    });
  } catch (error) {
    console.error("ロック解除エラー:", error);
    return NextResponse.json({ error: "解除処理中にエラーが発生しました。" }, { status: 500 });
  }
}

