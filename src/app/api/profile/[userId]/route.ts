// src/app/api/profile/[userId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

/* =============================================================================
 *  URL から userId を抽出（末尾スラッシュや可変セグメントに耐性）
 *  例: /api/profile/1 → "1" を抽出
 * ============================================================================= */
function extractUserIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean); // 空要素を除去
  const idStr = parts[parts.length - 1];
  if (!idStr) return null;
  const parsedId = Number(idStr);
  return Number.isFinite(parsedId) ? parsedId : null;
}

/* =============================================================================
 *  GET: プロフィール本体 or フォロワー/フォロー一覧
 *  - ビルド時の静的収集を無効化（dynamic = 'force-dynamic'）
 *  - URL パラメータの抽出を堅牢化
 * ============================================================================= */
export async function GET(request: NextRequest) {
  // クエリ取得（followers / following）
  const { searchParams } = new URL(request.url);
  const listType = searchParams.get('list'); // 'followers' または 'following'

  // パスから userId を抽出
  const profileUserId = extractUserIdFromRequest(request);
  if (profileUserId === null) {
    return NextResponse.json({ error: '無効なユーザーIDです。' }, { status: 400 });
  }

  try {
    // --- フォロワー一覧 ---
    if (listType === 'followers') {
      const followers = await prisma.follows.findMany({
        where: { followingId: profileUserId },
        select: {
          follower: { select: { id: true, nickname: true, image_url: true } }
        }
      });
      return NextResponse.json(followers.map(f => f.follower));
    }

    // --- フォロー一覧 ---
    if (listType === 'following') {
      const following = await prisma.follows.findMany({
        where: { followerId: profileUserId },
        select: {
          following: { select: { id: true, nickname: true, image_url: true } }
        }
      });
      return NextResponse.json(following.map(f => f.following));
    }

    // --- 通常のプロフィール情報 ---
    const session = await getServerSession(authOptions);
    const viewingUserId = session?.user?.id ? Number(session.user.id) : null;

    const user = await prisma.users.findUnique({
      where: { id: profileUserId },
      select: {
        id: true,
        name: true,
        nickname: true,
        image_url: true,
        bio: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    const [
      followerCount,
      followingCount,
      characters,
      totalMessageCount,
      followRelation,
      blockRelation,
    ] = await Promise.all([
      prisma.follows.count({ where: { followingId: profileUserId } }),
      prisma.follows.count({ where: { followerId: profileUserId } }),
      prisma.characters.findMany({
        where: { author_id: profileUserId },
        orderBy: { createdAt: 'desc' },
        include: {
          characterImages: { where: { isMain: true }, take: 1 },
          _count: { select: { favorites: true, chat: true } },
        },
      }),
      prisma.chat_message.count({
        where: { chat: { characters: { author_id: profileUserId } } },
      }),
      viewingUserId && viewingUserId !== profileUserId
        ? prisma.follows.findUnique({
            where: {
              followerId_followingId: {
                followerId: viewingUserId,
                followingId: profileUserId,
              },
            },
          })
        : Promise.resolve(null),
      viewingUserId && viewingUserId !== profileUserId
        ? prisma.block.findUnique({
            where: {
              blockerId_blockingId: {
                blockerId: viewingUserId,
                blockingId: profileUserId,
              },
            },
          })
        : Promise.resolve(null),
    ]);

    const profileData = {
      ...user,
      characters,
      totalMessageCount,
      _count: { followers: followerCount, following: followingCount },
      isFollowing: !!followRelation,
      isBlocked: !!blockRelation,
    };

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('プロファイルAPIエラー:', error);
    if (error instanceof Error) {
      // Prisma のテーブル未作成などを明示
      if (error.message.includes('relation "Block" does not exist')) {
        return NextResponse.json(
          { error: 'サーバーエラー: Blockテーブルがデータベースに存在しません。' },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}