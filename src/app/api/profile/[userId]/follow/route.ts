// src/app/api/profile/[userId]/follow/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

/**
 * フォロー切替エンドポイント
 * - モデル: follows（主キーは @@id([followerId, followingId]) の複合キー）
 * - 注意: where 条件は「followerId_followingId」を用いる
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  // --- 認証チェック ---
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  // --- パラメータ検証 ---
  const targetUserId = Number(params.userId);
  const currentUserId = Number(session.user.id);

  if (!Number.isInteger(targetUserId)) {
    return NextResponse.json({ error: 'userId が不正です。' }, { status: 400 });
  }
  if (targetUserId === currentUserId) {
    return NextResponse.json({ error: '自分自身はフォローできません。' }, { status: 400 });
  }

  try {
    // --- 既存レコードを複合キーで検索 ---
    const existing = await prisma.follows.findUnique({
      where: {
        // ✅ 複合PK/ユニークキーは「<fieldA>_<fieldB>」名のオブジェクトで指定
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    if (existing) {
      // --- フォロー中 → 解除（delete も同じ複合キーで指定）
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
      // --- 未フォロー → 登録
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
