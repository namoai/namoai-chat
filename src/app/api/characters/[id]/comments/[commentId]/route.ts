// C:\Users\sc998\namos-chat-v1\src\app\api\characters\[id]\comments\[commentId]\route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

/** Body 型: { content: string } を満たすか判定（更新用・any不使用） */
function hasValidContent(body: unknown): body is { content: string } {
  if (!body || typeof body !== 'object') return false;
  if (!('content' in body)) return false;
  const v = (body as { content?: unknown }).content;
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * コメント更新（PUT）
 * - ルート: /api/characters/[id]/comments/[commentId]
 * - 認証必須、コメント作成者のみ更新可能
 * - Prismaスキーマ上、updatedAt は必須 → 常に new Date() を設定
 */
export async function PUT(
  request: NextRequest,
  context: { params: { id: string; commentId: string } }
) {
  // ▼ 未使用変数警告を避けるため、必要な commentId のみ参照
  const commentIdNum = Number.parseInt(context.params.commentId, 10);
  if (Number.isNaN(commentIdNum)) {
    return NextResponse.json({ error: '無効なコメントIDです。' }, { status: 400 });
  }

  // ▼ 認証確認
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userIdNum = Number.parseInt(session.user.id as string, 10);

  // ▼ リクエストボディ検証（any不使用）
  const raw = (await request.json().catch(() => null)) as unknown;
  if (!hasValidContent(raw)) {
    return NextResponse.json({ error: 'コメント内容が必要です。' }, { status: 400 });
  }

  try {
    // ▼ コメントが存在し、かつ作成者であることを確認
    const comment = await prisma.comments.findUnique({
      where: { id: commentIdNum },
      select: { id: true, authorId: true },
    });
    if (!comment || comment.authorId !== userIdNum) {
      return NextResponse.json({ error: 'コメントを更新する権限がありません。' }, { status: 403 });
    }

    // ▼ 更新（updatedAt は必須）
    const updated = await prisma.comments.update({
      where: { id: commentIdNum },
      data: {
        content: raw.content.trim(),
        updatedAt: new Date(),
      },
      include: {
        users: { select: { id: true, nickname: true, image_url: true } },
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
 * - ルート: /api/characters/[id]/comments/[commentId]
 * - コメント作成者 / キャラクター作成者 / 管理者 のいずれかのみ削除可能
 * - ※ 未使用変数を避けるため、id は参照しない
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string; commentId: string } }
) {
  const commentIdNum = Number.parseInt(context.params.commentId, 10);
  if (Number.isNaN(commentIdNum)) {
    return NextResponse.json({ error: '無効なコメントIDです。' }, { status: 400 });
  }

  // ▼ 認証確認
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userIdNum = Number.parseInt(session.user.id as string, 10);
  const userRole = (session.user as { role?: string }).role;

  try {
    // ▼ コメント作成者、または対象キャラクターの作成者、または管理者かを判定
    const comment = await prisma.comments.findUnique({
      where: { id: commentIdNum },
      select: {
        authorId: true,
        characters: { select: { author_id: true } }, // characters.author_id が作成者
      },
    });

    if (!comment) {
      return NextResponse.json({ error: 'コメントが見つかりません。' }, { status: 404 });
    }

    const isCommentAuthor = comment.authorId === userIdNum;
    const isCharacterAuthor = comment.characters?.author_id === userIdNum;
    const isAdmin = userRole === 'CHAR_MANAGER' || userRole === 'SUPER_ADMIN';

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