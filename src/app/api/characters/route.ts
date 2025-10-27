export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { createClient } from '@supabase/supabase-js';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { randomUUID } from 'crypto';
import OpenAI from 'openai'; // ★ OpenAIクライアントをインポート

// =================================================================================
//  型定義 (Type Definitions)
// =================================================================================

type LorebookData = {
    content: string;
    keywords: string[];
};

type CharacterImageInput = {
    imageUrl: string;
    keyword: string | null;
    isMain: boolean;
    displayOrder: number;
};

type ImageMetaData = {
    url: string;
    keyword: string;
    isMain: boolean;
    displayOrder: number;
};

// =================================================================================
//  クライアント初期化 (Client Initialization)
// =================================================================================

// ★ OpenAIクライアント (Embedding生成用)
// ▼▼▼【重要】遅延初期化 - Secret Manager から OPENAI_API_KEY をロードした後に使用
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const rawApiKey = process.env.OPENAI_API_KEY;
    const cleanedApiKey = rawApiKey
      ?.replace(/\s/g, '')
      .replace(/\\n|\\r|\\t/g, '');

    openaiClient = new OpenAI({
      apiKey: cleanedApiKey,
      baseURL: 'https://api.openai.com/v1', // ▼▼▼【重要】Netlify AI Gatewayをバイパスして直接OpenAI APIを呼び出す
    });
  }
  return openaiClient;
}

// =================================================================================
//  ヘルパー関数 (Helper Functions)
// =================================================================================

/**
 * テキストをベクトルに変換するヘルパー関数
 * @param text ベクトル化するテキスト
 * @returns テキストのベクトル表現
 */
async function getEmbedding(text: string): Promise<number[]> {
  if (!text) return [];
  const sanitizedText = text.replace(/\n/g, ' ');
  const openai = getOpenAIClient(); // ▼▼▼【重要】遅延初期化されたクライアントを取得
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: sanitizedText,
  });
  return response.data[0].embedding;
}

/**
 * GCP の認証ファイルを /tmp に生成（必要な場合のみ）
 */
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

/**
 * GCP プロジェクトIDを解決
 */
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

/**
 * Secret Manager からシークレットを取得
 */
async function loadSecret(name: string, version = 'latest') {
    const projectId = await resolveGcpProjectId();
    const client = new SecretManagerServiceClient({ fallback: true });
    const [acc] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${name}/versions/${version}`,
    });
    const value = acc.payload?.data ? Buffer.from(acc.payload.data).toString('utf8') : '';
    return value.trim(); // ▼▼▼【重要】前後の空白・改行を削除
}

/**
 * Supabase 接続に必要な環境変数を準備
 */
async function ensureSupabaseEnv() {
    await ensureGcpCredsFile();

    if (!process.env.SUPABASE_URL) {
        process.env.SUPABASE_URL = await loadSecret('SUPABASE_URL');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = await loadSecret('SUPABASE_SERVICE_ROLE_KEY');
    }
    // ▼▼▼【重要】OPENAI_API_KEY を Secret Manager から強制取得（Netlify環境変数より優先）
    try {
        const openaiKeyFromGSM = await loadSecret('OPENAI_API_KEY');
        if (openaiKeyFromGSM && openaiKeyFromGSM.startsWith('sk-')) {
            process.env.OPENAI_API_KEY = openaiKeyFromGSM;
            console.log('[ensureSupabaseEnv] OPENAI_API_KEY loaded from Secret Manager (sk-...)');
        } else {
            console.warn('[ensureSupabaseEnv] Secret Manager returned invalid OPENAI_API_KEY, using env var');
        }
    } catch (e) {
        console.warn('[ensureSupabaseEnv] Failed to load OPENAI_API_KEY from Secret Manager:', e);
    }
    // ▲▲▲

    // ▼▼▼【重要】Netlify環境変数に含まれる可能性のある空白・改行・タブを全て削除
    if (process.env.SUPABASE_URL) {
        process.env.SUPABASE_URL = process.env.SUPABASE_URL
            .replace(/\s/g, '')  // 実際のホワイトスペース削除
            .replace(/\\n|\\r|\\t/g, '');  // リテラル文字列 \n \r \t 削除
    }
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
            .replace(/\s/g, '')  // 実際のホワイトスペース削除
            .replace(/\\n|\\r|\\t/g, '');  // リテラル文字列 \n \r \t 削除
    }
    if (process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY
            .replace(/\s/g, '')  // 実際のホワイトスペース削除
            .replace(/\\n|\\r|\\t/g, '');  // リテラル文字列 \n \r \t 削除
    }
    // ▲▲▲

    console.info('[diag] has SUPABASE_URL?', !!process.env.SUPABASE_URL);
    console.info('[diag] has SUPABASE_SERVICE_ROLE_KEY?', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.info('[diag] has OPENAI_API_KEY?', !!process.env.OPENAI_API_KEY);
}

// =================================================================================
//  APIハンドラー (API Handlers)
// =================================================================================

/**
 * GET: キャラクターリストを取得
 */
export async function GET(request: Request) {
    console.log('[GET] キャラクター一覧取得開始');
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;

    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode');

        let whereClause: Prisma.charactersWhereInput = {};

        // ブロック済みの著者IDを収集
        let blockedAuthorIds: number[] = [];
        if (currentUserId) {
            const blocks = await prisma.block.findMany({
                where: { blockerId: currentUserId },
                select: { blockingId: true }
            });
            blockedAuthorIds = blocks.map(b => b.blockingId);
        }

        // 自分のキャラクターのみ or 公開＋自分のキャラクター
        if (mode === 'my' && currentUserId) {
            whereClause.author_id = currentUserId;
        } else {
            const publicCondition = { visibility: 'public' as const };
            if (currentUserId) {
                whereClause.OR = [
                    publicCondition,
                    { author_id: currentUserId }
                ];
            } else {
                whereClause = publicCondition;
            }
        }
        
        // ブロック対象の著者IDを除外（any を使わず IntFilter を利用）
        if (blockedAuthorIds.length > 0) {
            const existingAuthorFilter = (whereClause as Prisma.charactersWhereInput).author_id;
            let baseFilter: Prisma.IntFilter = {} as Prisma.IntFilter;

            if (existingAuthorFilter && typeof existingAuthorFilter === 'object') {
                baseFilter = existingAuthorFilter as Prisma.IntFilter;
            } else if (typeof existingAuthorFilter === 'number') {
                baseFilter = { equals: existingAuthorFilter };
            }

            (whereClause as Prisma.charactersWhereInput).author_id = {
                ...baseFilter,
                notIn: blockedAuthorIds,
            };
        }

        const charactersRaw = await prisma.characters.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                characterImages: {
                    orderBy: { displayOrder: 'asc' },
                },
                _count: {
                    select: { favorites: true, chat: true },
                },
            },
            take: 20
        });

        // メイン画像のみを返す（なければ先頭）
        const characters = charactersRaw.map(char => {
            let mainImage = char.characterImages.find(img => img.isMain);
            if (!mainImage && char.characterImages.length > 0) {
                mainImage = char.characterImages[0];
            }
            return {
                ...char,
                characterImages: mainImage ? [mainImage] : [],
            };
        });

        console.log(`[GET] キャラクター取得件数: ${characters.length}`);
        return NextResponse.json(characters);
    } catch (error) {
        console.error('[GET] キャラクターリスト取得エラー:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
    }
}

/**
 * POST: 新しいキャラクターを作成（JSONインポート or FormData）
 */
export async function POST(request: Request) {
    console.log('[POST] キャラクター作成処理開始');
    try {
        await ensureSupabaseEnv();

        const contentType = request.headers.get("content-type") || "";

        // === JSON（インポート） ===
        if (contentType.includes("application/json")) {
            const data = await request.json();
            const { userId, characterData: sourceCharacter } = data as {
                userId?: string | number;
                characterData: {
                    name: string;
                    description?: string | null;
                    systemTemplate?: string | null;
                    firstSituation?: string | null;
                    firstMessage?: string | null;
                    visibility: 'public' | 'private';
                    safetyFilter: boolean;
                    category?: string | null;
                    hashtags?: string[];
                    detailSetting?: string | null;
                    characterImages?: CharacterImageInput[];
                    lorebooks?: { content: string; keywords?: string[] }[];
                };
            };

            if (!userId) {
                return NextResponse.json({ message: '認証情報が見つかりません。' }, { status: 401 });
            }

            const newCharacter = await prisma.$transaction(async (tx) => {
                const character = await tx.characters.create({
                    data: {
                        name: `${sourceCharacter.name} (コピー)`,
                        description: sourceCharacter.description ?? null,
                        systemTemplate: sourceCharacter.systemTemplate ?? null,
                        firstSituation: sourceCharacter.firstSituation ?? null,
                        firstMessage: sourceCharacter.firstMessage ?? null,
                        visibility: sourceCharacter.visibility,
                        safetyFilter: sourceCharacter.safetyFilter,
                        category: sourceCharacter.category ?? null,
                        hashtags: sourceCharacter.hashtags ?? [],
                        detailSetting: sourceCharacter.detailSetting ?? null,
                        author: { connect: { id: typeof userId === 'string' ? parseInt(userId, 10) : userId } },
                    }
                });

                if (sourceCharacter.characterImages && sourceCharacter.characterImages.length > 0) {
                    await tx.character_images.createMany({
                        data: sourceCharacter.characterImages.map((img: CharacterImageInput) => ({
                            characterId: character.id,
                            imageUrl: img.imageUrl,
                            keyword: img.keyword,
                            isMain: img.isMain,
                            displayOrder: img.displayOrder,
                        }))
                    });
                }

                // ▼▼▼ ロアブックを1件ずつ埋め込み生成して保存 ▼▼▼
                if (sourceCharacter.lorebooks && sourceCharacter.lorebooks.length > 0) {
                    for (const lore of sourceCharacter.lorebooks) {
                        const embedding = await getEmbedding(lore.content);
                        const embeddingString = `[${embedding.join(',')}]`;
                        await tx.$executeRaw`
                            INSERT INTO "lorebooks" ("content", "keywords", "characterId", "embedding")
                            VALUES (${lore.content}, ${lore.keywords || []}::text[], ${character.id}, ${embeddingString}::vector)
                        `;
                    }
                }
                // ▲▲▲ ここまで ▲▲▲

                return character;
            });
            return NextResponse.json({ message: 'キャラクターのインポートに成功しました！', character: newCharacter }, { status: 201 });
        }

        // === FormData（通常作成） ===
        const formData = await request.formData();
        console.log('[POST] formData 受信成功');

        const lorebooksString = formData.get('lorebooks') as string;
        const lorebooks: LorebookData[] = lorebooksString ? JSON.parse(lorebooksString) : [];
        const firstSituationDate = formData.get('firstSituationDate') as string;
        const firstSituationPlace = formData.get('firstSituationPlace') as string;

        const userIdString = formData.get('userId') as string;
        const name = (formData.get('name') as string) || '';
        const description = (formData.get('description') as string) || '';
        const category = (formData.get('category') as string) || '';
        const hashtagsString = (formData.get('hashtags') as string) || '[]';
        const visibility = (formData.get('visibility') as string) || 'public';
        const safetyFilterString = (formData.get('safetyFilter') as string) || 'true';
        const systemTemplate = (formData.get('systemTemplate') as string) || '';
        const detailSetting = (formData.get('detailSetting') as string) || '';
        const firstSituation = (formData.get('firstSituation') as string) || '';
        const firstMessage = (formData.get('firstMessage') as string) || '';

        if (!userIdString) {
            return NextResponse.json({ message: '認証情報が見つかりません。再度ログインしてください。' }, { status: 401 });
        }
        const userId = parseInt(userIdString, 10);
        if (isNaN(userId)) {
            return NextResponse.json({ message: '無効なユーザーIDです。' }, { status: 400 });
        }
        if (!name.trim()) {
            return NextResponse.json({ message: 'キャラクターの名前は必須項目です。' }, { status: 400 });
        }

        const safetyFilter = safetyFilterString === 'true';
        let hashtags: string[] = [];
        try {
            hashtags = JSON.parse(hashtagsString);
        } catch {
            hashtags = [];
        }

        const imageCountString = formData.get('imageCount') as string;
        const imageCount = imageCountString ? parseInt(imageCountString, 10) : 0;
        
        // Supabase ストレージへ画像アップロード
        const supabaseUrl = process.env.SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'characters';
        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ message: 'サーバー設定エラー（Storage接続情報不足）' }, { status: 500 });
        }
        const sb = createClient(supabaseUrl, serviceRoleKey);

        const imageMetas: ImageMetaData[] = [];

        for (let i = 0; i < imageCount; i++) {
            const file = formData.get(`image_${i}`) as File | null;
            const keyword = (formData.get(`keyword_${i}`) as string) || '';
            if (!file || file.size === 0) {
                continue;
            }

            const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
            const safeFileName = `${randomUUID()}.${fileExtension}`;
            const objectKey = `uploads/${safeFileName}`;

            const arrayBuffer = await file.arrayBuffer();

            const { error: uploadErr } = await sb.storage
                .from(bucket)
                .upload(objectKey, Buffer.from(arrayBuffer), {
                    contentType: file.type || 'application/octet-stream',
                    upsert: false,
                });

            if (uploadErr) {
                console.error(`[POST] Supabaseアップロード失敗(index=${i}):`, uploadErr);
                return NextResponse.json({ message: '画像アップロードに失敗しました。' }, { status: 500 });
            }

            const { data: pub } = sb.storage.from(bucket).getPublicUrl(objectKey);
            const imageUrl = pub.publicUrl;

            imageMetas.push({
                url: imageUrl,
                keyword,
                isMain: i === 0,
                displayOrder: i,
            });
        }
        
        const characterData = {
            name,
            description,
            systemTemplate,
            firstSituation,
            firstMessage,
            visibility,
            safetyFilter,
            category,
            hashtags,
            detailSetting,
            firstSituationDate: firstSituationDate ? new Date(firstSituationDate) : null,
            firstSituationPlace: firstSituationPlace,
            author: {
                connect: { id: userId },
            },
        };

        const newCharacter = await prisma.$transaction(async (tx) => {
            const character = await tx.characters.create({ data: characterData });

            if (imageMetas.length > 0) {
                await tx.character_images.createMany({
                    data: imageMetas.map((meta) => ({
                        characterId: character.id,
                        imageUrl: meta.url,
                        keyword: meta.keyword,
                        isMain: meta.isMain,
                        displayOrder: meta.displayOrder,
                    })),
                });
            }

            // ▼▼▼ ロアブックを1件ずつ埋め込み生成して保存 ▼▼▼
            if (lorebooks.length > 0) {
                for (const lore of lorebooks) {
                    const embedding = await getEmbedding(lore.content);
                    const embeddingString = `[${embedding.join(',')}]`;
                    // $executeRaw`...` はプリペアドステートメント相当で安全
                    await tx.$executeRaw`
                        INSERT INTO "lorebooks" ("content", "keywords", "characterId", "embedding")
                        VALUES (${lore.content}, ${lore.keywords || []}::text[], ${character.id}, ${embeddingString}::vector)
                    `;
                }
            }
            // ▲▲▲ ここまで ▲▲▲

            return await tx.characters.findUnique({
                where: { id: character.id },
                include: { characterImages: true, lorebooks: true },
            });
        });

        console.log('[POST] キャラクター作成成功');
        return NextResponse.json(
            { message: 'キャラクターの作成に成功しました！', character: newCharacter },
            { status: 201 }
        );
    } catch (error) {
        console.error('--- ❌ [POST] 致命的エラー:', error);
        return NextResponse.json(
            { message: error instanceof Error ? error.message : '不明なサーバーエラーが発生しました' },
            { status: 500 }
        );
    }
}