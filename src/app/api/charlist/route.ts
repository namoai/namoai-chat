export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ▼▼▼【重要】キャッシュを無効化して常に最新データを取得 ▼▼▼

import { NextResponse, NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

type CharacterItem = {
  id: number;
  name: string;
  description: string | null;
  characterImages: { imageUrl: string }[];
  hashtags: string[];
  createdAt: string;
  counts: {
    interactions: number;
    likes: number;
  };
};

type SortParam = "newest" | "popular" | "likes";

export async function GET(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const tagParam = searchParams.get("tag");
    const sortParam = (searchParams.get("sort") ?? "newest") as SortParam;

    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;
    
    // ▼▼▼【追加】セーフティフィルターとブロック機能の共通ロジック ▼▼▼
    // nullの場合はtrue（フィルターON）として処理（デフォルト動作）
    let userSafetyFilter = true;
    if (currentUserId) {
      const user = await prisma.users.findUnique({
        where: { id: currentUserId },
        select: { safetyFilter: true }
      });
      userSafetyFilter = user?.safetyFilter ?? true;
    }
    const safetyWhereClause = userSafetyFilter ? { safetyFilter: { not: false } } : {}; // nullも許可（未設定）

    let blockedAuthorIds: number[] = [];
    if (currentUserId) {
        const blocks = await prisma.block.findMany({
            where: { blockerId: currentUserId },
            select: { blockingId: true }
        });
        blockedAuthorIds = blocks.map(b => b.blockingId);
    }
    const blockWhereClause = { author_id: { notIn: blockedAuthorIds } };
    // ▲▲▲【追加】共通ロジックここまで ▲▲▲

    const tagWhere: Prisma.charactersWhereInput =
      tagParam && tagParam !== "全体"
        ? { hashtags: { has: tagParam } }
        : {};

    let orderBy: Prisma.charactersOrderByWithRelationInput;
    switch (sortParam) {
      case "popular":
        orderBy = {
          interactions: { _count: "desc" },
        } as unknown as Prisma.charactersOrderByWithRelationInput;
        break;
      case "likes":
        orderBy = {
          favorites: { _count: "desc" },
        } as unknown as Prisma.charactersOrderByWithRelationInput;
        break;
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    const pageParam = searchParams.get("page");
    const page = Math.max(1, Number(pageParam) || 1);
    const PAGE_SIZE = 30;
    const skip = (page - 1) * PAGE_SIZE;

    const where: Prisma.charactersWhereInput = {
      ...tagWhere,
      ...safetyWhereClause,
      ...blockWhereClause,
    };

    const [rows, totalCount, allTagRows] = await Promise.all([
      prisma.characters.findMany({
        where,
        orderBy,
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          description: true,
          hashtags: true,
          createdAt: true,
          characterImages: {
            select: { imageUrl: true },
            take: 1,
          },
          _count: {
            select: {
              interactions: true,
              favorites: true,
            },
          },
        },
      }),
      prisma.characters.count({ where }),
      prisma.characters.findMany({
        where: {
          ...safetyWhereClause,
          ...blockWhereClause,
        },
        select: { hashtags: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const characters: CharacterItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      characterImages: r.characterImages ?? [],
      hashtags: r.hashtags ?? [],
      createdAt: r.createdAt.toISOString(),
      counts: {
        interactions: r._count.interactions,
        likes: r._count.favorites,
      },
    }));

    const uniqueTags = Array.from(
      new Set(allTagRows.flatMap((c) => c.hashtags ?? []))
    );

    return NextResponse.json({
      characters,
      tags: ["全体", ...uniqueTags],
      page,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error("キャラクター一覧APIエラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}