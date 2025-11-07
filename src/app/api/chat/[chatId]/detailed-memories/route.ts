import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import { getEmbedding } from '@/lib/embeddings';

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

      // ▼▼▼【修正】再要約ロジック: 同期処理に変更して完了を待つ
      const windowSize = 5;
      
      try {
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
          return NextResponse.json({ 
            message: '要約するメッセージがありません。',
            success: false
          });
        }

        // スライディングウィンドウ方式で要約（1-5, 6-10, 11-15...）
        let createdCount = 0;
        let skippedCount = 0;
        
        for (let start = 0; start < messagesToSummarize.length; start += windowSize) {
            const end = Math.min(start + windowSize, messagesToSummarize.length);
            const batchMessages = messagesToSummarize.slice(start, end);
            
            if (batchMessages.length === 0) continue;
            
            // メッセージ範囲を計算（1-indexed）
            const messageStartIndex = start + 1;
            const messageEndIndex = end;
            
            const conversationText = batchMessages
              .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
              .join('\n\n');
            
            try {
              console.log(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} 要約開始 (${batchMessages.length}件)`);
              
              // ▼▼▼【改善】再要約でも各バッチに対してベクトル類似度チェックを実行（重複防止）
              // 注: 既存メモリは全て削除済みなので、このチェックは実際には機能しないが
              // 将来的な改善（部分再要約）のために残しておく
              let shouldSkip = false;
              try {
                const conversationEmbedding = await getEmbedding(conversationText);
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
                  chatIdNum
                );
                
                if (similarMemories && similarMemories.length > 0) {
                  console.log(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} 類似度 ${similarMemories[0].similarity.toFixed(3)} の既存要約があるためスキップ`);
                  shouldSkip = true;
                  skippedCount++;
                }
              } catch (error) {
                console.error('再要約: ベクトル類似度チェックエラー:', error);
                // エラーが発生しても要約は続行
              }
              
              if (shouldSkip) {
                continue;
              }
              // ▲▲▲
              
              // メモリが作成される場合のみカウント
              createdCount++;
              
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
                console.error(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} 要約が空です`);
                continue;
              }

              // ▼▼▼【改善】AIベースのキーワード抽出（自動要約と同様のロジック）
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
- 代名詞（例：그、그녀、그는、그녀는、彼、彼女、彼は、彼女は）
- 助詞・助動詞（例：は、が、を、に、は、이、가、을、를）
- 一般的すぎる動詞（例：する、ある、いる、하다、있다）
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

                const keywordResult = await generativeModel.generateContent(keywordPrompt);
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
                      const japaneseExclude = ['これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', 'その', '彼', '彼女', '彼は', '彼女は', 'もの', 'こと', 'は', 'が', 'を', 'に'];
                      if (japaneseExclude.includes(k)) return false;
                      
                      // 一般的な代名詞・指示語を除外（韓国語）
                      const koreanExclude = ['그', '그녀', '그는', '그녀는', '이것', '그것', '것', '이', '가', '을', '를', '은', '는', '의', '에', '에서'];
                      if (koreanExclude.includes(k)) return false;
                      
                      // 技術的なタグを除外
                      if (k.match(/^(img|Img|IMG|\{img|\{Img)$/i)) return false;
                      
                      // HTMLタグのようなものを除外
                      if (k.match(/^[<{}>]/)) return false;
                      
                      // 一般的すぎる単語を除外（英語）
                      const englishExclude = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'img'];
                      if (englishExclude.includes(k.toLowerCase())) return false;
                      
                      return true;
                    })
                    .slice(0, 10);
                }
              } catch (error) {
                console.error('再要約: AIキーワード抽出エラー:', error);
                // AI抽出失敗時は既存のextractKeywords関数を使用（フォールバック）
                extractedKeywords = extractKeywords(conversationText);
              }
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
              
              console.log(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} 要約完了`);
              
              // バッチ間に少し待機（サーバー負荷軽減）
              if (start + windowSize < messagesToSummarize.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (error) {
              console.error(`再要約: バッチ ${messageStartIndex}-${messageEndIndex} 要約エラー:`, error);
            }
        }
        
        console.log(`再要約: 全バッチ処理完了 (作成: ${createdCount}件, スキップ: ${skippedCount}件)`);
        
        // ▼▼▼【追加】再要約後、1-3個の場合は自動適用（lastAppliedを設定）
        const newMemories = await prisma.detailed_memories.findMany({
          where: { chatId: chatIdNum },
          orderBy: { createdAt: 'asc' },
        });
        
        if (newMemories.length > 0 && newMemories.length <= 3) {
          // 1-3個の場合は全て自動適用
          console.log(`再要約: ${newMemories.length}個のメモリを自動適用`);
          for (const memory of newMemories) {
            await prisma.detailed_memories.update({
              where: { id: memory.id },
              data: { lastApplied: new Date() },
            }).catch(err => console.error('自動適用エラー:', err));
          }
        } else if (newMemories.length > 3) {
          // 4個以上の場合は最初の3個を自動適用
          console.log(`再要約: 最初の3個のメモリを自動適用`);
          for (let i = 0; i < Math.min(3, newMemories.length); i++) {
            await prisma.detailed_memories.update({
              where: { id: newMemories[i].id },
              data: { lastApplied: new Date() },
            }).catch(err => console.error('自動適用エラー:', err));
          }
        }
        // ▲▲▲
        
        // ▼▼▼【修正】処理完了後に成功レスポンスを返す
        return NextResponse.json({ 
          message: '再要約が完了しました。',
          success: true
        });
        } catch (error) {
          console.error('再要約: 全体エラー:', error);
          return NextResponse.json({ 
            error: error instanceof Error ? error.message : '再要約に失敗しました。',
            success: false
          }, { status: 500 });
        }
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
  try {
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
  try {
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

// キーワード抽出関数（フォールバック用）
function extractKeywords(text: string): string[] {
  // キーワード抽出（範囲情報を除外、多言語対応）
  // 日本語（ひらがな、カタカナ、漢字）、韓国語（한글）、英語を抽出
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g; // ひらがな、カタカナ、漢字
  const koreanPattern = /[\uAC00-\uD7AF]+/g; // 한글
  const englishPattern = /\b[A-Za-z]{3,}\b/g; // 英語（3文字以上）
  
  const japaneseWords = text.match(japanesePattern) || [];
  const koreanWords = text.match(koreanPattern) || [];
  const englishWords = text.toLowerCase().match(englishPattern) || [];
  
  const allWords = [...japaneseWords, ...koreanWords, ...englishWords];
  const wordCount: { [key: string]: number } = {};
  
  // 除外する単語リスト
  const japaneseExclude = ['これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', 'その', '彼', '彼女', '彼は', '彼女は', 'もの', 'こと', 'は', 'が', 'を', 'に', 'の', 'で', 'へ', 'と', 'から', 'まで', 'より'];
  const koreanExclude = ['그', '그녀', '그는', '그녀는', '이것', '그것', '것', '이', '가', '을', '를', '은', '는', '의', '에', '에서', '으로', '로', '와', '과', '부터', '까지'];
  const englishExclude = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'img', 'and', 'or', 'but', 'if', 'when', 'where', 'what', 'who', 'why', 'how'];
  
  allWords.forEach(word => {
    // 範囲情報パターンを除外（例: "1-5", "6-10", "11-15"など）
    if (!/^\d+-\d+$/.test(word)) {
      // 英語のみ小文字に変換、日本語・韓国語はそのまま
      const normalizedWord = /^[A-Za-z]/.test(word) ? word.toLowerCase() : word;
      
      // 除外リストチェック
      if (japaneseExclude.includes(normalizedWord)) return;
      if (koreanExclude.includes(normalizedWord)) return;
      if (englishExclude.includes(normalizedWord)) return;
      
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

