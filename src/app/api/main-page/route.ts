export const runtime = 'nodejs';
export const dynamic = "force-dynamic"; // ▼▼▼【重要】キャッシュを無効化して常に最新データを取得 ▼▼▼

import { NextResponse } from 'next/server';
// ▼▼▼【修正】Prismaクライアントと型定義のインポート元を分離します ▼▼▼
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
// ▲▲▲【修正】ここまで ▲▲▲
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// 代表画像を取得する共通ヘルパー関数
// ▼▼▼【修正】orderByの型名を、Prismaが生成する正しい型名に修正します ▼▼▼
const getCharactersWithMainImage = async (
    where: Prisma.charactersWhereInput, 
    orderBy: Prisma.charactersOrderByWithRelationInput | Prisma.charactersOrderByWithRelationInput[], 
    take: number
) => {
// ▲▲▲【修正】ここまで ▲▲▲
    // ビルド時には空配列を返す
    if (isBuildTime()) {
        return [];
    }
    
    const prisma = await getPrisma();
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
    // デバッグ用ログ
    console.log('[main-page] Environment check:', {
        NEXT_PHASE: process.env.NEXT_PHASE,
        NODE_ENV: process.env.NODE_ENV,
        NETLIFY_FUNCTION: process.env.NETLIFY_FUNCTION,
        DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not set',
        isBuildTime: isBuildTime()
    });
    
    if (isBuildTime()) {
        console.log('[main-page] Build time detected, returning 503');
        return buildTimeResponse();
    }
    
    let prisma;
    try {
        console.log('[main-page] Attempting to get Prisma client...');
        prisma = await getPrisma();
        console.log('[main-page] Prisma client obtained successfully');
    } catch (error) {
        console.error('[main-page] Prisma initialization error:', error);
        // ビルド時エラーをキャッチ
        if (error instanceof Error && error.message.includes('Prisma is not available during build time')) {
            console.log('[main-page] Build time error detected, returning 503');
            return buildTimeResponse();
        }
        // その他のエラーは詳細を返す
        return NextResponse.json({ 
            error: 'Database connection failed', 
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
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

        const trendingCharacters = await getCharactersWithMainImage(baseWhere, [{ favorites: { _count: 'desc' } }], 10);
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const newTopCharacters = await getCharactersWithMainImage({ ...baseWhere, createdAt: { gte: sevenDaysAgo } }, { createdAt: 'desc' }, 10);

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
        console.error("[main-page] データ取得エラー:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error("[main-page] エラー詳細:", { errorMessage, errorStack });
        return NextResponse.json({ 
            error: "データの取得に失敗しました。",
            details: errorMessage
        }, { status: 500 });
    }
}