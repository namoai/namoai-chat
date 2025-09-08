// src/app/api/characters/[id]/comments/[commentId]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

/**
 * コメント更新（PUT）
 * - ルートパラメータは Next.js の仕様に合わせて Promise から取得する
 * - 認可: コメント作成者のみ更新可能
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  // ▼ Next.js 15 仕様: params は Promise の可能性があるため await で取得
  const { id, commentId } = await params;

  // ▼ セッション確認（未ログインなら 401）
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  // ▼ 数値IDへ変換（不正値は 400）
  const commentIdNum = Number.parseInt(commentId, 10);
  const userIdNum = Number.parseInt(session.user.id as string, 10);
  if (Number.isNaN(commentIdNum)) {
    return NextResponse.json({ error: '無効なコメントIDです。' }, { status: 400 });
  }

  try {
    // ▼ 入力バリデーション（content は必須の非空文字列）
    const body = await request.json().catch(() => ({}));
    const content: unknown = (body as any).content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'コメント内容が必要です。' }, { status: 400 });
    }

    // ▼ 対象コメント取得（存在 & 作成者一致チェック）
    const comment = await prisma.comments.findUnique({
      where: { id: commentIdNum },
      select: { id: true, authorId: true },
    });

    if (!comment || comment.authorId !== userIdNum) {
      return NextResponse.json({ error: 'コメントを更新する権限がありません。' }, { status: 403 });
    }

    // ▼ コメント更新
    const updatedComment = await prisma.comments.update({
      where: { id: commentIdNum },
      data: {
        content,
        updatedAt: new Date(),
      },
      include: {
        users: {
          select: {
            id: true,
            nickname: true,
            image_url: true,
          },
        },
      },
    });

    return NextResponse.json(updatedComment, { status: 200 });
  } catch (error) {
    console.error('コメント更新エラー:', error);
    return NextResponse.json({ error: 'コメントの更新に失敗しました。' }, { status: 500 });
  }
}

/**
 * コメント削除（DELETE）
 * - ルートパラメータは Next.js の仕様に合わせて Promise から取得する
 * - 認可: コメント作成者 / キャラクター作成者 / 管理者
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  // ▼ Next.js 15 仕様: params は Promise の可能性があるため await で取得
  const { id, commentId } = await params;

  // ▼ セッション確認（未ログインなら 401）
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  // ▼ 数値IDへ変換（不正値は 400）
  const commentIdNum = Number.parseInt(commentId, 10);
  const characterIdNum = Number.parseInt(id, 10);
  const userIdNum = Number.parseInt(session.user.id as string, 10);
  const userRole = (session.user as any).role as string | undefined;

  if (Number.isNaN(commentIdNum) || Number.isNaN(characterIdNum)) {
    return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
  }

  try {
    // ▼ Prisma のリレーション名/カラム名に合わせて選択
    const comment = await prisma.comments.findUnique({
      where: { id: commentIdNum },
      select: {
        authorId: true,
        characters: {
          select: {
            // スキーマ上の正しいカラム名に合わせる（例: author_id）
            author_id: true,
            id: true,
          },
        },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: 'コメントが見つかりません。' }, { status: 404 });
    }

    // ▼ 権限判定
    const isCommentAuthor = comment.authorId === userIdNum;
    const isCharacterAuthor = comment.characters?.author_id === userIdNum;
    const isAdmin =
      userRole === 'CHAR_MANAGER' || userRole === 'SUPER_ADMIN';

    if (!isCommentAuthor && !isCharacterAuthor && !isAdmin) {
      return NextResponse.json({ error: 'コメントを削除する権限がありません。' }, { status: 403 });
    }

    // ▼ 削除
    await prisma.comments.delete({ where: { id: commentIdNum } });

    return NextResponse.json({ message: 'コメントが削除されました。' }, { status: 200 });
  } catch (error) {
    console.error('コメント削除エラー:', error);
    return NextResponse.json({ error: 'コメントの削除に失敗しました。' }, { status: 500 });
  }
}