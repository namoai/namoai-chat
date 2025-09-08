import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

interface Params {
  params: {
    id: string; // キャラクターID
    commentId: string; // コメントID
  };
}

// PUT: コメントを更新
export async function PUT(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const commentId = parseInt(params.commentId, 10);
  const userId = parseInt(session.user.id, 10);
  const { content } = await request.json();

  if (isNaN(commentId)) {
    return NextResponse.json({ error: '無効なコメントIDです。' }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: 'コメント内容が必要です。' }, { status: 400 });
  }

  try {
    const comment = await prisma.comments.findUnique({ where: { id: commentId } });
    if (!comment) {
      return NextResponse.json({ error: 'コメントが見つかりません。' }, { status: 404 });
    }
    // 自分のコメントかチェック
    if (comment.authorId !== userId) {
      return NextResponse.json({ error: 'このコメントを編集する権限がありません。' }, { status: 403 });
    }

    const updatedComment = await prisma.comments.update({
      where: { id: commentId },
      data: { content, updatedAt: new Date() },
      include: { users: { select: { id: true, nickname: true, image_url: true } } },
    });

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error('コメント更新エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// DELETE: コメントを削除
export async function DELETE(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const characterId = parseInt(params.id, 10);
  const commentId = parseInt(params.commentId, 10);
  const userId = parseInt(session.user.id, 10);
  const userRole = session.user.role as Role;

  if (isNaN(commentId) || isNaN(characterId)) {
    return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
  }

  try {
    const comment = await prisma.comments.findUnique({ where: { id: commentId } });
    if (!comment) {
      return NextResponse.json({ error: 'コメントが見つかりません。' }, { status: 404 });
    }

    const character = await prisma.characters.findUnique({ where: { id: characterId } });
    if (!character) {
        return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }

    // 権限チェック
    const isCommentAuthor = comment.authorId === userId;
    const isCharacterAuthor = character.author_id === userId;
    const isAdmin = userRole === Role.CHAR_MANAGER || userRole === Role.SUPER_ADMIN;

    if (!isCommentAuthor && !isCharacterAuthor && !isAdmin) {
      return NextResponse.json({ error: 'このコメントを削除する権限がありません。' }, { status: 403 });
    }

    await prisma.comments.delete({ where: { id: commentId } });

    return NextResponse.json({ message: 'コメントが削除されました。' }, { status: 200 });
  } catch (error) {
    console.error('コメント削除エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
