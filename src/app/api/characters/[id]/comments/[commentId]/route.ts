export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ./src/app/api/characters/[id]/comments/[commentId]/route.ts
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
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