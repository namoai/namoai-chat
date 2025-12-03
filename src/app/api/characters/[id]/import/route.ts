export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from "@/lib/prisma";
import { randomUUID } from 'crypto';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import { uploadImageBufferToCloudflare } from '@/lib/cloudflare-images';
import JSZip from 'jszip';

// --- ▼▼▼【修正】データ型を明確に定義します ▼▼▼ ---
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

type LorebookData = {
    content: string;
    keywords: string[];
};
// --- ▲▲▲ 修正ここまで ▲▲▲ ---


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

export async function POST(request: NextRequest) {
    if (isBuildTime()) return buildTimeResponse();
    
    console.log('[POST] /api/characters/[id]/import - 同期インポート処理開始');

    const prisma = await getPrisma();
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
        const contentType = request.headers.get('content-type') || '';
        let sourceCharacterData: any;

        // ZIPファイルの場合は解凍してcharacter.jsonを取得
        if (contentType.includes('multipart/form-data') || contentType.includes('application/zip')) {
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            
            if (!file) {
                return NextResponse.json({ error: 'ZIPファイルが提供されていません。' }, { status: 400 });
            }

            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // character.jsonを取得
            const characterJsonFile = zip.file('character.json');
            if (!characterJsonFile) {
                return NextResponse.json({ error: 'ZIPファイルにcharacter.jsonが見つかりません。' }, { status: 400 });
            }

            const characterJsonText = await characterJsonFile.async('string');
            sourceCharacterData = JSON.parse(characterJsonText);

            // 画像をZIPから取得してアップロード
            const imagesFolder = zip.folder('images');
            if (imagesFolder && sourceCharacterData.characterImages) {
                const imageFiles = Object.keys(imagesFolder.files);
                const imageMap = new Map<string, Buffer>();

                for (const imagePath of imageFiles) {
                    const imageFile = imagesFolder.file(imagePath);
                    if (imageFile) {
                        const imageBuffer = await imageFile.async('nodebuffer');
                        imageMap.set(imagePath, imageBuffer);
                    }
                }

                // characterImagesの順序に合わせて画像をマッピング
                for (let i = 0; i < sourceCharacterData.characterImages.length; i++) {
                    const img = sourceCharacterData.characterImages[i];
                    // 元のimageUrlからファイル名を推測してマッピング
                    const imageKey = Object.keys(imageMap).find(key => 
                        key.includes(`image_${i}`) || key.includes(img.imageUrl?.split('/').pop() || '')
                    );
                    
                    if (imageKey && imageMap.has(imageKey)) {
                        // ZIP内の画像を使用
                        img._zipImageBuffer = imageMap.get(imageKey);
                    }
                }
            }
        } else {
            // JSON形式の場合は従来通り
            sourceCharacterData = await request.json();
        }

        const targetCharacter = await prisma.characters.findFirst({
            where: { id: targetCharacterId, author_id: currentUserId },
        });

        if (!targetCharacter) {
            return NextResponse.json({ error: 'キャラクターが見つからないか、権限がありません。' }, { status: 404 });
        }

        // --- ▼▼▼【修正】'let'を'const'に、'any[]'を'NewImageData[]'型に変更します ▼▼▼ ---
        const newImagesData: NewImageData[] = [];
        // --- ▲▲▲ 修正ここまで ▲▲▲
        const imageCount = sourceCharacterData.characterImages?.length || 0;

        if (imageCount > 0) {
            // --- ▼▼▼【修正】ループ内の'img'に'SourceImageData'型を適用します ▼▼▼ ---
            for (const img of sourceCharacterData.characterImages as (SourceImageData & { _zipImageBuffer?: Buffer })[]) {
            // --- ▲▲▲ 修正ここまで ▲▲▲
                // ZIP内の画像がある場合はそれを使用
                if (img._zipImageBuffer) {
                    try {
                        const fileExtension = img.imageUrl?.split('.').pop()?.split('?')[0].toLowerCase() || 'png';
                        const safeFileName = `${randomUUID()}.${fileExtension}`;
                        const contentType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;

                        const imageUrl = await uploadImageBufferToCloudflare(img._zipImageBuffer, {
                            filename: safeFileName,
                            contentType,
                        });

                        newImagesData.push({
                            imageUrl: imageUrl,
                            keyword: img.keyword || '',
                            isMain: img.isMain,
                            displayOrder: img.displayOrder,
                        });
                    } catch (e) {
                        console.error(`[IMPORT] ZIP画像アップロードエラー:`, e);
                    }
                    continue;
                }

                // 従来通りURLから画像をダウンロード
                if (!img.imageUrl) continue;

                let absoluteImageUrl = img.imageUrl;
                if (absoluteImageUrl.startsWith('/')) {
                    const requestUrl = new URL(request.url);
                    absoluteImageUrl = `${requestUrl.protocol}//${requestUrl.host}${absoluteImageUrl}`;
                }

                try {
                    const response = await fetch(absoluteImageUrl);
                    if (!response.ok) continue;
                    
                    const imageBuffer = await response.arrayBuffer();
                    const contentType = response.headers.get('content-type') || 'application/octet-stream';
                    const fileExtension = img.imageUrl.split('.').pop()?.split('?')[0].toLowerCase() || 'png';
                    const safeFileName = `${randomUUID()}.${fileExtension}`;

                    const imageUrl = await uploadImageBufferToCloudflare(Buffer.from(imageBuffer), {
                        filename: safeFileName,
                        contentType,
                    });

                    newImagesData.push({
                        imageUrl: imageUrl,
                        keyword: img.keyword || '',
                        isMain: img.isMain,
                        displayOrder: img.displayOrder,
                    });
                } catch (e) {
                    console.error(`[IMPORT] 画像処理エラー: ${absoluteImageUrl}`, e);
                }
            }
        }
        
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
                    // --- ▼▼▼【修正】'lore'の型を'LorebookData'型に変更します ▼▼▼ ---
                    data: sourceCharacterData.lorebooks.map((lore: LorebookData) => ({
                    // --- ▲▲▲ 修正ここまで ▲▲▲
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

        return NextResponse.json({ message: "インポートに成功しました！" }, { status: 200 });

    } catch (error) {
        console.error(`[POST] インポート処理エラー (ID: ${targetCharacterId}):`, error);
        const errorMessage = error instanceof Error ? error.message : '不明なサーバーエラーが発生しました。';
        return NextResponse.json({ error: `インポート処理中にエラーが発生しました: ${errorMessage}` }, { status: 500 });
    }
}

