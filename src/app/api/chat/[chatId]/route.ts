export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ▼▼▼【重要】キャッシュを無効化して常に最新データを取得 ▼▼▼

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  VertexAI,
  Content,
} from "@google-cloud/vertexai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { getEmbedding } from "@/lib/embeddings";
import { searchSimilarMessages, searchSimilarDetailedMemories } from "@/lib/vector-search";
import { getSafetySettings } from "@/lib/chat/safety-settings";
import { addImageTagIfKeywordMatched } from "@/lib/chat/image-selection";
import { createDetailedMemories, updateMemoriesWithAIKeywords } from "@/lib/chat/memory-management";
import { ensureGcpCreds } from "@/utils/ensureGcpCreds";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';

// VertexAIクライアントの初期化（遅延初期化、ランタイム環境変数対応）
let vertex_ai: VertexAI | null = null;

function getVertexAI(): VertexAI {
  // プロジェクトIDを解決: サービスアカウントJSONのproject_idを優先
  let projectId = process.env.GOOGLE_PROJECT_ID;
  
  // サービスアカウントJSONからproject_idを取得（環境変数より優先）
  // 注意: この関数は同期的である必要があるため、非同期読み込みは行わない
  // 代わりに、ensureGcpCreds()が既にファイルを作成していることを前提とする
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      // Node.js環境でのみ実行（ブラウザ環境ではスキップ）
      if (typeof process !== 'undefined' && process.versions?.node) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        if (fs.existsSync(credPath)) {
          const saContent = fs.readFileSync(credPath, 'utf8');
          const saJson = JSON.parse(saContent);
          if (saJson.project_id) {
            projectId = saJson.project_id;
            console.log(`[getVertexAI] ✅ サービスアカウントJSONからプロジェクトIDを取得: ${projectId}`);
            if (process.env.GOOGLE_PROJECT_ID && process.env.GOOGLE_PROJECT_ID !== projectId) {
              console.warn(`[getVertexAI] ⚠️ 環境変数GOOGLE_PROJECT_ID(${process.env.GOOGLE_PROJECT_ID})とサービスアカウントのproject_id(${projectId})が異なります。サービスアカウントのproject_idを使用します。`);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[getVertexAI] ⚠️ サービスアカウントJSONの読み込みに失敗:`, error);
    }
  }
  
  if (!projectId) {
    console.error('[getVertexAI] ❌ GOOGLE_PROJECT_ID が設定されていません');
    throw new Error('GOOGLE_PROJECT_ID 環境変数が設定されていません。');
  }
  
  // プロジェクトIDが変更された場合は再初期化
  // VertexAIインスタンスを再初期化する必要がある場合は常に再作成
  if (!vertex_ai) {
    console.log(`[getVertexAI] VertexAI クライアントを初期化: project=${projectId}`);
    console.log(`[getVertexAI] GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'not set'}`);
    vertex_ai = new VertexAI({
      project: projectId,
      location: "asia-northeast1",
    });
  }
  return vertex_ai;
}

export async function POST(request: Request, context: { params: Promise<{ chatId: string }> }) {
  if (isBuildTime()) return buildTimeResponse();
  
  // Lambda 환경에서 환경 변수 로드
  await ensureEnvVarsLoaded();
  // GCP 인증 정보 설정
  await ensureGcpCreds();
  
  console.log("チャットAPIリクエスト受信");
  console.time("⏱️ 全体API処理時間"); // 全体時間測定開始
  const { chatId: chatIdStr } = await context.params;

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    console.timeEnd("⏱️ 全体API処理時間");
    return NextResponse.json({ message: "認証が必要です。" }, { status: 401 });
  }

  const chatId = parseInt(String(chatIdStr), 10);
  if (isNaN(chatId)) {
    console.timeEnd("⏱️ 全体API処理時間");
    return NextResponse.json({ message: "無効なチャットIDです。" }, { status: 400 });
  }
  const userId = parseInt(String(session.user.id), 10);

  const prisma = await getPrisma();
  // ▼▼▼【追加】ユーザーのセーフティフィルター設定を取得
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { safetyFilter: true },
  });
  const userSafetyFilter = user?.safetyFilter ?? true; // デフォルトはtrue（フィルターON）
  // ▲▲▲

  const { message, settings, isRegeneration, turnId, activeVersions } = await request.json();
  if (!message) {
    console.timeEnd("⏱️ 全体API処理時間");
    return NextResponse.json({ message: "メッセージは必須です。" }, { status: 400 });
  }

  try {
    // DB書き込みPromise (ポイント消費, メッセージ保存)
    const dbWritePromise = (async () => {
      console.time("⏱️ DB Write (Points+Msg)");
      console.log(`ステップ1: ポイント消費とメッセージ保存処理開始 (ユーザーID: ${userId})`);
      const totalPointsToConsume = 1;
      let userMessageForHistory;
      let turnIdForModel;

      if (isRegeneration && turnId) {
        console.log(`ステップ3: 再生成のリクエストを処理 (ターンID: ${turnId})`);
        await prisma.$transaction(async (tx) => {
          const p = await tx.points.findUnique({ where: { user_id: userId } });
          const currentPoints = (p?.free_points || 0) + (p?.paid_points || 0);
          if (currentPoints < totalPointsToConsume) throw new Error("ポイントが不足しています。");
          let cost = totalPointsToConsume;
          const freeAfter = Math.max(0, (p?.free_points || 0) - cost);
          cost = Math.max(0, cost - (p?.free_points || 0));
          const paidAfter = Math.max(0, (p?.paid_points || 0) - cost);
          await tx.points.update({ where: { user_id: userId }, data: { free_points: freeAfter, paid_points: paidAfter } });
        });
        userMessageForHistory = await prisma.chat_message.findUnique({ where: { id: turnId } });
        if (!userMessageForHistory || userMessageForHistory.role !== 'user') throw new Error("再生成対象のメッセージが見つかりません。");
        turnIdForModel = userMessageForHistory.id;
      } else {
        console.log("ステップ3: 新規ユーザーメッセージ保存開始");
        userMessageForHistory = await prisma.$transaction(async (tx) => {
          const p = await tx.points.findUnique({ where: { user_id: userId } });
          const currentPoints = (p?.free_points || 0) + (p?.paid_points || 0);
          if (currentPoints < totalPointsToConsume) throw new Error("ポイントが不足しています。");
          let cost = totalPointsToConsume;
          const freeAfter = Math.max(0, (p?.free_points || 0) - cost);
          cost = Math.max(0, cost - (p?.free_points || 0));
          const paidAfter = Math.max(0, (p?.paid_points || 0) - cost);
          await tx.points.update({ where: { user_id: userId }, data: { free_points: freeAfter, paid_points: paidAfter } });
          const newUserMessage = await tx.chat_message.create({ data: { chatId: chatId, role: "user", content: message, version: 1, isActive: true } });
          const updatedMessage = await tx.chat_message.update({ where: { id: newUserMessage.id }, data: { turnId: newUserMessage.id } });
          // ▼▼▼【ベクトル検索】メッセージのembeddingを非同期で生成（応答速度を維持）▼▼▼
          (async () => {
            try {
              const embedding = await getEmbedding(message);
              const embeddingString = `[${embedding.join(',')}]`;
              await prisma.$executeRawUnsafe(
                `UPDATE "chat_message" SET "embedding" = $1::vector WHERE "id" = $2`,
                embeddingString,
                newUserMessage.id
              );
            } catch (error) {
              console.error('メッセージembedding生成エラー:', error);
            }
          })();
          // ▲▲▲
          return updatedMessage;
        });
        turnIdForModel = userMessageForHistory.id;
        console.log("ステップ3: ユーザーメッセージ保存完了");
      }
      console.timeEnd("⏱️ DB Write (Points+Msg)");
      return { userMessageForHistory, turnIdForModel };
    })();

    // コンテキスト取得Promise (DBクエリのみ)
    const contextPromise = (async () => {
      console.time("⏱️ Context Fetch Total (DB Only)");
      console.log(`ステップ2: チャットルームと世界観（characters）情報取得 (チャットID: ${chatId})`);
      console.time("⏱️ DB ChatRoom+Lorebooks Query");
      // 'characters' は世界観やシナリオ設定を保持するエンティティとして扱う
      const chatRoom = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          characters: { // 'characters' テーブルには世界観・シナリオ設定が含まれる
            include: {
              lorebooks: { orderBy: { id: "asc" } },
              characterImages: { orderBy: { id: "asc" } }, // idでソート
            },
          },
          users: { select: { defaultPersonaId: true, nickname: true } },
        },
      });
      console.timeEnd("⏱️ DB ChatRoom+Lorebooks Query");

      if (!chatRoom || !chatRoom.characters) {
        throw new Error("チャットまたは世界観（characters）設定が見つかりません。");
      }
      // ▼▼▼【デバッグ】chatRoom情報をログ出力 ▼▼▼
      console.log("ステップ2: チャットルーム情報取得完了");
      console.log(`chatRoom.id: ${chatRoom.id}`);
      console.log(`chatRoom.characters.id: ${chatRoom.characters?.id}`);
      console.log(`chatRoom.characters.name: ${chatRoom.characters?.name}`);
      console.log(`chatRoom.characters.systemTemplate length: ${chatRoom.characters?.systemTemplate?.length || 0}`);
      console.log(`chatRoom.characters.characterImages count: ${chatRoom.characters?.characterImages?.length || 0}`);
      if (!chatRoom.characters.systemTemplate || chatRoom.characters.systemTemplate.trim().length === 0) {
        console.error(`⚠️ WARNING: characters.systemTemplate is empty or missing! (Character ID: ${chatRoom.characters?.id}, Name: ${chatRoom.characters?.name || 'Unknown'})`);
        console.error(`⚠️ This may affect AI response quality. Please check the character's systemTemplate in the database.`);
      }
      // ▲▲▲

      console.time("⏱️ DB History+Persona Query");
      // ▼▼▼【修正】ユーザーが閲覧しているバージョンを考慮した履歴取得 ▼▼▼
      // 現在のメッセージ(userMessageForHistory)より前のメッセージのみを取得
      // 注意: userMessageForHistoryはまだ取得されていないため、createdAtで制限
      let historyWhereClause: {
        chatId: number;
        createdAt?: { lt: Date };
        isActive?: boolean;
        OR?: Array<{ role: string } | { id: { in: number[] } }>;
      } = {
        chatId: chatId
        // createdAt制限を削除: 並列処理のため、現在のメッセージはまだ保存されていない
      };

      // activeVersionsが指定されている場合、該当バージョンのみを取得
      if (activeVersions && Object.keys(activeVersions).length > 0) {
        // ▼▼▼【修正】INT4範囲を超える値（Date.now()で生成された一時ID）をフィルタリング ▼▼▼
        const MAX_INT4 = 2147483647; // INT4の最大値
        const versionIds = Object.values(activeVersions)
          .map(id => Number(id))
          .filter(id => id > 0 && id <= MAX_INT4); // 有効なINT4範囲内のIDのみ

        // 有効なIDがある場合のみ特別なクエリを使用
        if (versionIds.length > 0) {
          historyWhereClause = {
            chatId: chatId,
            createdAt: { lt: new Date() },
            OR: [
              { role: 'user' },  // ユーザーメッセージは全て含める
              { id: { in: versionIds } }  // 指定されたバージョンのモデルメッセージ
            ]
          };
        } else {
          // 有効なIDがない場合は通常のisActive=trueのみ
          historyWhereClause.isActive = true;
        }
        // ▲▲▲
      } else {
        // 通常はisActive=trueのメッセージのみ
        historyWhereClause.isActive = true;
      }
      // ▲▲▲【修正完了】▲▲▲

      const [persona, history, backMemory, detailedMemories] = await Promise.all([
        chatRoom.users.defaultPersonaId ? prisma.personas.findUnique({ where: { id: chatRoom.users.defaultPersonaId } }) : Promise.resolve(null),
        prisma.chat_message.findMany({
          where: historyWhereClause,
          orderBy: { createdAt: "desc" },
          take: 10, // 履歴は最新10件を取得（確実に全ての内容を読み取る）
        }),
        prisma.chat.findUnique({
          where: { id: chatId },
          select: { backMemory: true, autoSummarize: true },
        }),
        prisma.detailed_memories.findMany({
          where: { chatId: chatId },
          orderBy: { createdAt: "asc" }, // 順番通りに適用するため昇順
        }),
      ]);

      console.timeEnd("⏱️ DB History+Persona Query");

      const orderedHistory = history.reverse();

      // ▼▼▼【ベクトル検索】最新10件に加えて、関連メッセージをベクトル検索で追加（非同期、オプション）▼▼▼
      // ベクトル検索は時間がかかるため、メイン処理をブロックしないように非同期で実行
      // エラーが発生してもチャットは続行可能
      // 最初のメッセージ（履歴が1件以下）の場合はスキップして高速化
      let vectorMatchedMessages: Array<{ id: number; content: string; role: string; createdAt: Date }> = [];
      if (orderedHistory.length > 1) {
        // 2件以上のメッセージがある場合のみベクトル検索を実行
        const vectorSearchPromise = (async () => {
          try {
            const messageEmbedding = await getEmbedding(message);
            const excludeTurnIds = orderedHistory.map(msg => msg.turnId || 0).filter(id => id > 0);
            const matched = await searchSimilarMessages(messageEmbedding, chatId, excludeTurnIds, 10); // 5件から10件に増加
            return matched;
          } catch (error) {
            console.error('ベクトル検索エラー（メッセージ）:', error);
            return [];
          }
        })();

        // ベクトル検索結果は後で使用（非同期で待機、タイムアウト付き）
        try {
          const matched = await Promise.race([
            vectorSearchPromise,
            new Promise<[]>(resolve => setTimeout(() => resolve([]), 2000)) // 2秒タイムアウト
          ]);
          // 既存履歴に含まれていないメッセージのみ追加
          const existingIds = new Set(orderedHistory.map(h => h.id));
          vectorMatchedMessages = matched.filter(m => !existingIds.has(m.id));
        } catch (error) {
          // ベクトル検索が失敗しても続行
          console.error('ベクトル検索結果取得エラー:', error);
        }
      }
      // ▲▲▲
      console.log("ステップ2.5: ペルソナと履歴の取得完了");
      console.log(`使用されたバージョン: ${activeVersions ? JSON.stringify(activeVersions) : 'デフォルト(isActive)'}`);
      console.timeEnd("⏱️ Context Fetch Total (DB Only)");
      return { chatRoom, persona, orderedHistory, backMemory, detailedMemories, vectorMatchedMessages };
    })();

    // 2つの並列処理が完了するのを待ちます。
    console.time("⏱️ Promise.all(DBWrite, Context)");
    const [dbWriteResult, contextResult] = await Promise.all([dbWritePromise, contextPromise]);
    console.timeEnd("⏱️ Promise.all(DBWrite, Context)");

    const { userMessageForHistory, turnIdForModel } = dbWriteResult;
    const { chatRoom, persona, orderedHistory, backMemory, detailedMemories, vectorMatchedMessages } = contextResult;

    // ▼▼▼【追加】セーフティフィルター: ユーザーのセーフティフィルターがONで、キャラクターのセーフティフィルターがOFFの場合はアクセス拒否
    if (userSafetyFilter && chatRoom.characters.safetyFilter === false) {
      console.log(`[POST /api/chat/${chatId}] セーフティフィルター: ユーザーのフィルターがON、キャラクターのフィルターがOFFのためアクセス拒否`);
      console.timeEnd("⏱️ 全体API処理時間");
      return NextResponse.json({
        message: 'このキャラクターはセーフティフィルターがオフのため、セーフティフィルターがONの状態ではチャットできません。'
      }, { status: 403 });
    }
    // ▲▲▲

  const worldSetting = chatRoom.characters as typeof chatRoom.characters & {
    statusWindowPrompt?: string | null;
    statusWindowDescription?: string | null;
  }; // 'char' から 'worldSetting' に変数名を変更 (意味を明確化)
  const user = chatRoom.users;
  const worldName = worldSetting.name; // {{char}} に置換される名前 (世界観の名前)
  const userNickname = persona?.nickname || user.nickname || "ユーザー"; // {{user}} に置換される名前

  // プレースホルダー（{{char}}、{{user}}）を置換するヘルパー関数
  const replacePlaceholders = (text: string | null | undefined): string => {
    if (!text) return "";
    // {{char}} を世界観の名前 (characters.name) に置換
    // {{user}} をユーザーのニックネック (ペルソナ優先) に置換
    return text.replace(/{{char}}/g, worldName).replace(/{{user}}/g, userNickname);
  };

  // AIモデルに渡すチャット履歴を作成（プレースホルダーを置換）
  // 最新10件 + ベクトル検索で見つかった関連メッセージを統合
  // 現在のメッセージ(userMessageForHistory)を除外
  const currentMessageId = userMessageForHistory?.id;
  const allHistoryMessages = [
    ...orderedHistory.filter(msg => msg.id !== currentMessageId), // 現在のメッセージを除外
    ...vectorMatchedMessages
      .filter(m => m.id !== currentMessageId) // 現在のメッセージを除外
      .map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        turnId: null,
        version: 1,
        isActive: true,
      }))
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const chatHistory: Content[] = allHistoryMessages.map(msg => ({
    role: msg.role as "user" | "model",
    parts: [{ text: replacePlaceholders(msg.content) }],
  }));

  // ▼▼▼【デバッグ】チャット履歴の内容をログ出力
  console.log(`📜 チャット履歴: ${chatHistory.length}件のメッセージをAIに送信`);
  console.log(`  - orderedHistory: ${orderedHistory.length}件`);
  console.log(`  - vectorMatchedMessages: ${vectorMatchedMessages.length}件`);
  if (chatHistory.length > 0) {
    const firstMsg = chatHistory[0];
    const lastMsg = chatHistory[chatHistory.length - 1];
    const firstText = firstMsg.parts?.[0]?.text || '';
    const lastText = lastMsg.parts?.[0]?.text || '';
    console.log(`  - 最初のメッセージ: ${firstMsg.role} - ${firstText.substring(0, 50)}${firstText.length > 50 ? '...' : ''}`);
    console.log(`  - 最後のメッセージ: ${lastMsg.role} - ${lastText.substring(0, 50)}${lastText.length > 50 ? '...' : ''}`);
  }
  // ▲▲▲

  console.time("⏱️ Prompt Construction");
  console.log("ステップ4: 完全なシステムプロンプトの構築開始");

  // ロアブック検索ロジック (最適化版: 早期終了 & 小文字変換一回のみ)
  console.time("⏱️ Simple Text Lorebook Search");
  let lorebookInfo = "";
  const triggeredLorebooks = [];
  if (worldSetting.lorebooks && worldSetting.lorebooks.length > 0) {
    const lowerMessage = message.toLowerCase(); // 一度だけ小文字変換
    for (const lore of worldSetting.lorebooks) {
      if (triggeredLorebooks.length >= 5) break; // 早期終了（先頭に移動）

      if (lore.keywords && Array.isArray(lore.keywords) && lore.keywords.length > 0) {
        // キーワード検索を最適化（多言語対応：英語のみ小文字変換、日本語・韓国語はそのまま）
        const hasMatch = lore.keywords.some((keyword) => {
          if (!keyword) return false;
          // 英語キーワードのみ小文字に変換、日本語・韓国語はそのまま
          const normalizedKeyword = /^[A-Za-z]/.test(keyword) ? keyword.toLowerCase() : keyword;
          const searchText = /^[A-Za-z]/.test(keyword) ? lowerMessage : message;
          return searchText.includes(normalizedKeyword);
        });

        if (hasMatch) {
          triggeredLorebooks.push(replacePlaceholders(lore.content));
        }
      }
    }
  }
  console.timeEnd("⏱️ Simple Text Lorebook Search");
  if (triggeredLorebooks.length > 0) {
    lorebookInfo = `# 関連情報 (ロアブック)\n- 以下の設定は会話のキーワードに基づき有効化された。優先度順。\n- ${triggeredLorebooks.join("\n- ")}`;
  }

  // ▼▼▼ 詳細記憶のベクトル検索 + キーワードマッチング（ハイブリッド）▼▼▼
  console.time("⏱️ Detailed Memory Search");
  let detailedMemoryInfo = "";
  const triggeredMemories: string[] = [];
  const triggeredMemoryIds = new Set<number>();

  if (detailedMemories && detailedMemories.length > 0) {
    // 1-3個の場合は必ず全て適用、4個以上の場合はキーワードマッチング + ベクトル検索で最大3個選択
    const memoryCount = detailedMemories.length;

    if (memoryCount <= 3) {
      // 1-3個の場合は順番通りに全て適用（createdAt順）
      for (const memory of detailedMemories) {
        triggeredMemories.push(memory.content);
        triggeredMemoryIds.add(memory.id);
        // 非同期で更新（エラー無視）
        prisma.detailed_memories.update({
          where: { id: memory.id },
          data: { lastApplied: new Date() },
        }).catch(() => {});
      }
      console.log(`詳細記憶: ${memoryCount}個全て適用（1-3個のため全適用）`);
    } else {
      // 4個以上の場合はキーワードマッチング + ベクトル検索で最大3個選択
      const lowerMessage = message.toLowerCase();
      const lowerHistory = orderedHistory.length > 0
        ? orderedHistory.map(msg => msg.content.toLowerCase()).join(' ')
        : '';
      const combinedText = lowerHistory ? `${lowerMessage} ${lowerHistory}` : lowerMessage;

      // ベクトル検索で関連メモリを取得（非同期、タイムアウト付き）
      let vectorMatchedMemories: Array<{ id: number; content: string; keywords: string[]; similarity: number }> = [];
      try {
        const messageEmbedding = await getEmbedding(combinedText);
        const vectorSearchPromise = searchSimilarDetailedMemories(messageEmbedding, chatId, 5);
        vectorMatchedMemories = await Promise.race([
          vectorSearchPromise,
          new Promise<typeof vectorMatchedMemories>((resolve) =>
            setTimeout(() => resolve([]), 1500) // 1.5秒タイムアウト
          ),
        ]);
      } catch (error) {
        console.error('詳細記憶ベクトル検索エラー:', error);
      }

      const vectorMatchedIds = new Set(vectorMatchedMemories.map(m => m.id));

      // キーワードマッチング + ベクトル検索で順番通りに選択（createdAt順）
      for (const memory of detailedMemories) {
        if (triggeredMemories.length >= 3) break;

        // キーワードマッチングまたはベクトル検索でマッチした場合
        let hasMatch = false;

        // キーワードマッチング（多言語対応：英語のみ小文字変換、日本語・韓国語はそのまま）
        if (memory.keywords && Array.isArray(memory.keywords) && memory.keywords.length > 0) {
          // メタデータ（__META:start:X:end:Y__）を除外
          const cleanKeywords = memory.keywords.filter(k => !k.match(/^__META:/));
          hasMatch = cleanKeywords.some((keyword) => {
            if (!keyword) return false;
            // 英語キーワードのみ小文字に変換、日本語・韓国語はそのまま
            const normalizedKeyword = /^[A-Za-z]/.test(keyword) ? keyword.toLowerCase() : keyword;
            // 英語キーワードの場合は小文字変換されたテキストと比較、それ以外は元のテキストと比較
            const searchText = /^[A-Za-z]/.test(keyword) ? combinedText : (message + ' ' + (orderedHistory.length > 0 ? orderedHistory.map(msg => msg.content).join(' ') : ''));
            return searchText.includes(normalizedKeyword);
          });
        }

        // ベクトル検索でマッチした場合も追加
        if (!hasMatch && vectorMatchedIds.has(memory.id)) {
          hasMatch = true;
        }

        if (hasMatch) {
          triggeredMemories.push(memory.content);
          triggeredMemoryIds.add(memory.id);
          // 非同期で更新（エラー無視）
          prisma.detailed_memories.update({
            where: { id: memory.id },
            data: { lastApplied: new Date() },
          }).catch(() => {});
        }
      }

      // キーワードマッチング + ベクトル検索で3個に満たない場合は、順番通りに追加（キーワードなしでも）
      if (triggeredMemories.length < 3) {
        for (const memory of detailedMemories) {
          if (triggeredMemories.length >= 3) break;
          if (triggeredMemoryIds.has(memory.id)) continue;

          triggeredMemories.push(memory.content);
          triggeredMemoryIds.add(memory.id);
          // 非同期で更新（エラー無視）
          prisma.detailed_memories.update({
            where: { id: memory.id },
            data: { lastApplied: new Date() },
          }).catch(() => {});
        }
      }
      console.log(`詳細記憶: キーワードマッチング + ベクトル検索で${triggeredMemories.length}個適用（ベクトル検索: ${vectorMatchedMemories.length}件）`);
    }
  }
    console.timeEnd("⏱️ Detailed Memory Search");
    if (triggeredMemories.length > 0) {
      detailedMemoryInfo = `# 詳細記憶\n- 以下の記憶は会話の内容に基づき有効化された。\n${triggeredMemories.map((mem, idx) => `- 記憶${idx + 1}: ${mem}`).join('\n')}`;
      // ▼▼▼【デバッグ】詳細記憶の内容をログ出力
      console.log(`📝 詳細記憶が${triggeredMemories.length}個適用されました:`);
      triggeredMemories.forEach((mem, idx) => {
        console.log(`  記憶${idx + 1} (${mem.length}文字): ${mem.substring(0, 100)}${mem.length > 100 ? '...' : ''}`);
      });
      // ▲▲▲
    } else {
      console.log("📝 詳細記憶: 適用された記憶はありません");
    }
    // ▲▲▲

    // ▼▼▼ バックメモリの追加 ▼▼▼
    let backMemoryInfo = "";
    if (backMemory && backMemory.backMemory && backMemory.backMemory.trim().length > 0) {
      backMemoryInfo = `# メモリブック (会話の要約)\n${backMemory.backMemory}`;
      // ▼▼▼【デバッグ】メモリブックの内容をログ出力
      console.log(`📚 メモリブックが適用されました (${backMemory.backMemory.length}文字):`);
      console.log(`  ${backMemory.backMemory.substring(0, 200)}${backMemory.backMemory.length > 200 ? '...' : ''}`);
      // ▲▲▲
    } else {
      console.log("📚 メモリブック: 適用されたメモリはありません");
    }
    // ▲▲▲

    // ▼▼▼ Build system prompt components ▼▼▼
    const userPersonaInfo = persona
      ? `# User\n${persona.nickname}${persona.age ? `, ${persona.age}` : ''}${persona.gender ? `, ${persona.gender}` : ''}\n${replacePlaceholders(persona.description)}`
      : "";

    // Initial situation and message (only for first message)
    const initialContext = [];
    if (chatHistory.length === 0) {
      if (worldSetting.firstSituation) {
        initialContext.push(`# Initial\n${replacePlaceholders(worldSetting.firstSituation)}`);
      }
      if (worldSetting.firstMessage) {
        initialContext.push(`# Opening\n${replacePlaceholders(worldSetting.firstMessage)}`);
      }
    }
    const initialContextText = initialContext.join("\n\n");

    // ▼▼▼【画像リスト】AIが使用できる画像のリスト ▼▼▼
    const availableImages = worldSetting.characterImages || [];
    const imageList = availableImages
      .filter(img => !img.isMain)
      .map((img, index) => `${index + 1}. "${img.keyword}" - Use: {img:${index + 1}}`)
      .join('\n');

    const imageInstruction = imageList
      ? `# Images
Available Images:
${imageList}

**INSTRUCTIONS**:
- Insert {img:N} tags at appropriate moments when they enhance the narrative (scenes, emotions, actions, character expressions)
- **NEVER place {img:N} tags inside dialogue brackets (「」). Images must ALWAYS be outside dialogue brackets.**
- **CORRECT**: "彼女は微笑んだ {img:2} 「こんにちは」と挨拶した。部屋に入ると {img:5}"
- **WRONG**: 「こんにちは {img:2}」 (DO NOT DO THIS)
- Match image keywords with your narrative content
- Use images naturally when they add value to the story - it's fine to use one image, multiple images, or no images depending on what fits the scene
- Don't force images if they don't naturally fit the narrative flow
- Example: "彼女は微笑んだ {img:2} 「こんにちは」と挨拶した。部屋に入ると {img:5} 彼が振り返った {img:3}"
- Quality over quantity: use images that genuinely enhance the storytelling experience`
      : "";
    // ▲▲▲

    // ユーザーの最新メッセージから言語要求を抽出（長さ要求は無視して常に800-1100文字）
    const userLanguageRequest = message.match(/한국어|韓国語|korean|Korean|ko|KO|すべて.*韓国語|全て.*韓国語/i);

    // 言語要求に基づいてフォーマット指示を生成
    const languageInstruction = userLanguageRequest
      ? `- **Output Language**: Respond in Korean (한국어). All narration, dialogue, and descriptions should be in Korean.`
      : `- **Output Language**: Respond in Japanese (日本語). All narration, dialogue, and descriptions should be in Japanese.`;

    // 応答長さは常に800-1100文字に固定
    const lengthInstruction = `- **Response Length**: Aim for 800-1100 characters (including spaces) per response. Provide rich, detailed descriptions and dialogue.
- **Character Interactions**: If multiple characters are defined in systemTemplate, make them actively participate in the scene with dialogue and actions. Show their personalities through their words and behaviors.`;

    // ▼▼▼【追加】セーフティフィルター設定に基づいてContent Policyを動的に生成
    // キャラクターのセーフティフィルターがONの場合、より厳格な制限を適用
    const characterSafetyFilter = chatRoom.characters.safetyFilter ?? true;
    const contentPolicy = userSafetyFilter === false && characterSafetyFilter === false
      ? `- **Content Policy**: This is an adult-oriented creative writing platform. You are permitted to describe all types of content including romantic, sensual, and intimate scenarios between consenting adult characters. Focus on emotional depth, sensory details, and narrative quality. Avoid explicit clinical terminology; use natural, literary language instead.`
      : characterSafetyFilter === true
      ? `- **Content Policy**: This character has the safety filter enabled. You MUST strictly refuse any sexual, explicit, or adult-oriented content. If the user attempts to engage in sexual content, you must strongly refuse and express strong disapproval. Respond with phrases like "そんなこと絶対にできない！", "そういう話はやめて！", "私はそんなことはしたくない！" and redirect to safe, appropriate topics. Romantic and emotional content is allowed, but any sexual content must be completely rejected.`
      : `- **Content Policy**: Keep content appropriate and safe. Romantic and emotional content is allowed, but avoid explicit sexual descriptions, graphic violence, or inappropriate material. Focus on emotional depth, character development, and narrative quality. Use suggestive and subtle descriptions rather than explicit content. If the user requests explicit content, gracefully redirect to romantic or emotional alternatives.`;
    // ▲▲▲

    // ▼▼▼【ステータスウィンドウ】キャラクターのステータスウィンドウ設定を取得 ▼▼▼
    const statusWindowPrompt = worldSetting.statusWindowPrompt || '';
    const statusWindowDescription = worldSetting.statusWindowDescription || '';
    let statusWindowInstruction = '';
    
    if (statusWindowPrompt && statusWindowDescription) {
      statusWindowInstruction = `# Status Window (CRITICAL)
- **MANDATORY**: Include status window at end in \`\`\`code blocks\`\`\`.
- **Format**: ${statusWindowPrompt}
- **Values**: ${statusWindowDescription}
- **RULES**:
  1. Format NEVER changes. Keep exact structure.
  2. Values ONLY change if conversation explicitly requires it (major events, relationship changes, etc.).
  3. If no explicit reason, keep previous values EXACTLY.
  4. Default: NO CHANGE unless clear reason exists.`;
    } else if (statusWindowPrompt) {
      statusWindowInstruction = `# Status Window (CRITICAL)
- **MANDATORY**: Include status window at end in \`\`\`code blocks\`\`\`.
- **Format**: ${statusWindowPrompt}
- **RULES**:
  1. Format NEVER changes. Keep exact structure.
  2. Values ONLY change if conversation explicitly requires it.
  3. Default: NO CHANGE unless clear reason exists.`;
    }
    // ▲▲▲

    // ▼▼▼【ユーザー指示優先】ユーザーが時間スキップや状況変更を要求した場合、即座に適用
    const userDirectiveCheck = message.match(/(時間|時|時間を|時間が|時間が経|経過|スキップ|飛ば|進む|次の|翌日|翌朝|翌晩|数時間後|数日後|場所|移動|行く|来る|着く|到着)/i);
    const userDirectiveInstruction = userDirectiveCheck
      ? `\n- **USER DIRECTIVE DETECTED**: User requested time skip, location change, or situation transition. Apply immediately without questioning or refusing. Describe the new situation directly.`
      : '';
    // ▲▲▲

    // Content PolicyはsystemTemplateの指示事項と衝突する可能性があるため、
    // systemTemplateに性的コンテンツ制限解除などが明記されている場合はそれを優先
    // Content Policyは基本的なガイドラインとしてのみ使用
    const formattingInstruction = `# Response Format
- Narrator: Third person. User speaks for themselves.
- **CRITICAL - USER ACTIONS AND DIALOGUE**: You MUST NEVER write, act out, or roleplay the user's actions, dialogue, or thoughts. The user controls their own character completely. You can only describe what YOUR character sees, hears, or perceives about the user, but you cannot write what the user says or does. If the user's message contains their action or dialogue, acknowledge it narratively but do not repeat or rephrase it. Only respond as your character.
- Context: Read history. Maintain consistency.
- **CRITICAL**: Use PLAIN TEXT only. NEVER use HTML tags (<div>, <span>, <p>, style attributes, etc.). Output pure text with simple formatting only.
${contentPolicy}
${languageInstruction}
- Format: Narration (gray), Dialogue (「」/""), Status in \`\`\`code blocks\`\`\` at end.
${lengthInstruction}
${statusWindowInstruction}${userDirectiveInstruction}
- **Priority**: User directives > systemTemplate > general policies.`;

    const systemTemplate = replacePlaceholders(worldSetting.systemTemplate);

    // Assemble final system prompt
    // Note: systemTemplate is placed first to give it priority over other instructions
    const systemInstructionText = [systemTemplate, initialContextText, backMemoryInfo, detailedMemoryInfo, imageInstruction, formattingInstruction, userPersonaInfo, lorebookInfo].filter(Boolean).join("\n\n");

    // ▼▼▼【デバッグ】システムプロンプトの内容をログ出力 ▼▼▼
    console.log("=== システムプロンプト構築完了 ===");
    console.log(`systemTemplate length: ${systemTemplate?.length || 0}`);
    if (systemTemplate && systemTemplate.length > 0) {
      console.log(`systemTemplate 内容 (最初の500文字): ${systemTemplate.substring(0, 500)}${systemTemplate.length > 500 ? '...' : ''}`);
    }
    console.log(`initialContextText length: ${initialContextText?.length || 0}`);
    console.log(`backMemoryInfo length: ${backMemoryInfo?.length || 0}`);
    console.log(`detailedMemoryInfo length: ${detailedMemoryInfo?.length || 0}`);
    console.log(`imageInstruction length: ${imageInstruction?.length || 0}`);
    console.log(`formattingInstruction length: ${formattingInstruction?.length || 0}`);
    console.log(`userPersonaInfo length: ${userPersonaInfo?.length || 0}`);
    console.log(`lorebookInfo length: ${lorebookInfo?.length || 0}`);
    console.log(`systemInstructionText total length: ${systemInstructionText?.length || 0}`);

    // ▼▼▼【重要】AIに送信されるシステムプロンプトの主要部分を確認
    if (backMemoryInfo) {
      console.log("✅ メモリブックがシステムプロンプトに含まれています");
    }
    if (detailedMemoryInfo) {
      console.log("✅ 詳細記憶がシステムプロンプトに含まれています");
    }
    if (!backMemoryInfo && !detailedMemoryInfo) {
      console.warn("⚠️ メモリブックと詳細記憶の両方が空です。AIは記憶情報なしで応答します。");
    }
    // ▲▲▲

    if (!systemTemplate || systemTemplate.trim().length === 0) {
      console.error(`⚠️ WARNING: systemTemplate is empty or missing! (Character ID: ${worldSetting?.id}, Name: ${worldSetting?.name || 'Unknown'})`);
      console.error(`⚠️ This may affect AI response quality. Please check the character's systemTemplate in the database.`);
    }
    // ▲▲▲
    console.timeEnd("⏱️ Prompt Construction");

  // ストリーム応答を開始
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      // クライアントにイベントを送信するヘルパー関数
      const sendEvent = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

        let firstChunkReceived = false;
        console.time("⏱️ AI TTFB"); // AIからの最初の応答までの時間

        // ▼▼▼【タイムアウト対策】ハートビートを送信して接続を維持 ▼▼▼
        const heartbeatInterval = setInterval(() => {
          try {
            sendEvent('heartbeat', { timestamp: Date.now() });
          } catch {
            // 接続が既に閉じられている場合は無視
          }
        }, 5000); // 5秒ごとにハートビートを送信
        // ▲▲▲

        try {
          // ユーザーメッセージの保存をクライアントに通知 (再生成または新規)
          if (isRegeneration) {
            sendEvent('regeneration-start', { turnId: turnIdForModel });
          } else {
            sendEvent('user-message-saved', { userMessage: userMessageForHistory });
          }

          console.log("ステップ5: Vertex AI (Gemini) モデル呼び出し開始");
          console.time("⏱️ AI sendMessageStream Total"); // AI応答完了までの総時間
          const modelToUse = settings?.model || "gemini-2.5-flash";
          console.log(`\n🤖 ========================================`);
          console.log(`🤖 使用モデル: ${modelToUse}`);
          console.log(`🤖 リージョン: asia-northeast1`);
          console.log(`🤖 ========================================\n`);

          // ▼▼▼【デバッグ】AIに送信されるシステムプロンプトの確認
          console.log("📤 Vertex AIに送信されるシステムプロンプト:");
          console.log(`  - セーフティフィルター: ${userSafetyFilter ? 'ON (制限あり)' : 'OFF (制限なし)'}`);
          console.log(`  - システムプロンプト長: ${systemInstructionText.length}文字`);
          if (backMemoryInfo) {
            console.log(`  - ✅ メモリブック含む: ${backMemoryInfo.length}文字`);
          }
          if (detailedMemoryInfo) {
            console.log(`  - ✅ 詳細記憶含む: ${detailedMemoryInfo.length}文字`);
          }
          // システムプロンプトの最初の500文字を表示（デバッグ用）
          console.log(`  - システムプロンプト先頭: ${systemInstructionText.substring(0, 500)}${systemInstructionText.length > 500 ? '...' : ''}`);
          // ▲▲▲

          // GCP認証情報を確保
          await ensureGcpCreds();
          
          const safetySettings = getSafetySettings(userSafetyFilter);
          if (userSafetyFilter) {
            console.log(`  - 安全性設定: BLOCK_ONLY_HIGH (すべてのカテゴリー、高レベルだけブロック、ロマンチック/感情的な内容は許可)`);
          } else {
            console.log(`  - 安全性設定: BLOCK_NONE (すべて許可)`);
          }
          const generativeModel = getVertexAI().getGenerativeModel({ model: modelToUse, safetySettings });

          // チャットセッションを開始（履歴とシステム指示を渡す）
          // ▼▼▼【重要デバッグ】システム指示が正しく渡されているか確認
          console.log(`\n📋 システム指示確認:`);
          console.log(`  - 長さ: ${systemInstructionText.length}文字`);
          console.log(`  - 800-1100文字指示含む: ${systemInstructionText.includes('800-1100')}`);
          console.log(`  - HTML禁止指示含む: ${systemInstructionText.includes('PLAIN TEXT')}`);
          console.log(`  - システムテンプレート含む: ${systemInstructionText.includes(worldSetting.systemTemplate?.substring(0, 50) || 'N/A')}`);
          console.log(`  - 先頭200文字:\n${systemInstructionText.substring(0, 200)}...\n`);
          // ▲▲▲
          
          const chatSession = generativeModel.startChat({
            history: chatHistory,
            systemInstruction: systemInstructionText
          });

          // ストリーミングでメッセージを送信
          // ▼▼▼【デバッグ】現在のユーザーメッセージをログ出力
          console.log(`📤 現在のユーザーメッセージ: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
          console.log(`📤 チャット履歴 + 現在のメッセージでAIに送信 (履歴: ${chatHistory.length}件)`);
          // ▲▲▲
          const result = await chatSession.sendMessageStream(message);

          let finalResponseText = ""; // 最終的なAIの応答テキスト

          // ストリームを反復処理
          let wasBlocked = false;
          for await (const item of result.stream) {
            // ▼▼▼【安全性チェック】応答がブロックされたかチェック▼▼▼
            if (item.candidates && item.candidates.length > 0) {
              const candidate = item.candidates[0];
              if (candidate.finishReason === 'SAFETY') {
                wasBlocked = true;
                console.warn("⚠️ 応答が安全性フィルターによってブロックされました");
                const safetyRatings = candidate.safetyRatings || [];
                safetyRatings.forEach((rating) => {
                  if (rating.probability === 'HIGH' || rating.probability === 'MEDIUM') {
                    console.warn(`  - ${rating.category}: ${rating.probability}`);
                  }
                });
                break;
              }
              if (candidate.finishReason === 'OTHER' || candidate.finishReason === 'MAX_TOKENS') {
                console.warn(`⚠️ 応答が${candidate.finishReason}で終了しました`);
              }
            }
            // ▲▲▲

            if (!firstChunkReceived) {
                console.timeEnd("⏱️ AI TTFB"); // 最初のチャンク受信
                firstChunkReceived = true;
            }
            const chunk = item.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!chunk) continue;

            sendEvent('ai-update', { responseChunk: chunk }); // チャンクをクライアントに送信
            finalResponseText += chunk;
          }
          console.timeEnd("⏱️ AI sendMessageStream Total"); // AI応答完了

          // 応答が空でないか確認、またはブロックされた場合
          if (wasBlocked || !finalResponseText.trim()) {
            if (wasBlocked) {
              console.log("警告: 応答が安全性フィルターによってブロックされました。");
              sendEvent('ai-error', {
                error: 'この応答は安全性フィルターによってブロックされました。より適切な表現で再度お試しください。'
              });
              throw new Error("AIからの応答が安全性フィルターによってブロックされました。");
            } else {
              console.log("警告: 最終的な応答テキストが空でした。");
              throw new Error("AIからの応答が空でした。");
            }
          }

          // ▼▼▼【バックエンド画像キーワードマッチング】AIが画像タグを生成しなかった場合、キーワードで自動追加▼▼▼
          const nonMainImages = availableImages.filter(img => !img.isMain);
          const hasImgTag = /\{img:\d+\}/.test(finalResponseText);
          if (!hasImgTag && nonMainImages.length > 0) {
            finalResponseText = addImageTagIfKeywordMatched(finalResponseText, availableImages, worldSetting.name);
          }
          // ▲▲▲

          console.time("⏱️ DB Write (AI Msg)");
          console.log("ステップ6: AIの応答をデータベースに保存");
          const newModelMessage = await prisma.$transaction(async (tx) => {
            // 同じターンの古いモデルメッセージを非アクティブ化
            await tx.chat_message.updateMany({ where: { turnId: turnIdForModel, role: 'model' }, data: { isActive: false } });
            // 新しいバージョン番号を計算
            const lastVersion = await tx.chat_message.findFirst({ where: { turnId: turnIdForModel, role: 'model' }, orderBy: { version: 'desc' } });
            const newVersionNumber = (lastVersion?.version || 0) + 1;
            // 新しいモデルメッセージを作成
            return await tx.chat_message.create({
              data: { chatId, role: "model", content: finalResponseText, turnId: turnIdForModel, version: newVersionNumber, isActive: true },
            });
          });
          console.log("ステップ6: AI応答の保存完了");
          console.timeEnd("⏱️ DB Write (AI Msg)");

          // ▼▼▼【ベクトル検索】AIメッセージのembeddingを非同期で生成▼▼▼
          (async () => {
            try {
              const embedding = await getEmbedding(finalResponseText);
              const embeddingString = `[${embedding.join(',')}]`;
              await prisma.$executeRawUnsafe(
                `UPDATE "chat_message" SET "embedding" = $1::vector WHERE "id" = $2`,
                embeddingString,
                newModelMessage.id
              );
            } catch (error) {
              console.error('AIメッセージembedding生成エラー:', error);
            }
          })();
          // ▲▲▲

          // ▼▼▼【自動要約】autoSummarizeがONの場合、メッセージが追加されたら自動要約▼▼▼
          if (backMemory && backMemory.autoSummarize) {
            (async () => {
              try {
                // メッセージ数を取得
                const messageCount = await prisma.chat_message.count({
                  where: { chatId, isActive: true },
                });

                // 要約を実行する条件:
                // - 10個以下: 毎回実行（ただし2個以上）
                // - 10個超過: 5個単位で実行（10, 15, 20, 25...）
                let shouldSummarize = false;
                if (messageCount <= 10) {
                  shouldSummarize = messageCount >= 2; // 2個以上なら毎回（最初の1個はスキップ）
                } else {
                  shouldSummarize = messageCount % 5 === 0; // 5個単位
                }

                if (shouldSummarize) {
                  console.log(`自動要約を開始 (メッセージ数: ${messageCount})`);

                  // 会話履歴を取得（最新50件）
                  const messages = await prisma.chat_message.findMany({
                    where: {
                      chatId,
                      isActive: true,
                    },
                    orderBy: { createdAt: 'asc' },
                    take: 50,
                  });

                  // メッセージが2個以上ある場合のみ要約実行（最初の1個はスキップ）
                  if (messages.length >= 2) {
                    // 会話をテキストに変換
                    const conversationText = messages
                      .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
                      .join('\n\n');

                    // GCP認証情報を確保
                    await ensureGcpCreds();
                    
                    // Vertex AIで要約
                    const summaryProjectId = process.env.GOOGLE_PROJECT_ID;
                    if (!summaryProjectId) {
                      console.error('[要約] ❌ GOOGLE_PROJECT_ID が設定されていません');
                      throw new Error('GOOGLE_PROJECT_ID 環境変数が設定されていません。');
                    }
                    const summaryVertexAI = new VertexAI({
                      project: summaryProjectId,
                      location: 'asia-northeast1',
                    });

                    const summaryModel = summaryVertexAI.getGenerativeModel({
                      model: 'gemini-2.5-flash',
                      safetySettings,
                    });

                    const prompt = `以下の会話履歴を日本語で要約してください。以下の形式で整理してください：

[ストーリー要約]
- 主な出来事や展開を簡潔に箇条書きでまとめてください

[イベント要約]
- 具体的なイベントやシーンを箇条書きでまとめてください

[キャラクターの役割]
- 各キャラクターの特徴、役割、関係性を簡潔にまとめてください

要約は3000文字以内で、AIが理解しやすい形式で記述してください。

会話履歴：
${conversationText}`;

                    const result = await summaryModel.generateContent(prompt);
                    const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

                    if (summary) {
                      // 要約を保存
                      await prisma.chat.update({
                        where: { id: chatId },
                        data: { backMemory: summary },
                      });

                      // embeddingを生成（非同期、エラー無視）
                      (async () => {
                        try {
                          const embedding = await getEmbedding(summary);
                          const embeddingString = `[${embedding.join(',')}]`;
                          await prisma.$executeRawUnsafe(
                            `UPDATE "chat" SET "backMemoryEmbedding" = $1::vector WHERE "id" = $2`,
                            embeddingString,
                            chatId
                          );
                        } catch (error) {
                          console.error('バックメモリembedding生成エラー:', error);
                        }
                      })();

                      console.log('自動要約が完了しました');
                    }
                  }
                }
              } catch (error) {
                console.error('自動要約エラー:', error);
              }
            })();
          }
          // ▲▲▲

          // ▼▼▼【詳細記憶自動要約】autoSummarizeがONの場合、メッセージが追加されたら自動要約▼▼▼
          if (backMemory && backMemory.autoSummarize) {
            (async () => {
              try {
                // メッセージ数を取得
                const messageCount = await prisma.chat_message.count({
                  where: { chatId, isActive: true },
                });

                // 要約を実行する条件:
                // - 10個以下: 毎回実行（ただし2個以上）
                // - 10個超過: 5個単位で実行（10, 15, 20, 25...）
                let shouldSummarize = false;
                if (messageCount <= 10) {
                  shouldSummarize = messageCount >= 2; // 2個以上なら毎回（最初の1個はスキップ）
                } else {
                  shouldSummarize = messageCount % 5 === 0; // 5個単位
                }

                if (shouldSummarize) {
                  console.log(`詳細記憶自動要約を開始 (メッセージ数: ${messageCount})`);

                  // 会話履歴を取得
                  const messages = await prisma.chat_message.findMany({
                    where: {
                      chatId,
                      isActive: true,
                    },
                    orderBy: { createdAt: 'asc' },
                    take: messageCount <= 10 ? messageCount : 50, // 10個以下は全件、それ以上は最新50件
                  });

                  // メッセージが2個以上ある場合のみ要約実行
                  if (messages.length >= 2) {
                    // スライディングウィンドウ方式: 5個ずつまとめて要約（1-5, 6-10, 11-15...）
                    const windowSize = 5;
                    let startIndex = 0;
                    let endIndex = messageCount;

                    // 最後のウィンドウの開始位置を計算
                    if (messageCount > windowSize) {
                      // 5個単位で区切る（1-5, 6-10, 11-15...）
                      startIndex = Math.floor((messageCount - 1) / windowSize) * windowSize;
                      endIndex = messageCount;
                    }

                    const messagesToSummarize = messages.slice(startIndex, endIndex);

                    if (messagesToSummarize.length === 0) {
                      console.log('要約するメッセージがありません');
                      return;
                    }

                    // メッセージ範囲を計算（1-indexed）
                    const messageStartIndex = startIndex + 1;
                    const messageEndIndex = endIndex;

                    // ▼▼▼【改善】ベクトル類似度ベースの重複チェック（キーワード重複とは無関係に動作）
                    // 会話内容のベクトルを生成して、類似した要約があるか確認
                    // 類似度が0.85以上の要約があればスキップ、なければ生成
                    const conversationTextForCheck = messagesToSummarize
                      .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
                      .join('\n\n');

                    try {
                      const conversationEmbedding = await getEmbedding(conversationTextForCheck);
                      const vectorString = `[${conversationEmbedding.join(',')}]`;

                      // 既存の要約の中で類似したものがあるか確認（類似度0.85以上）
                      const similarMemories = await prisma.$queryRawUnsafe<Array<{ id: number; similarity: number }>>(
                        `SELECT id, 1 - (embedding <=> $1::vector) as similarity
                         FROM "detailed_memories"
                         WHERE "chatId" = $2
                           AND embedding IS NOT NULL
                           AND (1 - (embedding <=> $1::vector)) >= 0.85
                         ORDER BY embedding <=> $1::vector
                         LIMIT 1`,
                        vectorString,
                        chatId
                      );

                      if (similarMemories && similarMemories.length > 0) {
                        console.log(`詳細記憶自動要約: 類似度 ${similarMemories[0].similarity.toFixed(3)} の既存要約があるためスキップ (ID: ${similarMemories[0].id})`);
                        return;
                      }
                    } catch (error) {
                      console.error('ベクトル類似度チェックエラー:', error);
                      // エラーが発生しても要約は続行（重複チェック失敗は要約生成より重要度が低い）
                    }
                    // ▲▲▲

                    // 10個以下の場合は重複防止ロジックを適用しない（毎回要約）
                    // ▲▲▲

                    // 会話をテキストに変換
                    const conversationText = messagesToSummarize
                      .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
                      .join('\n\n');

                    // GCP認証情報を確保
                    await ensureGcpCreds();
                    
                    // Vertex AIで要約
                    const summaryProjectId = process.env.GOOGLE_PROJECT_ID;
                    if (!summaryProjectId) {
                      console.error('[要約] ❌ GOOGLE_PROJECT_ID が設定されていません');
                      throw new Error('GOOGLE_PROJECT_ID 環境変数が設定されていません。');
                    }
                    const summaryVertexAI = new VertexAI({
                      project: summaryProjectId,
                      location: 'us-central1', // ★ Pro用にus-central1に変更
                    });

                    const summaryModel = summaryVertexAI.getGenerativeModel({
                      model: 'gemini-2.5-flash', // ★ Flash維持（ステータス更新用）
                      safetySettings,
                    });

                    const prompt = `以下の会話履歴を、AIが理解しやすいように簡潔に要約してください。

【重要】
- 会話の進行内容と実際の出来事のみを要約してください
- 背景設定、キャラクター説明、初期状況などの固定情報は含めないでください
- ユーザーとAIの実際の対話と行動のみを要約してください
- 会話の重要なポイント、イベント、感情の変化などを簡潔に含めてください
- 冗長な描写や詳細な状況説明は省略し、核心的な内容のみを記述してください
- 要約は簡潔に記述してください（2000文字以内、可能な限り簡潔に）

会話履歴：
${conversationText}`;

                    const result = await summaryModel.generateContent(prompt);
                    const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

                    if (summary) {
                      // ▼▼▼【改善】タイムアウト対策: まずルールベースのキーワードでメモリを作成し、AIキーワード抽出は非同期で実行
                      // 1. まずルールベースのキーワードを抽出（高速、即座に実行）
                      const extractedKeywords = extractKeywords(conversationText);

                      // 2. メモリを作成（ルールベースキーワードで、分割処理も含む）
                      const createdMemoryIds = await createDetailedMemories(
                        chatId,
                        summary,
                        extractedKeywords,
                        messageStartIndex,
                        messageEndIndex
                      );

                      // 3. バックグラウンドでAIキーワード抽出し、記憶を更新
                      if (createdMemoryIds.length > 0) {
                        updateMemoriesWithAIKeywords(summaryModel, summary, createdMemoryIds).catch((error: unknown) => {
                          console.error('Background AI keyword extraction error:', error);
                        });
                      }

                      console.log('詳細記憶自動要約が完了しました');
                    }
                  }
                }
              } catch (error) {
                console.error('詳細記憶自動要約エラー:', error);
              }
            })();
          }
          // ▲▲▲

          // AIメッセージの保存完了をクライアントに通知
          sendEvent('ai-message-saved', { modelMessage: newModelMessage });

        } catch (e) {
          if (!firstChunkReceived) console.timeEnd("⏱️ AI TTFB"); // エラー発生時もTTFB記録
          console.timeEnd("⏱️ AI sendMessageStream Total"); // エラー発生時も総時間記録
          console.error("ストリーム内部エラー:", e);
          const errorMessage = e instanceof Error ? e.message : 'ストリーム処理中に不明なエラーが発生しました。';
          sendEvent('error', { message: errorMessage }); // エラーをクライアントに送信
        } finally {
          // ▼▼▼【タイムアウト対策】ハートビートを停止 ▼▼▼
          clearInterval(heartbeatInterval);
          // ▲▲▲
          sendEvent('stream-end', { message: 'Stream ended' }); // ストリーム終了を通知
          controller.close(); // ストリームコントローラーを閉じる
          console.timeEnd("⏱️ 全体API処理時間"); // API処理全体の時間記録終了
        }
      }
    });

  // ストリーム応答を返す
  // Netlify環境でのバッファリングを無効化するヘッダーを追加
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Netlify/Vercel 等のバッファリング無効化
    },
  });

  } catch (error) {
    // ストリーム開始前に発生したエラー (例: 認証失敗、ポイント不足など)
    console.error("チャットAPI (pre-stream) エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "内部サーバーエラーが発生しました。";
    const status = error instanceof Error && error.message === "ポイントが不足しています。" ? 402 : 500;
    console.timeEnd("⏱️ 全体API処理時間");
    return NextResponse.json({ message: errorMessage }, { status });
  }
}

// キーワード抽出関数（フォールバック用）- 日本語のみ
// 注意：この関数は日本語テキストからのみキーワードを抽出します
// 韓国語・英語などのテキストでは空配列を返します（AIキーワード抽出に依存）
function extractKeywords(text: string): string[] {
  // キーワード抽出（範囲情報を除外、日本語のみ）
  // 日本語（ひらがな、カタカナ、漢字）のみを抽出
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g; // ひらがな、カタカナ、漢字

  const japaneseWords = text.match(japanesePattern) || [];
  
  // 日本語がほとんど含まれていない場合（韓国語・英語のみなど）、空配列を返す
  // AIキーワード抽出に依存させるため
  if (japaneseWords.length === 0) {
    return [];
  }
  
  const allWords = [...japaneseWords];
  const wordCount: { [key: string]: number } = {};

  // 除外する単語リスト（日本語のみ）
  const japaneseExclude = [
    // 代名詞・指示語
    'これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', 'その', '彼', '彼女', '彼は', '彼女は', 'もの', 'こと', 'ユーザー', 'ユーザ',
    // 助詞
    'は', 'が', 'を', 'に', 'の', 'で', 'へ', 'と', 'から', 'まで', 'より', 'も', 'だけ', 'しか', 'ばかり',
    // 一般的な動詞
    'する', 'した', 'ある', 'あった', 'いる', 'いた', 'なる', 'なった', '見る', '見た', '言う', '言った', '思う', '思った',
    '知る', '知った', '行く', '行った', '来る', '来た', 'やる', 'やった', 'やめる', 'やめた', '始める', '始めた', '終わる', '終わった',
    // 一般的な形容詞
    'いい', '良い', 'よい', '悪い', '大きい', '小さい', '多い', '少ない', '新しい', '古い', '高い', '低い',
    '同じ', '違う', '似ている', '近い', '遠い'
  ];

  allWords.forEach(word => {
    // 範囲情報パターンを除外（例: "1-5", "6-10", "11-15"など）
    if (!/^\d+-\d+$/.test(word)) {
      // 日本語のみを処理
      let normalizedWord = word;

      // ▼▼▼【改善】最小長さチェック（日本語は2文字以上）
      if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(normalizedWord) && normalizedWord.length < 2) return; // 日本語は2文字未満を除外
      // ▲▲▲

      // 除外リストチェック（完全一致）
      if (japaneseExclude.includes(normalizedWord)) return;

      // ▼▼▼【改善】日本語: 助詞が付いた形を除外（~は, ~が, ~を, ~に, ~の, ~で, ~へ, ~と, ~から, ~までなど）
      if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+[はがをにのでへとからまでよりもだけしかばかり]$/.test(normalizedWord)) {
        const baseWord = normalizedWord.replace(/[はがをにのでへとからまでよりもだけしかばかり]$/, '');
        // 助詞を除いた部分が2文字未満の場合は除外
        if (baseWord.length < 2) return;
        if (japaneseExclude.includes(baseWord)) return;
        // 助詞を除いた部分も除外リストに含まれていない場合、ベースワードを使用
        normalizedWord = baseWord;
      }
      // ▲▲▲

      // 日本語: 一般的な動詞・形容詞の活用形を除外（~する, ~した, ~ある, ~あった, ~いる, ~いたなど）
      if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(する|した|ある|あった|いる|いた|なる|なった|見る|見た|言う|言った|思う|思った)$/.test(normalizedWord)) {
        const baseWord = normalizedWord.replace(/(する|した|ある|あった|いる|いた|なる|なった|見る|見た|言う|言った|思う|思った)$/, '');
        if (baseWord.length < 2) return;
        const commonJapaneseVerbs = ['する', 'ある', 'いる', 'なる', '見', '言', '思', '知', '行', '来', 'や', '始', '終'];
        if (commonJapaneseVerbs.includes(baseWord)) return;
      }

      // 日本語: 一般的な形容詞を除外（~いい, ~良い, ~悪い, ~大きい, ~小さいなど）
      if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(いい|良い|よい|悪い|大きい|小さい|多い|少ない|新しい|古い|高い|低い|同じ|違う|似ている|近い|遠い)$/.test(normalizedWord)) {
        return; // 形容詞はそのまま除外
      }

      // 技術的なタグを除外
      if (normalizedWord.match(/^(img|Img|IMG|\{img|\{Img)$/i)) return;

      // HTMLタグのようなものを除外
      if (normalizedWord.match(/^[<{}>]/)) return;

      // 数値のみを除外
      if (/^\d+$/.test(normalizedWord)) return;

      // メタデータパターンを除外
      if (normalizedWord.match(/^__META:/)) return;

      wordCount[normalizedWord] = (wordCount[normalizedWord] || 0) + 1;
    }
  });

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}
