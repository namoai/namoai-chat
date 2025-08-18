export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { createClient } from '@supabase/supabase-js';

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