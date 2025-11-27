export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/**
 * 【修正】常に新しいチャットセッションを開始する (POST)
 * - /api/chat/new
 * - Body: { characterId: number }
 */
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);

    const body = await request.json();
    const { characterId } = body;

    if (typeof characterId !== 'number') {
      return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
    }

    // ▼▼▼【追加】セーフティフィルター: ユーザーのセーフティフィルターがONで、キャラクターのセーフティフィルターがOFFの場合はチャット作成を拒否
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { safetyFilter: true },
    });
    const userSafetyFilter = user?.safetyFilter ?? true; // デフォルトはtrue（フィルターON）

    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      select: { safetyFilter: true },
    });

    if (!character) {
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }

    // ユーザーのセーフティフィルターがONで、キャラクターのセーフティフィルターがOFFの場合
    if (userSafetyFilter && character.safetyFilter === false) {
      console.log(`[POST /api/chat/new] セーフティフィルター: ユーザーのフィルターがON、キャラクターのフィルターがOFFのためチャット作成拒否`);
      return NextResponse.json({ 
        error: 'このキャラクターはセーフティフィルターがオフのため、セーフティフィルターがONの状態ではチャットを開始できません。' 
      }, { status: 403 });
    }
    // ▲▲▲

    // ▼▼▼【変更点】▼▼▼
    // 既存のチャットを探すロジックを削除し、常に新しいチャットを強制的に作成する。
    // これにより、「新しいチャットを開始」ボタンがその名の通りに機能するようになります。
    const chat = await prisma.chat.create({
      data: {
        userId,
        characterId,
        autoSummarize: true, // デフォルト値
      },
    });

    return NextResponse.json({ chatId: chat.id });
    
  } catch (error) {
    console.error('/api/chat/new エラー:', error);
    return NextResponse.json({ error: 'チャットセッションの作成に失敗しました。' }, { status: 500 });
  }
}