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
    const body = await request.json();
    const { content, keywords, autoSummarize } = body;

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

      // 最新の会話を取得
      const messages = await prisma.chat_message.findMany({
        where: {
          chatId: chatIdNum,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      if (messages.length === 0) {
        return NextResponse.json({ error: '要約する会話がありません。' }, { status: 400 });
      }

      const conversationText = messages
        .reverse()
        .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
        .join('\n\n');

      // Vertex AIで要約
      const vertex_ai = new VertexAI({
        project: process.env.GOOGLE_PROJECT_ID || '',
        location: 'asia-northeast1',
      });

      const generativeModel = vertex_ai.getGenerativeModel({
        model: 'gemini-2.5-pro',
        safetySettings,
      });

      const prompt = `以下の会話履歴を日本語で簡潔に要約してください。2000文字以内で、AIが理解しやすい形式で記述してください。

会話履歴：
${conversationText}`;

      const result = await generativeModel.generateContent(prompt);
      let summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!summary) {
        return NextResponse.json({ error: '要約の生成に失敗しました。' }, { status: 500 });
      }

      // キーワードを抽出（簡単な方法：会話から重要な単語を抽出）
      const extractedKeywords = extractKeywords(conversationText);
      
      // 2000文字を超える場合は複数のメモリに分割（保存個数制限なし）
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
        currentIndex++;
        
        // 次のメモリ用のembeddingを生成（非同期）
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
          break;
        }
      }
      
      // 最後の残り部分がある場合
      if (remainingSummary.length > 0) {
        const finalMemory = await prisma.detailed_memories.create({
          data: {
            chatId: chatIdNum,
            content: remainingSummary.substring(0, MAX_MEMORY_LENGTH),
            keywords: extractedKeywords,
          },
        });
        
        createdMemories.push(finalMemory);
        
        // embedding生成（非同期）
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
      
      // 最初に作成されたメモリを返す（既存のコードとの互換性のため）
      const newMemory = createdMemories[0];

      if (!newMemory) {
        return NextResponse.json({ error: 'メモリの作成に失敗しました。' }, { status: 500 });
      }

      return NextResponse.json({ 
        memory: { ...newMemory, index: existingCount + 1 },
        createdCount: createdMemories.length 
      });
    } else {
      // 手動作成の場合（保存個数制限なし）

      if (!content || content.length > MAX_MEMORY_LENGTH) {
        return NextResponse.json({ error: `内容は${MAX_MEMORY_LENGTH}文字以内で入力してください。` }, { status: 400 });
      }

      const memoryContent = content.substring(0, MAX_MEMORY_LENGTH);
      const newMemory = await prisma.detailed_memories.create({
        data: {
          chatId: chatIdNum,
          content: memoryContent,
          keywords: keywords || [],
        },
      });

      // ▼▼▼【ベクトル検索】詳細記憶のembeddingを生成▼▼▼
      (async () => {
        try {
          const embedding = await getEmbedding(memoryContent);
          const embeddingString = embeddingToVectorString(embedding);
          await prisma.$executeRaw`
            UPDATE "detailed_memories" 
            SET "embedding" = ${embeddingString}::vector 
            WHERE "id" = ${newMemory.id}
          `;
        } catch (error) {
          console.error('詳細記憶embedding生成エラー:', error);
        }
      })();
      // ▲▲▲

      return NextResponse.json({ memory: { ...newMemory, index: existingCount + 1 } });
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

    if (!content || content.length > MAX_MEMORY_LENGTH) {
      return NextResponse.json({ error: `内容は${MAX_MEMORY_LENGTH}文字以内で入力してください。` }, { status: 400 });
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

    const memoryContent = content.substring(0, MAX_MEMORY_LENGTH);
    const updated = await prisma.detailed_memories.update({
      where: { id: memoryId },
      data: { content: memoryContent },
    });

    // ▼▼▼【ベクトル検索】更新された詳細記憶のembeddingを再生成▼▼▼
    (async () => {
      try {
        const embedding = await getEmbedding(memoryContent);
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

