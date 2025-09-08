import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// ▼▼▼【修正】Next.js App Routerの正しい型定義を使用します ▼▼▼
type RouteParams = {
  params: {
    id: string;
    commentId: string;
  };
};

// PUT: 特定のコメントを更新
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const commentId = parseInt(params.commentId, 10);
    const userId = parseInt(session.user.id, 10);
    const { content } = await request.json();

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'コメント内容が必要です。' }, { status: 400 });
    }

    const comment = await prisma.comments.findUnique({ where: { id: commentId } });
    if (!comment) {
      return NextResponse.json({ error: 'コメントが見つかりません。' }, { status: 404 });
    }
    if (comment.authorId !== userId) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const updatedComment = await prisma.comments.update({
      where: { id: commentId },
      data: { content, updatedAt: new Date() },
      include: {
        users: { select: { id: true, nickname: true, image_url: true } },
      },
    });

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error('コメント更新エラー:', error);
    return NextResponse.json({ error: 'コメントの更新に失敗しました。' }, { status: 500 });
  }
}


// DELETE: 特定のコメントを削除
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  
  try {
    const commentId = parseInt(params.commentId, 10);
    const userId = parseInt(session.user.id, 10);
    const userRole = session.user.role as Role;

    const comment = await prisma.comments.findUnique({
      where: { id: commentId },
      select: {
        authorId: true,
        characters: {
          select: { author_id: true },
        },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: 'コメントが見つかりません。' }, { status: 404 });
    }

    const isCommentAuthor = comment.authorId === userId;
    const isCharacterAuthor = comment.characters?.author_id === userId;
    const isAdmin = userRole === 'CHAR_MANAGER' || userRole === 'SUPER_ADMIN';

    if (!isCommentAuthor && !isCharacterAuthor && !isAdmin) {
      return NextResponse.json({ error: 'このコメントを削除する権限がありません。' }, { status: 403 });
    }

    await prisma.comments.delete({ where: { id: commentId } });

    return NextResponse.json({ message: 'コメントが削除されました。' }, { status: 200 });
  } catch (error) {
    console.error('コメント削除エラー:', error);
    return NextResponse.json({ error: 'コメントの削除中にエラーが発生しました。' }, { status: 500 });
  }
}

