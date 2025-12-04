// src/app/api/profile/[userId]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/* =============================================================================
 *  URL から userId を抽出（末尾スラッシュや可変セグメントに耐性）
 *  例: /api/profile/1 → "1" を抽出
 * ============================================================================= */
function extractUserIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const idStr = parts[parts.length - 1];
  if (!idStr) return null;
  const parsedId = Number(idStr);
  return Number.isFinite(parsedId) ? parsedId : null;
}

/* =============================================================================
 *  GET: プロフィール本体 or フォロワー/フォロー一覧
 *  - ビルド時の静的収集を無効化（dynamic = 'force-dynamic'）
 *  - いかなる場合でも JSON 本文を返却（空レスポンス禁止）
 * ============================================================================= */
export async function GET(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    // クエリ取得（followers / following）
    const { searchParams } = new URL(request.url);
    const listType = searchParams.get('list'); // 'followers' または 'following'

    // パスから userId を抽出
    const profileUserId = extractUserIdFromRequest(request);
    if (profileUserId === null) {
      return new NextResponse(JSON.stringify({ ok: false, error: '無効なユーザーIDです。' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    // --- フォロワー一覧 ---
    if (listType === 'followers') {
      const followers = await prisma.follows.findMany({
        where: { followingId: profileUserId },
        select: {
          follower: { select: { id: true, nickname: true, image_url: true } }
        }
      });
      const data = followers.map(f => f.follower);
      return new NextResponse(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    // --- フォロー一覧 ---
    if (listType === 'following') {
      const following = await prisma.follows.findMany({
        where: { followerId: profileUserId },
        select: {
          following: { select: { id: true, nickname: true, image_url: true } }
        }
      });
      const data = following.map(f => f.following);
      return new NextResponse(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
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
        password: true, // パスワードの有無を確認するため（値自体は返さない）
      }
    });

    if (!user) {
      return new NextResponse(JSON.stringify({ ok: false, error: 'ユーザーが見つかりません。' }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
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
        orderBy: { createdAt: 'asc' },
        include: {
          // メイン画像がない場合は最初の画像を取得
          characterImages: { 
            orderBy: [
              { isMain: 'desc' },  // メイン画像を優先
              { displayOrder: 'asc' },  // 次に表示順
              { id: 'asc' }  // 最後にID順
            ],
            take: 1 
          },
          _count: { select: { favorites: true } },
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

    // 各キャラクターの実際のメッセージ数を計算
    const charactersWithMessageCount = await Promise.all(
      characters.map(async (char) => {
        const messageCount = await prisma.chat_message.count({
          where: {
            chat: { characterId: char.id },
            isActive: true,
          },
        });
        return {
          ...char,
          _count: {
            ...char._count,
            chat: messageCount,
          },
        };
      })
    );

    const profileData = {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      image_url: user.image_url,
      bio: user.bio,
      hasPassword: !!user.password, // パスワードが設定されているかどうか（本人確認用）
      characters: charactersWithMessageCount,
      totalMessageCount,
      _count: { followers: followerCount, following: followingCount },
      isFollowing: !!followRelation,
      isBlocked: !!blockRelation,
    };

    return new NextResponse(JSON.stringify(profileData), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch (error) {
    console.error('プロファイルAPIエラー:', error);
    // Prisma のテーブル未作成などを明示
    if (error instanceof Error && error.message.includes('relation "Block" does not exist')) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: 'サーバーエラー: Blockテーブルがデータベースに存在しません。' }),
        { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } }
      );
    }
    return new NextResponse(JSON.stringify({ ok: false, error: 'サーバーエラーが発生しました。' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}