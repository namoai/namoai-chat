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
    console.log(`[Export] キャラクターエクスポート開始 (ID: ${characterId})`);
    const prisma = await getPrisma();

    // キャラクター情報を取得
    console.log(`[Export] キャラクター情報を取得中...`);
    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      include: {
        characterImages: {
          orderBy: { displayOrder: 'asc' },
        },
        lorebooks: true,
      },
    });

    if (!character) {
      console.warn(`[Export] キャラクターが見つかりません (ID: ${characterId})`);
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }

    console.log(`[Export] キャラクター情報取得成功: ${character.name}, 画像数: ${character.characterImages.length}, ロアブック数: ${character.lorebooks.length}`);

    // 権限チェック: 所有者または管理者のみ
    const isOwner = character.author_id === currentUserId;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'CHAR_MANAGER';

    if (!isOwner && !isAdmin) {
      console.warn(`[Export] 権限がありません (ユーザーID: ${currentUserId}, キャラクター所有者: ${character.author_id})`);
      return NextResponse.json({ error: 'このキャラクターをエクスポートする権限がありません。' }, { status: 403 });
    }

    // ZIPファイルを作成
    console.log(`[Export] ZIPファイルを作成中...`);
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
    if (imagesFolder && character.characterImages.length > 0) {
      // displayOrder順にソート（既にorderByでソートされているが、念のため）
      const sortedImages = [...character.characterImages].sort((a, b) => a.displayOrder - b.displayOrder);
      
      console.log(`[Export] ${sortedImages.length} 枚の画像をダウンロード開始...`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < sortedImages.length; i++) {
        const img = sortedImages[i];
        try {
          console.log(`[Export] 画像 ${i + 1}/${sortedImages.length} ダウンロード開始: ${img.imageUrl}`);
          
          if (!img.imageUrl || img.imageUrl.trim() === '') {
            console.warn(`[Export] 画像 ${i + 1}/${sortedImages.length}: URLが空です`);
            failCount++;
            continue;
          }
          
          // URLからクエリパラメータを削除して元の画像を取得
          let cleanUrl = img.imageUrl.split('?')[0].trim();
          
          // 相対URLの場合は絶対URLに変換
          if (cleanUrl.startsWith('/')) {
            const requestUrl = new URL(request.url);
            cleanUrl = `${requestUrl.protocol}//${requestUrl.host}${cleanUrl}`;
            console.log(`[Export] 相対URLを絶対URLに変換: ${cleanUrl}`);
          }
          
          // fetchで画像をダウンロード（リダイレクトを許可、タイムアウト設定）
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト
          
          try {
            const imageResponse = await fetch(cleanUrl, {
              method: 'GET',
              headers: {
                'Accept': 'image/*',
                'User-Agent': 'Mozilla/5.0',
              },
              redirect: 'follow',
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              
              if (imageBuffer.byteLength === 0) {
                console.error(`[Export] ❌ 画像 ${i + 1}/${sortedImages.length}: ダウンロードしたデータが空です`);
                failCount++;
                continue;
              }
              
              const contentType = imageResponse.headers.get('content-type') || 'image/png';
              
              // Content-Typeから拡張子を決定
              let extension = 'png';
              if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                extension = 'jpg';
              } else if (contentType.includes('webp')) {
                extension = 'webp';
              } else if (contentType.includes('gif')) {
                extension = 'gif';
              } else {
                // URLから拡張子を抽出を試みる
                const urlMatch = cleanUrl.match(/\.(png|jpg|jpeg|webp|gif)(\?|$|#)/i);
                if (urlMatch) {
                  extension = urlMatch[1].toLowerCase();
                }
              }
              
              // シンプルなファイル名: image_0.png, image_1.jpg など
              const filename = `image_${i}.${extension}`;
              imagesFolder.file(filename, imageBuffer);
              successCount++;
              console.log(`[Export] ✅ 画像 ${i + 1}/${sortedImages.length} ZIPに追加成功: ${filename} (${imageBuffer.byteLength} bytes, ${contentType})`);
            } else {
              console.error(`[Export] ❌ 画像 ${i + 1}/${sortedImages.length} ダウンロード失敗: HTTP ${imageResponse.status} ${imageResponse.statusText}`);
              console.error(`[Export] URL: ${img.imageUrl} -> ${cleanUrl}`);
              failCount++;
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              console.error(`[Export] ❌ 画像 ${i + 1}/${sortedImages.length} ダウンロードタイムアウト (30秒)`);
            } else {
              throw fetchError;
            }
            failCount++;
          }
        } catch (error) {
          console.error(`[Export] ❌ 画像 ${i + 1}/${sortedImages.length} ダウンロードエラー:`, error);
          console.error(`[Export] URL: ${img.imageUrl}`);
          console.error(`[Export] エラー詳細:`, error instanceof Error ? error.stack : String(error));
          failCount++;
          // 画像のダウン로ードに失敗しても続行
        }
      }
      console.log(`[Export] 画像ダウンロード処理完了: 成功 ${successCount}枚, 失敗 ${failCount}枚`);
    } else {
      console.log(`[Export] 画像がありません（スキップ）`);
    }

    // ZIPファイルを生成
    console.log(`[Export] ZIPファイルを生成中...`);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    console.log(`[Export] ZIPファイル生成完了: ${zipBuffer.length} bytes`);

    // ファイル名を生成
    const safeName = character.name.replace(/[^a-zA-Z0-9가-힣ひらがなカタカナ漢字_-]/g, '_');
    const filename = `${safeName}_${characterId}_${Date.now()}.zip`;

    // BufferをUint8Arrayに変換してNextResponseに渡す
    const uint8Array = new Uint8Array(zipBuffer);

    console.log(`[Export] エクスポート完了。ファイル名: ${filename}, サイズ: ${uint8Array.length} bytes`);

    // レスポンスを返す
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': uint8Array.length.toString(),
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

