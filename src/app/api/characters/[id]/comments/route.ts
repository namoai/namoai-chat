// /api/characters/[id]/comments/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** 認証ユーザー最小型（NextAuth の user に id/role を期待する） */
type AuthUser = { id: string; role?: string };

/** Body 型: { content: string } を満たすか判定 */
function hasValidContent(body: unknown): body is { content: string } {
  if (!body || typeof body !== 'object') return false;
  // 'in' ガード + 型絞り込み（any 不使用）
  if (!('content' in body)) return false;
  const v = (body as { content: unknown }).content;
  return typeof v === 'string' && v.trim().length > 0;
}

/** ルートのコンテキスト型定義 */
interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * コメント一覧取得（GET）
 * - ルート: /api/characters/[id]/comments
 * - クエリ: ?take=20&cursor=123
 */
export async function GET(request: NextRequest, context: RouteContext) {
  // ▼ 文字列IDを数値へ
  const characterId = Number.parseInt(context.params.id, 10);
  if (Number.isNaN(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  // ▼ ページング値
  const url = new URL(request.url);
  const takeRaw = url.searchParams.get('take');
  const cursorRaw = url.searchParams.get('cursor');

  let take = Number.parseInt(takeRaw ?? '20', 10);
  if (Number.isNaN(take) || take < 1) take = 20;
  if (take > 100) take = 100;

  // ▼ Prisma 引数（まずはベースを確定）
  const args: Prisma.commentsFindManyArgs = {
    where: { characterId },
    take,
    orderBy: { createdAt: 'asc' },
    include: {
      users: { select: { id: true, nickname: true, image_url: true } },
    },
  };

  // ▼ cursor が数値なら cursor/skip を追加
  if (typeof cursorRaw === 'string') {
    const cursorId = Number.parseInt(cursorRaw, 10);
    if (!Number.isNaN(cursorId)) {
      args.cursor = { id: cursorId };
      args.skip = 1; // cursor 自身をスキップ
    }
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
 * - 認証必須
 * - Body: { content: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const characterId = Number.parseInt(context.params.id, 10);
  if (Number.isNaN(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  // ▼ 認証
  const session = await getServerSession(authOptions);
  const user = session?.user as AuthUser | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  // ▼ Body 検証（any 不使用）
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
        // Prisma スキーマ上、updatedAt は必須
        updatedAt: new Date(),
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