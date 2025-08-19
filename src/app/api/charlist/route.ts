// src/app/api/charlist/route.ts
export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * キャラクター一覧 API
 * - クエリ:
 *   - tag: string | null  … ハッシュタグ絞り込み（"全体" または空/nullなら全件）
 *   - sort: 'newest' | 'popular' | 'likes'  … 並び順（既定: newest）
 *
 * レスポンス:
 * {
 *   characters: CharacterItem[];
 *   tags: string[]; // ['全体', ...ユニークなタグ]
 * }
 *
 * ※ 注意：Prisma モデル名が schema.prisma で `characters` の場合、
 *   生成される型は `Prisma.charactersWhereInput` のように “小文字/複数形” になります。
 *   （今回のビルドエラーはここが原因です）
 */

// UIに返すアイテム型（必要最小限＋フロントで使用する項目）
type CharacterItem = {
  id: number;
  name: string;
  description: string | null;
  characterImages: { imageUrl: string }[];
  hashtags: string[];
  createdAt: string; // ISO 文字列
  counts: {
    interactions: number; // チャット数などの人気指標
    likes: number; // いいね数
  };
};

type SortParam = "newest" | "popular" | "likes";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagParam = searchParams.get("tag");
    const sortParam = (searchParams.get("sort") ?? "newest") as SortParam;

    // ---- フィルタ（タグ） -----------------------------
    // Prisma の string[] カラムに対しては { has: tag } で絞り込み
    const where: Prisma.charactersWhereInput =
      tagParam && tagParam !== "全体"
        ? { hashtags: { has: tagParam } }
        : {};

    // ---- 並び順 --------------------------------------
    // relation 件数で並び替える場合の orderBy を型安全に組み立て
    let orderBy: Prisma.charactersOrderByWithRelationInput;

    switch (sortParam) {
      case "popular":
        // 関連テーブル interactions の件数降順
        orderBy = { interactions: { _count: "desc" } } as unknown as Prisma.charactersOrderByWithRelationInput;
        break;
      case "likes":
        // 関連テーブル favorites の件数降順
        orderBy = { favorites: { _count: "desc" } } as unknown as Prisma.charactersOrderByWithRelationInput;
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    // ---- データ取得 ----------------------------------
    // 必要な列 + _count（interactions, favorites）+ 画像/説明 を取得
    const rows = await prisma.characters.findMany({
      where,
      orderBy,
      select: {
        id: true,
        name: true,
        description: true,
        hashtags: true,
        createdAt: true,
        characterImages: {
          select: { imageUrl: true },
          take: 1, // 一枚だけ使う想定なら最初の1件に限定
        },
        _count: {
          select: {
            interactions: true,
            favorites: true,
          },
        },
      },
    });

    // UI 向けに整形
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

    // ---- タグ一覧（ユニーク化） -----------------------
    // 画面のタブ/フィルタに使用（先頭は「全体」固定）
    const uniqueTags = Array.from(
      new Set(rows.flatMap((c) => c.hashtags ?? []))
    );

    return NextResponse.json({ characters, tags: ["全体", ...uniqueTags] });
  } catch (error) {
    // ここで例外を握りつぶさずログに残す
    console.error("キャラクター一覧APIエラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}