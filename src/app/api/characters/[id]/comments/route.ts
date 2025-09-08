// src/app/api/characters/[id]/comments/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** 認証ユーザー最小型（NextAuth の user に id/role を期待する） */
type AuthUser = {
  id: string;
  role?: string;
};

/** コメント作成リクエストの型 */
interface CreateCommentBody {
  content: string;
}

/** Type Guard: CreateCommentBody */
function isCreateCommentBody(value: unknown): value is CreateCommentBody {
  if (!value || typeof value !== 'object') return false;
  const v = value as { content?: unknown };
  return typeof v.content === 'string' && v.content.trim().length > 0;
}

/**
 * コメント一覧取得（GET）
 * - ルートパラメータ: { id } = キャラクターID
 * - ページネーション: /?take=20&cursor=123 のように指定可能
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // キャラクターIDの検証
  const characterId = Number.parseInt(id, 10);
  if (Number.isNaN(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  // クエリパラメータ
  const url = new URL(request.url);
  const takeRaw = url.searchParams.get('take');
  const cursorRaw = url.searchParams.get('cursor');

  let take = Number.parseInt(takeRaw ?? '20', 10);
  if (Number.isNaN(take) || take < 1) take = 20;
  if (take > 100) take = 100;

  // Prisma 引数を構築
  const baseArgs: Prisma.commentsFindManyArgs = {
    where: { characterId },
    take,
    orderBy: { createdAt: 'asc' },
    include: {
      users: {
        select: { id: true, nickname: true, image_url: true },
      },
    },
  };

  if (typeof cursorRaw === 'string') {
    const cursorId = Number.parseInt(cursorRaw, 10);
    if (!Number.isNaN(cursorId)) {
      baseArgs.cursor = { id: cursorId };
      baseArgs.skip = 1;
    }
  }

  try {
    const comments = await prisma.comments.findMany(baseArgs);
    return NextResponse.json({ comments }, { status: 200 });
  } catch (error) {
    console.error('コメント一覧取得エラー:', error);
    return NextResponse.json({ error: 'コメント一覧の取得に失敗しました。' }, { status: 500 });
  }
}

/**
 * コメント作成（POST）
 * - 認証必須
 * - Body: { content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const characterId = Number.parseInt(id, 10);
  if (Number.isNaN(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  // 認証チェック
  const session = await getServerSession(authOptions);
  const user = session?.user as AuthUser | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  // リクエストボディ検証
  const bodyUnknown = (await request.json().catch(() => null)) as unknown;
  if (!isCreateCommentBody(bodyUnknown)) {
    return NextResponse.json({ error: 'content は必須です。' }, { status: 400 });
  }

  try {
    const created = await prisma.comments.create({
      data: {
        content: bodyUnknown.content.trim(),
        characterId,
        authorId: Number.parseInt(user.id, 10),
        updatedAt: new Date(), // ← スキーマで必須なので必ず指定
      },
      include: {
        users: {
          select: { id: true, nickname: true, image_url: true },
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('コメント作成エラー:', error);
    return NextResponse.json({ error: 'コメントの作成に失敗しました。' }, { status: 500 });
  }
}