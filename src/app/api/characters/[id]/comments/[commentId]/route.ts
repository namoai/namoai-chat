import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

/** Body 型: { content: string } を満たすか判定（更新用） */
function hasValidContent(body: unknown): body is { content: string } {
  if (!body || typeof body !== 'object') return false;
  if (!('content' in body)) return false;
  const v = (body as { content?: unknown }).content;
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * コメント更新（PUT）
 * - ルート: /api/characters/[id]/comments/[commentId]
 * - 認証必須（作成者のみ）
 * - Prismaスキーマ上、updatedAt は必須 → 常に new Date() を設定
 */
export async function PUT(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  // ▼ 2番目引数は next の検証で具体型を禁止されるため any（内部で手動バリデーション）
  const p = (context?.params ?? {}) as { id?: string; commentId?: string };
  const commentIdNum = Number.parseInt(p.commentId ?? '', 10);
  if (!Number.isFinite(commentIdNum)) {
    return NextResponse.json({ error: '無効なコメントIDです。' }, { status: 400 });
  }

  // ▼ 認証確認
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userIdNum = Number.parseInt(String(session.user.id), 10);

  // ▼ リクエストボディ検証
  const raw = (await request.json().catch(() => null)) as unknown;
  if (!hasValidContent(raw)) {
    return NextResponse.json({ error: 'コメント内容が必要です。' }, { status: 400 });
  }

  try {
    // ▼ コメント存在 & 権限確認
    const comment = await prisma.comments.findUnique({
      where: { id: commentIdNum },
      select: { id: true, authorId: true },
    });
    if (!comment || comment.authorId !== userIdNum) {
      return NextResponse.json({ error: 'コメントを更新する権限がありません。' }, { status: 403 });
    }

    const updated = await prisma.comments.update({
      where: { id: commentIdNum },
      data: {
        content: raw.content.trim(),
        updatedAt: new Date(), // ← 必須フィールド
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
 * - 作成者 / キャラクター作成者 / 管理者 が削除可能
 */
export async function DELETE(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  const p = (context?.params ?? {}) as { id?: string; commentId?: string };
  const commentIdNum = Number.parseInt(p.commentId ?? '', 10);
  if (!Number.isFinite(commentIdNum)) {
    return NextResponse.json({ error: '無効なコメントIDです。' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userIdNum = Number.parseInt(String(session.user.id), 10);
  const userRole = (session.user as { role?: string }).role;

  try {
    const comment = await prisma.comments.findUnique({
      where: { id: commentIdNum },
      select: {
        authorId: true,
        characters: { select: { author_id: true } }, // キャラクター作成者
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