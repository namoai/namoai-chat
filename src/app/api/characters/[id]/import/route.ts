export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from "@/lib/prisma";

interface SourceImage {
  imageUrl: string;
  keyword?: string;
  isMain: boolean;
  displayOrder: number;
}

// ✅ [id]를 URL에서 직접 파싱
function extractIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  const id = url.pathname.split('/').filter(Boolean).pop();
  if (!id) return null;
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
}

export async function GET(request: Request) {
  const characterId = extractIdFromRequest(request);
  if (characterId === null) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  const character = await prisma.characters.findUnique({
    where: { id: characterId },
    include: {
      characterImages: true,
    },
  });

  if (!character) {
    return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
  }

  return NextResponse.json(character);
}

export async function POST(request: Request) {
  const characterId = extractIdFromRequest(request);
  if (characterId === null) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const sourceCharacterData = await request.json();

  const targetCharacter = await prisma.characters.findFirst({
    where: { id: characterId, author_id: userId },
  });

  if (!targetCharacter) {
    return NextResponse.json({ error: 'キャラクターが見つからないか、権限がありません。' }, { status: 404 });
  }

  const updatedCharacter = await prisma.$transaction(async (tx) => {
    await tx.character_images.deleteMany({ where: { characterId } });

    if (Array.isArray(sourceCharacterData.characterImages)) {
      const newImageMetas = (sourceCharacterData.characterImages as SourceImage[]).map((img) => ({
        characterId,
        imageUrl: img.imageUrl,
        keyword: img.keyword || '',
        isMain: img.isMain,
        displayOrder: img.displayOrder,
      }));

      if (newImageMetas.length > 0) {
        await tx.character_images.createMany({ data: newImageMetas });
      }
    }

    const dataToUpdate = {
      name: sourceCharacterData.name,
      description: sourceCharacterData.description,
      systemTemplate: sourceCharacterData.systemTemplate,
      firstSituation: sourceCharacterData.firstSituation,
      firstMessage: sourceCharacterData.firstMessage,
      visibility: sourceCharacterData.visibility,
      safetyFilter: sourceCharacterData.safetyFilter,
      category: sourceCharacterData.category,
      hashtags: sourceCharacterData.hashtags,
      detailSetting: sourceCharacterData.detailSetting,
    };

    return await tx.characters.update({
      where: { id: characterId },
      data: dataToUpdate,
      include: {
        characterImages: true,
      },
    });
  });

  return NextResponse.json(updatedCharacter);
}