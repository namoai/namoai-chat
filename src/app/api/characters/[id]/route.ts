export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';

type LorebookData = {
  id?: number;
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

export async function GET(request: NextRequest) {
  const characterId = extractIdFromRequest(request);
  if (characterId === null) {
    return NextResponse.json({ error: '無効なIDです。'}, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;

    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      include: {
        characterImages: { 
          select: {
            id: true,
            imageUrl: true,
            keyword: true
          },
          orderBy: { 
            displayOrder: 'asc' 
          } 
        },
        author: { select: { id: true, name: true, nickname: true } },
        _count: { select: { favorites: true, chat: true } },
        lorebooks: true,
      }
    });

    if (!character) {
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }
    
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

    return NextResponse.json(character);

  } catch (error) {
    console.error('キャラクター詳細の取得エラー:', error);
    if (error instanceof Error && error.message.includes("relation \"Block\" does not exist")) {
        return NextResponse.json({ 
            error: 'サーバーエラー: Blockテーブルがデータベースに存在しません。DBスキーマを確認してください。' 
        }, { status: 500 });
    }
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// PUT, DELETE メソッドは変更ありません
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

        const lorebooksString = formData.get('lorebooks') as string;
        const lorebooks: LorebookData[] = lorebooksString ? JSON.parse(lorebooksString) : [];
        const firstSituationDate = formData.get('firstSituationDate') as string;
        const firstSituationPlace = formData.get('firstSituationPlace') as string;

        const updatedCharacter = await prisma.$transaction(async (tx) => {
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
            
            await tx.lorebooks.deleteMany({
                where: { characterId: characterIdToUpdate },
            });
            if (lorebooks.length > 0) {
                await tx.lorebooks.createMany({
                    data: lorebooks.map(lore => ({
                        content: lore.content,
                        keywords: lore.keywords,
                        characterId: characterIdToUpdate,
                    }))
                });
            }

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

        return NextResponse.json(updatedCharacter);

    } catch (error) {
        console.error('キャラクターの更新エラー:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました。', details: (error as Error).message }, { status: 500 });
    }
}

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
        
        await prisma.characters.delete({
            where: { id: characterIdToDelete },
        });

        return NextResponse.json({ message: 'キャラクターが正常に削除されました。' }, { status: 200 });

    } catch (error) {
        console.error('キャラクターの削除エラー:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
    }
}

