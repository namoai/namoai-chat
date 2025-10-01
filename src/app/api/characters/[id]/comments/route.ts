// ./src/app/api/characters/[id]/comments/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
// ❌ 不要: import type { Prisma } from '@prisma/client';

/** 認証ユーザーの最小型 */
type AuthUser = { id: string; role?: string };

/** Body:{ content:string } の妥当性チェック */
function hasValidContent(body: unknown): body is { content: string } {
  if (!body || typeof body !== 'object') return false;
  if (!('content' in body)) return false;
  const v = (body as { content?: unknown }).content;
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * コメント一覧取得（GET）
 * - クエリ `?take=数値` で件数を制御（デフォルト 20）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } } // ✅ App Router 形式で params を直接受け取る
) {
  const characterId = Number.parseInt(params.id, 10); // ✅ 直接 params.id を使用
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
        users: {
          select: { id: true, nickname: true, image_url: true },
        },
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
 * - 認証必須
 * - Body: { content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } } // ✅ App Router 形式で params を直接受け取る
) {
  const characterId = Number.parseInt(params.id, 10); // ✅ 直接 params.id を使用
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