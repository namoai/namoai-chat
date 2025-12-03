export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import JSZip from 'jszip';

/**
 * キャラクターをZIPファイルとしてエクスポート
 * キャラクター情報、画像、ロアブックを含む
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isBuildTime()) return buildTimeResponse();

  const { id } = await params;
  const characterId = Number.parseInt(id, 10);
  
  if (isNaN(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const currentUserId = parseInt(session.user.id, 10);
  const userRole = session.user.role;

  try {
    const prisma = await getPrisma();

    // キャラクター情報を取得
    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      include: {
        characterImages: true,
        lorebooks: true,
      },
    });

    if (!character) {
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }

    // 権限チェック: 所有者または管理者のみ
    const isOwner = character.author_id === currentUserId;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'CHAR_MANAGER';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'このキャラクターをエクスポートする権限がありません。' }, { status: 403 });
    }

    // ZIPファイルを作成
    const zip = new JSZip();

    // キャラクター情報をJSONとして保存
    const characterData = {
      name: character.name,
      description: character.description,
      systemTemplate: character.systemTemplate,
      firstSituation: character.firstSituation,
      firstMessage: character.firstMessage,
      visibility: character.visibility,
      safetyFilter: character.safetyFilter,
      category: character.category,
      hashtags: character.hashtags,
      detailSetting: character.detailSetting,
      statusWindowPrompt: character.statusWindowPrompt,
      statusWindowDescription: character.statusWindowDescription,
      characterImages: character.characterImages.map(img => ({
        imageUrl: img.imageUrl,
        keyword: img.keyword,
        isMain: img.isMain,
        displayOrder: img.displayOrder,
      })),
      lorebooks: character.lorebooks.map(lore => ({
        content: lore.content,
        keywords: lore.keywords,
      })),
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
    };

    zip.file('character.json', JSON.stringify(characterData, null, 2));

    // 画像をダウンロードしてZIPに追加
    const imagesFolder = zip.folder('images');
    if (imagesFolder) {
      for (let i = 0; i < character.characterImages.length; i++) {
        const img = character.characterImages[i];
        try {
          const imageResponse = await fetch(img.imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const urlParts = img.imageUrl.split('.');
            const extension = urlParts[urlParts.length - 1]?.split('?')[0] || 'png';
            const filename = `image_${i}_${img.isMain ? 'main' : i}.${extension}`;
            imagesFolder.file(filename, imageBuffer);
          }
        } catch (error) {
          console.error(`[Export] 画像ダウンロードエラー: ${img.imageUrl}`, error);
          // 画像のダウンロードに失敗しても続行
        }
      }
    }

    // ZIPファイルを生成
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    // ファイル名を生成
    const safeName = character.name.replace(/[^a-zA-Z0-9가-힣ひらがなカタカナ漢字_-]/g, '_');
    const filename = `${safeName}_${characterId}_${Date.now()}.zip`;

    // BufferをUint8Arrayに変換してNextResponseに渡す
    const uint8Array = new Uint8Array(zipBuffer);

    // レスポンスを返す
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error(`[Export] エクスポートエラー (ID: ${characterId}):`, error);
    const errorMessage = error instanceof Error ? error.message : '不明なサーバーエラーが発生しました。';
    return NextResponse.json(
      { error: `エクスポート処理中にエラーが発生しました: ${errorMessage}` },
      { status: 500 }
    );
  }
}

