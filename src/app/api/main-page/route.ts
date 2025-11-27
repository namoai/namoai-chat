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


// タイムアウト付きでクエリを実行するヘルパー関数
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    try {
        const timeoutPromise = new Promise<T>((_, reject) => {
            setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
        });
        return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
        console.error('Query timeout or error:', error);
        return fallback;
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;

        // ▼▼▼【修正】セーフティフィルター: nullの場合はtrue（フィルターON）として処理
        let userSafetyFilter = true;
        if (currentUserId) {
            try {
                const user = await withTimeout(
                    prisma.users.findUnique({
                        where: { id: currentUserId },
                        select: { safetyFilter: true }
                    }),
                    5000,
                    null
                );
                // nullの場合はtrue（フィルターON）として処理（デフォルト動作）
                userSafetyFilter = user?.safetyFilter ?? true;
            } catch (error) {
                console.error('User safety filter query error:', error);
                // デフォルト値を使用
            }
        }
        const safetyWhereClause = userSafetyFilter ? { safetyFilter: { not: false } } : {}; // nullも許可（未設定）
        // ▲▲▲

        let blockedAuthorIds: number[] = [];
        if (currentUserId) {
            try {
                const blocks = await withTimeout(
                    prisma.block.findMany({
                        where: { blockerId: currentUserId },
                        select: { blockingId: true }
                    }),
                    5000,
                    []
                );
                blockedAuthorIds = blocks.map(b => b.blockingId);
            } catch (error) {
                console.error('Block query error:', error);
                // 空配列を使用
            }
        }
        const blockWhereClause = { author_id: { notIn: blockedAuthorIds } };

        const publicOnlyWhereClause = { visibility: 'public' };
        const baseWhere = { ...publicOnlyWhereClause, ...safetyWhereClause, ...blockWhereClause };

        // 各クエリを並列実行し、タイムアウトを設定（部分失敗を許容）
        const [officialCharacters, trendingCharacters, newTopCharacters, specialCharacters, generalCharacters] = await Promise.allSettled([
            withTimeout(
                getCharactersWithMainImage({ ...baseWhere, isOfficial: true }, { createdAt: 'desc' }, 20),
                8000,
                []
            ),
            withTimeout(
                getCharactersWithMainImage(baseWhere, [{ favorites: { _count: 'desc' } }], 10),
                8000,
                []
            ),
            (async () => {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return await withTimeout(
                    getCharactersWithMainImage({ ...baseWhere, createdAt: { gte: sevenDaysAgo } }, { createdAt: 'desc' }, 10),
                    8000,
                    []
                );
            })(),
            (async () => {
                try {
                    const filteredCharacterIds = await withTimeout(
                        prisma.characters.findMany({ where: baseWhere, select: { id: true } }),
                        5000,
                        []
                    );
                    const shuffled = filteredCharacterIds.sort(() => 0.5 - Math.random());
                    const randomIds = shuffled.slice(0, 10).map(c => c.id);
                    return await withTimeout(
                        getCharactersWithMainImage({ id: { in: randomIds } }, { createdAt: 'desc' }, 10),
                        8000,
                        []
                    );
                } catch (error) {
                    console.error('Special characters query error:', error);
                    return [];
                }
            })(),
            withTimeout(
                getCharactersWithMainImage(baseWhere, { createdAt: 'desc' }, 10),
                8000,
                []
            ),
        ]);

        // 結果を抽出（失敗した場合は空配列を使用）
        const getResult = <T>(result: PromiseSettledResult<T>, fallback: T): T => {
            return result.status === 'fulfilled' ? result.value : fallback;
        };

        return NextResponse.json({
            officialCharacters: getResult(officialCharacters, []),
            trendingCharacters: getResult(trendingCharacters, []),
            newTopCharacters: getResult(newTopCharacters, []),
            specialCharacters: getResult(specialCharacters, []),
            generalCharacters: getResult(generalCharacters, []),
        });

    } catch (error) {
        console.error("メインページデータの取得エラー:", error);
        // エラー時も空のデータを返してフロントエンドがクラッシュしないようにする
        return NextResponse.json({
            officialCharacters: [],
            trendingCharacters: [],
            newTopCharacters: [],
            specialCharacters: [],
            generalCharacters: [],
        }, { status: 200 }); // 200を返してフロントエンドがエラーとして扱わないようにする
    }
}