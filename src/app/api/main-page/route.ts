export const runtime = 'nodejs';
export const dynamic = "force-dynamic"; // ▼▼▼【重要】キャッシュを無効化して常に最新データを取得 ▼▼▼

import { NextResponse } from 'next/server';
// ▼▼▼【修正】Prismaクライアントと型定義のインポート元を分離します ▼▼▼
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
// ▲▲▲【修正】ここまで ▲▲▲
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

// 代表画像を取得する共通ヘルパー関数
// ▼▼▼【修正】orderByの型名を、Prismaが生成する正しい型名に修正します ▼▼▼
const getCharactersWithMainImage = async (
    where: Prisma.charactersWhereInput, 
    orderBy: Prisma.charactersOrderByWithRelationInput | Prisma.charactersOrderByWithRelationInput[], 
    take: number
) => {
// ▲▲▲【修正】ここまで ▲▲▲
    const charactersRaw = await prisma.characters.findMany({
        where,
        orderBy,
        take,
        include: { 
            characterImages: { 
                orderBy: { displayOrder: 'asc' } 
            } 
        },
    });

    // ▼▼▼【修正】各キャラクターの代表画像を1枚だけ選択するロジック ▼▼▼
    return charactersRaw.map(char => {
        // isMainフラグがtrueの画像を優先的に探す
        let mainImage = char.characterImages.find(img => img.isMain);
        
        // isMainフラグの画像がない場合、表示順が一番最初の画像を選ぶ
        if (!mainImage && char.characterImages.length > 0) {
            mainImage = char.characterImages[0];
        }

        return {
            ...char,
            // characterImages配列を、見つかった代表画像1枚のみに置き換える
            // 画像が一つもない場合は空の配列になり、フロントエンドでプレースホルダーが表示される
            characterImages: mainImage ? [mainImage] : [],
        };
    });
    // ▲▲▲ 修正ここまで ▲▲▲
};


export async function GET() {
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;

    // ▼▼▼【修正】セーフティフィルター: nullの場合はtrue（フィルターON）として処理
    let userSafetyFilter = true;
    if (currentUserId) {
        const user = await prisma.users.findUnique({
            where: { id: currentUserId },
            select: { safetyFilter: true }
        });
        // nullの場合はtrue（フィルターON）として処理（デフォルト動作）
        userSafetyFilter = user?.safetyFilter ?? true;
    }
    const safetyWhereClause = userSafetyFilter ? { safetyFilter: { not: false } } : {}; // nullも許可（未設定）
    // ▲▲▲

    let blockedAuthorIds: number[] = [];
    if (currentUserId) {
        const blocks = await prisma.block.findMany({
            where: { blockerId: currentUserId },
            select: { blockingId: true }
        });
        blockedAuthorIds = blocks.map(b => b.blockingId);
    }
    const blockWhereClause = { author_id: { notIn: blockedAuthorIds } };

    const publicOnlyWhereClause = { visibility: 'public' };

    try {
        const baseWhere = { ...publicOnlyWhereClause, ...safetyWhereClause, ...blockWhereClause };

        // ナモアイフレンズ（公式キャラクター）を取得
        const officialCharacters = await getCharactersWithMainImage(
            { ...baseWhere, isOfficial: true }, 
            { createdAt: 'desc' }, 
            20
        );

        const trendingCharacters = await getCharactersWithMainImage(baseWhere, [{ chat: { _count: 'desc' } }, { favorites: { _count: 'desc' } }], 10);
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const newTopCharacters = await getCharactersWithMainImage({ ...baseWhere, createdAt: { gte: sevenDaysAgo } }, { chat: { _count: 'desc' } }, 10);

        const filteredCharacterIds = await prisma.characters.findMany({ where: baseWhere, select: { id: true } });
        const shuffled = filteredCharacterIds.sort(() => 0.5 - Math.random());
        const randomIds = shuffled.slice(0, 10).map(c => c.id);
        const specialCharacters = await getCharactersWithMainImage({ id: { in: randomIds } }, { createdAt: 'desc' }, 10);

        const generalCharacters = await getCharactersWithMainImage(baseWhere, { createdAt: 'desc' }, 10);

        return NextResponse.json({
            officialCharacters: officialCharacters || [],
            trendingCharacters: trendingCharacters || [],
            newTopCharacters: newTopCharacters || [],
            specialCharacters: specialCharacters || [],
            generalCharacters: generalCharacters || [],
        });

    } catch (error) {
        console.error("メインページデータの取得エラー:", error);
        return NextResponse.json({ error: "データの取得に失敗しました。" }, { status: 500 });
    }
}