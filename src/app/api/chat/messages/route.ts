export const dynamic = "force-dynamic"; // ▼▼▼【重要】キャッシュを無効化して常に最新データを取得 ▼▼▼

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { VertexAI, HarmCategory, HarmBlockThreshold, Content } from "@google-cloud/vertexai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth"; 
import { getEmbedding } from "@/lib/embeddings";
import { searchSimilarDetailedMemories } from "@/lib/vector-search"; 

// VertexAIクライアントの初期化（asia-northeast1に変更して高速化）
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_PROJECT_ID,
  location: "asia-northeast1",
});

// 安全性設定（デフォルト、ユーザー設定に基づいて動的に変更される）
const getSafetySettings = (safetyFilterEnabled: boolean) => {
    if (safetyFilterEnabled === false) {
        // セーフティフィルターOFF: すべてのコンテンツを許可
        return [
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
];
    } else {
        // セーフティフィルターON: 高レベルだけをブロック（ロマンチック/感情的な内容は許可）
        return [
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }, // 高レベルだけブロック（ロマンチック/感情的な内容は許可）
        ];
    }
};

// ▼▼▼【バックエンド画像キーワードマッチング】AI応答からキーワードで画像を自動選択▼▼▼
type CharacterImageInfo = {
  keyword?: string | null;
  imageUrl: string;
  isMain?: boolean;
};

const selectImageByKeyword = (
  aiResponse: string,
  availableImages: CharacterImageInfo[]
): string | null => {
  if (!aiResponse || !availableImages || availableImages.length === 0) {
    return null;
  }

  const lowerResponse = aiResponse.toLowerCase();
  const nonMainImages = availableImages.filter(img => !img.isMain && img.keyword);
  
  // 優先度順にマッチング（最初にマッチしたものを返す）
  for (const img of nonMainImages) {
    if (img.keyword) {
      const keyword = img.keyword.toLowerCase().trim();
      // キーワードが完全に含まれているかチェック（部分マッチ）
      if (keyword && lowerResponse.includes(keyword)) {
        console.log(`📸 再生成: バックエンド画像キーワードマッチ: "${keyword}" -> ${img.imageUrl}`);
        return img.imageUrl;
      }
    }
  }
  
  return null;
};

const addImageTagIfKeywordMatched = (
  responseText: string,
  availableImages: CharacterImageInfo[]
): string => {
  // 既に {img:N} タグがあるかチェック
  const hasImgTag = /\{img:\d+\}/.test(responseText);
  if (hasImgTag) {
    return responseText; // 既にタグがあれば何もしない
  }

  // キーワードマッチングで画像を選択
  const matchedImageUrl = selectImageByKeyword(responseText, availableImages);
  if (!matchedImageUrl) {
    return responseText; // マッチしなければそのまま
  }

  // マッチした画像のインデックスを取得
  const nonMainImages = availableImages.filter(img => !img.isMain);
  const imageIndex = nonMainImages.findIndex(img => img.imageUrl === matchedImageUrl);
  
  if (imageIndex >= 0) {
    // 応答の最後に画像タグを追加
    const imgTag = ` {img:${imageIndex + 1}}`;
    console.log(`📸 再生成: バックエンド画像タグ自動追加: ${imgTag}`);
    return responseText + imgTag;
  }

  return responseText;
};
// ▲▲▲


// --- 新規メッセージ作成または再生成 (POST) ---
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }
    const userId = parseInt(session.user.id);

    // ▼▼▼【追加】ユーザーのセーフティフィルター設定を取得
    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { safetyFilter: true },
    });
    const userSafetyFilter = user?.safetyFilter ?? true; // デフォルトはtrue（フィルターON）
    // ▲▲▲

    const { chatId, turnId, settings, activeVersions } = await request.json();

    if (!chatId || !turnId) {
        return NextResponse.json({ error: "チャットIDとターンIDは必須です。" }, { status: 400 });
    }

    try {
        console.log("再生成API開始");
        console.time("⏱️ 再生成API処理時間");
        
        // ポイント消費ロジック
        const boostMultiplier = settings?.responseBoostMultiplier || 1.0;
        const boostCostMap: { [key: number]: number } = { 1.5: 1, 3.0: 2, 5.0: 4 };
        const boostCost = boostCostMap[boostMultiplier] || 0;
        const totalPointsToConsume = 1 + boostCost;

        console.time("⏱️ ポイント消費");
        await prisma.$transaction(async (tx) => {
            const userPointsRecord = await tx.points.findUnique({ where: { user_id: userId } });
            const currentUserPoints = (userPointsRecord?.free_points || 0) + (userPointsRecord?.paid_points || 0);
            if (currentUserPoints < totalPointsToConsume) throw new Error("ポイントが不足しています。");
            
            let remainingCost = totalPointsToConsume;
            const freePointsAfter = Math.max(0, (userPointsRecord?.free_points || 0) - remainingCost);
            remainingCost = Math.max(0, remainingCost - (userPointsRecord?.free_points || 0));
            const paidPointsAfter = Math.max(0, (userPointsRecord?.paid_points || 0) - remainingCost);
            
            await tx.points.update({
                where: { user_id: userId },
                data: { free_points: freePointsAfter, paid_points: paidPointsAfter },
            });
        });
        console.timeEnd("⏱️ ポイント消費");

        // DBクエリを並列化して高速化
        console.time("⏱️ DBクエリ");
        const [chatRoom, userMessageForTurn] = await Promise.all([
            prisma.chat.findUnique({
                where: { id: chatId },
                include: { 
                    characters: { 
                        include: { 
                            characterImages: true,
                            lorebooks: { orderBy: { id: "asc" } }
                        } 
                    }, 
                    users: { select: { defaultPersonaId: true } } 
                },
            }),
            prisma.chat_message.findUnique({ where: { id: turnId } })
        ]);
        console.timeEnd("⏱️ DBクエリ");

        if (!chatRoom || !chatRoom.characters) return NextResponse.json({ error: "チャットまたはキャラクターが見つかりません。" }, { status: 404 });
        if (!userMessageForTurn) throw new Error("対象のメッセージが見つかりません。");
        
        // システムプロンプト構築
        let userPersonaInfo = "";
        if (chatRoom.users.defaultPersonaId) {
            console.time("⏱️ ペルソナ取得");
            const p = await prisma.personas.findUnique({ where: { id: chatRoom.users.defaultPersonaId }});
            if (p) userPersonaInfo = `# User\n${p.nickname}${p.age ? `, ${p.age}` : ''}${p.gender ? `, ${p.gender}` : ''}\n${p.description}`;
            console.timeEnd("⏱️ ペルソナ取得");
        }
        const char = chatRoom.characters;
        
        // ▼▼▼【プレースホルダー置換】{{char}}、{{user}}を置換 ▼▼▼
        const userNickname = userPersonaInfo ? userPersonaInfo.match(/^# User\n(.+?)(?:\n|,)/)?.[1] || "ユーザー" : "ユーザー";
        const worldName = char.name || "キャラクター";
        const replacePlaceholders = (text: string | null | undefined): string => {
          if (!text) return "";
          return text.replace(/{{char}}/g, worldName).replace(/{{user}}/g, userNickname);
        };
        // ▲▲▲
        
        // ▼▼▼【バックメモリ】会話の要約を追加 ▼▼▼
        let backMemoryInfo = "";
        const backMemoryData = await prisma.chat.findUnique({
          where: { id: chatId },
          select: { backMemory: true },
        });
        if (backMemoryData?.backMemory && backMemoryData.backMemory.trim().length > 0) {
          backMemoryInfo = `# メモリブック (会話の要約)\n${backMemoryData.backMemory}`;
          // ▼▼▼【デバッグ】メモリブックの内容をログ出力
          console.log(`📚 再生成: メモリブックが適用されました (${backMemoryData.backMemory.length}文字):`);
          console.log(`  ${backMemoryData.backMemory.substring(0, 200)}${backMemoryData.backMemory.length > 200 ? '...' : ''}`);
          // ▲▲▲
        } else {
          console.log("📚 再生成: メモリブック: 適用されたメモリはありません");
        }
        // ▲▲▲
        
        console.time("⏱️ 履歴取得");
        // ▼▼▼【修正】再生成時は、再生成対象のturnIdを除き、各turnIdの最新アクティブバージョンを取得 ▼▼▼
        // 再生成対象のturnIdより前のメッセージを取得
        const messagesBeforeRegen = await prisma.chat_message.findMany({
            where: {
                chatId: chatId,
                createdAt: { lt: userMessageForTurn.createdAt },
            },
            orderBy: { createdAt: 'asc' },
        });
        
        // 各turnIdごとに最新のアクティブバージョンを選択
        // ただし、再生成対象のturnIdは完全に除外（再生成前の状態を保持）
        const userMessagesMap = new Map<number, typeof messagesBeforeRegen[0]>();
        const modelMessagesMap = new Map<number, typeof messagesBeforeRegen[0]>();
        
        for (const msg of messagesBeforeRegen) {
            // turnIdがnullの場合はスキップ
            if (!msg.turnId) continue;
            
            // 再生成対象のturnIdは完全に除外
            if (msg.turnId === turnId) continue;
            
            if (msg.role === 'user') {
                // ユーザーメッセージは常に含める（各turnId당 하나）
                if (!userMessagesMap.has(msg.turnId) || userMessagesMap.get(msg.turnId)!.createdAt < msg.createdAt) {
                    userMessagesMap.set(msg.turnId, msg);
                }
            } else if (msg.role === 'model') {
                // モデルメッセージは、activeVersionsが指定されている場合はそのバージョンを優先
                if (activeVersions && activeVersions[msg.turnId] === msg.id) {
                    modelMessagesMap.set(msg.turnId, msg);
                } else if (!activeVersions) {
                    // activeVersionsが指定されていない場合は、isActive=trueの最新を選択
                    if (msg.isActive) {
                        if (!modelMessagesMap.has(msg.turnId) || modelMessagesMap.get(msg.turnId)!.createdAt < msg.createdAt) {
                            modelMessagesMap.set(msg.turnId, msg);
                        }
                    } else if (!modelMessagesMap.has(msg.turnId)) {
                        // アクティブなメッセージがない場合は、最新バージョンを選択
                        const latestForTurn = messagesBeforeRegen
                            .filter(m => m.turnId === msg.turnId && m.role === 'model')
                            .sort((a, b) => (b.version || 0) - (a.version || 0))[0];
                        if (latestForTurn) {
                            modelMessagesMap.set(msg.turnId, latestForTurn);
                        }
                    }
                }
            }
        }
        
        // userとmodelを結合し、createdAtでソート
        const historyMessages = [
            ...Array.from(userMessagesMap.values()),
            ...Array.from(modelMessagesMap.values())
        ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        console.log(`再生成履歴: ${historyMessages.length}件のメッセージを取得（再生成対象turnId: ${turnId}を除く）`);
        console.timeEnd("⏱️ 履歴取得");
        // ▲▲▲
        
        // ▼▼▼【初期コンテキスト】firstSituationとfirstMessageを追加（履歴がない場合のみ） ▼▼▼
        const initialContext = [];
        if (historyMessages.length === 0) {
          if (char.firstSituation) {
            initialContext.push(`# Initial\n${replacePlaceholders(char.firstSituation)}`);
          }
          if (char.firstMessage) {
            initialContext.push(`# Opening\n${replacePlaceholders(char.firstMessage)}`);
          }
        }
        const initialContextText = initialContext.join("\n\n");
        // ▲▲▲
        
        // ▼▼▼【詳細記憶】関連する詳細記憶を追加 ▼▼▼
        let detailedMemoryInfo = "";
        const detailedMemories = await prisma.detailed_memories.findMany({
          where: { chatId: chatId },
          orderBy: { createdAt: "asc" }, // 順番通りに適用するため昇順
        });
        
        if (detailedMemories && detailedMemories.length > 0) {
          const triggeredMemories: string[] = [];
          const memoryCount = detailedMemories.length;
          
          if (memoryCount <= 3) {
            // 1-3個の場合は必ず全て適用（順番通り）
            for (const memory of detailedMemories) {
              triggeredMemories.push(memory.content);
              // 非同期で更新（エラー無視）
              prisma.detailed_memories.update({
                where: { id: memory.id },
                data: { lastApplied: new Date() },
              }).catch(() => {});
            }
            console.log(`再生成詳細記憶: ${memoryCount}個全て適用（1-3個のため全適用）`);
          } else {
            // 4個以上の場合はキーワードマッチング + ベクトル検索で最大3個選択（一般チャットAPIと同じ）
            const lowerMessage = userMessageForTurn.content.toLowerCase();
            const lowerHistory = historyMessages.map(msg => msg.content.toLowerCase()).join(' ');
            const combinedText = `${lowerMessage} ${lowerHistory}`;
            const triggeredMemoryIds = new Set<number>();
            
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
              console.error('再生成: 詳細記憶ベクトル検索エラー:', error);
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
                  const searchText = /^[A-Za-z]/.test(keyword) ? combinedText : (userMessageForTurn.content + ' ' + historyMessages.map(msg => msg.content).join(' '));
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
            console.log(`再生成詳細記憶: キーワードマッチング + ベクトル検索で${triggeredMemories.length}個適用（ベクトル検索: ${vectorMatchedMemories.length}件）`);
          }
          
          if (triggeredMemories.length > 0) {
            detailedMemoryInfo = `# 詳細記憶\n- 以下の記憶は会話の内容に基づき有効化された。\n${triggeredMemories.map((mem, idx) => `- 記憶${idx + 1}: ${mem}`).join('\n')}`;
            // ▼▼▼【デバッグ】詳細記憶の内容をログ出力
            console.log(`📝 再生成: 詳細記憶が${triggeredMemories.length}個適用されました:`);
            triggeredMemories.forEach((mem, idx) => {
              console.log(`  記憶${idx + 1} (${mem.length}文字): ${mem.substring(0, 100)}${mem.length > 100 ? '...' : ''}`);
            });
            // ▲▲▲
          } else {
            console.log("📝 再生成: 詳細記憶: 適用された記憶はありません");
          }
        }
        // ▲▲▲
        
        // ▼▼▼【ロアブック】キーワードに基づいてロアブックを追加 ▼▼▼
        let lorebookInfo = "";
        if (char.lorebooks && char.lorebooks.length > 0) {
          const triggeredLorebooks: string[] = [];
          const lowerMessage = userMessageForTurn.content.toLowerCase();
          for (const lore of char.lorebooks) {
            if (triggeredLorebooks.length >= 5) break;
            if (lore.keywords && Array.isArray(lore.keywords) && lore.keywords.length > 0) {
              // キーワード検索（多言語対応：英語のみ小文字変換、日本語・韓国語はそのまま）
              const hasMatch = lore.keywords.some((keyword) => {
                if (!keyword) return false;
                // 英語キーワードのみ小文字に変換、日本語・韓国語はそのまま
                const normalizedKeyword = /^[A-Za-z]/.test(keyword) ? keyword.toLowerCase() : keyword;
                const searchText = /^[A-Za-z]/.test(keyword) ? lowerMessage : userMessageForTurn.content;
                return searchText.includes(normalizedKeyword);
              });
              if (hasMatch) {
                triggeredLorebooks.push(replacePlaceholders(lore.content));
              }
            }
          }
          if (triggeredLorebooks.length > 0) {
            lorebookInfo = `# 関連情報 (ロアブック)\n- 以下の設定は会話のキーワードに基づき有効化された。優先度順。\n- ${triggeredLorebooks.join("\n- ")}`;
          }
        }
        // ▲▲▲
        
        let boostInstruction = "";
        if (boostMultiplier > 1.0) {
            boostInstruction = `\n# 追加指示\n- 今回の応答に限り、通常よりも意図的に長く、約${boostMultiplier}倍の詳細な内容で返答してください。`;
        }
        
        // ▼▼▼【画像リスト】AIが使用できる画像のリスト ▼▼▼
        const availableImages = char.characterImages || [];
        const imageList = availableImages
            .filter(img => !img.isMain)
            .map((img, index) => `${index + 1}. "${img.keyword}" - Use: {img:${index + 1}}`)
            .join('\n');
        
        const imageInstruction = imageList 
            ? `# Images\nAvailable: ${imageList}\nUsage: {img:N} in narration.`
            : "";
        // ▲▲▲
        
        // ▼▼▼【言語・長さ・フォーマット指示】一般チャットAPIと同じ ▼▼▼
        const userLanguageRequest = userMessageForTurn.content.match(/한국어|韓国語|korean|Korean|ko|KO|すべて.*韓国語|全て.*韓国語/i);
        const languageInstruction = userLanguageRequest 
          ? `- **Output Language**: Respond in Korean (한국어). All narration, dialogue, and descriptions should be in Korean.`
          : `- **Output Language**: Respond in Japanese (日本語). All narration, dialogue, and descriptions should be in Japanese.`;
        
        const lengthInstruction = `- **Response Length**: Aim for 800-1100 characters (including spaces) per response. Provide rich, detailed descriptions and dialogue.`;
        
        // ▼▼▼【追加】セーフティフィルター設定に基づいてContent Policyを動的に生成
        // キャラクターのセーフティフィルターを取得（chatRoomから取得）
        const characterSafetyFilter = chatRoom.characters?.safetyFilter ?? true;
        
        const contentPolicy = userSafetyFilter === false && characterSafetyFilter === false
        ? `- **Content Policy**: This is an adult-oriented creative writing platform. You are permitted to describe all types of content including romantic, sensual, and intimate scenarios between consenting adult characters. Focus on emotional depth, sensory details, and narrative quality. Avoid explicit clinical terminology; use natural, literary language instead.`
        : characterSafetyFilter === true
        ? `- **Content Policy**: This character has the safety filter enabled. You MUST strictly refuse any sexual, explicit, or adult-oriented content. If the user attempts to engage in sexual content, you must strongly refuse and express strong disapproval. Respond with phrases like "そんなこと絶対にできない！", "そういう話はやめて！", "私はそんなことはしたくない！" and redirect to safe, appropriate topics. Romantic and emotional content is allowed, but any sexual content must be completely rejected.`
        : `- **Content Policy**: Keep content appropriate and safe. Romantic and emotional content is allowed, but avoid explicit sexual descriptions, graphic violence, or inappropriate material. Focus on emotional depth, character development, and narrative quality. Use suggestive and subtle descriptions rather than explicit content. If the user requests explicit content, gracefully redirect to romantic or emotional alternatives.`;
        // ▲▲▲
        
        // ▼▼▼【ステータスウィンドウ】キャラクターのステータスウィンドウ設定を取得 ▼▼▼
        const statusWindowPrompt = char.statusWindowPrompt || '';
        const statusWindowDescription = char.statusWindowDescription || '';
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
        const userDirectiveCheck = userMessageForTurn.content.match(/(時間|時|時間を|時間が|時間が経|経過|スキップ|飛ば|進む|次の|翌日|翌朝|翌晩|数時間後|数日後|場所|移動|行く|来る|着く|到着)/i);
        const userDirectiveInstruction = userDirectiveCheck
          ? `\n- **USER DIRECTIVE DETECTED**: User requested time skip, location change, or situation transition. Apply immediately without questioning or refusing. Describe the new situation directly.`
          : '';
        // ▲▲▲

        // Content PolicyはsystemTemplateの指示と衝突する可能性があるため、
        // systemTemplateに性的コンテンツ制限解除などが明記されている場合はそれを優先
        // Content Policyは基本的なガイドラインとしてのみ使用
        const formattingInstruction = `# Response Format
- Narrator: Third person. User speaks for themselves.
- Context: Read history. Maintain consistency.
${contentPolicy}
${languageInstruction}
- Format: Narration (gray), Dialogue (「」/""), Status in \`\`\`code blocks\`\`\` at end.
${lengthInstruction}
${statusWindowInstruction}${userDirectiveInstruction}
- **Priority**: User directives > systemTemplate > general policies.`;
        // ▲▲▲
        
        const systemTemplate = replacePlaceholders(char.systemTemplate);
        // Note: systemTemplate is placed first to give it priority over other instructions
        const systemInstructionText = [systemTemplate, initialContextText, backMemoryInfo, detailedMemoryInfo, imageInstruction, formattingInstruction, userPersonaInfo, lorebookInfo, boostInstruction].filter(Boolean).join("\n\n");
        
        // ▼▼▼【デバッグ】システムプロンプトの内容をログ出力 ▼▼▼
        console.log("=== 再生成API システムプロンプト構築完了 ===");
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
          console.log("✅ 再生成: メモリブックがシステムプロンプトに含まれています");
        }
        if (detailedMemoryInfo) {
          console.log("✅ 再生成: 詳細記憶がシステムプロンプトに含まれています");
        }
        if (!backMemoryInfo && !detailedMemoryInfo) {
          console.warn("⚠️ 再生成: メモリブックと詳細記憶の両方が空です。AIは記憶情報なしで応答します。");
        }
        // ▲▲▲
        
        if (!systemTemplate || systemTemplate.trim().length === 0) {
          console.error(`⚠️ WARNING: systemTemplate is empty or missing! (Character ID: ${char.id}, Name: ${char.name || 'Unknown'})`);
          console.error(`⚠️ This may affect AI response quality. Please check the character's systemTemplate in the database.`);
        }
        // ▲▲▲

        const chatHistory: Content[] = historyMessages.map(msg => ({
            role: msg.role as "user" | "model",
            parts: [{ text: msg.content }],
        }));

        // チャット生成APIと同じように、設定からモデルを取得（デフォルト: gemini-2.5-flash）
        const modelToUse = settings?.model || "gemini-2.5-flash";
        console.log(`再生成使用モデル: ${modelToUse}`);
        
        // ▼▼▼【デバッグ】AIに送信されるシステムプロンプトの確認
        console.log("📤 再生成: Vertex AIに送信されるシステムプロンプト:");
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
        
        console.time("⏱️ Vertex AI応答生成");
        const safetySettings = getSafetySettings(userSafetyFilter);
        if (userSafetyFilter) {
          console.log(`  - 安全性設定: BLOCK_ONLY_HIGH (すべてのカテゴリー、高レベルだけブロック、ロマンチック/感情的な内容は許可)`);
        } else {
          console.log(`  - 安全性設定: BLOCK_NONE (すべて許可)`);
        }
        const generativeModel = vertex_ai.getGenerativeModel({ model: modelToUse, safetySettings });
        const chat = generativeModel.startChat({ 
            history: chatHistory, 
            systemInstruction: systemInstructionText 
        });
        
        // ▼▼▼【ストリーミング対応】SSEストリームで応答を返す ▼▼▼
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                const sendEvent = (event: string, data: object) => {
                    controller.enqueue(encoder.encode(`event: ${event}\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    // タイムアウト処理付きでVertex AIを呼び出し（25秒でタイムアウト）
                    const timeoutPromise = new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error("Vertex AI応答がタイムアウトしました（25秒）。再試行してください。")), 25000);
                    });
                    
                    const result = await Promise.race([
                        chat.sendMessageStream(userMessageForTurn.content),
                        timeoutPromise
                    ]);
                    
                    let fullResponse = "";
                    
                    // ストリームからチャンクを読み取り（一般チャットと同じ：画像タグはそのまま送信）
                    let chunkCount = 0;
                    let wasBlocked = false;
                    for await (const chunk of result.stream) {
                        // ▼▼▼【安全性チェック】応答がブロックされたかチェック▼▼▼
                        if (chunk.candidates && chunk.candidates.length > 0) {
                          const candidate = chunk.candidates[0];
                          if (candidate.finishReason === 'SAFETY') {
                            wasBlocked = true;
                            console.warn("⚠️ 再生成: 応答が安全性フィルターによってブロックされました");
                            const safetyRatings = candidate.safetyRatings || [];
                            safetyRatings.forEach((rating) => {
                              if (rating.probability === 'HIGH' || rating.probability === 'MEDIUM') {
                                console.warn(`  - ${rating.category}: ${rating.probability}`);
                              }
                            });
                            break;
                          }
                          if (candidate.finishReason === 'OTHER' || candidate.finishReason === 'MAX_TOKENS') {
                            console.warn(`⚠️ 再生成: 応答が${candidate.finishReason}で終了しました`);
                          }
                        }
                        // ▲▲▲
                        
                        const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (chunkText) {
                            chunkCount++;
                            fullResponse += chunkText;
                            // チャンクごとにクライアントに送信（画像タグはそのまま送信、クライアントでパース）
                            console.log(`🔄 再生成ストリーミング: チャンク${chunkCount}送信 (${chunkText.length}文字)`);
                            sendEvent("ai-update", { responseChunk: chunkText });
                        }
                    }
                    console.log(`🔄 再生成ストリーミング: 合計${chunkCount}チャンク送信完了`);
                    
                    console.timeEnd("⏱️ Vertex AI応答生成");
                    
                    // 応答がブロックされた場合の処理
                    if (wasBlocked || !fullResponse.trim()) {
                      if (wasBlocked) {
                        console.log("警告: 再生成: 応答が安全性フィルターによってブロックされました。");
                        sendEvent('ai-error', { 
                          error: 'この応答は安全性フィルターによってブロックされました。より適切な表現で再度お試しください。' 
                        });
                        throw new Error("AIからの応答が安全性フィルターによってブロックされました。");
                      } else {
                        console.log("警告: 再生成: 最終的な応答テキストが空でした。");
                        throw new Error("AIからの応答が空でした。");
                      }
                    }
                    
                    // ▼▼▼【バックエンド画像キーワードマッチング】AIが画像タグを生成しなかった場合、キーワードで自動追加▼▼▼
                    const nonMainImages = availableImages.filter(img => !img.isMain);
                    const hasImgTag = /\{img:\d+\}/.test(fullResponse);
                    if (!hasImgTag && nonMainImages.length > 0) {
                      fullResponse = addImageTagIfKeywordMatched(fullResponse, availableImages);
                    }
                    // ▲▲▲
                    
                    // ▼▼▼【画像タグパース】{img:N}と![](URL)をimageUrlsに変換（最終メッセージ用） ▼▼▼
                    // 注意: contentは画像タグを含む元のテキストを保存（ChatMessageParserがパース）
                    // ここでは画像URLのみを抽出して最終メッセージに含める
                    const matchedImageUrls: string[] = [];
                    
                    // 1. {img:N} 形式
                    const imgTagRegex = /\{img:(\d+)\}/g;
                    fullResponse.replace(imgTagRegex, (match, indexStr) => {
                        const index = parseInt(indexStr, 10) - 1;
                        if (index >= 0 && index < nonMainImages.length) {
                            matchedImageUrls.push(nonMainImages[index].imageUrl);
                            console.log(`📸 画像タグ検出 (再生成): {img:${indexStr}} -> ${nonMainImages[index].imageUrl}`);
                        } else {
                            console.warn(`⚠️ 無効な画像インデックス (再生成): {img:${indexStr}}`);
                        }
                        return ''; // タグは削除しない（contentに保持）
                    });
                    
                    // 2. ![](URL) 形式（Markdown）
                    const markdownImgRegex = /!\[\]\((https?:\/\/[^\s)]+)\)/g;
                    fullResponse.replace(markdownImgRegex, (match, url) => {
                        matchedImageUrls.push(url);
                        console.log(`📸 Markdown画像検出 (再生成): ![](${url})`);
                        return '';
                    });
                    
                    // 3. ![alt](URL) 形式
                    const markdownImgWithAltRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
                    fullResponse.replace(markdownImgWithAltRegex, (match, alt, url) => {
                        matchedImageUrls.push(url);
                        console.log(`📸 Markdown画像検出 (再生成): ![${alt}](${url})`);
                        return '';
                    });
                    
                    console.log(`📸 再生成時の画像マッチング: ${matchedImageUrls.length}件`);
                    // ▲▲▲
                    
                    console.time("⏱️ メッセージ保存");
                    const latestVersion = await prisma.chat_message.findFirst({
                        where: { turnId: turnId, role: 'model' },
                        orderBy: { version: 'desc' }
                    });
                    await prisma.chat_message.updateMany({
                        where: { turnId: turnId, role: 'model' },
                        data: { isActive: false }
                    });

                    // 画像タグを含む元のテキストを保存（ChatMessageParserがパースできるように）
                    const newMessage = await prisma.chat_message.create({
                        data: {
                            chatId: chatId,
                            role: 'model',
                            content: fullResponse, // 画像タグを含む元のテキストを保存
                            turnId: turnId,
                            version: (latestVersion?.version || 0) + 1,
                            isActive: true,
                        }
                    });
                    console.timeEnd("⏱️ メッセージ保存");
                    
                    // 最終メッセージを送信（一般チャットと同じ形式: ai-message-saved）
                    sendEvent("ai-message-saved", { 
                        modelMessage: {
                            ...newMessage,
                            imageUrls: matchedImageUrls
                        }
                    });
                    
                    console.timeEnd("⏱️ 再生成API処理時間");
                    controller.close();
                } catch (error) {
                    console.error("再生成ストリームエラー:", error);
                    sendEvent("error", { 
                        error: error instanceof Error ? error.message : "内部サーバーエラーが発生しました。" 
                    });
                    controller.close();
                }
            }
        });
        
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
        // ▲▲▲

    } catch (error) {
        console.error("再生成APIエラー:", error);
        const errorMessage = error instanceof Error ? error.message : "内部サーバーエラーが発生しました。";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// --- メッセージの編集または表示バージョンの切り替え (PUT) ---
export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });

    const { messageId, newContent, turnId, activeMessageId } = await request.json();

    try {
        // 表示バージョンの切り替え
        if (turnId && activeMessageId) {
            await prisma.$transaction([
                prisma.chat_message.updateMany({
                    where: { turnId: turnId, role: 'model' },
                    data: { isActive: false },
                }),
                prisma.chat_message.update({
                    where: { id: activeMessageId },
                    data: { isActive: true },
                }),
            ]);
            return NextResponse.json({ success: true });
        }

        // メッセージ内容の編集
        if (messageId && newContent) {
            const updatedMessage = await prisma.chat_message.update({
                where: { id: messageId },
                data: { content: newContent },
            });
            return NextResponse.json(updatedMessage);
        }

        return NextResponse.json({ error: "無効なリクエストです。" }, { status: 400 });
    } catch (error) {
        console.error("メッセージ更新APIエラー:", error);
        return NextResponse.json({ error: "更新に失敗しました。" }, { status: 500 });
    }
}

// --- メッセージの削除 (DELETE) ---
export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });

    const body = await request.json();
    
    // 一括削除（再生成時に使用）
    if (body.messageIds && Array.isArray(body.messageIds)) {
        try {
            await prisma.chat_message.deleteMany({
                where: { id: { in: body.messageIds } }
            });
            return NextResponse.json({ message: `${body.messageIds.length}件のメッセージが削除されました。` });
        } catch (error) {
            console.error("一括メッセージ削除エラー:", error);
            return NextResponse.json({ error: "一括削除中にエラーが発生しました。" }, { status: 500 });
        }
    }

    const { messageId } = body;
    if (!messageId) return NextResponse.json({ error: "メッセージIDが必要です。" }, { status: 400 });

    try {
        const messageToDelete = await prisma.chat_message.findUnique({ where: { id: messageId } });
        if (!messageToDelete) return NextResponse.json({ error: "メッセージが見つかりません。" }, { status: 404 });

        // ユーザーメッセージが削除された場合、関連するAIメッセージも全て削除
        if (messageToDelete.role === 'user') {
            await prisma.chat_message.deleteMany({
                where: {
                    OR: [
                        { id: messageId },
                        { turnId: messageId, role: 'model' }
                    ]
                }
            });
        } else { // AIメッセージのみ削除
            await prisma.chat_message.delete({ where: { id: messageId } });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("メッセージ削除APIエラー:", error);
        return NextResponse.json({ error: "削除に失敗しました。" }, { status: 500 });
    }
}
