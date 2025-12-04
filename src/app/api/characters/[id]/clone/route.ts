export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import { Role } from '@prisma/client';

/**
 * POST /api/characters/[id]/clone
 * 既存キャラクターを元に新しいキャラクターを複製して作成する
 * 画像とロアブックも含めてコピーする（画像は同じURLを参照）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isBuildTime()) return buildTimeResponse();

  const { id } = await params;
  const sourceCharacterId = Number.parseInt(id, 10);

  if (isNaN(sourceCharacterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const currentUserId = parseInt(session.user.id, 10);
  const userRole = session.user.role as Role | undefined;

  try {
    const prisma = await getPrisma();

    // 元キャラクター取得
    const source = await prisma.characters.findUnique({
      where: { id: sourceCharacterId },
      include: {
        characterImages: { orderBy: { displayOrder: 'asc' } },
        lorebooks: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }

    const isOwner = source.author_id === currentUserId;
    const isAdmin =
      userRole === Role.SUPER_ADMIN ||
      userRole === Role.CHAR_MANAGER;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'このキャラクターを複製する権限がありません。' },
        { status: 403 }
      );
    }

    // 複製処理
    const cloned = await prisma.$transaction(async (tx) => {
      const clonedCharacter = await tx.characters.create({
        data: {
          name: `${source.name} (コピー)`,
          description: source.description,
          systemTemplate: source.systemTemplate,
          firstSituation: source.firstSituation,
          firstMessage: source.firstMessage,
          visibility: source.visibility,
          safetyFilter: source.safetyFilter ?? true,
          category: source.category,
          hashtags: source.hashtags,
          detailSetting: source.detailSetting,
          statusWindowPrompt: source.statusWindowPrompt,
          statusWindowDescription: source.statusWindowDescription,
          firstSituationDate: source.firstSituationDate,
          firstSituationPlace: source.firstSituationPlace,
          author: { connect: { id: currentUserId } },
        },
      });

      // 画像コピー（同じURLを参照）
      if (source.characterImages?.length) {
        await tx.character_images.createMany({
          data: source.characterImages.map((img) => ({
            characterId: clonedCharacter.id,
            imageUrl: img.imageUrl,
            keyword: img.keyword ?? '',
            isMain: img.isMain,
            displayOrder: img.displayOrder,
          })),
        });
      }

      // ロアブックコピー（embedding もそのままコピー）
      if (source.lorebooks?.length) {
        for (const lore of source.lorebooks) {
          await tx.$executeRaw`
            INSERT INTO "lorebooks" ("content", "keywords", "characterId", "embedding")
            VALUES (${lore.content}, ${lore.keywords}::text[], ${clonedCharacter.id}, ${lore.embedding}::vector)
          `;
        }
      }

      return clonedCharacter;
    });

    return NextResponse.json(
      { message: 'キャラクターを複製しました。', character: cloned },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Clone Character] 複製処理エラー:', error);
    return NextResponse.json(
      { error: 'キャラクターの複製中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}


