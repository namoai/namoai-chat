import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** 認証ユーザー最小型 */
type AuthUser = { id: string; role?: string };

/** Body: { content: string } の判定 */
function hasValidContent(body: unknown): body is { content: string } {
  if (!body || typeof body !== 'object') return false;
  if (!('content' in body)) return false;
  const v = (body as { content?: unknown }).content;
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * コメント一覧取得（GET）
 * - /api/characters/[id]/comments?take=20&cursor=123
 */
export async function GET(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  const characterId = Number.parseInt(String(context?.params?.id ?? ''), 10);
  if (!Number.isFinite(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  const url = new URL(request.url);
  const takeRaw = url.searchParams.get('take');
  const cursorRaw = url.searchParams.get('cursor');

  let take = Number.parseInt(takeRaw ?? '20', 10);
  if (!Number.isFinite(take) || take < 1) take = 20;
  if (take > 100) take = 100;

  const args: Prisma.commentsFindManyArgs = {
    where: { characterId },
    take,
    orderBy: { createdAt: 'asc' },
    include: {
      users: { select: { id: true, nickname: true, image_url: true } },
    },
  };

  const cursorId = Number.parseInt(cursorRaw ?? '', 10);
  if (Number.isFinite(cursorId)) {
    args.cursor = { id: cursorId };
    args.skip = 1;
  }

  try {
    const comments = await prisma.comments.findMany(args);
    return NextResponse.json({ comments }, { status: 200 });
  } catch (error) {
    console.error('コメント一覧取得エラー:', error);
    return NextResponse.json({ error: 'コメント一覧の取得に失敗しました。' }, { status: 500 });
  }
}

/**
 * コメント作成（POST）
 * - 認証必須 / Body: { content }
 * - Prismaスキーマの都合で updatedAt は必須
 */
export async function POST(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  const characterId = Number.parseInt(String(context?.params?.id ?? ''), 10);
  if (!Number.isFinite(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const user = session?.user as AuthUser | undefined;
  if (!user?.id) {
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
        authorId: Number.parseInt(user.id, 10),
        updatedAt: new Date(), // ← 必須
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