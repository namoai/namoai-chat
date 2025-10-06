export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from "@/lib/prisma";
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ▼▼▼【追加】インポート元と先の画像のデータ型を定義します ▼▼▼
type SourceImageData = {
    imageUrl: string;
    keyword: string | null;
    isMain: boolean;
    displayOrder: number;
};

type NewImageData = {
    imageUrl: string;
    keyword: string;
    isMain: boolean;
    displayOrder: number;
};
// ▲▲▲【追加】ここまで ▲▲▲

// ▼▼▼【追加】Lorebookのデータ型を定義します ▼▼▼
type LorebookData = {
    content: string;
    keywords: string[];
};
// ▲▲▲【追加】ここまで ▲▲▲

// URLからキャラクターIDを抽出するヘルパー関数
function getCharacterId(request: NextRequest): number | null {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const importIndex = segments.indexOf('import');
    if (importIndex > 0) {
        const idSegment = segments[importIndex - 1];
        const parsedId = parseInt(idSegment, 10);
        if (!isNaN(parsedId)) {
            return parsedId;
        }
    }
    return null;
}

// POST: 既存のキャラクターに別のキャラクターデータを上書き（インポート） - 同期処理
export async function POST(request: NextRequest) {
    console.log('[POST] /api/characters/[id]/import - 同期インポート処理開始');

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
    }
    const currentUserId = parseInt(session.user.id, 10);
    const targetCharacterId = getCharacterId(request);

    if (targetCharacterId === null) {
        return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
    }

    try {
        const sourceCharacterData = await request.json();
        const targetCharacter = await prisma.characters.findFirst({
            where: { id: targetCharacterId, author_id: currentUserId },
        });

        if (!targetCharacter) {
            return NextResponse.json({ error: 'キャラクターが見つからないか、権限がありません。' }, { status: 404 });
        }
        
        // STEP 1: 画像のダウンロードと再アップロード
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'characters';

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabaseの接続情報が不足しています。');
        }
        const sb = createClient(supabaseUrl, serviceRoleKey);

        // ▼▼▼【修正】'let'を'const'に変更し、'any[]'を上で定義した'NewImageData[]'型に変更します ▼▼▼
        const newImagesData: NewImageData[] = [];
        // ▲▲▲【修正】ここまで ▲▲▲
        const imageCount = sourceCharacterData.characterImages?.length || 0;
        console.log(`[IMPORT] コピー元の画像数: ${imageCount}枚`);

        if (imageCount > 0) {
            // ▼▼▼【修正】ループ内の'img'に上で定義した'SourceImageData'型を適用します ▼▼▼
            for (const [index, img] of sourceCharacterData.characterImages.entries() as [number, SourceImageData][]) {
            // ▲▲▲【修正】ここまで ▲▲▲
                console.log(`[IMPORT] 画像 ${index + 1}/${imageCount} の処理を開始: ${img.imageUrl}`);
                if (!img.imageUrl) continue;

                // ▼▼▼【重要】相対URLを絶対URLに変換 ▼▼▼
                let absoluteImageUrl = img.imageUrl;
                if (absoluteImageUrl.startsWith('/')) {
                    const requestUrl = new URL(request.url);
                    absoluteImageUrl = `${requestUrl.protocol}//${requestUrl.host}${absoluteImageUrl}`;
                    console.log(`[IMPORT] 相対URLを絶対URLに変換しました: ${absoluteImageUrl}`);
                }
                // ▲▲▲ 修正ここまで ▲▲▲

                try {
                    const response = await fetch(absoluteImageUrl); // 修正：絶対URLを使用
                    if (!response.ok) {
                        console.warn(`[IMPORT] 画像のフェッチに失敗: ${absoluteImageUrl}`);
                        continue;
                    };
                    
                    const imageBuffer = await response.arrayBuffer();
                    const contentType = response.headers.get('content-type') || 'application/octet-stream';
                    const fileExtension = img.imageUrl.split('.').pop()?.split('?')[0].toLowerCase() || 'png';
                    const safeFileName = `${randomUUID()}.${fileExtension}`;
                    const objectKey = `uploads/${safeFileName}`;

                    await sb.storage.from(bucket).upload(objectKey, Buffer.from(imageBuffer), { contentType });
                    const { data: pub } = sb.storage.from(bucket).getPublicUrl(objectKey);

                    newImagesData.push({
                        imageUrl: pub.publicUrl,
                        keyword: img.keyword || '',
                        isMain: img.isMain,
                        displayOrder: img.displayOrder,
                    });
                } catch (e) {
                    console.error(`[IMPORT] 画像処理エラー: ${absoluteImageUrl}`, e);
                }
            }
        }
        console.log(`[IMPORT] ${newImagesData.length}枚の画像の処理が完了。DB更新を開始...`);

        // STEP 2: データベースの更新
        await prisma.$transaction(async (tx) => {
            await tx.character_images.deleteMany({ where: { characterId: targetCharacterId } });
            await tx.lorebooks.deleteMany({ where: { characterId: targetCharacterId } });

            if (newImagesData.length > 0) {
                await tx.character_images.createMany({
                    data: newImagesData.map(img => ({ ...img, characterId: targetCharacterId })),
                });
            }

            if (Array.isArray(sourceCharacterData.lorebooks) && sourceCharacterData.lorebooks.length > 0) {
                await tx.lorebooks.createMany({
                    // ▼▼▼【修正】'lore'の型を'any'から上で定義した'LorebookData'型に変更します ▼▼▼
                    data: sourceCharacterData.lorebooks.map((lore: LorebookData) => ({
                    // ▲▲▲【修正】ここまで ▲▲▲
                        characterId: targetCharacterId,
                        content: lore.content,
                        keywords: lore.keywords,
                    })),
                });
            }

            const dataToUpdate = {
                name: sourceCharacterData.name,
                description: sourceCharacterData.description,
                systemTemplate: sourceCharacterData.systemTemplate,
                firstSituation: sourceCharacterData.firstSituation,
                firstMessage: sourceCharacterData.firstMessage,
                visibility: sourceCharacterData.visibility,
                safetyFilter: sourceCharacterData.safetyFilter,
                category: sourceCharacterData.category,
                hashtags: sourceCharacterData.hashtags,
                detailSetting: sourceCharacterData.detailSetting,
            };

            await tx.characters.update({
                where: { id: targetCharacterId },
                data: dataToUpdate,
            });
        });

        console.log(`[POST] キャラクターID ${targetCharacterId} のインポート成功`);
        return NextResponse.json({ message: "インポートに成功しました！" }, { status: 200 });

    } catch (error) {
        console.error(`[POST] インポート処理エラー (ID: ${targetCharacterId}):`, error);
        const errorMessage = error instanceof Error ? error.message : '不明なサーバーエラーが発生しました。';
        return NextResponse.json({ error: `インポート処理中にエラーが発生しました: ${errorMessage}` }, { status: 500 });
    }
}
