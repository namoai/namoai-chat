// src/app/api/characters/[id]/like/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

/**
 * キャラクターに「いいね」を付与（POST）
 * - 認証必須
 * - context の型は any にしてランタイム検証を回避
 */
export async function POST(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  const { id } = (context?.params ?? {}) as { id?: string };
  const characterId = Number.parseInt(id ?? '', 10);

  if (!Number.isFinite(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  // 認証確認
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userId = Number.parseInt(String(session.user.id), 10);

  try {
    // 既にいいねしているか確認
    const existing = await prisma.favorites.findUnique({
      where: { user_id_character_id: { user_id: userId, character_id: characterId } },
    });

    if (existing) {
      return NextResponse.json({ message: 'すでにいいね済みです。' }, { status: 200 });
    }

    // いいねを作成
    const created = await prisma.favorites.create({
      data: {
        user_id: userId,
        character_id: characterId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('いいね作成エラー:', error);
    return NextResponse.json({ error: 'いいねの作成に失敗しました。' }, { status: 500 });
  }
}