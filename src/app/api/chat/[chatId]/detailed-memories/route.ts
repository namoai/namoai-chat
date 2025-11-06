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
      select: {
        id: true,
        content: true,
        keywords: true,
        createdAt: true,
        lastApplied: true,
      },
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

      // 再要約の場合: 既存の詳細記憶を全て削除して全体を再要約
      const existingMemories = await prisma.detailed_memories.findMany({
        where: { chatId: chatIdNum },
      });
      
      if (existingMemories.length > 0) {
        console.log(`既存の詳細記憶 ${existingMemories.length}件を削除して再要約を開始`);
        await prisma.detailed_memories.deleteMany({
          where: { chatId: chatIdNum },
        });
      }

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
        return NextResponse.json({ 
          message: '要約するメッセージがありません。'
        });
      }

      // 再要約ロジック: 最初の10個まで自動要約、その後5個単位で要約
      const initialCount = Math.min(10, messagesToSummarize.length);
      const batchSize = 5;
      
      // 最初のバッチ（1個）を同期的に処理して、最初のメモリを作成
      let firstBatchCompleted = false;
      let firstMemoryCreated = false;
      
      // 最初の1個のバッチを同期処理
      if (messagesToSummarize.length > 0) {
        const firstBatch = messagesToSummarize.slice(0, 1);
        const conversationText = firstBatch
          .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
          .join('\n\n');

        try {
          console.log(`最初のバッチ（1個）要約開始`);
          const vertex_ai = new VertexAI({
            project: process.env.GOOGLE_PROJECT_ID || '',
            location: 'asia-northeast1',
          });

          const generativeModel = vertex_ai.getGenerativeModel({
            model: 'gemini-2.5-flash',
            safetySettings,
          });

          const prompt = `以下の会話履歴を、AIが理解しやすいように要約してください。

【重要】
- 会話の進行内容と実際の出来事のみを要約してください
- 背景設定、キャラクター説明、初期状況などの固定情報は含めないでください
- ユーザーとAIの実際の対話と行動のみを要約してください
- 会話の重要なポイント、イベント、感情の変化などを漏れなく含めてください
- 要約は詳細に記述してください（2000文字以内、可能な限り詳細に）

会話履歴：
${conversationText}`;

          const result = await generativeModel.generateContent(prompt);
          const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

          if (summary) {
            const extractedKeywords = extractKeywords(conversationText);
            
            let remainingSummary = summary;
            
            // 要約が2000文字を超える場合のみ分割、それ以外は1つのメモリとして保存
            if (summary.length > MAX_MEMORY_LENGTH) {
              // 2000文字を超える場合: 分割
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
                
                if (!firstMemoryCreated) {
                  firstMemoryCreated = true;
                  firstBatchCompleted = true;
                }
                
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
                    const finalMemory = await prisma.detailed_memories.create({
                      data: {
                        chatId: chatIdNum,
                        content: remainingSummary,
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
            } else {
              // 2000文字以下の場合: 1つのメモリとして保存
              const newMemory = await prisma.detailed_memories.create({
                data: {
                  chatId: chatIdNum,
                  content: summary,
                  keywords: extractedKeywords,
                },
              });
              
              if (!firstMemoryCreated) {
                firstMemoryCreated = true;
                firstBatchCompleted = true;
              }
              
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
            
            console.log(`最初のバッチ（1個）要約完了`);
          }
        } catch (error) {
          console.error(`最初のバッチ要約エラー:`, error);
        }
      }

      // 最初の10個を非同期で処理開始（2個目から、ブロックしない）
      if (messagesToSummarize.length > 1) {
        const summarizeRemainingInitialBatches = async () => {
          const startCount = 2; // 2個目から開始
          for (let count = startCount; count <= initialCount; count++) {
            const batchMessages = messagesToSummarize.slice(0, count);
            
            if (batchMessages.length === 0) continue;

            const conversationText = batchMessages
              .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
              .join('\n\n');

            // 要約処理（非同期）
            (async () => {
              try {
                console.log(`バッチ ${count} 要約開始 (${batchMessages.length}件)`);
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
- 会話の重要なポイント、イベント、感情の変化などを簡潔に含めてください
- 冗長な描写や詳細な状況説明は省略し、核心的な内容のみを記述してください
- 要約は簡潔に記述してください（2000文字以内、可能な限り簡潔に）

会話履歴：
${conversationText}`;

                const result = await generativeModel.generateContent(prompt);
                const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

                if (!summary) {
                  console.error(`バッチ ${count} 要約が空です`);
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
                
                console.log(`バッチ ${count} 要約完了`);
              } catch (error) {
                console.error(`バッチ ${count} 要約エラー:`, error);
              }
            })();
            
            // 順次処理のため、各バッチ間に少し待機（サーバー負荷軽減）
            if (count < initialCount) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        };
        
        summarizeRemainingInitialBatches().catch(console.error);
      }

      // 10個以降は5個単位で要約（非同期、バックグラウンド処理）
      if (messagesToSummarize.length > 10) {
        (async () => {
          for (let start = 10; start < messagesToSummarize.length; start += batchSize) {
            const end = Math.min(start + batchSize, messagesToSummarize.length);
            const batchMessages = messagesToSummarize.slice(start, end);
            
            if (batchMessages.length === 0) continue;

            const conversationText = batchMessages
              .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
              .join('\n\n');

            try {
              console.log(`バッチ ${start + 1}-${end} 要約開始 (${batchMessages.length}件)`);
              const vertex_ai = new VertexAI({
                project: process.env.GOOGLE_PROJECT_ID || '',
                location: 'asia-northeast1',
              });

              const generativeModel = vertex_ai.getGenerativeModel({
                model: 'gemini-2.5-flash',
                safetySettings,
              });

              const prompt = `以下の会話履歴を、AIが理解しやすいように要約してください。

【重要】
- 会話の進行内容と実際の出来事のみを要約してください
- 背景設定、キャラクター説明、初期状況などの固定情報は含めないでください
- ユーザーとAIの実際の対話と行動のみを要約してください
- 会話の重要なポイント、イベント、感情の変化などを漏れなく含めてください
- 要約は詳細に記述してください（2000文字以内、可能な限り詳細に）

会話履歴：
${conversationText}`;

              const result = await generativeModel.generateContent(prompt);
              const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

              if (!summary) {
                console.error(`バッチ ${start + 1}-${end} 要約が空です`);
                continue;
              }

              const extractedKeywords = extractKeywords(conversationText);
              
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
              
              console.log(`バッチ ${start + 1}-${end} 要約完了`);
              
              // 5個単位ごとに少し待機（サーバー負荷軽減）
              if (start + batchSize < messagesToSummarize.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (error) {
              console.error(`バッチ ${start + 1}-${end} 要約エラー:`, error);
            }
          }
        })().catch(console.error);
      }

      // 最初のメモリを返す（最初のバッチが完了しているはず）
      if (!firstBatchCompleted) {
        return NextResponse.json({ error: 'メモリの作成に失敗しました。' }, { status: 500 });
      }

      const firstMemory = await prisma.detailed_memories.findFirst({
        where: { chatId: chatIdNum },
        orderBy: { createdAt: 'desc' },
      });

      if (!firstMemory) {
        return NextResponse.json({ error: 'メモリの作成に失敗しました。' }, { status: 500 });
      }

      return NextResponse.json({ 
        memory: { ...firstMemory, index: 1 },
        message: '再要約を開始しました。最初の10個まで処理し、その後5個単位でバックグラウンドで処理されます。'
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

