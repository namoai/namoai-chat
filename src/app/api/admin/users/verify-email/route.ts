export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse, safeJsonParse } from "@/lib/api-helpers";

// POST: メール認証状態を切り替え
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  
  // SUPER_ADMINのみアクセス可能
  if (session?.user?.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    // リクエストボディを安全にパース
    const parsed = await safeJsonParse<{ userId: number | string; verified: boolean }>(request);
    if (!parsed.success) {
      // safeJsonParse 内で生成されたエラーレスポンスをそのまま返す
      return parsed.error;
    }

    const { userId, verified } = parsed.data;
    
    if (!userId) {
      return NextResponse.json({ error: 'ユーザーIDが必要です。' }, { status: 400 });
    }

    const prisma = await getPrisma();
    
    // メール認証状態を更新
    const updatedUser = await prisma.users.update({
      where: { id: typeof userId === 'number' ? userId : parseInt(userId as string, 10) },
      data: {
        emailVerified: verified ? new Date() : null,
      },
    });

    console.log(`✅ ユーザー ${updatedUser.email} のメール認証状態を変更: ${verified ? '認証済み' : '未認証'}`);

    return NextResponse.json({ 
      message: `メール認証状態を${verified ? '認証済み' : '未認証'}に変更しました。`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        emailVerified: updatedUser.emailVerified,
      }
    });
  } catch (error) {
    console.error('メール認証状態変更エラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}


