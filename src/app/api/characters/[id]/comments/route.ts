import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// セッションユーザーの型を拡張
interface ExtendedUser {
  id?: string | null;
  role?: Role | null;
}

/**
 * コメント更新（PUT）
 * - 認証必須
 * - コメント作成者のみが更新可能
 */
export async function PUT(
  request: NextRequest,
  context: { params: { commentId: string } }
) {
  // ▼▼▼【修正】未使用の'id'変数を削除します ▼▼▼
  const { commentId } = context.params;

  // 認証確認
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const commentIdNum = Number.parseInt(commentId, 10);
  const userIdNum = Number.parseInt(session.user.id as string, 10);
  if (Number.isNaN(commentIdNum)) {
    return NextResponse.json({ error: '無効なコメントIDです。' }, { status: 400 });
  }

  try {
    // ▼▼▼【修正】'any'型を避け、リクエストボディの型を明示的に定義します ▼▼▼
    const body: { content?: unknown } = await request.json().catch(() => ({}));
    const { content } = body;

    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'コメント内容が必要です。' }, { status: 400 });
    }

    // コメント存在確認
    const comment = await prisma.comments.findUnique({
      where: { id: commentIdNum },
    });

    if (!comment || comment.authorId !== userIdNum) {
      return NextResponse.json({ error: 'コメントを更新する権限がありません。' }, { status: 403 });
    }

    // 更新処理（updatedAt 必須）
    const updated = await prisma.comments.update({
      where: { id: commentIdNum },
      data: {
        content: content.trim(),
        updatedAt: new Date(),
      },
      include: {
        users: {
          select: { id: true, nickname: true, image_url: true },
        },
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('コメント更新エラー:', error);
    return NextResponse.json({ error: 'コメントの更新に失敗しました。' }, { status: 500 });
  }
}

/**
 * コメント削除（DELETE）
 * - コメント作成者 / キャラクター作成者 / 管理者のみ可能
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { commentId: string } }
) {
  const { commentId } = context.params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const commentIdNum = Number.parseInt(commentId, 10);
  const userIdNum = Number.parseInt(session.user.id as string, 10);
  // ▼▼▼【修正】'any'型を避け、拡張したユーザー型を使用します ▼▼▼
  const userRole = (session.user as ExtendedUser).role;

  if (Number.isNaN(commentIdNum)) {
    return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
  }

  try {
    const comment = await prisma.comments.findUnique({
      where: { id: commentIdNum },
      select: {
        authorId: true,
        characters: { select: { author_id: true } },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: 'コメントが見つかりません。' }, { status: 404 });
    }

    const isCommentAuthor = comment.authorId === userIdNum;
    const isCharacterAuthor = comment.characters?.author_id === userIdNum;
    const isAdmin =
      userRole === 'CHAR_MANAGER' || userRole === 'SUPER_ADMIN';

    if (!isCommentAuthor && !isCharacterAuthor && !isAdmin) {
      return NextResponse.json({ error: 'コメントを削除する権限がありません。' }, { status: 403 });
    }

    await prisma.comments.delete({ where: { id: commentIdNum } });

    return NextResponse.json({ message: 'コメントが削除されました。' }, { status: 200 });
  } catch (error) {
    console.error('コメント削除エラー:', error);
    return NextResponse.json({ error: 'コメントの削除に失敗しました。' }, { status: 500 });
  }
}

