export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";

// ▼▼▼【追加】リクエストボディの型を定義します ▼▼▼
type RequestBody = {
  chatId?: number;
  characterId?: number;
  forceNew?: boolean;
}
// ▲▲▲【追加】ここまで ▲▲▲

/**
 * POST /api/chats/find-or-create
 * Body:
 * - chatId?: number            ← あればこれだけで検索 (所有者検証)
 * - characterId?: number       ← なければchatIdが必要
 * - forceNew?: boolean         ← trueならcharacterIdで常に新規作成
 *
 * ポリシー:
 * - chatId があれば最優先でそのチャットのみ返却（所有者チェック込み）
 * - forceNew=true なら characterId で常に新規作成
 * - それ以外は「同一ユーザ×同一キャラの最新(createdAt desc, id desc)」を返却し、無ければ新規作成
 *
 * 安定化ポイント:
 * - 最新選択は createdAt desc, id desc（タイムスタンプ被り時のブレ回避）
 * - chat_message は asc 固定
 */
export async function POST(req: Request) {
  try {
    // --- 認証チェック ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    // --- 入力 ---
    // ▼▼▼【修正】any型を上で定義したRequestBody型に変更します ▼▼▼
    const body: RequestBody = await req.json().catch(() => ({}));
    // ▲▲▲【修正】ここまで ▲▲▲
    const chatIdRaw = body?.chatId;
    const characterIdRaw = body?.characterId;
    const forceNew = body?.forceNew === true;

    // 1) chatId 指定があれば最優先でそのレコードだけ返す（所有者チェック）
    if (chatIdRaw != null) {
      const chatId = Number(chatIdRaw);
      if (!Number.isFinite(chatId)) {
        return NextResponse.json({ error: "Invalid chatId" }, { status: 400 });
      }
      const exact = await prisma.chat.findFirst({
        where: { id: chatId, userId },
        include: { chat_message: { orderBy: { createdAt: "asc" } } },
      });
      if (!exact) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(exact);
    }

    // chatId が無い場合は characterId が必要
    const characterId = Number(characterIdRaw);
    if (!Number.isFinite(characterId)) {
      return NextResponse.json(
        { error: "Either chatId or a valid characterId is required" },
        { status: 400 }
      );
    }

    // ★ タイムスタンプ（スキーマで default/updatedAt が無い場合の保険）
    const now = new Date();

    // 2) 強制新規
    if (forceNew) {
      const created = await prisma.chat.create({
        data: {
          userId,
          characterId,
          createdAt: now,
          updatedAt: now,
        },
        include: {
          chat_message: { orderBy: { createdAt: "asc" } },
        },
      });
      return NextResponse.json(created);
    }

    // 3) 既存があれば最新を返す（無ければ作る）
    const latest = await prisma.chat.findFirst({
      where: { userId, characterId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { chat_message: { orderBy: { createdAt: "asc" } } },
    });

    if (latest) {
      return NextResponse.json(latest);
    }

    const created = await prisma.chat.create({
      data: {
        userId,
        characterId,
        createdAt: now,
        updatedAt: now,
      },
      include: { chat_message: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json(created);
  } catch (err) {
    console.error("[find-or-create] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
