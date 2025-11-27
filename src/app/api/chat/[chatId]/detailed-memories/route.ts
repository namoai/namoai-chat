import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import { getEmbedding } from '@/lib/embeddings';
import { ensureGcpCreds } from '@/utils/ensureGcpCreds';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// ▼▼▼【安全対策】同時再要約防止用のMap
const summarizingChats = new Map<number, boolean>();
// ▲▲▲

// 安全性設定（ユーザー設定に基づいて動的に変更される）
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

const MAX_MEMORY_LENGTH = 2000;
// 注意: 保存個数制限は削除されました。適用時の最大個数は3個です（route.tsで制御）。

// GET: 詳細記憶の一覧を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const { chatId } = await params;
  const chatIdNum = parseInt(chatId, 10);
  if (isNaN(chatIdNum)) {
    return NextResponse.json({ error: '無効なチャットIDです。' }, { status: 400 });
  }

  const prisma = await getPrisma();

  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatIdNum },
      select: { userId: true },
    });

    if (!chat) {
      return NextResponse.json({ error: 'チャットが見つかりません。' }, { status: 404 });
    }

    if (chat.userId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const memories = await prisma.detailed_memories.findMany({
      where: { chatId: chatIdNum },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        keywords: true,
        createdAt: true,
        lastApplied: true,
      },
    });

    // メッセージ範囲情報を抽出してインデックスを追加
    const memoriesWithIndex = memories.map((mem, idx) => {
      // メタデータからメッセージ範囲を抽出
      let messageRange: { start: number; end: number } | null = null;
      const cleanKeywords: string[] = [];
      
      if (mem.keywords && Array.isArray(mem.keywords)) {
        for (const keyword of mem.keywords) {
          // メタデータ形式: __META:start:1:end:5__
          const metaMatch = keyword.match(/^__META:start:(\d+):end:(\d+)__$/);
          if (metaMatch) {
            messageRange = {
              start: parseInt(metaMatch[1], 10),
              end: parseInt(metaMatch[2], 10),
            };
          } else {
            // 通常のキーワードのみ追加
            cleanKeywords.push(keyword);
          }
        }
      }
      
      return {
      ...mem,
      index: idx + 1,
        messageRange, // メッセージ範囲情報を追加
        keywords: cleanKeywords, // メタデータを除いたキーワードのみ
      };
    });

    return NextResponse.json({ memories: memoriesWithIndex });
  } catch (error) {
    console.error('詳細記憶取得エラー:', error);
    return NextResponse.json({ error: '内部サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// POST: 新しい詳細記憶を作成または自動要約
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (isBuildTime()) return buildTimeResponse();
  
  console.log('詳細記憶 POST API 開始');
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    console.error('認証エラー');
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const { chatId } = await params;
  const chatIdNum = parseInt(chatId, 10);
  if (isNaN(chatIdNum)) {
    console.error('無効なchatId:', chatId);
    return NextResponse.json({ error: '無効なチャットIDです。' }, { status: 400 });
  }

  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const { content, keywords, autoSummarize } = body;
    console.log('リクエストボディ:', { content: content ? 'あり' : 'なし', keywords, autoSummarize });

    const chat = await prisma.chat.findUnique({
      where: { id: chatIdNum },
      select: { userId: true },
    });

    if (!chat) {
      return NextResponse.json({ error: 'チャットが見つかりません。' }, { status: 404 });
    }

    if (chat.userId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    // ▼▼▼【追加】ユーザーのセーフティフィルター設定を取得
    const userId = parseInt(session.user.id);
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { safetyFilter: true },
    });
    const userSafetyFilter = user?.safetyFilter ?? true; // デフォルトはtrue（フィルターON）
    const safetySettings = getSafetySettings(userSafetyFilter);
    // ▲▲▲

    // 既存の記憶数を確認
    const existingCount = await prisma.detailed_memories.count({
      where: { chatId: chatIdNum },
    });

    if (autoSummarize) {
      // 自動要約の場合（保存個数制限なし、ただし適用時は最大3個まで）
      console.log('自動要約モード開始, chatId:', chatIdNum);

      // ▼▼▼【安全対策】同時再要約防止チェック
      if (summarizingChats.get(chatIdNum)) {
        return NextResponse.json({ 
          error: '再要約が既に実行中です。完了するまでお待ちください。',
          isProcessing: true
        }, { status: 409 }); // Conflict
      }
      
      // メッセージ数を確認
      const messageCount = await prisma.chat_message.count({
        where: {
          chatId: chatIdNum,
          isActive: true,
        },
      });
      
      // ▼▼▼【安全対策】メッセージ数が多い場合の警告（注意喚起のみ、処理は継続可能）
      // 注意: 200個を超える場合でも処理は可能だが、時間がかかることを通知
      if (messageCount > 200) {
        console.warn(`再要約警告: メッセージ数が多い (${messageCount}件)。処理に時間がかかる可能性があります。`);
        // 処理は継続（ユーザーが確認して実行した場合は処理を続行）
      }
      // ▲▲▲
      // ▲▲▲

      // ▼▼▼【修正】再要約ロジック: タイムアウト対策のため最適化
      // 1. キーワード抽出をフォールバック方式に変更（AI呼び出し削減）
      // 2. バッチ間の待機時間を削除
      // 3. メッセージロードと既存メモリ削除も非同期で実行（完全なタイムアウト対策）
      // 4. バッチサイズを20に増加してAPI呼び出し回数を大幅に削減（性能向上）
      // メッセージ数に応じてバッチサイズを動的に調整
      const windowSize = messageCount > 100 ? 30 : messageCount > 50 ? 20 : 15;
      
      // 処理中フラグを設定
      summarizingChats.set(chatIdNum, true);
      
      // ▼▼▼【タイムアウト対策】再要約を完全に非同期で開始して即座に応答
      // すべての重い処理（メッセージロード、既存メモリ削除、要約）をバックグラウンドで実行
      (async () => {
        try {
          await performReSummarization(chatIdNum, windowSize, safetySettings, messageCount);
        } catch (error) {
          console.error('再要約: バックグラウンド処理エラー:', error);
        } finally {
          // 処理完了後にフラグを解除
          summarizingChats.delete(chatIdNum);
        }
      })();
                  
      // 即座に応答を返す（タイムアウトを防ぐ）
      return NextResponse.json({ 
        message: `再要約を開始しました（${messageCount}件のメッセージを処理中）。バックグラウンドで処理中です。`,
        messageCount,
        estimatedTime: Math.ceil(messageCount / windowSize) * 8, // 推定時間（秒、バッチサイズに応じて調整）
        success: true
      });
    } else {
      // 手動作成の場合（保存個数制限なし、2000文字を超える場合は自動分割）

      if (!content) {
        return NextResponse.json({ error: '内容を入力してください。' }, { status: 400 });
      }

      // 2000文字を超える場合は複数のメモリに自動分割
      const createdMemories = [];
      let remainingContent = content;
      
      while (remainingContent.length > 0) {
        const memoryContent = remainingContent.substring(0, MAX_MEMORY_LENGTH);
        remainingContent = remainingContent.substring(MAX_MEMORY_LENGTH);
        
        const newMemory = await prisma.detailed_memories.create({
          data: {
            chatId: chatIdNum,
            content: memoryContent,
            keywords: keywords || [],
          },
        });
        
        createdMemories.push(newMemory);
        
        // embedding生成（非同期）
        (async () => {
          try {
            const embedding = await getEmbedding(memoryContent);
            const embeddingString = `[${embedding.join(',')}]`;
            await prisma.$executeRawUnsafe(
              `UPDATE "detailed_memories" SET "embedding" = $1::vector WHERE "id" = $2`,
              embeddingString,
              newMemory.id
            );
          } catch (error) {
            console.error('詳細記憶embedding生成エラー:', error);
          }
        })();
      }

      const firstMemory = createdMemories[0];
      if (!firstMemory) {
        return NextResponse.json({ error: 'メモリの作成に失敗しました。' }, { status: 500 });
      }

      return NextResponse.json({ 
        memory: { ...firstMemory, index: existingCount + 1 },
        message: '詳細記憶を作成しました。'
      });
    }
  } catch (error) {
    console.error('詳細記憶作成エラー:', error);
    return NextResponse.json({ error: 'メモリの作成に失敗しました。' }, { status: 500 });
  }
}

// PUT: 詳細記憶の更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }

    const { id, content, keywords } = await request.json();
    const resolvedParams = await params;
    const chatIdNum = parseInt(resolvedParams.chatId);

    if (!content) {
      return NextResponse.json({ error: '内容を入力してください。' }, { status: 400 });
    }

    // 既存のメモリを取得
    const existingMemory = await prisma.detailed_memories.findUnique({
      where: { id },
    });

    if (!existingMemory || existingMemory.chatId !== chatIdNum) {
      return NextResponse.json({ error: 'メモリが見つかりません。' }, { status: 404 });
    }

    // ▼▼▼【改善】内容が変更されていない場合は更新をスキップ▼▼▼
    const normalizedNewContent = content.trim();
    const normalizedExistingContent = existingMemory.content.trim();
    const normalizedNewKeywords = (keywords || []).sort().join(',');
    const normalizedExistingKeywords = (existingMemory.keywords || []).sort().join(',');
    
    // 内容とキーワードが同じ場合は更新不要
    if (normalizedNewContent === normalizedExistingContent && 
        normalizedNewKeywords === normalizedExistingKeywords) {
      console.log(`詳細記憶 ${id}: 内容が変更されていないため更新をスキップ`);
      return NextResponse.json({ 
        memory: { ...existingMemory, index: 1 },
        message: '内容が変更されていません。',
        updated: false
      });
    }
    // ▲▲▲

    // 2000文字を超える場合は複数のメモリに自動分割
    // 既存の分割メモリがある場合は、同じID範囲のメモリを取得して更新
    const existingMemoriesForUpdate = await prisma.detailed_memories.findMany({
      where: {
        chatId: chatIdNum,
        createdAt: {
          gte: new Date(existingMemory.createdAt.getTime() - 1000), // 1秒以内に作成されたもの
          lte: new Date(existingMemory.createdAt.getTime() + 1000),
        },
      },
      orderBy: { id: 'asc' },
    });

    // 既存の分割メモリを削除（2000文字を超える場合の分割に対応）
    if (existingMemoriesForUpdate.length > 0) {
      await prisma.detailed_memories.deleteMany({
        where: {
          id: { in: existingMemoriesForUpdate.map(m => m.id) },
        },
      });
    } else {
      // 単一メモリの場合は既存のものを削除
    await prisma.detailed_memories.delete({
      where: { id },
    });
    }

    const updatedMemories = [];
    let remainingContent = normalizedNewContent;
    
    while (remainingContent.length > 0) {
      const memoryContent = remainingContent.substring(0, MAX_MEMORY_LENGTH);
      remainingContent = remainingContent.substring(MAX_MEMORY_LENGTH);
      
      const newMemory = await prisma.detailed_memories.create({
        data: {
          chatId: chatIdNum,
          content: memoryContent,
          keywords: keywords || [],
        },
      });
      
      updatedMemories.push(newMemory);
      
      // embedding生成（非同期）
      (async () => {
        try {
          const embedding = await getEmbedding(memoryContent);
          const embeddingString = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE "detailed_memories" SET "embedding" = $1::vector WHERE "id" = $2`,
            embeddingString,
            newMemory.id
          );
        } catch (error) {
          console.error('詳細記憶embedding生成エラー:', error);
        }
      })();
    }

    return NextResponse.json({ 
      memory: { ...updatedMemories[0], index: 1 },
      message: '詳細記憶を更新しました。',
      updated: true
    });
  } catch (error) {
    console.error('詳細記憶更新エラー:', error);
    return NextResponse.json({ error: 'メモリの更新に失敗しました。' }, { status: 500 });
  }
}

// DELETE: 詳細記憶の削除
export async function DELETE(
  request: Request
) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json({ error: 'IDが必要です。' }, { status: 400 });
    }

    await prisma.detailed_memories.delete({
      where: { id },
    });

    return NextResponse.json({ message: '詳細記憶を削除しました。' });
  } catch (error) {
    console.error('詳細記憶削除エラー:', error);
    return NextResponse.json({ error: 'メモリの削除に失敗しました。' }, { status: 500 });
  }
}

// 再要約処理関数（バックグラウンドで実行）
type SafetySetting = Array<{
  category: typeof HarmCategory[keyof typeof HarmCategory];
  threshold: typeof HarmBlockThreshold[keyof typeof HarmBlockThreshold];
}>;

async function performReSummarization(
  chatIdNum: number,
  windowSize: number,
  safetySettings: SafetySetting,
  totalMessageCount: number
) {
  console.log(`再要約: バックグラウンド処理開始 (メッセージ数: ${totalMessageCount}件, バッチ数: ${Math.ceil(totalMessageCount / windowSize)}件)`);
  
  try {
    const prisma = await getPrisma();
    // ▼▼▼【注意】再要約: ユーザーが明示的に再要約を要求した場合のみ全削除
    // 通常の自動要約とは異なり、既存の要約を全て削除して最初から再生成します
    const existingMemories = await prisma.detailed_memories.findMany({
      where: { chatId: chatIdNum },
    });
    
    if (existingMemories.length > 0) {
      console.log(`再要約: 既存の詳細記憶 ${existingMemories.length}件を削除して再要約を開始`);
      await prisma.detailed_memories.deleteMany({
        where: { chatId: chatIdNum },
      });
    }
    // ▲▲▲

    // 全メッセージを取得（再要約なので全体を処理）
    const messagesToSummarize = await prisma.chat_message.findMany({
      where: {
        chatId: chatIdNum,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`再要約: 全メッセージ数: ${messagesToSummarize.length}`);

    if (messagesToSummarize.length === 0) {
      console.log('再要約: 要約するメッセージがありません');
      return;
    }
    
    let createdCount = 0;
  
  // ▼▼▼【安全対策】バッチ処理にリトライロジックを追加
  const maxRetries = 2; // 最大リトライ回数（3→2に削減して速度向上）
  const retryDelay = 1000; // リトライ間隔（ミリ秒、2秒→1秒に短縮）
  
  // ▼▼▼【性能向上】バッチを並列処理（最大3つまで同時実行）して速度向上
  const maxConcurrentBatches = 3; // 同時実行バッチ数
  const batches: Array<{ start: number; end: number; messages: typeof messagesToSummarize }> = [];
  
  // すべてのバッチを準備
  for (let start = 0; start < messagesToSummarize.length; start += windowSize) {
    const end = Math.min(start + windowSize, messagesToSummarize.length);
    const batchMessages = messagesToSummarize.slice(start, end);
    if (batchMessages.length > 0) {
      batches.push({ start, end, messages: batchMessages });
    }
  }
  
  // バッチを並列処理（チャンク単位で処理）
  for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
    const batchChunk = batches.slice(i, i + maxConcurrentBatches);
    
    // このチャンクのバッチを並列処理（エラーが発生しても他のバッチ는続行）
    await Promise.allSettled(batchChunk.map(async ({ start, end, messages: batchMessages }) => {
      const messageStartIndex = start + 1;
      const messageEndIndex = end;
      
      const conversationText = batchMessages
        .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
        .join('\n\n');
      
      // ▼▼▼【安全対策】リトライループで各バッチを処理
      let batchSuccess = false;
      let retryCount = 0;
      
      while (!batchSuccess && retryCount < maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} リトライ ${retryCount}/${maxRetries - 1}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
          }
          
          console.log(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} 要約開始 (${batchMessages.length}件)`);
          
          // GCP認証情報を確保
          await ensureGcpCreds();
          
          const vertex_ai = new VertexAI({
            project: process.env.GOOGLE_PROJECT_ID || '',
            location: 'asia-northeast1',
          });

          const generativeModel = vertex_ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            safetySettings,
          });

          // ▼▼▼【性能向上】フロンプトを最適化してレスポンス速度を向上（さらに簡潔に）
          const prompt = `会話の要点のみ簡潔に要約（2000文字以内）。進行と出来事のみ。

${conversationText}`;

          const result = await generativeModel.generateContent(prompt);
          const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

          if (!summary) {
            console.error(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} 要約が空です`);
            retryCount++;
            continue; // リトライ
          }

          // ▼▼▼【タイムアウト対策】再要約時はキーワード抽出をフォールバック方式に変更（AI呼び出し削減）
          const extractedKeywords = extractKeywords(conversationText);
          // ▲▲▲
          
          // 要約が2000文字を超える場合のみ分割、それ以外は1つのメモリとして保存
          if (summary.length > MAX_MEMORY_LENGTH) {
            // 2000文字を超える場合: 分割
            let remainingSummary = summary;
            
            while (remainingSummary.length > 0) {
              const memoryContent = remainingSummary.substring(0, MAX_MEMORY_LENGTH);
              remainingSummary = remainingSummary.substring(MAX_MEMORY_LENGTH);
              
              // メッセージ範囲情報をメタデータとしてkeywordsに追加
              const metaKeywords = [`__META:start:${messageStartIndex}:end:${messageEndIndex}__`, ...extractedKeywords];
              
              const newMemory = await prisma.detailed_memories.create({
                data: {
                  chatId: chatIdNum,
                  content: memoryContent,
                  keywords: metaKeywords,
                },
              });
              
              // embedding生成（非同期）
              (async () => {
                try {
                  const embedding = await getEmbedding(memoryContent);
                  const embeddingString = `[${embedding.join(',')}]`;
                  await prisma.$executeRawUnsafe(
                    `UPDATE "detailed_memories" SET "embedding" = $1::vector WHERE "id" = $2`,
                    embeddingString,
                    newMemory.id
                  );
                } catch (error) {
                  console.error('詳細記憶embedding生成エラー:', error);
                }
              })();
              
              // 残りが2000文字以下なら終了
              if (remainingSummary.length <= MAX_MEMORY_LENGTH) {
                if (remainingSummary.length > 0) {
                  const metaKeywords = [`__META:start:${messageStartIndex}:end:${messageEndIndex}__`, ...extractedKeywords];
                  const finalMemory = await prisma.detailed_memories.create({
                    data: {
                      chatId: chatIdNum,
                      content: remainingSummary,
                      keywords: metaKeywords,
                    },
                  });
                  
                  // embedding生成（非同期）
                  (async () => {
                    try {
                      const embedding = await getEmbedding(remainingSummary);
                      const embeddingString = `[${embedding.join(',')}]`;
                      await prisma.$executeRawUnsafe(
                        `UPDATE "detailed_memories" SET "embedding" = $1::vector WHERE "id" = $2`,
                        embeddingString,
                        finalMemory.id
                      );
                    } catch (error) {
                      console.error('詳細記憶embedding生成エラー:', error);
                    }
                  })();
                }
                break;
              }
            }
          } else {
            // 2000文字以下の場合: 1つのメモリとして保存
            // メッセージ範囲情報をメタデータとしてkeywordsに追加
            const metaKeywords = [`__META:start:${messageStartIndex}:end:${messageEndIndex}__`, ...extractedKeywords];
            
            const newMemory = await prisma.detailed_memories.create({
              data: {
                chatId: chatIdNum,
                content: summary,
                keywords: metaKeywords,
              },
            });
            
            // embedding生成（非同期）
            (async () => {
              try {
                const embedding = await getEmbedding(summary);
                const embeddingString = `[${embedding.join(',')}]`;
                await prisma.$executeRawUnsafe(
                  `UPDATE "detailed_memories" SET "embedding" = $1::vector WHERE "id" = $2`,
                  embeddingString,
                  newMemory.id
                );
              } catch (error) {
                console.error('詳細記憶embedding生成エラー:', error);
              }
            })();
          }
          
          // メモリ保存が完了したら成功フラグを設定
          createdCount++;
          console.log(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} 要約完了`);
          batchSuccess = true; // 成功
          
        } catch (error) {
          retryCount++;
          console.error(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} 要約エラー (試行 ${retryCount}/${maxRetries}):`, error);
          
          // 最大リトライ回数に達した場合
          if (retryCount >= maxRetries) {
            console.error(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} は最大リトライ回数に達したためスキップします`);
            break;
          }
        }
      }
      
      // バッチが成功しなかった場合の警告
      if (!batchSuccess) {
        console.error(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} の処理に失敗しました`);
      }
      // ▲▲▲
    }));
  }

  // ▼▼▼【性能向上】並列処理完了
  // 実際に作成されたメモリ数を確認（createdCountは並列処理で不正確になる可能性があるため）
  const actualCreatedCount = await prisma.detailed_memories.count({
    where: { chatId: chatIdNum },
  });
  console.log(`再要約: 全バッチ処理完了 (作成: ${actualCreatedCount}件, バッチ成功: ${createdCount}件)`);
    
    // ▼▼▼【修正】再要約後、作成されたメモリ数を確認して自動適用
    // 最新のメモリから適用するため、作成日時で降順ソート
    const newMemories = await prisma.detailed_memories.findMany({
      where: { chatId: chatIdNum },
      orderBy: { createdAt: 'desc' }, // 最新のものから（降順）
    });
    
    console.log(`再要約: 作成されたメモリ数: ${newMemories.length}件`);
    
    // 作成されたメモリ数に応じて自動適用（最大3個まで）
    if (newMemories.length > 0) {
      const memoriesToApply = newMemories.slice(0, Math.min(3, newMemories.length)); // 最大3個まで
      console.log(`再要約: ${memoriesToApply.length}個のメモリを自動適用（作成: ${newMemories.length}件）`);
      
      // すべてのメモリのlastAppliedを一度に更新（再要約完了時点で適用済みにする）
      const applyDate = new Date();
      await Promise.all(
        memoriesToApply.map(memory =>
          prisma.detailed_memories.update({
            where: { id: memory.id },
            data: { lastApplied: applyDate },
          }).catch(err => {
            console.error(`自動適用エラー (ID: ${memory.id}):`, err);
            return null;
          })
        )
      );
      
      console.log(`再要約: 自動適用完了 (${memoriesToApply.length}個) - 再要約完了時点で適用済み`);
    } else {
      console.log('再要約: 作成されたメモリがないため、自動適用をスキップ');
    }
    // ▲▲▲
  } catch (error) {
    console.error('再要約: 処理エラー:', error);
    throw error;
  }
}

// キーワード抽出関数（フォールバック用）- 日本語のみ
// 注意：この関数は日本語テキストからのみキーワードを抽出します
// 韓国語・英語などのテキストでは空配列を返します
function extractKeywords(text: string): string[] {
  // キーワード抽出（範囲情報を除外、日本語のみ）
  // 日本語（ひらがな、カタカナ、漢字）のみを抽出
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g; // ひらがな、カタカナ、漢字

  const japaneseWords = text.match(japanesePattern) || [];
  
  // 日本語がほとんど含まれていない場合（韓国語・英語のみなど）、空配列を返す
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
    'する', 'した', 'する', 'ある', 'あった', 'いる', 'いた', 'なる', 'なった', 'なる', '見る', '見た', '見る', '言う', '言った', '言う',
    '思う', '思った', '思う', '知る', '知った', '知る', '行く', '行った', '行く', '来る', '来た', '来る',
    'やる', 'やった', 'やる', 'やめる', 'やめた', 'やめる', '始める', '始めた', '始める', '終わる', '終わった', '終わる',
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
      
      // 日本語: 助詞が付いた形を除外（~は, ~が, ~を, ~に, ~の, ~で, ~へ, ~と, ~から, ~までなど）
      if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+[はがをにのでへとからまでよりもだけしかばかり]$/.test(normalizedWord)) {
        const baseWord = normalizedWord.replace(/[はがをにのでへとからまでよりもだけしかばかり]$/, '');
        // 助詞を除いた部分が2文字未満の場合は除外
        if (baseWord.length < 2) return;
        if (japaneseExclude.includes(baseWord)) return;
        // 助詞を除いた部分も除外リストに含まれていない場合、ベースワードを使用
        normalizedWord = baseWord;
      }
      
      // 日本語: 一般的な動詞・形容詞の活用形を除外（~する, ~した, ~ある, ~あった, ~いる, ~いたなど）
      if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(する|した|する|ある|あった|いる|いた|なる|なった|なる|見る|見た|見る|言う|言った|言う|思う|思った|思う)$/.test(normalizedWord)) {
        const baseWord = normalizedWord.replace(/(する|した|する|ある|あった|いる|いた|なる|なった|なる|見る|見た|見る|言う|言った|言う|思う|思った|思う)$/, '');
        if (baseWord.length <= 1) return;
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
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
}

