export const runtime = 'nodejs';
export const dynamic = "force-dynamic"; // ▼▼▼【重要】キャッシュを無効化して常に最新データを取得 ▼▼▼

import { NextResponse } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import { Prisma } from "@prisma/client";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { checkFieldsForSexualContent } from '@/lib/content-filter';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import OpenAI from 'openai'; // ★ OpenAIクライアントをインポート
import { notifyFollowersOnCharacterCreation } from '@/lib/notifications'; // ★ 通知関数をインポート
import { validateImageFile } from '@/lib/upload/validateImage';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';
import { uploadImageBufferToCloudflare } from '@/lib/cloudflare-images';
import JSZip from 'jszip';
import { randomUUID } from 'crypto';

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

    const fs = await import('fs/promises');
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
        const fs = await import('fs/promises');
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
    // ▼▼▼【Netlify対応】Secret Manager接続失敗でも環境変数があればOK ▼▼▼
    try {
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
    } catch (error) {
        // Secret Manager 接続失敗（Netlify環境など）
        console.warn('[ensureSupabaseEnv] Secret Manager接続失敗、環境変数を使用:', error);
        
        // 環境変数がない場合のみエラー
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
            throw new Error('必須の環境変数が設定されていません。SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEYを確認してください。');
        }
    }
    // ▲▲▲【Netlify対応 終了】

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
    if (isBuildTime()) return buildTimeResponse();
    
    console.log('[GET] キャラクター一覧取得開始');
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;

    try {
        const prisma = await getPrisma();
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

        // ▼▼▼【追加】セーフティフィルター: ユーザーのセーフティフィルターがONの場合は、キャラクターのセーフティフィルターがOFFのものを除外
        // nullの場合はtrue（フィルターON）として処理（デフォルト動作）
        let userSafetyFilter = true;
        if (currentUserId) {
            const user = await prisma.users.findUnique({
                where: { id: currentUserId },
                select: { safetyFilter: true }
            });
            userSafetyFilter = user?.safetyFilter ?? true;
        }
        // ▲▲▲

        // 自分のキャラクターのみ or 公開＋自分のキャラクター
        if (mode === 'my' && currentUserId) {
            whereClause.author_id = currentUserId;
            // 自分のキャラクターの場合はセーフティフィルター条件を適用しない
        } else {
            const publicCondition: Prisma.charactersWhereInput = { visibility: 'public' as const };
            // ユーザーのセーフティフィルターがONの場合、公開キャラクターのセーフティフィルターがOFF（false）のものを除外
            if (userSafetyFilter) {
                publicCondition.safetyFilter = { not: false }; // nullも許可（未設定）
            }
            
            if (currentUserId) {
                whereClause.OR = [
                    publicCondition,
                    { author_id: currentUserId } // 自分のキャラクターはセーフティフィルター条件を適用しない
                ];
            } else {
                // 未ログインユーザーの場合
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
            select: {
                id: true,
                name: true,
                visibility: true,
                safetyFilter: true,
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
    if (isBuildTime()) return buildTimeResponse();
    
    // Lambda 환경에서 환경 변수 로드
    await ensureEnvVarsLoaded();
    
    console.log('[POST] キャラクター作成処理開始');
    try {
        const prisma = await getPrisma();
        await ensureSupabaseEnv();

        const contentType = request.headers.get("content-type") || "";

        // === ZIPファイルインポート（新規キャラクター作成） ===
        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            const zipFile = formData.get('zipFile') as File | null;
            
            // ZIPファイルがある場合は新規キャラクター作成
            if (zipFile && zipFile.name.endsWith('.zip')) {
                console.log('[POST] ZIPファイルからの新規キャラクター作成開始');
                
                const session = await getServerSession(authOptions);
                if (!session?.user?.id) {
                    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
                }
                const currentUserId = parseInt(session.user.id, 10);
                
                // ZIPファイルを解凍
                const arrayBuffer = await zipFile.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);
                
                // character.jsonを取得
                const characterJsonFile = zip.file('character.json');
                if (!characterJsonFile) {
                    return NextResponse.json({ error: 'ZIPファイルにcharacter.jsonが見つかりません。' }, { status: 400 });
                }
                
                const characterJsonText = await characterJsonFile.async('string');
                const parsedData = JSON.parse(characterJsonText) as {
                    id?: number; // Import時は無視される
                    name: string;
                    description?: string | null;
                    systemTemplate?: string | null;
                    firstSituation?: string | null;
                    firstMessage?: string | null;
                    visibility: 'public' | 'private' | 'link';
                    safetyFilter: boolean;
                    category?: string | null;
                    hashtags?: string[];
                    detailSetting?: string | null;
                    statusWindowPrompt?: string | null;
                    statusWindowDescription?: string | null;
                    characterImages?: Array<{
                        imageUrl: string;
                        keyword: string | null;
                        isMain: boolean;
                        displayOrder: number;
                    }>;
                    lorebooks?: Array<{
                        content: string;
                        keywords: string[];
                    }>;
                };
                
                // idフィールドを明示的に削除（新規作成時はidを指定しない）
                const { id, ...sourceCharacterData } = parsedData;
                if (id !== undefined) {
                    console.log(`[IMPORT] 警告: character.jsonにidフィールド(${id})が含まれていますが、新規作成のため無視されます。`);
                }
                
                // 画像をZIPから取得
                // ZIP内のすべてのファイルをリストして確認
                const allFiles: string[] = [];
                zip.forEach((relativePath) => {
                    allFiles.push(relativePath);
                });
                console.log(`[IMPORT] ZIP内の全ファイル:`, allFiles);
                
                const imagesFolder = zip.folder('images');
                const imageMap = new Map<number, Buffer>(); // displayOrder -> Buffer のマップ
                
                if (sourceCharacterData.characterImages && sourceCharacterData.characterImages.length > 0) {
                    // displayOrder順にソート
                    const sortedImages = [...sourceCharacterData.characterImages].sort((a, b) => a.displayOrder - b.displayOrder);
                    
                    console.log(`[IMPORT] ZIP内の画像ファイル数: ${sortedImages.length}`);
                    console.log(`[IMPORT] characterImages データ:`, sortedImages.map(img => ({
                        displayOrder: img.displayOrder,
                        isMain: img.isMain,
                        keyword: img.keyword,
                    })));
                    
                    // 画像ファイルを順番に読み込む (image_0.png, image_1.png など)
                    for (let i = 0; i < sortedImages.length; i++) {
                        const img = sortedImages[i];
                        const displayOrder = img.displayOrder;
                        
                        // 拡張子を試行 (png, jpg, jpeg, webp, gif)
                        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
                        let imageBuffer: Buffer | null = null;
                        let foundExtension: string | null = null;
                        let foundPath: string | null = null;
                        
                        // 方法1: images/image_0.png 形式で検索
                        if (imagesFolder) {
                            for (const ext of extensions) {
                                const imagePath = `image_${i}.${ext}`;
                                const imageFile = imagesFolder.file(imagePath);
                                if (imageFile) {
                                    imageBuffer = await imageFile.async('nodebuffer');
                                    foundExtension = ext;
                                    foundPath = `images/${imagePath}`;
                                    console.log(`[IMPORT] 画像 ${i} (displayOrder: ${displayOrder}) をZIPから取得: ${foundPath} (${imageBuffer.length} bytes)`);
                                    break;
                                }
                            }
                        }
                        
                        // 方法2: 全ファイルから直接検索 (images/image_0.png など)
                        if (!imageBuffer) {
                            for (const ext of extensions) {
                                const possiblePaths = [
                                    `images/image_${i}.${ext}`,
                                    `image_${i}.${ext}`,
                                    `images/${i}.${ext}`,
                                    `${i}.${ext}`,
                                ];
                                
                                for (const imagePath of possiblePaths) {
                                    const imageFile = zip.file(imagePath);
                                    if (imageFile) {
                                        imageBuffer = await imageFile.async('nodebuffer');
                                        foundExtension = ext;
                                        foundPath = imagePath;
                                        console.log(`[IMPORT] 画像 ${i} (displayOrder: ${displayOrder}) をZIPから取得 (直接検索): ${foundPath} (${imageBuffer.length} bytes)`);
                                        break;
                                    }
                                }
                                if (imageBuffer) break;
                            }
                        }
                        
                        if (imageBuffer && foundExtension && foundPath) {
                            imageMap.set(displayOrder, imageBuffer);
                        } else {
                            console.warn(`[IMPORT] 画像 ${i} (displayOrder: ${displayOrder}) が見つかりません`);
                            console.warn(`[IMPORT] 試行したパス: image_${i}.{png,jpg,jpeg,webp,gif} (images/ フォルダ内)`);
                            console.warn(`[IMPORT] 試行したパス: images/image_${i}.{png,jpg,jpeg,webp,gif} (直接検索)`);
                        }
                    }
                }
                
                // 画像をアップロード
                const newImagesData: ImageMetaData[] = [];
                if (sourceCharacterData.characterImages && sourceCharacterData.characterImages.length > 0) {
                    // displayOrder順にソート
                    const sortedImages = [...sourceCharacterData.characterImages].sort((a, b) => a.displayOrder - b.displayOrder);
                    
                    console.log(`[IMPORT] 画像アップロード開始: ${sortedImages.length} 枚`);
                    
                    for (let i = 0; i < sortedImages.length; i++) {
                        const img = sortedImages[i];
                        const displayOrder = img.displayOrder;
                        
                        // displayOrderに対応する画像バッファを取得
                        const imageBuffer = imageMap.get(displayOrder);
                        
                        if (imageBuffer) {
                            try {
                                // 拡張子を推測 (デフォルトはpng)
                                // 元のURLから拡張子を取得、なければpng
                                let fileExtension = 'png';
                                if (img.imageUrl) {
                                    const urlMatch = img.imageUrl.match(/\.(png|jpg|jpeg|webp|gif)(\?|$|#)/i);
                                    if (urlMatch) {
                                        fileExtension = urlMatch[1].toLowerCase();
                                    }
                                }
                                
                                const safeFileName = `${randomUUID()}.${fileExtension}`;
                                const contentType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
                                
                                console.log(`[IMPORT] 画像 ${i} (displayOrder: ${displayOrder}, isMain: ${img.isMain}, keyword: ${img.keyword || '(なし)'}) をCloudflareにアップロード中...`);
                                const imageUrl = await uploadImageBufferToCloudflare(imageBuffer, {
                                    filename: safeFileName,
                                    contentType,
                                });
                                
                                console.log(`[IMPORT] 画像 ${i} アップロード成功: ${imageUrl}`);
                                
                                newImagesData.push({
                                    url: imageUrl,
                                    keyword: img.keyword || '',
                                    isMain: img.isMain,
                                    displayOrder: img.displayOrder,
                                });
                            } catch (e) {
                                console.error(`[IMPORT] ZIP画像 ${i} (displayOrder: ${displayOrder}) アップロードエラー:`, e);
                            }
                        } else {
                            console.warn(`[IMPORT] 画像 ${i} (displayOrder: ${displayOrder}) のバッファが見つかりません`);
                        }
                    }
                }
                
                console.log(`[IMPORT] 合計 ${newImagesData.length} 枚の画像をアップロードしました`);
                
                // セーフティフィルターチェック
                if (sourceCharacterData.safetyFilter) {
                    const violations = checkFieldsForSexualContent({
                        systemTemplate: sourceCharacterData.systemTemplate,
                        firstSituation: sourceCharacterData.firstSituation,
                        firstMessage: sourceCharacterData.firstMessage,
                        description: sourceCharacterData.description,
                    });
                    
                    if (violations.length > 0) {
                        const fieldNames: Record<string, string> = {
                            systemTemplate: 'システムテンプレート',
                            firstSituation: '初期状況',
                            firstMessage: '最初のメッセージ',
                            description: '説明',
                        };
                        const violationMessages = violations.map(v => fieldNames[v] || v).join('、');
                        return NextResponse.json({ 
                            error: `セーフティフィルターがONのキャラクターには性的コンテンツを含めることができません。\n\n以下のフィールドに性的コンテンツが検出されました: ${violationMessages}` 
                        }, { status: 400 });
                    }
                }
                
                // 新規キャラクター作成
                const newCharacter = await prisma.$transaction(async (tx) => {
                    const character = await tx.characters.create({
                        data: {
                            name: sourceCharacterData.name,
                            description: sourceCharacterData.description ?? null,
                            systemTemplate: sourceCharacterData.systemTemplate ?? null,
                            firstSituation: sourceCharacterData.firstSituation ?? null,
                            firstMessage: sourceCharacterData.firstMessage ?? null,
                            visibility: sourceCharacterData.visibility === 'link' ? 'public' : sourceCharacterData.visibility,
                            safetyFilter: sourceCharacterData.safetyFilter,
                            category: sourceCharacterData.category ?? null,
                            hashtags: sourceCharacterData.hashtags ?? [],
                            detailSetting: sourceCharacterData.detailSetting ?? null,
                            statusWindowPrompt: sourceCharacterData.statusWindowPrompt ?? null,
                            statusWindowDescription: sourceCharacterData.statusWindowDescription ?? null,
                            author: { connect: { id: currentUserId } },
                        }
                    });
                    
                    // 画像登録
                    if (newImagesData.length > 0) {
                        console.log(`[IMPORT] データベースに保存する画像データ:`, newImagesData.map(img => ({
                            url: img.url.substring(0, 50) + '...',
                            keyword: img.keyword,
                            isMain: img.isMain,
                            displayOrder: img.displayOrder,
                        })));
                        
                        const imageDataToSave = newImagesData.map(img => ({
                            characterId: character.id,
                            imageUrl: img.url,
                            keyword: img.keyword || '',
                            isMain: img.isMain,
                            displayOrder: img.displayOrder,
                        }));
                        
                        console.log(`[IMPORT] createManyに渡すデータ:`, imageDataToSave.map(img => ({
                            characterId: img.characterId,
                            imageUrl: img.imageUrl.substring(0, 50) + '...',
                            keyword: img.keyword,
                            isMain: img.isMain,
                            displayOrder: img.displayOrder,
                        })));
                        
                        await tx.character_images.createMany({
                            data: imageDataToSave,
                        });
                        
                        console.log(`[IMPORT] 画像データベース保存完了: ${imageDataToSave.length} 枚`);
                    } else {
                        console.warn(`[IMPORT] 保存する画像データがありません`);
                    }
                    
                    // ロアブック保存
                    if (sourceCharacterData.lorebooks && sourceCharacterData.lorebooks.length > 0) {
                        for (const lore of sourceCharacterData.lorebooks) {
                            const embedding = await getEmbedding(lore.content);
                            const embeddingString = `[${embedding.join(',')}]`;
                            await tx.$executeRaw`
                                INSERT INTO "lorebooks" ("content", "keywords", "characterId", "embedding")
                                VALUES (${lore.content}, ${lore.keywords || []}::text[], ${character.id}, ${embeddingString}::vector)
                            `;
                        }
                    }
                    
                    return character;
                });
                
                // フォロワーに通知
                notifyFollowersOnCharacterCreation(currentUserId, newCharacter.id, newCharacter.name).catch(err => 
                    console.error('通知作成エラー:', err)
                );
                
                return NextResponse.json({ 
                    message: 'キャラクターのインポートに成功しました！', 
                    character: newCharacter 
                }, { status: 201 });
            }
        }

        // === JSON（通常作成 または インポート） ===
        if (contentType.includes("application/json")) {
            const data = await request.json();
            
            // ▼▼▼【新規】直接アップロード方式（images配列がある場合）▼▼▼
            if (data.images && Array.isArray(data.images)) {
                console.log('[POST/JSON] 直接アップロード方式での作成');
                const { userId, images, lorebooks, id, ...formFields } = data;
                // idフィールドを明示的に削除（新規作成時はidを指定しない）
                if (id !== undefined) {
                    console.log(`[POST/JSON] 警告: リクエストにidフィールド(${id})が含まれていますが、新規作成のため無視されます。`);
                }
                
                if (!userId) {
                    return NextResponse.json({ message: '認証情報が見つかりません。' }, { status: 401 });
                }
                
                const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
                if (isNaN(userIdNum)) {
                    return NextResponse.json({ message: '無効なユーザーIDです。' }, { status: 400 });
                }
                
                if (!formFields.name?.trim()) {
                    return NextResponse.json({ message: 'キャラクターの名前は必須項目です。' }, { status: 400 });
                }
                
                // ▼▼▼【追加】セーフティフィルターがONの場合、性的コンテンツをチェック
                const safetyFilter = formFields.safetyFilter !== false;
                if (safetyFilter) {
                    const violations = checkFieldsForSexualContent({
                        systemTemplate: formFields.systemTemplate,
                        firstSituation: formFields.firstSituation,
                        firstMessage: formFields.firstMessage,
                        description: formFields.description,
                    });
                    
                    if (violations.length > 0) {
                        const fieldNames: Record<string, string> = {
                            systemTemplate: 'システムテンプレート',
                            firstSituation: '初期状況',
                            firstMessage: '最初のメッセージ',
                            description: '説明',
                        };
                        const violationMessages = violations.map(v => fieldNames[v] || v).join('、');
                        return NextResponse.json({ 
                            message: `セーフティフィルターがONのキャラクターには性的コンテンツを含めることができません。\n\n以下のフィールドに性的コンテンツが検出されました: ${violationMessages}\n\nセーフティフィルターをOFFにするか、性的コンテンツを削除してください。` 
                        }, { status: 400 });
                    }
                }
                // ▲▲▲
                
                console.log('[POST] 데이터베이스 쓰기 시도 시작...');
                console.log('[POST] DATABASE_URL from env:', process.env.DATABASE_URL?.substring(0, 50) + '...');
                // Prisma가 실제로 사용하는 URL 확인
                const prismaUrl = typeof prisma.$connect === 'function' ? 'Prisma connected' : 'Prisma not connected';
                console.log('[POST] Prisma connection status:', prismaUrl);
                
                const newCharacter = await prisma.$transaction(async (tx) => {
                    try {
                        console.log('[POST] characters.create 시도...');
                        const character = await tx.characters.create({
                            data: {
                                name: formFields.name,
                                description: formFields.description ?? null,
                                systemTemplate: formFields.systemTemplate ?? null,
                                firstSituation: formFields.firstSituation ?? null,
                                firstMessage: formFields.firstMessage ?? null,
                                visibility: formFields.visibility || 'public',
                                safetyFilter: formFields.safetyFilter !== false,
                                category: formFields.category ?? null,
                                hashtags: formFields.hashtags ?? [],
                                detailSetting: formFields.detailSetting ?? null,
                                statusWindowPrompt: formFields.statusWindowPrompt ?? null,
                                statusWindowDescription: formFields.statusWindowDescription ?? null,
                                author: { connect: { id: userIdNum } },
                            }
                        });
                        console.log('[POST] characters.create 성공:', character.id);
                    
                    // 画像登録（既にSupabaseにアップロード済みのURL）
                    if (images && images.length > 0) {
                        console.log('[POST] character_images.createMany 시도...');
                        await tx.character_images.createMany({
                            data: images.map((img: { imageUrl: string; keyword: string }, index: number) => ({
                                characterId: character.id,
                                imageUrl: img.imageUrl,
                                keyword: img.keyword || '',
                                isMain: index === 0,
                                displayOrder: index,
                            }))
                        });
                        console.log('[POST] character_images.createMany 성공');
                    }
                    
                    // ロアブック保存
                    if (lorebooks && lorebooks.length > 0) {
                        for (const lore of lorebooks) {
                            const embedding = await getEmbedding(lore.content);
                            const embeddingString = `[${embedding.join(',')}]`;
                            await tx.$executeRaw`
                                INSERT INTO "lorebooks" ("content", "keywords", "characterId", "embedding")
                                VALUES (${lore.content}, ${lore.keywords || []}::text[], ${character.id}, ${embeddingString}::vector)
                            `;
                        }
                    }
                    
                    return character;
                    } catch (dbError) {
                        console.error('[POST] 데이터베이스 쓰기 에러 상세:');
                        console.error('[POST] 에러 타입:', typeof dbError);
                        console.error('[POST] 에러 객체:', dbError);
                        if (dbError instanceof Error) {
                            console.error('[POST] 에러 메시지:', dbError.message);
                            console.error('[POST] 에러 스택:', dbError.stack);
                        }
                        if (typeof dbError === 'object' && dbError !== null) {
                            const prismaError = dbError as { code?: string; meta?: unknown; message?: string };
                            console.error('[POST] Prisma 에러 코드:', prismaError.code);
                            console.error('[POST] Prisma 에러 메타:', prismaError.meta);
                            
                            // Unique constraint 에러가 id 필드에서 발생한 경우 시퀀스 수정 시도
                            const errorMessage = prismaError.message || (dbError instanceof Error ? dbError.message : '');
                            if (prismaError.code === 'P2002' && 
                                (errorMessage.includes('Unique constraint failed on the fields: (`id`)') ||
                                 (prismaError.meta && typeof prismaError.meta === 'object' && 
                                  'target' in prismaError.meta && 
                                  Array.isArray(prismaError.meta.target) &&
                                  prismaError.meta.target.includes('id'))) {
                                console.log('[POST] ⚠️ Sequence out of sync detected. Attempting to fix...');
                                try {
                                    // 현재 최대 id 확인
                                    const maxResult = await prisma.$queryRaw<Array<{ max: bigint | null }>>`
                                        SELECT MAX(id) as max FROM characters
                                    `;
                                    const maxId = maxResult[0]?.max ? Number(maxResult[0].max) : 0;
                                    
                                    // 시퀀스 재설정
                                    await prisma.$executeRawUnsafe(`
                                        SELECT setval('characters_id_seq', ${maxId + 1}, false)
                                    `);
                                    
                                    console.log(`[POST] ✅ Sequence fixed. Max ID: ${maxId}, Sequence set to: ${maxId + 1}`);
                                    
                                    // 재시도
                                    const character = await tx.characters.create({
                                        data: {
                                            name: formFields.name,
                                            description: formFields.description ?? null,
                                            systemTemplate: formFields.systemTemplate ?? null,
                                            firstSituation: formFields.firstSituation ?? null,
                                            firstMessage: formFields.firstMessage ?? null,
                                            visibility: formFields.visibility || 'public',
                                            safetyFilter: formFields.safetyFilter !== false,
                                            category: formFields.category ?? null,
                                            hashtags: formFields.hashtags ?? [],
                                            detailSetting: formFields.detailSetting ?? null,
                                            statusWindowPrompt: formFields.statusWindowPrompt ?? null,
                                            statusWindowDescription: formFields.statusWindowDescription ?? null,
                                            author: { connect: { id: userIdNum } },
                                        }
                                    });
                                    console.log('[POST] ✅ characters.create 성공 (재시도 후):', character.id);
                                    
                                    // 이미지와 로어북 처리도 다시 해야 함
                                    if (images && images.length > 0) {
                                        await tx.character_images.createMany({
                                            data: images.map((img: { imageUrl: string; keyword: string }, index: number) => ({
                                                characterId: character.id,
                                                imageUrl: img.imageUrl,
                                                keyword: img.keyword || '',
                                                isMain: index === 0,
                                                displayOrder: index,
                                            }))
                                        });
                                    }
                                    
                                    if (lorebooks && lorebooks.length > 0) {
                                        for (const lore of lorebooks) {
                                            const embedding = await getEmbedding(lore.content);
                                            const embeddingString = `[${embedding.join(',')}]`;
                                            await tx.$executeRaw`
                                                INSERT INTO "lorebooks" ("content", "keywords", "characterId", "embedding")
                                                VALUES (${lore.content}, ${lore.keywords || []}::text[], ${character.id}, ${embeddingString}::vector)
                                            `;
                                        }
                                    }
                                    
                                    return character;
                                } catch (retryError) {
                                    console.error('[POST] ❌ Sequence fix and retry failed:', retryError);
                                    throw dbError; // 원래 에러를 다시 throw
                                }
                            }
                        }
                        if (typeof dbError === 'object' && dbError !== null) {
                            const prismaError = dbError as { code?: string; meta?: unknown; message?: string };
                            console.error('[POST] Prisma 에러 코드:', prismaError.code);
                            console.error('[POST] Prisma 에러 메타:', prismaError.meta);
                        }
                        throw dbError;
                    }
                });
                
                // ★ フォロワーに通知
                notifyFollowersOnCharacterCreation(userIdNum, newCharacter.id, newCharacter.name).catch(err => 
                    console.error('通知作成エラー:', err)
                );
                
                return NextResponse.json({ 
                    message: 'キャラクターが正常に作成されました！', 
                    character: newCharacter 
                }, { status: 201 });
            }
            // ▲▲▲【新規 終了】▲▲▲
            
            // ▼▼▼【既存】インポート用（characterDataがある場合）▼▼▼
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

                // ロアブックを1件ずつ埋め込み生成して保存
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

                return character;
            });
            return NextResponse.json({ message: 'キャラクターのインポートに成功しました！', character: newCharacter }, { status: 201 });
            // ▲▲▲【既存 終了】▲▲▲
        }

        // === FormData（通常作成、ZIPファイル以外） ===
        const formData = await request.formData();
        
        // ZIPファイルの場合は既に処理済みなのでスキップ
        const zipFile = formData.get('zipFile');
        if (zipFile && zipFile instanceof File && zipFile.name.endsWith('.zip')) {
            return NextResponse.json({ error: 'ZIPファイルは既に処理されました。' }, { status: 400 });
        }
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
        
        // ▼▼▼【追加】セーフティフィルターがONの場合、性的コンテンツをチェック
        if (safetyFilter) {
            const violations = checkFieldsForSexualContent({
                systemTemplate,
                firstSituation,
                firstMessage,
                description,
            });
            
            if (violations.length > 0) {
                const fieldNames: Record<string, string> = {
                    systemTemplate: 'システムテンプレート',
                    firstSituation: '初期状況',
                    firstMessage: '最初のメッセージ',
                    description: '説明',
                };
                const violationMessages = violations.map(v => fieldNames[v] || v).join('、');
                return NextResponse.json({ 
                    message: `セーフティフィルターがONのキャラクターには性的コンテンツを含めることができません。\n\n以下のフィールドに性的コンテンツが検出されました: ${violationMessages}\n\nセーフティフィルターをOFFにするか、性的コンテンツを削除してください。` 
                }, { status: 400 });
            }
        }
        // ▲▲▲
        
        let hashtags: string[] = [];
        try {
            hashtags = JSON.parse(hashtagsString);
        } catch {
            hashtags = [];
        }

        const imageCountString = formData.get('imageCount') as string;
        const imageCount = imageCountString ? parseInt(imageCountString, 10) : 0;
        
        // Cloudflare R2へ画像アップロード
        const imageMetas: ImageMetaData[] = [];

        for (let i = 0; i < imageCount; i++) {
            const file = formData.get(`image_${i}`) as File | null;
            const keyword = (formData.get(`keyword_${i}`) as string) || '';
            if (!file || file.size === 0) {
                console.log(`[POST] 画像 ${i}: スキップ (ファイルなし)`);
                continue;
            }

            console.log(`[POST] 画像 ${i} アップロード開始: ${file.name} (${file.size} bytes, ${file.type})`);

            let validatedFile;
            try {
                validatedFile = await validateImageFile(file, { maxSizeBytes: 5 * 1024 * 1024 });
            } catch (err) {
                const message = err instanceof Error ? err.message : '画像検証中にエラーが発生しました。';
                return NextResponse.json({ message: `画像${i + 1}: ${message}` }, { status: 400 });
            }

            try {
                const imageUrl = await uploadImageBufferToCloudflare(validatedFile.buffer, {
                    filename: validatedFile.safeFileName,
                    contentType: validatedFile.mimeType,
                });

                console.log(`[POST] 画像 ${i} アップロード成功: ${imageUrl}`);

                imageMetas.push({
                    url: imageUrl,
                    keyword,
                    isMain: i === 0,
                    displayOrder: i,
                });
            } catch (uploadErr) {
                console.error(`[POST] Cloudflareアップロード失敗(index=${i}):`, uploadErr);
                const message = uploadErr instanceof Error ? uploadErr.message : '画像アップロードに失敗しました。';
                return NextResponse.json({ 
                    message: `画像アップロードに失敗しました: ${message}` 
                }, { status: 500 });
            }
        }
        
        const statusWindowPrompt = (formData.get('statusWindowPrompt') as string) || '';
        const statusWindowDescription = (formData.get('statusWindowDescription') as string) || '';
        
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
            statusWindowPrompt: statusWindowPrompt || null,
            statusWindowDescription: statusWindowDescription || null,
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

        // ★ フォロワーに通知
        if (newCharacter) {
            notifyFollowersOnCharacterCreation(userId, newCharacter.id, newCharacter.name).catch(err => 
                console.error('通知作成エラー:', err)
            );
        }

        console.log('[POST] キャラクター作成成功');
        return NextResponse.json(
            { message: 'キャラクターの作成に成功しました！', character: newCharacter },
            { status: 201 }
        );
    } catch (error) {
        console.error('--- ❌ [POST] 致命的エラー:', error);
        // ▼▼▼【詳細ログ】エラーの詳細情報を出力 ▼▼▼
        if (error instanceof Error) {
            console.error('[POST] エラー名:', error.name);
            console.error('[POST] エラーメッセージ:', error.message);
            console.error('[POST] スタックトレース:', error.stack);
        }
        // ▲▲▲
        return NextResponse.json(
            { message: error instanceof Error ? error.message : '不明なサーバーエラーが発生しました' },
            { status: 500 }
        );
    }
}