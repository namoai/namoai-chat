import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

function extractUserIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  // /api/profile/1 -> 1を抽出
  const idStr = url.pathname.split('/')[3]; 
  if (!idStr) return null;
  const parsedId = parseInt(idStr, 10);
  return isNaN(parsedId) ? null : parsedId;
}

export async function GET(request: NextRequest) {
  const profileUserId = extractUserIdFromRequest(request);
  if (profileUserId === null) {
    return NextResponse.json({ error: '無効なユーザーIDです。' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const listType = searchParams.get('list'); // 'followers' または 'following'

  try {
    // リスト取得リクエストを処理します
    if (listType === 'followers') {
        const followers = await prisma.follows.findMany({
            where: { followingId: profileUserId },
            select: { follower: { select: { id: true, nickname: true, image_url: true } } }
        });
        return NextResponse.json(followers.map(f => f.follower));
    }

    if (listType === 'following') {
        const following = await prisma.follows.findMany({
            where: { followerId: profileUserId },
            select: { following: { select: { id: true, nickname: true, image_url: true } } }
        });
        return NextResponse.json(following.map(f => f.following));
    }

    // 通常のプロフィール情報取得ロジック
    const session = await getServerSession(authOptions);
    const viewingUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;

    const user = await prisma.users.findUnique({
      where: { id: profileUserId },
      select: {
        id: true, name: true, nickname: true, image_url: true, bio: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }
    
    const [followerCount, followingCount, characters, totalMessageCount, followRelation, blockRelation] = await Promise.all([
        prisma.follows.count({ where: { followingId: profileUserId } }),
        prisma.follows.count({ where: { followerId: profileUserId } }),
        prisma.characters.findMany({
            where: { author_id: profileUserId },
            orderBy: { createdAt: 'desc' },
            include: {
                characterImages: { where: { isMain: true }, take: 1 },
                _count: { select: { favorites: true, chat: true } }
            }
        }),
        prisma.chat_message.count({
            where: { chat: { characters: { author_id: profileUserId } } }
        }),
        viewingUserId && viewingUserId !== profileUserId 
            ? prisma.follows.findUnique({ where: { followerId_followingId: { followerId: viewingUserId, followingId: profileUserId } } })
            : Promise.resolve(null),
        viewingUserId && viewingUserId !== profileUserId
            ? prisma.block.findUnique({ where: { blockerId_blockingId: { blockerId: viewingUserId, blockingId: profileUserId } } })
            : Promise.resolve(null)
    ]);
    
    const profileData = {
      ...user,
      characters,
      totalMessageCount,
      _count: { followers: followerCount, following: followingCount, },
      isFollowing: !!followRelation,
      isBlocked: !!blockRelation,
    };

    return NextResponse.json(profileData);
    
  } catch (error) {
    console.error('プロファイルAPIエラー:', error);
    if (error instanceof Error) {
        if (error.message.includes('relation "Block" does not exist')) {
            return NextResponse.json({ error: 'サーバーエラー: Blockテーブルがデータベースに存在しません。' }, { status: 500 });
        }
    }
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

