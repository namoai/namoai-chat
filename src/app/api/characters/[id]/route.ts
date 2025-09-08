export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';

// ▼▼▼【追加】ロアブックの型定義 ▼▼▼
type LorebookData = {
  id?: number; // 既存のロアブックはIDを持つ可能性があります
  content: string;
  keywords: string[];
};

function extractIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  const idStr = url.pathname.split('/').pop();
  if (!idStr) return null;
  const parsedId = parseInt(idStr, 10);
  return isNaN(parsedId) ? null : parsedId;
}

// GET: 特定のキャラクターの詳細情報を取得します（公開・非公開をハンドリング）
export async function GET(request: NextRequest) {
  const characterId = extractIdFromRequest(request);
  if (characterId === null) {
    return NextResponse.json({ error: '無効なIDです。'}, { status: 400 });
  }

  try {
    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      include: {
        // ▼▼▼【修正】取得するデータにロアブックを追加します ▼▼▼
        characterImages: { 
          select: {
            id: true, // 編集のためにIDも取得
            imageUrl: true,
            keyword: true
          },
          orderBy: { 
            displayOrder: 'asc' 
          } 
        },
        author: { select: { id: true, name: true, nickname: true } },
        _count: { select: { favorites: true, chat: true } },
        lorebooks: true, // ロアブックデータを取得
      }
    });

    if (!character) {
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }

    if (character.visibility === 'private') {
      const session = await getServerSession(authOptions);
      // user.idはstringなので、numberに変換して比較します
      if (session?.user?.id !== character.author_id?.toString()) {
        return NextResponse.json({ error: 'このキャラクターは非公開です。' }, { status: 403 });
      }
    }

    return NextResponse.json(character);

  } catch (error) {
    console.error('キャラクター詳細の取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// PUT: キャラクター情報を更新します
export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
    }

    const characterIdToUpdate = extractIdFromRequest(request);
    const currentUser = session.user;

    if (characterIdToUpdate === null) {
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

        // ▼▼▼【修正】ロアブックと追加情報をフォームデータからパースします ▼▼▼
        const lorebooksString = formData.get('lorebooks') as string;
        const lorebooks: LorebookData[] = lorebooksString ? JSON.parse(lorebooksString) : [];
        const firstSituationDate = formData.get('firstSituationDate') as string;
        const firstSituationPlace = formData.get('firstSituationPlace') as string;

        // トランザクション内でキャラクター、ロアブック、画像を更新します
        const updatedCharacter = await prisma.$transaction(async (tx) => {
            // 画像削除処理 (既存のコード)
            const imagesToDeleteString = formData.get('imagesToDelete') as string;
            if (imagesToDeleteString) {
                const imagesToDelete: number[] = JSON.parse(imagesToDeleteString);
                if (imagesToDelete.length > 0) {
                    const images = await tx.character_images.findMany({ where: { id: { in: imagesToDelete } } });
                    for (const img of images) {
                        try {
                            await fs.unlink(path.join(process.cwd(), 'public', img.imageUrl));
                        } catch (e) {
                            console.error(`ファイルの物理削除に失敗: ${img.imageUrl}`, e);
                        }
                    }
                    await tx.character_images.deleteMany({ where: { id: { in: imagesToDelete } } });
                }
            }
            
            // 新規画像追加処理 (既存のコード)
            const newImageCountString = formData.get('newImageCount') as string;
            const newImageCount = newImageCountString ? parseInt(newImageCountString, 10) : 0;
            const newImageMetas: { characterId: number; imageUrl: string; keyword: string; isMain: boolean; displayOrder: number; }[] = [];
            const existingImageCount = await tx.character_images.count({ where: { characterId: characterIdToUpdate }});
            let displayOrderCounter = existingImageCount;
            for (let i = 0; i < newImageCount; i++) {
                const file = formData.get(`new_image_${i}`) as File | null;
                const keyword = formData.get(`new_keyword_${i}`) as string || '';
                if (file && file.size > 0) {
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
                    const savePath = path.join(process.cwd(), 'public/uploads', filename);
                    await fs.mkdir(path.dirname(savePath), { recursive: true });
                    await fs.writeFile(savePath, buffer);
                    newImageMetas.push({
                        characterId: characterIdToUpdate,
                        imageUrl: `/uploads/${filename}`,
                        keyword,
                        isMain: false,
                        displayOrder: displayOrderCounter++,
                    });
                }
            }
            if (newImageMetas.length > 0) {
                await tx.character_images.createMany({ data: newImageMetas });
            }
            
            // ▼▼▼【新規追加】ロアブック更新ロジック ▼▼▼
            // 1. 既存のロアブックをすべて削除します
            await tx.lorebooks.deleteMany({
                where: { characterId: characterIdToUpdate },
            });
            // 2. 新しいロアブックリストを登録します
            if (lorebooks.length > 0) {
                await tx.lorebooks.createMany({
                    data: lorebooks.map(lore => ({
                        content: lore.content,
                        keywords: lore.keywords,
                        characterId: characterIdToUpdate,
                    }))
                });
            }

            // キャラクター本体の情報を更新します
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
                    // ▼▼▼【追加】日付と場所のデータを更新します ▼▼▼
                    firstSituationDate: firstSituationDate ? new Date(firstSituationDate) : null,
                    firstSituationPlace: firstSituationPlace,
                }
            });
        });

        return NextResponse.json(updatedCharacter);

    } catch (error) {
        console.error('キャラクターの更新エラー:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました。', details: (error as Error).message }, { status: 500 });
    }
}

// DELETE: 特定のキャラクターを削除します (変更なし)
export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
    }

    const characterIdToDelete = extractIdFromRequest(request);
    const currentUser = session.user;

    if (characterIdToDelete === null) {
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
            const filePath = path.join(process.cwd(), 'public', img.imageUrl);
            try {
                await fs.unlink(filePath);
            } catch (e) {
                console.error(`ファイルの物理削除に失敗: ${filePath}`, e);
            }
        }
        
        // characterが削除されると、`onDelete: Cascade`設定により、関連するlorebooksも自動的に削除されます。
        await prisma.characters.delete({
            where: { id: characterIdToDelete },
        });

        return NextResponse.json({ message: 'キャラクターが正常に削除されました。' }, { status: 200 });

    } catch (error) {
        console.error('キャラクターの削除エラー:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
    }
}
