export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ▼▼▼【重要】キャッシュを無効化して常に最新データを取得 ▼▼▼

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
  Content,
} from "@google-cloud/vertexai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { getEmbedding } from "@/lib/embeddings";
import { searchSimilarMessages, searchSimilarDetailedMemories } from "@/lib/vector-search";
import { getSafetySettings } from "@/lib/chat/safety-settings";
import { CharacterImageInfo, selectImageByKeyword, addImageTagIfKeywordMatched } from "@/lib/chat/image-selection";
import { createDetailedMemories } from "@/lib/chat/memory-management";

// VertexAIクライアントの初期化
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_PROJECT_ID,
  location: "asia-northeast1",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(request: Request, context: any) {
  console.log("チャットAPIリクエスト受信");
  console.time("⏱️ 全体API処理時間"); // 全体時間測定開始
  const { params } = (context ?? {}) as { params?: Record<string, string | string[]> };
  const rawChatId = params?.chatId;
  const chatIdStr = Array.isArray(rawChatId) ? rawChatId[0] : rawChatId;


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
        userMessageForHistory = await prisma.chat_message.findUnique({ where: { id: turnId }});
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

    const worldSetting = chatRoom.characters; // 'char' から 'worldSetting' に変数名を変更 (意味を明確化)
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
      ? `# User Settings\n- ${persona.nickname}, ${persona.age || "Age unset"}, ${persona.gender || "Gender unset"}\n- Details: ${replacePlaceholders(persona.description)}` 
      : "";
    
    // Initial situation and message
    const initialContext = [];
    if (worldSetting.firstSituation) {
      initialContext.push(`# Initial Situation\n${replacePlaceholders(worldSetting.firstSituation)}`);
    }
    if (worldSetting.firstMessage) {
      initialContext.push(`# Opening Message\n${replacePlaceholders(worldSetting.firstMessage)}`);
    }
    const initialContextText = initialContext.join("\n\n");
    
    // ▼▼▼【画像リスト】AIが使用できる画像のリスト ▼▼▼
    const availableImages = worldSetting.characterImages || [];
    const imageList = availableImages
      .filter(img => !img.isMain)
      .map((img, index) => `${index + 1}. "${img.keyword}" - Use: {img:${index + 1}}`)
      .join('\n');
    
    const imageInstruction = imageList 
      ? `# Available Images\nYou can display images by including tags in your response:\n${imageList}\n\nUsage: Insert {img:N} at appropriate moments in your narration. Example: \`Alice smiled warmly. {img:1}\``
      : "";
    // ▲▲▲
    
    // ユーザーの最新メッセージから言語要求を抽出（長さ要求は無視して常に800-1100文字）
    const userLanguageRequest = message.match(/한국어|韓国語|korean|Korean|ko|KO|すべて.*韓国語|全て.*韓国語/i);
    
    // 言語要求に基づいてフォーマット指示を生成
    const languageInstruction = userLanguageRequest 
      ? `- **Output Language**: Respond in Korean (한국어). All narration, dialogue, and descriptions should be in Korean.`
      : `- **Output Language**: Respond in Japanese (日本語). All narration, dialogue, and descriptions should be in Japanese.`;
    
    // 応答長さは常に800-1100文字に固定
    const lengthInstruction = `- **Response Length**: Aim for 800-1100 characters (including spaces) per response. Provide rich, detailed descriptions and dialogue.`;
    
    // ▼▼▼【追加】セーフティフィルター設定に基づいてContent Policyを動的に生成
    // キャラクターのセーフティフィルターがONの場合、より厳格な制限を適用
    const characterSafetyFilter = chatRoom.characters.safetyFilter ?? true;
    const contentPolicy = userSafetyFilter === false && characterSafetyFilter === false
      ? `- **Content Policy**: This is an adult-oriented creative writing platform. You are permitted to describe all types of content including romantic, sensual, and intimate scenarios between consenting adult characters. Focus on emotional depth, sensory details, and narrative quality. Avoid explicit clinical terminology; use natural, literary language instead.`
      : characterSafetyFilter === true
      ? `- **Content Policy**: This character has the safety filter enabled. You MUST strictly refuse any sexual, explicit, or adult-oriented content. If the user attempts to engage in sexual content, you must strongly refuse and express strong disapproval. Respond with phrases like "そんなこと絶対にできない！", "そういう話はやめて！", "私はそんなことはしたくない！" and redirect to safe, appropriate topics. Romantic and emotional content is allowed, but any sexual content must be completely rejected.`
      : `- **Content Policy**: Keep content appropriate and safe. Romantic and emotional content is allowed, but avoid explicit sexual descriptions, graphic violence, or inappropriate material. Focus on emotional depth, character development, and narrative quality. Use suggestive and subtle descriptions rather than explicit content. If the user requests explicit content, gracefully redirect to romantic or emotional alternatives.`;
    // ▲▲▲
    
    // Content PolicyはsystemTemplateの指示事項と衝突する可能性があるため、
    // systemTemplateに性的コンテンツ制限解除などが明記されている場合はそれを優先
    // Content Policyは基本的なガイドラインとしてのみ使用
    const formattingInstruction = `# Response Format
- Narrator role: Describe character actions/dialogue in third person. User speaks for themselves.
- Context: Read all chat history. Maintain consistency with previous messages.
${contentPolicy}
${languageInstruction}
- Format: Narration (gray), Dialogue in quotes (「」/""), Status in \`\`\`code blocks\`\`\` at end.
${lengthInstruction}
- **Important**: The character's systemTemplate (above) takes precedence over general content policies. Follow the character's specific instructions in systemTemplate first.`;

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
          const modelToUse = settings?.model || "gemini-2.5-flash"; // デフォルトモデル
          console.log(`使用モデル: ${modelToUse}`);
          
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
          
          const safetySettings = getSafetySettings(userSafetyFilter);
          if (userSafetyFilter) {
            console.log(`  - 安全性設定: BLOCK_ONLY_HIGH (すべてのカテゴリー、高レベルだけブロック、ロマンチック/感情的な内容は許可)`);
          } else {
            console.log(`  - 安全性設定: BLOCK_NONE (すべて許可)`);
          }
          const generativeModel = vertex_ai.getGenerativeModel({ model: modelToUse, safetySettings });
          
          // チャットセッションを開始（履歴とシステム指示を渡す）
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

                    // Vertex AIで要約
                    const summaryVertexAI = new VertexAI({
                      project: process.env.GOOGLE_PROJECT_ID || '',
                      location: 'asia-northeast1',
                    });

                    const summaryModel = summaryVertexAI.getGenerativeModel({
                      model: 'gemini-2.5-pro',
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

                    // Vertex AIで要約
                    const summaryVertexAI = new VertexAI({
                      project: process.env.GOOGLE_PROJECT_ID || '',
                      location: 'asia-northeast1',
                    });

                    const summaryModel = summaryVertexAI.getGenerativeModel({
                      model: 'gemini-2.5-flash',
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
                      // ▼▼▼【改善】AIベースのキーワード抽出（より正確なキーワード抽出）
                      let extractedKeywords: string[] = [];
                      try {
                        const keywordPrompt = `以下の会話要約から、重要なキーワードを10個まで抽出してください。

【抽出するキーワードの種類】
- 出来事・イベント（例：オーディション、コンサート、パーティー、試合）
- 行動・活動（例：歌、踊り、演奏、演説、対戦）
- 対象・テーマ（例：音楽、スポーツ、芸術、勉強、仕事）
- 人物・関係（例：プロデューサー、審査員、観客、友達、恋人）
- 感情・状態（例：緊張、興奮、喜び、悲しみ、自信）
- 場所・環境（例：ステージ、ホール、学校、家）
- 物・道具（例：マイク、ギター、楽器、衣装）

【絶対に除外する単語】
- 代名詞（例：그、그녀、그는、그녀는、彼、彼女、彼は、彼女は、당신、당신의、ユーザー）
- 助詞・助動詞（例：は、が、を、に、の、で、へ、と、から、まで、より、이、가、을、를、은、는、의、에、에서）
- 一般的すぎる動詞（例：する、した、ある、あった、いる、いた、なる、なった、見る、見た、言う、言った、思う、思った、하다、했다、있다、있었다、없다、없었다、보다、봤다、듯하다、듯했다）
- 一般的すぎる形容詞（例：いい、良い、よい、悪い、大きい、小さい、多い、少ない、新しい、古い、좋다、좋았다、나쁘다、나빴다、크다、작다）
- 技術的なタグ（例：Img、img、{img}、HTMLタグ）
- 数値や記号のみ（例：1、2、3、-、/）
- 指示語（例：これ、それ、あれ、이것、그것）

【重要なルール】
- 名詞中心で、会話の核心を表す重要な概念のみを抽出
- 抽象的すぎる単語（例：もの、こと、것、事）は除外
- キーワードはカンマ区切りで返してください
- キーワードは元の言語（日本語、英語、韓国語など）でそのまま返してください
- 10個に満たない場合は、無理に10個にしなくても構いません

会話要約：
${summary}`;

                        const keywordResult = await summaryModel.generateContent(keywordPrompt);
                        const keywordText = keywordResult.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        
                        if (keywordText) {
                          // カンマ区切りで分割し、空白を削除（多言語対応のためtoLowerCaseは使用しない）
                          extractedKeywords = keywordText
                            .split(',')
                            .map(k => k.trim())
                            .filter(k => {
                              if (!k || k.length < 2 || k.length > 30) return false;
                              
                              // メタデータパターンを除外
                              if (k.match(/^__META:/)) return false;
                              
                              // 数値のみを除外
                              if (/^\d+$/.test(k)) return false;
                              
                              // 一般的な代名詞・指示語を除外（日本語）
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
                              if (japaneseExclude.includes(k)) return false;
                              
                              // 日本語: 一般的な動詞・形容詞の活用形を除外
                              if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(する|した|ある|あった|いる|いた|なる|なった|見る|見た|言う|言った|思う|思った)$/.test(k)) {
                                const baseWord = k.replace(/(する|した|ある|あった|いる|いた|なる|なった|見る|見た|言う|言った|思う|思った)$/, '');
                                if (baseWord.length <= 1) return false;
                                const commonJapaneseVerbs = ['する', 'ある', 'いる', 'なる', '見', '言', '思', '知', '行', '来', 'や', '始', '終'];
                                if (commonJapaneseVerbs.includes(baseWord)) return false;
                              }
                              
                              // 日本語: 一般的な形容詞を除外
                              if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(いい|良い|よい|悪い|大きい|小さい|多い|少ない|新しい|古い|高い|低い|同じ|違う|似ている|近い|遠い)$/.test(k)) {
                                return false;
                              }
                              
                              // 一般的な代名詞・指示語を除外（韓国語）
                              const koreanExclude = [
                                // 代名詞・指示語
                                '그', '그녀', '그는', '그녀는', '그녀의', '이것', '그것', '것', '당신', '당신의',
                                // 助詞
                                '이', '가', '을', '를', '은', '는', '의', '에', '에서', '으로', '로', '와', '과', '부터', '까지', '도', '만', '조차',
                                // 一般的な動詞
                                '있다', '있었다', '없다', '없었다', '하다', '했다', '한다', '되다', '되었다', '된다', '보다', '봤다', '본다', '보았다',
                                '듯하다', '듯했다', '듯한다', '같다', '같았다', '좋다', '좋았다', '나쁘다', '나빴다',
                                '되다', '되었다', '된다', '말하다', '말했다', '말한다', '생각하다', '생각했다', '생각한다',
                                // 一般的な形容詞
                                '크다', '작다', '많다', '적다', '좋다', '나쁘다', '새롭다', '오래되다'
                              ];
                              if (koreanExclude.includes(k)) return false;
                              
                              // 韓国語: 助詞が付いた形を除外
                              if (/^[가-힣]+(의|이|가|을|를|은|는|에|에서|으로|로|와|과|부터|까지|도|만|조차)$/.test(k)) {
                                const baseWord = k.replace(/(의|이|가|을|를|은|는|에|에서|으로|로|와|과|부터|까지|도|만|조차)$/, '');
                                if (koreanExclude.includes(baseWord)) return false;
                              }
                              
                            // 一般的な動詞・形容詞の過去形・現在形を除外
                            if (/^[가-힣]+(다|았다|었다|한다|했다)$/.test(k)) {
                              const baseWord = k.replace(/(다|았다|었다|한다|했다)$/, '');
                              if (baseWord.length <= 2) return false;
                              const commonVerbs = ['있', '없', '하', '되', '보', '말', '생각', '좋', '나쁘', '크', '작', '많', '적', '새롭', '오래되'];
                              if (commonVerbs.includes(baseWord)) return false;
                            }
                            
                            // 日本語: 一般的な動詞・形容詞の活用形を除外
                            if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(する|した|ある|あった|いる|いた|なる|なった|見る|見た|言う|言った|思う|思った)$/.test(k)) {
                              const baseWord = k.replace(/(する|した|ある|あった|いる|いた|なる|なった|見る|見た|言う|言った|思う|思った)$/, '');
                              if (baseWord.length <= 1) return false;
                              const commonJapaneseVerbs = ['する', 'ある', 'いる', 'なる', '見', '言', '思', '知', '行', '来', 'や', '始', '終'];
                              if (commonJapaneseVerbs.includes(baseWord)) return false;
                            }
                            
                            // 日本語: 一般的な形容詞を除外
                            if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(いい|良い|よい|悪い|大きい|小さい|多い|少ない|新しい|古い|高い|低い|同じ|違う|似ている|近い|遠い)$/.test(k)) {
                              return false;
                            }
                              
                              // 技術的なタグを除外
                              if (k.match(/^(img|Img|IMG|\{img|\{Img)$/i)) return false;
                              
                              // HTMLタグのようなものを除外
                              if (k.match(/^[<{}>]/)) return false;
                              
                              // 一般的すぎる単語を除外（英語）
                              const englishExclude = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'img', 'user', 'users'];
                              if (englishExclude.includes(k.toLowerCase())) return false;
                              
                              return true;
                            })
                            .slice(0, 10);
                        }
                      } catch (error) {
                        console.error('AIキーワード抽出エラー:', error);
                        // AI抽出失敗時は多言語対応フォールバック（改善されたフィルタリング）
                        // 日本語（ひらがな、カタカナ、漢字）、韓国語（한글）、英語を抽出
                        const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g; // ひらがな、カタカナ、漢字
                        const koreanPattern = /[\uAC00-\uD7AF]+/g; // 한글
                        const englishPattern = /\b[A-Za-z]{3,}\b/g; // 英語（3文字以上）
                        
                        const japaneseWords = conversationText.match(japanesePattern) || [];
                        const koreanWords = conversationText.match(koreanPattern) || [];
                        const englishWords = conversationText.toLowerCase().match(englishPattern) || [];
                        
                        const allWords = [...japaneseWords, ...koreanWords, ...englishWords];
                        const wordCount: { [key: string]: number } = {};
                        
                        // 除外する単語リスト
                        const japaneseExclude = [
                          // 代名詞・指示語
                          'これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', 'その', '彼', '彼女', '彼は', '彼女は', 'もの', 'こと', 'ユーザー', 'ユーザ',
                          // 助詞
                          'は', 'が', 'を', 'に', 'の', 'で', 'へ', 'と', 'から', 'まで', 'より', 'も', 'だけ', 'しか', 'ばかり',
                          // 一般的な動詞
                          'する', 'した', 'する', 'ある', 'あった', 'いる', 'いた', 'なる', 'なった', 'なる', '見る', '見た', '見る', '言う', '言った', '言う',
                          '思う', '思った', '思う', '知る', '知った', '知る', '行く', '行った', '行く', '来る', '来た', '来る',
                          'やる', 'やった', 'やる', 'やめる', 'やめた', 'やめる', '始める', '始めた', '始める', '終わる', '終わった', '終わる',
                          // 一般的な形容詞
                          'いい', '良い', 'よい', '悪い', '大きい', '小さい', '多い', '少ない', '新しい', '古い', '高い', '低い',
                          '同じ', '違う', '似ている', '近い', '遠い'
                        ];
                        const koreanExclude = [
                          // 代名詞・指示語
                          '그', '그녀', '그는', '그녀는', '그녀의', '이것', '그것', '것', '당신', '당신의',
                          // 助詞
                          '이', '가', '을', '를', '은', '는', '의', '에', '에서', '으로', '로', '와', '과', '부터', '까지', '도', '만', '도', '조차',
                          // 一般的な動詞
                          '있다', '있었다', '없다', '없었다', '하다', '했다', '한다', '되다', '되었다', '된다', '보다', '봤다', '본다', '보았다',
                          '듯하다', '듯했다', '듯한다', '같다', '같았다', '같다', '좋다', '좋았다', '나쁘다', '나빴다',
                          '되다', '되었다', '된다', '말하다', '말했다', '말한다', '생각하다', '생각했다', '생각한다',
                          // 一般的な形容詞
                          '크다', '작다', '많다', '적다', '좋다', '나쁘다', '새롭다', '오래되다'
                        ];
                        const englishExclude = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'img', 'and', 'or', 'but', 'if', 'when', 'where', 'what', 'who', 'why', 'how', 'user', 'users'];
                        
                        allWords.forEach(word => {
                          // 範囲情報パターンを除外（例: "1-5"など）
                          if (!/^\d+-\d+$/.test(word)) {
                            const normalizedWord = /^[A-Za-z]/.test(word) ? word.toLowerCase() : word;
                            
                            // 除外リストチェック（完全一致）
                            if (japaneseExclude.includes(normalizedWord)) return;
                            if (koreanExclude.includes(normalizedWord)) return;
                            if (englishExclude.includes(normalizedWord)) return;
                            
                            // 韓国語: 助詞が付いた形を除外（~의, ~이, ~가, ~을, ~를, ~은, ~는, ~에, ~에서など）
                            if (/^[가-힣]+(의|이|가|을|를|은|는|에|에서|으로|로|와|과|부터|까지|도|만|조차)$/.test(normalizedWord)) {
                              // 助詞を除いた部分も除外リストに含まれているか確認
                              const baseWord = normalizedWord.replace(/(의|이|가|을|를|은|는|에|에서|으로|로|와|과|부터|까지|도|만|조차)$/, '');
                              if (koreanExclude.includes(baseWord)) return;
                            }
                            
                            // 一般的な動詞・形容詞の過去形・現在形を除外（~다, ~았다, ~었다, ~한다, ~했다など）
                            if (/^[가-힣]+(다|았다|었다|한다|했다|한다|한다|한다|한다)$/.test(normalizedWord)) {
                              const baseWord = normalizedWord.replace(/(다|았다|었다|한다|했다|한다|한다|한다|한다)$/, '');
                              // 短すぎる単語（2文字以下）は除外
                              if (baseWord.length <= 2) return;
                              // 一般的な動詞・形容詞の語幹を除外
                              const commonVerbs = ['있', '없', '하', '되', '보', '말', '생각', '좋', '나쁘', '크', '작', '많', '적', '새롭', '오래되'];
                              if (commonVerbs.includes(baseWord)) return;
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
                        
                        extractedKeywords = Object.entries(wordCount)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 10)
                          .map(([word]) => word);
                      }
                      // ▲▲▲
                      
                      // Create detailed memories from summary
                      await createDetailedMemories(
                        chatId,
                        summary,
                        extractedKeywords,
                        messageStartIndex,
                        messageEndIndex
                      );
                      
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
