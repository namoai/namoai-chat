export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextauth";
import { getPrisma } from "@/lib/prisma";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

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
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    // --- 認証チェック ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);

    // ▼▼▼【追加】セーフティフィルター: ユーザーのセーフティフィルター設定を取得
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { safetyFilter: true },
    });
    const userSafetyFilter = user?.safetyFilter ?? true; // デフォルトはtrue（フィルターON）
    // ▲▲▲

    // --- 入力 ---
    // ▼▼▼【修正】any型を上で定義したRequestBody型に変更します ▼▼▼
    const body: RequestBody = await req.json().catch(() => ({}));
    // ▲▲▲【修正】ここまで ▲▲▲
    const chatIdRaw = body?.chatId;
    const characterIdRaw = body?.characterId;
    const forceNew = body?.forceNew === true;

    // 1) chatId 指定があれば最優先でそのレコードだけ返す（所有者チェック）
    if (chatIdRaw != null) {
      console.time("⏱️ find-or-create: chatId指定");
      const chatId = Number(chatIdRaw);
      if (!Number.isFinite(chatId)) {
        return NextResponse.json({ error: "Invalid chatId" }, { status: 400 });
      }
      const exact = await prisma.chat.findFirst({
        where: { id: chatId, userId },
        select: {
          id: true,
          userId: true,
          characterId: true,
          createdAt: true,
          updatedAt: true,
          userNote: true,
          backMemory: true,
          autoSummarize: true,
          characters: {
            select: {
              id: true,
              safetyFilter: true,
            },
          },
          chat_message: {
            // 全てのバージョンを取得（バージョン切り替え機能のため）
            orderBy: [{ createdAt: "asc" }, { version: "asc" }],
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
              turnId: true,
              version: true,
              isActive: true,
            }
          }
        },
      });
      console.timeEnd("⏱️ find-or-create: chatId指定");
      if (!exact) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      
      // ▼▼▼【追加】セーフティフィルター: ユーザーのセーフティフィルターがONで、キャラクターのセーフティフィルターがOFFの場合はアクセス拒否
      if (userSafetyFilter && exact.characters?.safetyFilter === false) {
        console.log(`[POST /api/chats/find-or-create] セーフティフィルター: ユーザーのフィルターがON、キャラクターのフィルターがOFFのためアクセス拒否`);
        return NextResponse.json({ 
          error: 'このキャラクターはセーフティフィルターがオフのため、セーフティフィルターがONの状態ではチャットできません。' 
        }, { status: 403 });
      }
      // ▲▲▲
      
      // characters を除外して返す（既存のレスポンス形式に合わせる）
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { characters, ...chatData } = exact;
      return NextResponse.json(chatData);
    }

    // chatId が無い場合は characterId が必要
    const characterId = Number(characterIdRaw);
    if (!Number.isFinite(characterId)) {
      return NextResponse.json(
        { error: "Either chatId or a valid characterId is required" },
        { status: 400 }
      );
    }

    // ▼▼▼【追加】セーフティフィルター: キャラクターのセーフティフィルターをチェック
    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      select: { safetyFilter: true },
    });

    if (!character) {
      return NextResponse.json({ error: "キャラクターが見つかりません。" }, { status: 404 });
    }

    // ユーザーのセーフティフィルターがONで、キャラクターのセーフティフィルターがOFFの場合
    if (userSafetyFilter && character.safetyFilter === false) {
      console.log(`[POST /api/chats/find-or-create] セーフティフィルター: ユーザーのフィルターがON、キャラクターのフィルターがOFFのためアクセス拒否`);
      return NextResponse.json({ 
        error: 'このキャラクターはセーフティフィルターがオフのため、セーフティフィルターがONの状態ではチャットを開始できません。' 
      }, { status: 403 });
    }
    // ▲▲▲

    // ★ タイムスタンプ（スキーマで default/updatedAt が無い場合の保険）
    const now = new Date();

    // 2) 強制新規
    if (forceNew) {
      console.time("⏱️ find-or-create: 強制新規作成");
      const created = await prisma.chat.create({
        data: {
          userId,
          characterId,
          createdAt: now,
          updatedAt: now,
        },
        select: {
          id: true,
          userId: true,
          characterId: true,
          createdAt: true,
          updatedAt: true,
          userNote: true,
          backMemory: true,
          autoSummarize: true,
          chat_message: {
            // 全てのバージョンを取得（バージョン切り替え機能のため）
            orderBy: [{ createdAt: "asc" }, { version: "asc" }],
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
              turnId: true,
              version: true,
              isActive: true,
            }
          }
        },
      });
      console.timeEnd("⏱️ find-or-create: 強制新規作成");
      return NextResponse.json(created);
    }

    // 3) 既存があれば最新を返す（無ければ作る）
    console.time("⏱️ find-or-create: 既存検索");
      const latest = await prisma.chat.findFirst({
        where: { userId, characterId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          userId: true,
          characterId: true,
          createdAt: true,
          updatedAt: true,
          userNote: true,
          backMemory: true,
          autoSummarize: true,
          chat_message: {
            // 全てのバージョンを取得（バージョン切り替え機能のため）
            orderBy: [{ createdAt: "asc" }, { version: "asc" }],
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
              turnId: true,
              version: true,
              isActive: true,
            }
          }
        },
      });
    console.timeEnd("⏱️ find-or-create: 既存検索");

    if (latest) {
      return NextResponse.json(latest);
    }

    console.time("⏱️ find-or-create: 新規作成");
    const created = await prisma.chat.create({
      data: {
        userId,
        characterId,
        createdAt: now,
        updatedAt: now,
      },
      select: {
        id: true,
        userId: true,
        characterId: true,
        createdAt: true,
        updatedAt: true,
        userNote: true,
        backMemory: true,
        autoSummarize: true,
        chat_message: {
          where: {
            isActive: true, // アクティブなメッセージのみを取得（選択中のバージョン）
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            turnId: true,
            version: true,
            isActive: true,
          }
        }
      },
    });
    console.timeEnd("⏱️ find-or-create: 新規作成");

    return NextResponse.json(created);
  } catch (err) {
    console.error("[find-or-create] error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
