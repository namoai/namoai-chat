export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ./src/app/api/characters/[id]/comments/[commentId]/route.ts
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/**
 * コメント取得（GET）
 * - ルート: /api/characters/[id]/comments/[commentId]
 * - ✅ Next.js 15 では params は Promise 扱い（id と commentId を含む）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
): Promise<Response> {
  // ビルド時の静的生成を回避（最優先）
  if (isBuildTime()) {
    return buildTimeResponse();
  }

  try {
    const { id, commentId } = await params; // ← await で展開
    const characterId = Number.parseInt(id, 10);
    const commentIdNum = Number.parseInt(commentId, 10);
    if (!Number.isFinite(characterId) || !Number.isFinite(commentIdNum)) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    // ビルド時には getPrisma を呼び出さない
    if (isBuildTime()) {
      return buildTimeResponse();
    }

    const prisma = await getPrisma();
    const comment = await prisma.comments.findFirst({
      where: { id: commentIdNum, characterId },
      include: {
        // Prisma field name is `image` (mapped to DB column `image_url`)
        users: { select: { id: true, nickname: true, image: true } },
      },
    });
    if (!comment) {
      return NextResponse.json({ error: '指定されたコメントが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json(comment);
  } catch (error) {
    // ビルド時のエラーを無視
    if (isBuildTime()) {
      return buildTimeResponse();
    }
    console.error('コメント取得エラー:', error);
    return NextResponse.json({ error: 'コメントの取得に失敗しました。' }, { status: 500 });
  }
}

/**
 * コメント削除（DELETE）
 * - ルート: /api/characters/[id]/comments/[commentId]
 * - 認証必須（session.user.id）
 * - ✅ Next.js 15 では params は Promise 扱い
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
): Promise<Response> {
  if (isBuildTime()) {
    return buildTimeResponse();
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
    }

    const userId = Number.parseInt(session.user.id, 10);
    const { id, commentId } = await params;
    const characterId = Number.parseInt(id, 10);
    const commentIdNum = Number.parseInt(commentId, 10);

    if (!Number.isFinite(characterId) || !Number.isFinite(commentIdNum)) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    const prisma = await getPrisma();
    
    // コメントの存在と権限確認
    const comment = await prisma.comments.findFirst({
      where: { id: commentIdNum, characterId },
    });

    if (!comment) {
      return NextResponse.json({ error: '指定されたコメントが見つかりません。' }, { status: 404 });
    }

    // コメントの作成者またはキャラクターの作成者만 삭제 가능
    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      select: { author_id: true },
    });

    const isAuthor = comment.authorId === userId;
    const isCharacterAuthor = character?.author_id === userId;

    if (!isAuthor && !isCharacterAuthor) {
      return NextResponse.json({ error: 'このコメントを削除する権限がありません。' }, { status: 403 });
    }

    // コメント削除
    await prisma.comments.delete({
      where: { id: commentIdNum },
    });

    return NextResponse.json({ success: true, message: 'コメントを削除しました。' });
  } catch (error) {
    console.error('コメント削除エラー:', error);
    return NextResponse.json({ error: 'コメントの削除に失敗しました。' }, { status: 500 });
  }
}