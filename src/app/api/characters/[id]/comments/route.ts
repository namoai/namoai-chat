import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

// GET: 特定キャラクターのコメント一覧を取得
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const characterId = parseInt(params.id, 10);
  if (isNaN(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  try {
    const comments = await prisma.comments.findMany({
      where: { characterId },
      include: {
        // ▼▼▼【修正】Prismaが自動生成したリレーション名 'users' を使用します ▼▼▼
        users: { 
          select: {
            id: true,
            nickname: true,
            image_url: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(comments);
  } catch (error) {
    console.error('コメント取得エラー:', error);
    return NextResponse.json({ error: 'コメントの取得に失敗しました。' }, { status: 500 });
  }
}

// POST: 新しいコメントを作成
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const characterId = parseInt(params.id, 10);
  const authorId = parseInt(session.user.id, 10);
  const { content } = await request.json();

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'コメント内容が必要です。' }, { status: 400 });
  }
  if (isNaN(characterId) || isNaN(authorId)) {
    return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
  }

  try {
    const newComment = await prisma.comments.create({
      data: {
        content,
        characterId,
        authorId,
        // ▼▼▼【修正】スキーマで必須となっている updatedAt フィールドを追加します ▼▼▼
        updatedAt: new Date(),
      },
      include: {
        // ▼▼▼【修正】Prismaが自動生成したリレーション名 'users' を使用します ▼▼▼
        users: {
          select: {
            id: true,
            nickname: true,
            image_url: true,
          },
        },
      },
    });
    return NextResponse.json(newComment, { status: 201 });
  } catch (error)
  {
    console.error('コメント作成エラー:', error);
    return NextResponse.json({ error: 'コメントの作成に失敗しました。' }, { status: 500 });
  }
}