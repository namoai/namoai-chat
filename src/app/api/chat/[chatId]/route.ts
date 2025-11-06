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
import { getEmbedding, embeddingToVectorString } from "@/lib/embeddings";
import { searchSimilarMessages, searchSimilarDetailedMemories } from "@/lib/vector-search";

// VertexAIクライアントの初期化
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_PROJECT_ID,
  location: "asia-northeast1",
});

// 安全性設定
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

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
                 const embeddingString = embeddingToVectorString(embedding);
                 await prisma.$executeRaw`
                   UPDATE "chat_message" 
                   SET "embedding" = ${embeddingString}::vector 
                   WHERE "id" = ${newUserMessage.id}
                 `;
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
        console.log("ステップ2: チャットルーム情報取得完了");

        console.time("⏱️ DB History+Persona Query");
        // ▼▼▼【修正】ユーザーが閲覧しているバージョンを考慮した履歴取得 ▼▼▼
        let historyWhereClause: {
            chatId: number;
            createdAt: { lt: Date };
            isActive?: boolean;
            OR?: Array<{ role: string } | { id: { in: number[] } }>;
        } = { 
            chatId: chatId, 
            createdAt: { lt: new Date() } 
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
                take: 10, // 履歴は最新10件を取得
            }),
            prisma.chat.findUnique({
                where: { id: chatId },
                select: { backMemory: true, autoSummarize: true },
            }),
            prisma.detailed_memories.findMany({
                where: { chatId: chatId },
                orderBy: { createdAt: "desc" },
            }),
        ]);
        
        console.timeEnd("⏱️ DB History+Persona Query");

        const orderedHistory = history.reverse();
        
        // ▼▼▼【ベクトル検索】最新10件に加えて、関連メッセージをベクトル検索で追加▼▼▼
        let vectorMatchedMessages: Array<{ id: number; content: string; role: string; createdAt: Date }> = [];
        try {
          const messageEmbedding = await getEmbedding(message);
          const excludeTurnIds = orderedHistory.map(msg => msg.turnId || 0).filter(id => id > 0);
          const matched = await searchSimilarMessages(messageEmbedding, chatId, excludeTurnIds, 5);
          // 既存履歴に含まれていないメッセージのみ追加
          const existingIds = new Set(orderedHistory.map(h => h.id));
          vectorMatchedMessages = matched.filter(m => !existingIds.has(m.id));
        } catch (error) {
          console.error('ベクトル検索エラー（メッセージ）:', error);
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
    const allHistoryMessages = [
      ...orderedHistory,
      ...vectorMatchedMessages.map(m => ({
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
            // キーワード検索を最適化
            const hasMatch = lore.keywords.some((keyword) => {
              return keyword && lowerMessage.includes(keyword.toLowerCase());
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
      // 1. ベクトル検索（embeddingがある場合）
      try {
        const messageEmbedding = await getEmbedding(message);
        const vectorMatched = await searchSimilarDetailedMemories(messageEmbedding, chatId, 3);
        
        for (const mem of vectorMatched) {
          if (triggeredMemories.length >= 3 || triggeredMemoryIds.has(mem.id)) continue;
          triggeredMemories.push(mem.content);
          triggeredMemoryIds.add(mem.id);
          // 最後に適用された時刻を更新
          await prisma.detailed_memories.update({
            where: { id: mem.id },
            data: { lastApplied: new Date() },
          });
        }
      } catch (error) {
        console.error('ベクトル検索エラー:', error);
      }
      
      // 2. キーワードマッチング（ベクトル検索で見つからなかった場合の補完）
      if (triggeredMemories.length < 3) {
        const lowerMessage = message.toLowerCase();
        const lowerHistory = orderedHistory.map(msg => msg.content.toLowerCase()).join(' ');
        const combinedText = `${lowerMessage} ${lowerHistory}`;
        
        for (const memory of detailedMemories) {
          if (triggeredMemories.length >= 3 || triggeredMemoryIds.has(memory.id)) break;
          
          if (memory.keywords && Array.isArray(memory.keywords) && memory.keywords.length > 0) {
            const hasMatch = memory.keywords.some((keyword) => {
              return keyword && combinedText.includes(keyword.toLowerCase());
            });
            
            if (hasMatch) {
              triggeredMemories.push(memory.content);
              triggeredMemoryIds.add(memory.id);
              await prisma.detailed_memories.update({
                where: { id: memory.id },
                data: { lastApplied: new Date() },
              });
            }
          }
        }
      }
    }
    console.timeEnd("⏱️ Detailed Memory Search");
    if (triggeredMemories.length > 0) {
      detailedMemoryInfo = `# 詳細記憶\n- 以下の記憶は会話の内容に基づき有効化された。\n${triggeredMemories.map((mem, idx) => `- 記憶${idx + 1}: ${mem}`).join('\n')}`;
    }
    // ▲▲▲

    // ▼▼▼ バックメモリの追加 ▼▼▼
    let backMemoryInfo = "";
    if (backMemory && backMemory.backMemory && backMemory.backMemory.trim().length > 0) {
      backMemoryInfo = `# メモリブック (会話の要約)\n${backMemory.backMemory}`;
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
    
    const formattingInstruction = `# Response Format (Required)
- You are the narrator and game master of this world. Describe the actions and dialogue of characters from a third-person perspective.
- Narration: Write in third person naturally. All narration text will be displayed in gray color automatically.
- Dialogue: Enclose in Japanese quotation marks (「」) ONLY. Dialogue will be displayed in white color. Example: 「Hello」 or Alice「Hello」
- Status Window: For character status, location info, or game system information, wrap them in code blocks using triple backticks (\`\`\`). Example:
\`\`\`
📅91日目 | 🏫 教室 | 🌤️ 晴れ
キャラクター: 太郎、花子
💖関係: 友人 → 恋人候補
\`\`\`
- For multiple characters, describe each character's actions and speech naturally.
- Separate narration and dialogue with line breaks for readability.
- Continue from the initial situation and opening message provided above.
- **Response Length**: Aim for 800-1100 characters (including spaces) per response. Provide rich, detailed descriptions and dialogue.
- **IMPORTANT**: Always include a status window at the end of your response using code blocks (\`\`\`) to show current situation, characters present, relationships, etc.`;

    const systemTemplate = replacePlaceholders(worldSetting.systemTemplate);

    // Assemble final system prompt
    const systemInstructionText = [systemTemplate, initialContextText, backMemoryInfo, detailedMemoryInfo, imageInstruction, formattingInstruction, userPersonaInfo, lorebookInfo].filter(Boolean).join("\n\n");
    console.log("ステップ4: システムプロンプト構築完了");
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
          const generativeModel = vertex_ai.getGenerativeModel({ model: modelToUse, safetySettings });
          
          // チャットセッションを開始（履歴とシステム指示を渡す）
          const chatSession = generativeModel.startChat({ 
            history: chatHistory, 
            systemInstruction: systemInstructionText 
          });
          
          // ストリーミングでメッセージを送信
          const result = await chatSession.sendMessageStream(message);

          let finalResponseText = ""; // 最終的なAIの応答テキスト

          // ストリームを反復処理
          for await (const item of result.stream) {
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

          // 応答が空でないか確認
          if (!finalResponseText.trim()) {
             console.log("警告: 最終的な応答テキストが空でした。");
             throw new Error("AIからの応答が空でした。");
          }

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
              const embeddingString = embeddingToVectorString(embedding);
              await prisma.$executeRaw`
                UPDATE "chat_message" 
                SET "embedding" = ${embeddingString}::vector 
                WHERE "id" = ${newModelMessage.id}
              `;
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
                // - 10個以下: 毎回実行
                // - 10個超過: 5個単位で実行（10, 15, 20, 25...）
                let shouldSummarize = false;
                if (messageCount <= 10) {
                  shouldSummarize = messageCount >= 1; // 1個以上なら毎回
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

                  if (messages.length > 0) {
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

                      // embeddingを生成
                      (async () => {
                        try {
                          const embedding = await getEmbedding(summary);
                          const embeddingString = embeddingToVectorString(embedding);
                          await prisma.$executeRaw`
                            UPDATE "chat" 
                            SET "backMemoryEmbedding" = ${embeddingString}::vector 
                            WHERE "id" = ${chatId}
                          `;
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
