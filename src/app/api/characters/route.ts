export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { createClient } from '@supabase/supabase-js';
// ★追加: GSM を使うためのクライアントをインポート
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'; // ← 追加

// ★追加 ───────────────────────────────────────────────────────────────
//  ランタイムで GCP サービスアカウント認証ファイルを保証
//  - Netlify/Vercel 等では SA JSON を BASE64/JSON の環境変数で渡し、/tmp に復元します
// ───────────────────────────────────────────────────────────────
async function ensureGcpCredsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;
  if (!raw && !b64) return; // 認証ファイルを用いない構成の場合はスキップ

  const fs = await import('node:fs/promises');
  const path = '/tmp/gcp-sa.json';
  const content = raw ?? Buffer.from(b64!, 'base64').toString('utf8');
  // ★修正: encoding をオブジェクト形式で指定することで型エラーを解消
  await fs.writeFile(path, content, { encoding: 'utf8' });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
}

// ★追加 ───────────────────────────────────────────────────────────────
//  Secret Manager からシークレットを取得
//  - プロジェクト ID は GCP_PROJECT_ID または GOOGLE_CLOUD_PROJECT を参照
// ───────────────────────────────────────────────────────────────
async function loadSecret(name: string, version = 'latest') {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('GCP project id が存在しません');
  const client = new SecretManagerServiceClient();
  const [acc] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/${version}`,
  });
  // ★修正: Uint8Array → Buffer に変換してから文字列化
  return acc.payload?.data ? Buffer.from(acc.payload.data).toString('utf8') : '';

}

// ★追加 ───────────────────────────────────────────────────────────────
//  Supabase 関連の環境変数をランタイムで補完
//  - 既に存在していれば変更しません（安全性のため）
// ───────────────────────────────────────────────────────────────
async function ensureSupabaseEnv() {
  await ensureGcpCredsFile();

  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = await loadSecret('SUPABASE_URL');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = await loadSecret('SUPABASE_SERVICE_ROLE_KEY');
  }

  // 値そのものは出力せず、存在フラグだけログに出す（機密情報の露出防止）
  console.info('[diag] has SUPABASE_URL?', !!process.env.SUPABASE_URL);
  console.info('[diag] has SUPABASE_SERVICE_ROLE_KEY?', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
}

type ImageMetaData = {
  url: string;
  keyword: string;
  isMain: boolean;
  displayOrder: number;
};

export async function GET() {
  console.log('[GET] キャラクター一覧取得開始');
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    console.warn('[GET] 認証エラー: セッションなし');
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id, 10);
    console.log(`[GET] ユーザーID: ${userId}`);

    const characters = await prisma.characters.findMany({
      where: { author_id: userId },
      orderBy: { id: 'desc' },
      include: {
        characterImages: {
          orderBy: { displayOrder: 'asc' },
          take: 1,
        },
        _count: {
          select: { favorites: true, interactions: true },
        },
      },
    });

    console.log(`[GET] キャラクター取得件数: ${characters.length}`);
    return NextResponse.json(characters);
  } catch (error) {
    console.error('[GET] キャラクターリスト取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('[POST] キャラクター作成処理開始');
  try {
    // ★挿入: ランタイムでシークレットを補完（ここを最初に実行）
    await ensureSupabaseEnv(); // ← 追加（既存ロジックの前段で実行）

    const formData = await request.formData();
    console.log('[POST] formData 受信成功');

    const userIdString = formData.get('userId') as string;
    console.log(`[POST] userId: ${userIdString}`);

    const name = (formData.get('name') as string) || '';
    console.log(`[POST] キャラクター名: ${name}`);

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
      console.warn('[POST] 認証情報なし');
      return NextResponse.json({ message: '認証情報が見つかりません。再度ログインしてください。' }, { status: 401 });
    }
    const userId = parseInt(userIdString, 10);
    if (isNaN(userId)) {
      console.warn('[POST] 無効なユーザーID');
      return NextResponse.json({ message: '無効なユーザーIDです。' }, { status: 400 });
    }

    if (!name.trim()) {
      console.warn('[POST] キャラクター名未入力');
      return NextResponse.json({ message: 'キャラクターの名前は必須項目です。' }, { status: 400 });
    }

    const safetyFilter = safetyFilterString === 'true';
    let hashtags: string[] = [];
    try {
      hashtags = JSON.parse(hashtagsString);
    } catch {
      console.warn('[POST] ハッシュタグJSON解析失敗');
      hashtags = [];
    }

    const imageCountString = formData.get('imageCount') as string;
    const imageCount = imageCountString ? parseInt(imageCountString, 10) : 0;
    console.log(`[POST] 画像枚数: ${imageCount}`);

    // ★挿入: ensureSupabaseEnv() 実行後に env を参照（存在しない場合は 500 を返す）
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'characters';
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[POST] 環境変数不足: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json({ message: 'サーバー設定エラー（Storage接続情報不足）' }, { status: 500 });
    }
    console.log(`[POST] Supabase接続先: ${supabaseUrl}, バケット: ${bucket}`);
    const sb = createClient(supabaseUrl, serviceRoleKey);

    const imageMetas: ImageMetaData[] = [];

    for (let i = 0; i < imageCount; i++) {
      console.log(`[POST] 画像処理開始: index=${i}`);
      const file = formData.get(`image_${i}`) as File | null;
      const keyword = (formData.get(`keyword_${i}`) as string) || '';
      if (!file || file.size === 0) {
        console.warn(`[POST] ファイルなし: index=${i}`);
        continue;
      }

      const ext = (file.type?.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
      const safeName = (file.name || `image.${ext}`).replace(/\s/g, '_');
      const objectKey = `uploads/${Date.now()}-${i}-${safeName}`;
      console.log(`[POST] アップロードキー: ${objectKey}`);

      const arrayBuffer = await file.arrayBuffer();
      console.log(`[POST] ファイルサイズ: ${arrayBuffer.byteLength} bytes`);

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
      console.log(`[POST] 公開URL: ${imageUrl}`);

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
      author: {
        connect: { id: userId },
      },
    };

    console.log('[POST] DBトランザクション開始');
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

      return await tx.characters.findUnique({
        where: { id: character.id },
        include: { characterImages: true },
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