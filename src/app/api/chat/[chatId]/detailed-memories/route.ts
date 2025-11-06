import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import { getEmbedding, embeddingToVectorString } from '@/lib/embeddings';

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const MAX_MEMORY_LENGTH = 2000;
// 注意: 保存個数制限は削除されました。適用時の最大個数は3個です（route.tsで制御）。

// GET: 詳細記憶の一覧を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const { chatId } = await params;
  const chatIdNum = parseInt(chatId, 10);
  if (isNaN(chatIdNum)) {
    return NextResponse.json({ error: '無効なチャットIDです。' }, { status: 400 });
  }

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
    });

    // インデックスを追加（1-3）
    const memoriesWithIndex = memories.map((mem, idx) => ({
      ...mem,
      index: idx + 1,
    }));

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

    // 既存の記憶数を確認
    const existingCount = await prisma.detailed_memories.count({
      where: { chatId: chatIdNum },
    });

    if (autoSummarize) {
      // 自動要約の場合（保存個数制限なし、ただし適用時は最大3個まで）
      console.log('自動要約モード開始, chatId:', chatIdNum);

      // 最後に作成された詳細記憶を取得（既に要約されたメッセージの範囲を把握）
      const lastMemory = await prisma.detailed_memories.findFirst({
        where: { chatId: chatIdNum },
        orderBy: { createdAt: 'desc' },
      });

      // 最後の要約以降のメッセージを取得（既に要約された部分はスキップ）
      let messagesToSummarize;
      if (lastMemory) {
        // 最後の要約作成時刻以降のメッセージを取得
        messagesToSummarize = await prisma.chat_message.findMany({
          where: {
            chatId: chatIdNum,
            isActive: true,
            createdAt: { gt: lastMemory.createdAt }, // 最後の要約以降のメッセージ
          },
          orderBy: { createdAt: 'asc' },
        });
        console.log(`最後の要約以降のメッセージ数: ${messagesToSummarize.length}`);
      } else {
        // 最初の要約の場合、全メッセージを取得
        messagesToSummarize = await prisma.chat_message.findMany({
          where: {
            chatId: chatIdNum,
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        });
        console.log(`初回要約: 全メッセージ数: ${messagesToSummarize.length}`);
      }

      if (messagesToSummarize.length === 0) {
        return NextResponse.json({ 
          message: '要約する新しいメッセージがありません。',
          memory: lastMemory || null
        });
      }

      // 新しいメッセージを5個単位で要約
      const batchSize = 5;
      const totalNewMessages = messagesToSummarize.length;
      
      // 5個単位で要約処理（非同期でバックグラウンド処理）
      const summarizeMessages = async (messages: typeof messagesToSummarize) => {
        for (let start = 0; start < messages.length; start += batchSize) {
          const end = Math.min(start + batchSize, messages.length);
          const batchMessages = messages.slice(start, end);
          
          if (batchMessages.length === 0) continue;

          const conversationText = batchMessages
            .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
            .join('\n\n');

          // 要約処理
          const summarizeBatch = async (msgBatch: typeof batchMessages, batchNum: number) => {
            try {
              console.log(`バッチ ${batchNum} 要約開始 (${msgBatch.length}件)`);
              const vertex_ai = new VertexAI({
                project: process.env.GOOGLE_PROJECT_ID || '',
                location: 'asia-northeast1',
              });

              const generativeModel = vertex_ai.getGenerativeModel({
                model: 'gemini-2.5-flash',
                safetySettings,
              });

              const prompt = `以下の会話履歴を、AIが理解しやすいように簡潔に要約してください。

【重要】
- 会話の進行内容と実際の出来事のみを要約してください
- 背景設定、キャラクター説明、初期状況などの固定情報は含めないでください
- ユーザーとAIの実際の対話と行動のみを要約してください
- 2000文字以内で簡潔に記述してください

会話履歴：
${conversationText}`;

              const result = await generativeModel.generateContent(prompt);
              const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

              if (!summary) {
                console.error(`バッチ ${batchNum} 要約が空です`);
                return;
              }

              const extractedKeywords = extractKeywords(conversationText);
              
              // 2000文字を超える場合は複数のメモリに分割
              let remainingSummary = summary;
              
              while (remainingSummary.length > 0) {
                const memoryContent = remainingSummary.substring(0, MAX_MEMORY_LENGTH);
                remainingSummary = remainingSummary.substring(MAX_MEMORY_LENGTH);
                
                const newMemory = await prisma.detailed_memories.create({
                  data: {
                    chatId: chatIdNum,
                    content: memoryContent,
                    keywords: extractedKeywords,
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
                
                if (remainingSummary.length <= MAX_MEMORY_LENGTH) {
                  if (remainingSummary.length > 0) {
                    const finalMemory = await prisma.detailed_memories.create({
                      data: {
                        chatId: chatIdNum,
                        content: remainingSummary.substring(0, MAX_MEMORY_LENGTH),
                        keywords: extractedKeywords,
                      },
                    });
                    
                    (async () => {
                      try {
                        const embedding = await getEmbedding(finalMemory.content);
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
              
              console.log(`バッチ ${batchNum} 要約完了`);
            } catch (error) {
              console.error(`バッチ ${batchNum} 要約エラー:`, error);
            }
          };

              console.log(`バッチ ${batchNum} 要約完了`);
            } catch (error) {
              console.error(`バッチ ${batchNum} 要約エラー:`, error);
            }
          };

          // 最初のバッチのみ同期で処理し、それ以外は非同期
          if (start === 0) {
            await summarizeBatch(batchMessages, start / batchSize + 1);
          } else {
            // 非同期で処理（ブロックしない）
            summarizeBatch(batchMessages, start / batchSize + 1).catch(console.error);
          }
          
          // 5個単位ごとに少し待機（サーバー負荷軽減）
          if (start + batchSize < messages.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      };

      // 最初の5個のバッチのみ同期で処理（レスポンスを返すため）
      if (messagesToSummarize.length > 0) {
        const firstBatch = messagesToSummarize.slice(0, Math.min(batchSize, messagesToSummarize.length));
        const conversationText = firstBatch
          .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
          .join('\n\n');

        try {
          console.log(`最初のバッチ要約開始 (${firstBatch.length}件)`);
          const vertex_ai = new VertexAI({
            project: process.env.GOOGLE_PROJECT_ID || '',
            location: 'asia-northeast1',
          });

          const generativeModel = vertex_ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            safetySettings,
          });

          const prompt = `以下の会話履歴を、AIが理解しやすいように簡潔に要約してください。

【重要】
- 会話の進行内容と実際の出来事のみを要約してください
- 背景設定、キャラクター説明、初期状況などの固定情報は含めないでください
- ユーザーとAIの実際の対話と行動のみを要約してください
- 2000文字以内で簡潔に記述してください

会話履歴：
${conversationText}`;

          const result = await generativeModel.generateContent(prompt);
          const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

          if (!summary) {
            return NextResponse.json({ error: '要約の生成に失敗しました。' }, { status: 500 });
          }

          const extractedKeywords = extractKeywords(conversationText);
          
          // 2000文字を超える場合は複数のメモリに分割
          const createdMemories = [];
          let remainingSummary = summary;
          
          while (remainingSummary.length > 0) {
            const memoryContent = remainingSummary.substring(0, MAX_MEMORY_LENGTH);
            remainingSummary = remainingSummary.substring(MAX_MEMORY_LENGTH);
            
            const newMemory = await prisma.detailed_memories.create({
              data: {
                chatId: chatIdNum,
                content: memoryContent,
                keywords: extractedKeywords,
              },
            });
            
            createdMemories.push(newMemory);
            
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
            
            if (remainingSummary.length <= MAX_MEMORY_LENGTH) {
              if (remainingSummary.length > 0) {
                const finalMemory = await prisma.detailed_memories.create({
                  data: {
                    chatId: chatIdNum,
                    content: remainingSummary.substring(0, MAX_MEMORY_LENGTH),
                    keywords: extractedKeywords,
                  },
                });
                
                createdMemories.push(finalMemory);
                
                (async () => {
                  try {
                    const embedding = await getEmbedding(finalMemory.content);
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

          // 残りのメッセージは非同期でバックグラウンド処理
          if (messagesToSummarize.length > batchSize) {
            summarizeMessages(messagesToSummarize.slice(batchSize)).catch(console.error);
          }

          const firstMemory = createdMemories[0];
          if (!firstMemory) {
            return NextResponse.json({ error: 'メモリの作成に失敗しました。' }, { status: 500 });
          }

          return NextResponse.json({ 
            memory: { ...firstMemory, index: existingCount + 1 },
            message: `最初の${batchSize}個のメッセージを要約しました。残りはバックグラウンドで処理されます。`,
            createdCount: createdMemories.length 
          });
        } catch (error) {
          console.error('要約エラー:', error);
          return NextResponse.json({ error: '要約の生成に失敗しました。' }, { status: 500 });
        }
      }

      // 最初のメモリを返す（既存のコードとの互換性のため）
      const firstMemory = await prisma.detailed_memories.findFirst({
        where: { chatId: chatIdNum },
        orderBy: { createdAt: 'desc' },
      });

      if (!firstMemory) {
        return NextResponse.json({ error: 'メモリの作成に失敗しました。' }, { status: 500 });
      }

      return NextResponse.json({ 
        memory: { ...firstMemory, index: existingCount + 1 },
        message: '要約処理を開始しました。バックグラウンドで順次処理されます。'
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
        
        // 残りが2000文字以下なら終了
        if (remainingContent.length <= MAX_MEMORY_LENGTH) {
          if (remainingContent.length > 0) {
            const finalMemory = await prisma.detailed_memories.create({
              data: {
                chatId: chatIdNum,
                content: remainingContent,
                keywords: keywords || [],
              },
            });
            
            createdMemories.push(finalMemory);
            
            (async () => {
              try {
                const embedding = await getEmbedding(finalMemory.content);
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

      // 最初に作成されたメモリを返す（既存のコードとの互換性のため）
      const firstMemory = createdMemories[0];
      if (!firstMemory) {
        return NextResponse.json({ error: 'メモリの作成に失敗しました。' }, { status: 500 });
      }

      return NextResponse.json({ 
        memory: { ...firstMemory, index: existingCount + 1 },
        createdCount: createdMemories.length 
      });
    }
  } catch (error) {
    console.error('詳細記憶作成エラー:', error);
    return NextResponse.json({ error: '内部サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// PUT: 詳細記憶を更新
export async function PUT(
  request: NextRequest
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  try {
    const { memoryId, content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: '内容を入力してください。' }, { status: 400 });
    }

    const memory = await prisma.detailed_memories.findUnique({
      where: { id: memoryId },
      include: { chat: { select: { userId: true } } },
    });

    if (!memory) {
      return NextResponse.json({ error: '詳細記憶が見つかりません。' }, { status: 404 });
    }

    if (memory.chat.userId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    // 最初の2000文字は既存メモリを更新
    const firstPart = content.substring(0, MAX_MEMORY_LENGTH);
    const remainingContent = content.substring(MAX_MEMORY_LENGTH);
    
    const updated = await prisma.detailed_memories.update({
      where: { id: memoryId },
      data: { content: firstPart },
    });

    // 残りがある場合は新しいメモリを作成
    const createdMemories = [];
    let remaining = remainingContent;
    
    while (remaining.length > 0) {
      const memoryContent = remaining.substring(0, MAX_MEMORY_LENGTH);
      remaining = remaining.substring(MAX_MEMORY_LENGTH);
      
      const newMemory = await prisma.detailed_memories.create({
        data: {
          chatId: memory.chatId,
          content: memoryContent,
          keywords: memory.keywords || [],
        },
      });
      
      createdMemories.push(newMemory);
      
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
      
      if (remaining.length <= MAX_MEMORY_LENGTH) {
        if (remaining.length > 0) {
          const finalMemory = await prisma.detailed_memories.create({
            data: {
              chatId: memory.chatId,
              content: remaining,
              keywords: memory.keywords || [],
            },
          });
          
          createdMemories.push(finalMemory);
          
          (async () => {
            try {
              const embedding = await getEmbedding(finalMemory.content);
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

    // ▼▼▼【ベクトル検索】更新された詳細記憶のembeddingを再生成▼▼▼
    (async () => {
      try {
        const embedding = await getEmbedding(firstPart);
        const embeddingString = embeddingToVectorString(embedding);
        await prisma.$executeRaw`
          UPDATE "detailed_memories" 
          SET "embedding" = ${embeddingString}::vector 
          WHERE "id" = ${memoryId}
        `;
      } catch (error) {
        console.error('詳細記憶embedding更新エラー:', error);
      }
    })();
    // ▲▲▲

    return NextResponse.json({ memory: updated });
  } catch (error) {
    console.error('詳細記憶更新エラー:', error);
    return NextResponse.json({ error: '内部サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// DELETE: 詳細記憶を削除
export async function DELETE(
  request: NextRequest
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const memoryId = searchParams.get('memoryId');

  if (!memoryId) {
    return NextResponse.json({ error: 'メモリIDが必要です。' }, { status: 400 });
  }

  try {
    const memory = await prisma.detailed_memories.findUnique({
      where: { id: parseInt(memoryId, 10) },
      include: { chat: { select: { userId: true } } },
    });

    if (!memory) {
      return NextResponse.json({ error: '詳細記憶が見つかりません。' }, { status: 404 });
    }

    if (memory.chat.userId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    await prisma.detailed_memories.delete({
      where: { id: parseInt(memoryId, 10) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('詳細記憶削除エラー:', error);
    return NextResponse.json({ error: '内部サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// キーワード抽出の簡単な実装
function extractKeywords(text: string): string[] {
  // 日本語の重要な単語を抽出（簡単な実装）
  const words = text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !/^(ユーザー|キャラクター|は|が|を|に|で|と|の|も|から|まで|より|など|です|ます|です|でした|ます|ました)/.test(w));

  // 頻度の高い単語を上位10個取得
  const wordCounts: { [key: string]: number } = {};
  words.forEach((word) => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });

  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

