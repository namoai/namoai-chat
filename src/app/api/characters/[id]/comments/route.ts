export const runtime = 'nodejs';

// ./src/app/api/characters/[id]/comments/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

/** Body 型: { content: string } を満たすか判定（作成用） */
function hasValidContent(body: unknown): body is { content: string } {
  if (!body || typeof body !== 'object') return false;
  if (!('content' in body)) return false;
  const v = (body as { content?: unknown }).content;
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * コメント一覧取得（GET）
 * - ルート: /api/characters/[id]/comments
 * - クエリ: ?take=数値（デフォルト 20）
 * - 認証不要
 * - ✅ Next.js 15 では params は Promise 扱い
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // ← ここを Promise に
): Promise<Response> {
  const { id } = await params; // ← await で展開
  const characterId = Number.parseInt(id, 10);
  if (!Number.isFinite(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  const url = new URL(request.url);
  const takeRaw = url.searchParams.get('take');
  const take = Number.isFinite(Number(takeRaw)) ? Number(takeRaw) : 20;

  try {
    const comments = await prisma.comments.findMany({
      where: { characterId },
      take,
      orderBy: { createdAt: 'asc' },
      include: {
        users: { select: { id: true, nickname: true, image_url: true } },
      },
    });
    return NextResponse.json({ comments });
  } catch (error) {
    console.error('コメント一覧取得エラー:', error);
    return NextResponse.json({ error: 'コメント一覧の取得に失敗しました。' }, { status: 500 });
  }
}

/**
 * コメント作成（POST）
 * - ルート: /api/characters/[id]/comments
 * - 認証必須（session.user.id）
 * - Body: { content: string }
 * - ✅ Next.js 15 では params は Promise 扱い
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // ← ここを Promise に
): Promise<Response> {
  const { id } = await params; // ← await で展開
  const characterId = Number.parseInt(id, 10);
  if (!Number.isFinite(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user?.id ?? '').toString();
  if (!userId) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const raw = (await request.json().catch(() => null)) as unknown;
  if (!hasValidContent(raw)) {
    return NextResponse.json({ error: 'content は必須です。' }, { status: 400 });
  }

  try {
    const created = await prisma.comments.create({
      data: {
        content: raw.content.trim(),
        characterId,
        authorId: Number.parseInt(userId, 10),
      },
      include: {
        users: { select: { id: true, nickname: true, image_url: true } },
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('コメント作成エラー:', error);
    return NextResponse.json({ error: 'コメントの作成に失敗しました。' }, { status: 500 });
  }
}