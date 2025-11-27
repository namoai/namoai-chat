export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextauth";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/**
 * GET: ログインユーザーがブロックしたユーザーのリストを取得します
 */
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証されていません。" }, { status: 401 });
  }
  const currentUserId = parseInt(session.user.id, 10);

  try {
    const prisma = await getPrisma();
    const blockedRelations = await prisma.block.findMany({
      where: { blockerId: currentUserId },
      // ▼▼▼【修正】Prismaスキーマの実際のリレーション名に合わせて修正します ▼▼▼
      select: {
        users_Block_blockingIdTousers: { // `blocking` の代わりに正しいリレーション名を使用
          select: {
            id: true,
            nickname: true,
            image_url: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // `blocking`オブジェクトの配列に変換
    const blockedUsers = blockedRelations.map(relation => relation.users_Block_blockingIdTousers);

    return NextResponse.json({ blockedUsers });
  } catch (error) {
    console.error("ブロックリストの取得エラー:", error);
    // 型ガードを追加してエラーメッセージを安全に読み取ります
    if (error instanceof Error) {
        return NextResponse.json({ error: "サーバーエラーが発生しました。", details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "サーバーエラーが発生しました。" }, { status: 500 });
  }
}