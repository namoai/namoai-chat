export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/chats/find-or-create
 * Body:
 *  - characterId: number (必須)
 *  - chatId?: number
 *  - forceNew?: boolean
 *
 * ポリシー:
 *  - forceNew=true の場合は常に新規作成
 *  - chatId が指定されていれば、そのチャットのみ返却（所有者チェック込み）
 *  - 上記以外は「同一ユーザ×同一キャラの最新」を返却し、無ければ新規作成
 *
 * 備考:
 *  - Prisma の型が unchecked create にマッチしており、updatedAt が必須になっているため
 *    data に createdAt/updatedAt を明示的に指定してエラーを回避する。
 *  - スキーマ側で `updatedAt @updatedAt`／`createdAt @default(now())` を設定すれば
 *    本来この指定は不要になる（将来的にスキーマ修正を推奨）。
 */
export async function POST(req: Request) {
  try {
    // --- 認証チェック ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = Number(session.user.id);

    // --- 入力 ---
    const body = await req.json();
    const characterId = Number(body?.characterId);
    const chatIdRaw = body?.chatId;
    const forceNew = body?.forceNew === true;

    if (!Number.isFinite(characterId)) {
      return NextResponse.json({ error: 'Invalid characterId' }, { status: 400 });
    }

    // ★ タイムスタンプ（unchecked create の必須項目対策）
    const now = new Date();

    // 1) 新規作成を強制
    if (forceNew) {
      const created = await prisma.chat.create({
        data: {
          // unchecked ルートに乗るためスカラーで指定
          userId,
          characterId,
          createdAt: now,   // スキーマで default(now) がない場合に備えて明示
          updatedAt: now,   // スキーマで @updatedAt がないため必須
        },
        include: {
          chat_message: { orderBy: { createdAt: 'asc' } },
        },
      });
      return NextResponse.json(created);
    }

    // 2) chatId 指定（所有者チェック）
    if (chatIdRaw != null) {
      const chatId = Number(chatIdRaw);
      if (!Number.isFinite(chatId)) {
        return NextResponse.json({ error: 'Invalid chatId' }, { status: 400 });
      }
      const exact = await prisma.chat.findFirst({
        where: { id: chatId, userId },
        include: { chat_message: { orderBy: { createdAt: 'asc' } } },
      });
      if (!exact) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(exact);
    }

    // 3) 既存があれば最新を返す。無ければ新規作成
    const latest = await prisma.chat.findFirst({
      where: { userId, characterId },
      orderBy: { createdAt: 'desc' },
      include: { chat_message: { orderBy: { createdAt: 'asc' } } },
    });

    if (latest) return NextResponse.json(latest);

    // 新規作成（unchecked create なのでタイムスタンプも明示）
    const created = await prisma.chat.create({
      data: {
        userId,
        characterId,
        createdAt: now,
        updatedAt: now,
      },
      include: { chat_message: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json(created);
  } catch (err) {
    console.error('[find-or-create] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
