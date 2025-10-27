export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from "@/lib/prisma";
import { createClient } from '@supabase/supabase-js';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { randomUUID } from 'crypto';

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


// --- Google Secret Manager関連のコード ---
async function ensureGcpCredsFile() {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;
    if (!raw && !b64) return;

    const fs = await import('node:fs/promises');
    const path = '/tmp/gcp-sa.json';
    const content = raw ?? Buffer.from(b64!, 'base64').toString('utf8');
    await fs.writeFile(path, content, { encoding: 'utf8' });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
}

async function resolveGcpProjectId(): Promise<string> {
    const envProject =
        process.env.GCP_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GOOGLE_PROJECT_ID;
    if (envProject && envProject.trim().length > 0) return envProject.trim();

    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;
    try {
        if (raw || b64) {
            const jsonStr = raw ?? Buffer.from(b64!, 'base64').toString('utf8');
            const parsed = JSON.parse(jsonStr);
            if (typeof parsed?.project_id === 'string' && parsed.project_id) {
                return parsed.project_id;
            }
        }
    } catch { }

    try {
        const fs = await import('node:fs/promises');
        const path = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/tmp/gcp-sa.json';
        const buf = await fs.readFile(path, { encoding: 'utf8' });
        const parsed = JSON.parse(buf);
        if (typeof parsed?.project_id === 'string' && parsed.project_id) {
            return parsed.project_id;
        }
    } catch { }

    throw new Error('GCP project id が存在しません');
}

async function loadSecret(name: string, version = 'latest') {
    const projectId = await resolveGcpProjectId();
    const client = new SecretManagerServiceClient({ fallback: true });
    const [acc] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${name}/versions/${version}`,
    });
    const value = acc.payload?.data ? Buffer.from(acc.payload.data).toString('utf8') : '';
    return value.trim(); // ▼▼▼【重要】前後の空白・改行を削除
}

async function ensureSupabaseEnv() {
    await ensureGcpCredsFile();

    if (!process.env.SUPABASE_URL) {
        process.env.SUPABASE_URL = await loadSecret('SUPABASE_URL');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = await loadSecret('SUPABASE_SERVICE_ROLE_KEY');
    }

    // ▼▼▼【重要】Netlify環境変数に含まれる可能性のある空白・改行・タブを全て削除
    if (process.env.SUPABASE_URL) {
        process.env.SUPABASE_URL = process.env.SUPABASE_URL.replace(/\s/g, '');
    }
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.replace(/\s/g, '');
    }
    // ▲▲▲
}
// --- Google Secret Manager関連のコードここまで ---


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
        await ensureSupabaseEnv();

        const sourceCharacterData = await request.json();
        const targetCharacter = await prisma.characters.findFirst({
            where: { id: targetCharacterId, author_id: currentUserId },
        });

        if (!targetCharacter) {
            return NextResponse.json({ error: 'キャラクターが見つからないか、権限がありません。' }, { status: 404 });
        }
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'characters';

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabaseの接続情報が不足しています。');
        }
        const sb = createClient(supabaseUrl, serviceRoleKey);

        // --- ▼▼▼【修正】'let'を'const'に、'any[]'を'NewImageData[]'型に変更します ▼▼▼ ---
        const newImagesData: NewImageData[] = [];
        // --- ▲▲▲ 修正ここまで ▲▲▲
        const imageCount = sourceCharacterData.characterImages?.length || 0;

        if (imageCount > 0) {
            // --- ▼▼▼【修正】ループ内の'img'に'SourceImageData'型を適用します ▼▼▼ ---
            for (const img of sourceCharacterData.characterImages as SourceImageData[]) {
            // --- ▲▲▲ 修正ここまで ▲▲▲
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

