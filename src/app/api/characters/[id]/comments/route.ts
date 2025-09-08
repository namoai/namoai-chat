import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

// PUT: 特定のコメントを更新
export async function PUT(
  request: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  const session = await getServerSession(authOptions);
  // セッションがない、またはユーザーIDがない場合は認証エラー
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const commentId = parseInt(params.commentId, 10);
  const userId = parseInt(session.user.id, 10);

  // コメントIDが無効な場合
  if (isNaN(commentId)) {
    return NextResponse.json({ error: '無効なコメントIDです。' }, { status: 400 });
  }

  try {
    const { content } = await request.json();
    // コメント内容が空の場合はエラー
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'コメント内容が必要です。' }, { status: 400 });
    }

    // 更新対象のコメントをデータベースから探す
    const comment = await prisma.comments.findUnique({
      where: { id: commentId },
    });

    // コメントが存在しない、またはコメントの作成者でない場合はエラー
    if (!comment || comment.authorId !== userId) {
      return NextResponse.json({ error: 'コメントを更新する権限がありません。' }, { status: 403 });
    }

    // コメントを更新
    const updatedComment = await prisma.comments.update({
      where: { id: commentId },
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

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error('コメント更新エラー:', error);
    return NextResponse.json({ error: 'コメントの更新に失敗しました。' }, { status: 500 });
  }
}

// DELETE: 特定のコメントを削除
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  const session = await getServerSession(authOptions);
  // セッションがない、またはユーザーIDがない場合は認証エラー
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const commentId = parseInt(params.commentId, 10);
  const characterId = parseInt(params.id, 10);
  const userId = parseInt(session.user.id, 10);
  const userRole = session.user.role;

  // IDが無効な場合
  if (isNaN(commentId) || isNaN(characterId)) {
    return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
  }

  try {
    // ▼▼▼【修正】Prisma Schemaに合わせてリレーション先のフィールド名を修正します ▼▼▼
    const comment = await prisma.comments.findUnique({
      where: { id: commentId },
      select: {
        authorId: true,
        characters: {
          select: {
            // 'authorId' -> 'author_id' に修正
            author_id: true
          }
        }
      },
    });

    // コメントが存在しない場合はエラー
    if (!comment) {
      return NextResponse.json({ error: 'コメントが見つかりません。' }, { status: 404 });
    }

    const isCommentAuthor = comment.authorId === userId;
    // ▼▼▼【修正】正しいプロパティパスでキャラクター作成者のIDにアクセスします ▼▼▼
    const isCharacterAuthor = comment.characters.author_id === userId;
    const isAdmin = userRole === 'CHAR_MANAGER' || userRole === 'SUPER_ADMIN';

    // 削除権限がない場合はエラー
    if (!isCommentAuthor && !isCharacterAuthor && !isAdmin) {
      return NextResponse.json({ error: 'コメントを削除する権限がありません。' }, { status: 403 });
    }

    // コメントを削除
    await prisma.comments.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ message: 'コメントが削除されました。' }, { status: 200 });
  } catch (error) {
    console.error('コメント削除エラー:', error);
    return NextResponse.json({ error: 'コメントの削除に失敗しました。' }, { status: 500 });
  }
}

