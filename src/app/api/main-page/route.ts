export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next'; // セッション取得のためにインポート
import { authOptions } from '@/lib/nextauth';

export async function GET() {
  // ▼▼▼ 変更点 1: ユーザーのセッションとフィルター設定を取得します ▼▼▼
  const session = await getServerSession(authOptions);
  let userSafetyFilter = true; // デフォルトはON（安全なコンテンツのみ表示）

  if (session?.user?.id) {
    const user = await prisma.users.findUnique({
      where: { id: parseInt(session.user.id, 10) },
      select: { safetyFilter: true }
    });
    // ユーザー設定が存在し、nullでないことを確認
    if (user && user.safetyFilter !== null) {
      userSafetyFilter = user.safetyFilter;
    }
  }

  // ▼▼▼ 変更点 2: フィルターがONの場合に適用するwhere句を定義します ▼▼▼
  // フィルターがON(true)なら { safetyFilter: true } を、OFF(false)なら {} を条件に加えます。
  const safetyWhereClause = userSafetyFilter ? { safetyFilter: true } : {};

  try {
    // 1. いま話題のキャラクター
    const trendingCharacters = await prisma.characters.findMany({
      where: safetyWhereClause, // フィルターを適用
      orderBy: {
        chat: {
          _count: 'desc',
        },
      },
      take: 10,
      include: {
        characterImages: { where: { isMain: true }, take: 1 },
      },
    });

    // 2. 新着人気キャラクターTOP10
    const newTopCharacters = await prisma.characters.findMany({
      where: safetyWhereClause, // フィルターを適用
      orderBy: [
        { createdAt: 'desc' },
        { favorites: { _count: 'desc' } }
      ],
      take: 10,
      include: {
        characterImages: { where: { isMain: true }, take: 1 },
        _count: {
          select: { favorites: true, chat: true }
        }
      },
    });
    
    // 3. 注目のキャラクター（ランダム）
    // 先にフィルターを適用したキャラクターの中からランダムに選びます
    const filteredCharacterIds = await prisma.characters.findMany({
        where: safetyWhereClause,
        select: { id: true }
    });
    const shuffled = filteredCharacterIds.sort(() => 0.5 - Math.random());
    const randomIds = shuffled.slice(0, 10).map(c => c.id);

    const specialCharacters = await prisma.characters.findMany({
        where: { id: { in: randomIds } }, // 既にフィルター済みなので、ここではIDだけで検索
        include: {
            characterImages: { where: { isMain: true }, take: 1 },
        }
    });

    // 4. 新規キャラクター紹介
    const generalCharacters = await prisma.characters.findMany({
      where: safetyWhereClause, // フィルターを適用
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        characterImages: { where: { isMain: true }, take: 1 },
      },
    });

    return NextResponse.json({
      trendingCharacters,
      newTopCharacters,
      specialCharacters,
      generalCharacters,
    });

  } catch (error) {
    console.error("メインページデータの取得エラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}

