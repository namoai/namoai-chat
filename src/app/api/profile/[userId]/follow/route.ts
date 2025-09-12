// src/app/api/profile/[userId]/follow/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
// プロジェクト構成に合わせてパスを調整してください（authOptionsの所在）
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * RouteContext（自前定義）
 * - Next.js のルートハンドラ第2引数には公式の型が公開されていないため、
 *   ここでは必要最小限の型のみ宣言し、関数内で as キャストする。
 */
type RouteContext = {
  params: {
    userId: string;
  };
};

/**
 * フォロー切替エンドポイント
 * - 第二引数に明示的な「具体型」を付けると Next.js の型検証に弾かれるため、
 *   ここでは unknown とし、関数内で最小限のキャストのみ行う。
 * - follows モデルは複合主キー @@id([followerId, followingId]) を使用。
 *   → where は followerId_followingId を用いる。
 */
export async function POST(req: NextRequest, context: unknown) {
  // --- params の安全な取り出し（最小限の型アサーション） ---
  const { userId } = (context as RouteContext).params;

  // --- 認証チェック ---
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  // --- パラメータ検証 ---
  const targetUserId = Number(userId);
  const currentUserId = Number(session.user.id);

  if (!Number.isInteger(targetUserId)) {
    return NextResponse.json({ error: 'userId が不正です。' }, { status: 400 });
  }
  if (targetUserId === currentUserId) {
    return NextResponse.json({ error: '自分自身はフォローできません。' }, { status: 400 });
  }

  try {
    // --- 既存レコード確認（複合キーでユニーク検索） ---
    const existing = await prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    if (existing) {
      // --- フォロー中 → 解除 ---
      await prisma.follows.delete({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: targetUserId,
          },
        },
      });

      const newFollowerCount = await prisma.follows.count({
        where: { followingId: targetUserId },
      });

      return NextResponse.json({
        message: 'フォローを解除しました。',
        isFollowing: false,
        newFollowerCount,
      });
    } else {
      // --- 未フォロー → 追加 ---
      await prisma.follows.create({
        data: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      });

      const newFollowerCount = await prisma.follows.count({
        where: { followingId: targetUserId },
      });

      return NextResponse.json({
        message: 'フォローしました。',
        isFollowing: true,
        newFollowerCount,
      });
    }
  } catch (e) {
    console.error('フォロー処理エラー:', e);
    return NextResponse.json({ error: '処理中にエラーが発生しました。' }, { status: 500 });
  }
}