export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

const prisma = new PrismaClient();

// ✅ Vercelビルドエラーを回避するため、URLから直接IDを解析するヘルパー関数
function extractIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  // APIパスの最後の部分をIDとして取得します (例: /api/characters/123 -> "123")
  const idStr = url.pathname.split('/').pop();
  if (!idStr) return null;
  const parsedId = parseInt(idStr, 10);
  return isNaN(parsedId) ? null : parsedId;
}

// GET: 特定のキャラクターの詳細情報を取得します（公開ページ用）
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const characterId = extractIdFromRequest(request);
  if (characterId === null) {
    return NextResponse.json({ error: '無効なIDです。'}, { status: 400 });
  }

  try {
    const character = await prisma.characters.findUnique({
      where: {
        id: characterId,
      },
      include: {
        characterImages: {
            orderBy: {
                displayOrder: 'asc'
            }
        },
        author: {
          select: {
            id: true,
            name: true,
            nickname: true,
          }
        },
        _count: {
          select: { 
            favorites: true,
            chat: true,
          }
        }
      }
    });

    if (!character) {
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
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
    const userId = parseInt(session.user.id, 10);

    if (characterIdToUpdate === null || isNaN(userId)) {
      return NextResponse.json({ error: '無効なIDです。'}, { status: 400 });
    }

    try {
        const formData = await request.formData();

        const originalCharacter = await prisma.characters.findFirst({
            where: { id: characterIdToUpdate, author_id: userId }
        });

        if (!originalCharacter) {
            return NextResponse.json({ error: 'キャラクターが見つからないか、更新権限がありません。' }, { status: 404 });
        }

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
            
            const dataToUpdate = {
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
            };

            return await tx.characters.update({
                where: { id: characterIdToUpdate },
                data: dataToUpdate
            });
        });

        return NextResponse.json(updatedCharacter);

    } catch (error) {
        console.error('キャラクターの更新エラー:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
    }
}

// DELETE: 特定のキャラクターを削除します (変更なし)
export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
    }

    const characterId = extractIdFromRequest(request);
    const userId = parseInt(session.user.id, 10);

    if (characterId === null || isNaN(userId)) {
        return NextResponse.json({ error: '無効なIDです。'}, { status: 400 });
    }

    try {
        const character = await prisma.characters.findFirst({
            where: {
                id: characterId,
                author_id: userId,
            },
            include: { characterImages: true }
        });

        if (!character) {
            return NextResponse.json({ error: 'キャラクターが見つからないか、削除権限がありません。' }, { status: 404 });
        }
        
        for (const img of character.characterImages) {
            const filePath = path.join(process.cwd(), 'public', img.imageUrl);
            try {
                await fs.unlink(filePath);
            } catch (e) {
                console.error(`ファイルの物理削除に失敗: ${filePath}`, e);
            }
        }

        await prisma.characters.delete({
            where: { id: characterId },
        });

        return NextResponse.json({ message: 'キャラクターが正常に削除されました。' }, { status: 200 });

    } catch (error) {
        console.error('キャラクターの削除エラー:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
    }
}
