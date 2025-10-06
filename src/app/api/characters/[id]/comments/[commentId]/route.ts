export const runtime = 'nodejs';
// ./src/app/api/characters/[id]/comments/[commentId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * コメント取得（GET）
 * - ルート: /api/characters/[id]/comments/[commentId]
 * - ✅ Next.js 15 では params は Promise 扱い（id と commentId を含む）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
): Promise<Response> {
  const { id, commentId } = await params; // ← await で展開
  const characterId = Number.parseInt(id, 10);
  const commentIdNum = Number.parseInt(commentId, 10);
  if (!Number.isFinite(characterId) || !Number.isFinite(commentIdNum)) {
    return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
  }

  try {
    const comment = await prisma.comments.findFirst({
      where: { id: commentIdNum, characterId },
      include: {
        users: { select: { id: true, nickname: true, image_url: true } },
      },
    });
    if (!comment) {
      return NextResponse.json({ error: '指定されたコメントが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json(comment);
  } catch (error) {
    console.error('コメント取得エラー:', error);
    return NextResponse.json({ error: 'コメントの取得に失敗しました。' }, { status: 500 });
  }
}