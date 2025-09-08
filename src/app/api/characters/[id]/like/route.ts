import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

// POST: いいねのトグル処理
export async function POST(
  request: Request,
  // ▼▼▼【修正】Next.jsのフォルダ名に合わせて 'id' を使用します ▼▼▼
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  // ▼▼▼【修正】params.characterId を params.id に変更します ▼▼▼
  const characterId = parseInt(params.id, 10);
  const userId = parseInt(session.user.id, 10);

  if (isNaN(characterId) || isNaN(userId)) {
    return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
  }

  try {
    const existingFavorite = await prisma.favorites.findUnique({
      where: {
        user_id_character_id: {
          user_id: userId,
          character_id: characterId,
        },
      },
    });

    if (existingFavorite) {
      // いいねが存在する場合は削除（いいね解除）
      await prisma.favorites.delete({
        where: {
          id: existingFavorite.id,
        },
      });
      return NextResponse.json({ liked: false, message: 'いいねを取り消しました。' });
    } else {
      // いいねが存在しない場合は作成（いいね）
      await prisma.favorites.create({
        data: {
          user_id: userId,
          character_id: characterId,
        },
      });
      return NextResponse.json({ liked: true, message: 'いいねしました。' });
    }
  } catch (error) {
    console.error('いいね処理エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
