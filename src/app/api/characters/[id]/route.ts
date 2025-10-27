export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';
// ▼▼▼【Redis】 lib/redis.ts からインポート
import { redis } from '@/lib/redis'; 
import OpenAI from 'openai';
// ▼▼▼【Supabase】追加インポート
import { createClient } from '@supabase/supabase-js';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { randomUUID } from 'crypto';

// =================================================================================
//  型定義 (Type Definitions)
// =================================================================================

type LorebookData = {
  id?: number;
  content: string;
  keywords: string[];
};

// =================================================================================
//  クライアント初期化 (Client Initialization)
// =================================================================================

// ★ OpenAIクライアント (Embedding生成用)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: sanitizedText,
  });
  return response.data[0].embedding;
}

/**
 * GCPサービスアカウント認証情報を /tmp に展開
 */
async function ensureGcpCredsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;
  if (!raw && !b64) return;

  const tmpPath = '/tmp/gcp-sa.json';
  const content = raw ?? Buffer.from(b64!, 'base64').toString('utf8');
  await fs.writeFile(tmpPath, content, { encoding: 'utf8' });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
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
  } catch (e) {
    console.error('[resolveGcpProjectId] JSONパースエラー:', e);
  }
  throw new Error('GCPプロジェクトIDが見つかりません。');
}

/**
 * Secret Managerからシークレット値を取得
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

  console.info('[diag] has SUPABASE_URL?', !!process.env.SUPABASE_URL);
  console.info('[diag] has SUPABASE_SERVICE_ROLE_KEY?', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
}


// =================================================================================
//  APIハンドラー (API Handlers)
// =================================================================================


/**
 * 特定のキャラクター詳細情報を取得 (GET) - 変更なし
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const characterId = Number.parseInt(id, 10);
  if (isNaN(characterId)) {
    return NextResponse.json({ error: '無効なIDです。'}, { status: 400 });
  }

  console.log(`[GET /api/characters/${characterId}] 詳細情報取得リクエストを受信`);

  try {
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;

    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      include: {
        characterImages: { 
          orderBy: { 
            displayOrder: 'asc' 
          } 
        },
        author: { select: { id: true, name: true, nickname: true, image_url: true } },
        _count: { select: { favorites: true, chat: true } },
        lorebooks: true,
      }
    });

    if (!character) {
      console.log(`[GET /api/characters/${characterId}] エラー: キャラクターが見つかりませんでした。`);
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }
    
    console.log(`[GET /api/characters/${characterId}] データベースからキャラクターを検索しました。`);
    console.log(`[GET /api/characters/${characterId}] 関連付けられた画像の数: ${character.characterImages?.length || 0}枚`);

    if (currentUserId && character.author_id) {
      const isBlocked = await prisma.block.findUnique({
        where: {
          blockerId_blockingId: {
            blockerId: currentUserId,
            blockingId: character.author_id
          }
        }
      });
      if (isBlocked) {
        return NextResponse.json({ error: 'この製作者はブロックされているため、キャラクターを表示できません。' }, { status: 403 });
      }
    }

    if (character.visibility === 'private') {
      if (!currentUserId || currentUserId !== character.author_id) {
        return NextResponse.json({ error: 'このキャラクターは非公開です。' }, { status: 403 });
      }
    }

    let isFavorited = false;
    if (currentUserId) {
      const favorite = await prisma.favorites.findUnique({
        where: {
          user_id_character_id: {
            user_id: currentUserId,
            character_id: characterId,
          },
        },
      });
      isFavorited = !!favorite;
    }

    const responseData = {
      ...character,
      isFavorited,
    };
    
    console.log(`[GET /api/characters/${characterId}] クライアントへのレスポンスを送信します。画像数: ${responseData.characterImages?.length || 0}枚`);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(`[GET /api/characters/${characterId}] キャラクター詳細の取得エラー:`, error);
    if (error instanceof Error && error.message.includes("relation \"Block\" does not exist")) {
      return NextResponse.json({ 
        error: 'サーバーエラー: Blockテーブルがデータベースに存在しません。DBスキーマを確認してください。' 
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

/**
 * キャラクター更新（PUT）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const characterIdToUpdate = Number.parseInt(id, 10);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const currentUser = session.user;

  if (isNaN(characterIdToUpdate)) {
    return NextResponse.json({ error: '無効なIDです。'}, { status: 400 });
  }

  try {
    const characterToUpdate = await prisma.characters.findUnique({
      where: { id: characterIdToUpdate },
      select: { author_id: true }
    });

    if (!characterToUpdate) {
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }

    const isOwner = characterToUpdate.author_id === parseInt(currentUser.id, 10);
    const hasAdminPermission = currentUser.role === Role.CHAR_MANAGER || currentUser.role === Role.SUPER_ADMIN;

    if (!isOwner && !hasAdminPermission) {
      return NextResponse.json({ error: 'このキャラクターを編集する権限がありません。' }, { status: 403 });
    }
    
    const formData = await request.formData();

    const lorebooksString = formData.get('lorebooks') as string;
    const lorebooks: LorebookData[] = lorebooksString ? JSON.parse(lorebooksString) : [];
    const firstSituationDate = formData.get('firstSituationDate') as string;
    const firstSituationPlace = formData.get('firstSituationPlace') as string;

    // ▼▼▼【Supabase】環境変数を準備してクライアントを初期化
    await ensureSupabaseEnv();
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'characters';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabaseの接続情報が不足しています。');
    }
    const sb = createClient(supabaseUrl, serviceRoleKey);
    // ▲▲▲【Supabase】初期化完了

    const updatedCharacter = await prisma.$transaction(async (tx) => {
      // (画像削除・追加ロジックは変更なし)
      const imagesToDeleteString = formData.get('imagesToDelete') as string;
      if (imagesToDeleteString) {
        const imagesToDelete: number[] = JSON.parse(imagesToDeleteString);
        if (imagesToDelete.length > 0) {
          const images = await tx.character_images.findMany({ where: { id: { in: imagesToDelete } } });
          for (const img of images) {
            try {
              // URLかローカルパスかを判定して適切に処理
              if (img.imageUrl.startsWith('http://') || img.imageUrl.startsWith('https://')) {
                // Supabase Storageなど外部URLの場合はスキップ（Netlify環境では削除不要）
                console.log(`外部ストレージのファイルのため削除をスキップ: ${img.imageUrl}`);
              } else {
                // ローカルファイルの場合のみ物理削除
                await fs.unlink(path.join(process.cwd(), 'public', img.imageUrl));
              }
            } catch (e) {
              console.error(`ファイルの物理削除に失敗: ${img.imageUrl}`, e);
            }
          }
          await tx.character_images.deleteMany({ where: { id: { in: imagesToDelete } } });
        }
      }
      
      const newImageCountString = formData.get('newImageCount') as string;
      const newImageCount = newImageCountString ? parseInt(newImageCountString, 10) : 0;
      const newImageMetas: { characterId: number; imageUrl: string; keyword: string; isMain: boolean; displayOrder: number; }[] = [];
      const existingImageCount = await tx.character_images.count({ where: { characterId: characterIdToUpdate }});
      let displayOrderCounter = existingImageCount;
      
      // ▼▼▼【Supabase】新しい画像をSupabase Storageにアップロード
      for (let i = 0; i < newImageCount; i++) {
        const file = formData.get(`new_image_${i}`) as File | null;
        const keyword = formData.get(`new_keyword_${i}`) as string || '';
        if (file && file.size > 0) {
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
            console.error(`[PUT] Supabaseアップロード失敗(index=${i}):`, uploadErr);
            throw new Error('画像アップロードに失敗しました。');
          }

          const { data: pub } = sb.storage.from(bucket).getPublicUrl(objectKey);
          const imageUrl = pub.publicUrl;

          newImageMetas.push({
            characterId: characterIdToUpdate,
            imageUrl: imageUrl,
            keyword,
            isMain: false,
            displayOrder: displayOrderCounter++,
          });
        }
      }
      if (newImageMetas.length > 0) {
        await tx.character_images.createMany({ data: newImageMetas });
      }
      // ▲▲▲【Supabase】アップロード完了
      
      // ▼▼▼【核心的な修正】既存のロアブックを全て削除し、新しいロアブックをベクトル化して再作成します。▼▼▼
      await tx.lorebooks.deleteMany({
        where: { characterId: characterIdToUpdate },
      });
      if (lorebooks.length > 0) {
        for (const lore of lorebooks) {
            const embedding = await getEmbedding(lore.content);
            const embeddingString = `[${embedding.join(',')}]`;
            await tx.$executeRaw`
                INSERT INTO "lorebooks" ("content", "keywords", "characterId", "embedding")
                VALUES (${lore.content}, ${lore.keywords || []}::text[], ${characterIdToUpdate}, ${embeddingString}::vector)
            `;
        }
      }
      // ▲▲▲ 修正完了 ▲▲▲

      return await tx.characters.update({
        where: { id: characterIdToUpdate },
        data: {
          name: formData.get('name') as string,
          description: formData.get('description') as string,
          systemTemplate: formData.get('systemTemplate') as string,
          firstSituation: formData.get('firstSituation') as string,
          firstMessage: formData.get('firstMessage') as string,
          visibility: formData.get('visibility') as string,
          safetyFilter: formData.get('safetyFilter') === 'true',
          category: formData.get('category') as string,
          hashtags: JSON.parse(formData.get('hashtags') as string || '[]'),
          detailSetting: formData.get('detailSetting') as string,
          firstSituationDate: firstSituationDate ? new Date(firstSituationDate) : null,
          firstSituationPlace: firstSituationPlace,
        }
      });
    });

    // ▼▼▼【核心的な修正】キャラクター更新後、関連する全てのチャットルームのRedisキャッシュを削除（無効化）します。▼▼▼
    console.log(`キャラクター更新成功: ${characterIdToUpdate}。関連キャッシュを無効化します。`);
    const chatsToInvalidate = await prisma.chat.findMany({
      where: { characterId: characterIdToUpdate },
      select: { id: true }
    });

    if (chatsToInvalidate.length > 0) {
      // ▼▼▼【重要】 キャッシュキーを `chat:[chatId]:room` に修正します。
      const cacheKeys = chatsToInvalidate.map(chat => `chat:${chat.id}:room`);
      await redis.del(...cacheKeys);
      console.log(`キャッシュ削除完了: ${cacheKeys.join(', ')}`);
    }
    // ▲▲▲ 修正完了 ▲▲▲

    return NextResponse.json(updatedCharacter);

  } catch (error) {
    console.error('キャラクターの更新エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。', details: (error as Error).message }, { status: 500 });
  }
}

/**
 * キャラクター削除（DELETE）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const characterIdToDelete = Number.parseInt(id, 10);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const currentUser = session.user;

  if (isNaN(characterIdToDelete)) {
    return NextResponse.json({ error: '無効なIDです。'}, { status: 400 });
  }

  try {
    const characterToDelete = await prisma.characters.findUnique({
      where: { id: characterIdToDelete },
      include: { characterImages: true }
    });

    if (!characterToDelete) {
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }

    const isOwner = characterToDelete.author_id === parseInt(currentUser.id, 10);
    const hasAdminPermission = currentUser.role === Role.CHAR_MANAGER || currentUser.role === Role.SUPER_ADMIN;

    if (!isOwner && !hasAdminPermission) {
      return NextResponse.json({ error: 'このキャラクターを削除する権限がありません。' }, { status: 403 });
    }
    
    for (const img of characterToDelete.characterImages) {
      try {
        // URLかローカルパスかを判定して適切に処理
        if (img.imageUrl.startsWith('http://') || img.imageUrl.startsWith('https://')) {
          // Supabase Storageなど外部URLの場合はスキップ（Netlify環境では削除不要）
          console.log(`外部ストレージのファイルのため削除をスキップ: ${img.imageUrl}`);
        } else {
          // ローカルファイルの場合のみ物理削除
          const filePath = path.join(process.cwd(), 'public', img.imageUrl);
          await fs.unlink(filePath);
        }
      } catch (e) {
        console.error(`ファイルの物理削除に失敗: ${img.imageUrl}`, e);
      }
    }
    
    await prisma.characters.delete({
      where: { id: characterIdToDelete },
    });

    // ▼▼▼【追加】キャラクター削除後、関連キャッシュも削除します。▼▼▼
    const chatsToInvalidate = await prisma.chat.findMany({
      where: { characterId: characterIdToDelete },
      select: { id: true }
    });
    if (chatsToInvalidate.length > 0) {
      // ▼▼▼【重要】 キャッシュキーを `chat:[chatId]:room` に修正します。
      const cacheKeys = chatsToInvalidate.map(chat => `chat:${chat.id}:room`);
      await redis.del(...cacheKeys);
      console.log(`キャラクター削除に伴いキャッシュを削除: ${cacheKeys.join(', ')}`);
    }
    // ▲▲▲ 追加完了 ▲▲▲

    return NextResponse.json({ message: 'キャラクターが正常に削除されました。' }, { status: 200 });

  } catch (error) {
    console.error('キャラクターの削除エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
