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
    // セーフティフィルターON: より厳格
    return [
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];
  }
};

// GET: バックメモリを取得
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
      select: { backMemory: true, autoSummarize: true, userId: true },
    });

    if (!chat) {
      return NextResponse.json({ error: 'チャットが見つかりません。' }, { status: 404 });
    }

    if (chat.userId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    return NextResponse.json({
      backMemory: chat.backMemory || '',
      autoSummarize: chat.autoSummarize ?? true,
    });
  } catch (error) {
    console.error('バックメモリ取得エラー:', error);
    return NextResponse.json({ error: '内部サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// PUT: バックメモリを更新
export async function PUT(
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
    const { content, autoSummarize } = await request.json();

    if (content && content.length > 3000) {
      return NextResponse.json({ error: '内容は3000文字以内で入力してください。' }, { status: 400 });
    }

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

    const updated = await prisma.chat.update({
      where: { id: chatIdNum },
      data: {
        backMemory: content !== undefined ? content : undefined,
        autoSummarize: autoSummarize !== undefined ? autoSummarize : undefined,
      },
    });

    // ▼▼▼【ベクトル検索】バックメモリのembeddingを生成▼▼▼
    if (content && content.trim().length > 0) {
      (async () => {
        try {
          const embedding = await getEmbedding(content);
          const embeddingString = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE "chat" SET "backMemoryEmbedding" = $1::vector WHERE "id" = $2`,
            embeddingString,
            chatIdNum
          );
        } catch (error) {
          console.error('バックメモリembedding生成エラー:', error);
        }
      })();
    } else {
      // 内容が空の場合はembeddingも削除
      await prisma.$executeRawUnsafe(
        `UPDATE "chat" SET "backMemoryEmbedding" = NULL WHERE "id" = $1`,
        chatIdNum
      );
    }
    // ▲▲▲

    return NextResponse.json({
      backMemory: updated.backMemory || '',
      autoSummarize: updated.autoSummarize ?? true,
    });
  } catch (error) {
    console.error('バックメモリ更新エラー:', error);
    return NextResponse.json({ error: '内部サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// POST: 自動要約を実行
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

    // 全メッセージ数を取得して自動的に適切な数を選択
    const totalMessageCount = await prisma.chat_message.count({
      where: {
        chatId: chatIdNum,
        isActive: true,
      },
    });

    // メッセージ数に応じて取得数を自動調整（多くても50件、少なければ全件）
    const takeCount = totalMessageCount <= 50 ? totalMessageCount : 50;
    console.log(`全メッセージ数: ${totalMessageCount}, 取得数: ${takeCount}`);

    // 会話履歴を取得
    const messages = await prisma.chat_message.findMany({
      where: {
        chatId: chatIdNum,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
      take: takeCount,
    });

    if (messages.length === 0) {
      return NextResponse.json({ error: '要約する会話がありません。' }, { status: 400 });
    }

    // 会話をテキストに変換
    const conversationText = messages
      .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'キャラクター'}: ${msg.content}`)
      .join('\n\n');

    // Vertex AIで要約
    const vertex_ai = new VertexAI({
      project: process.env.GOOGLE_PROJECT_ID || '',
      location: 'asia-northeast1',
    });

    // gemini-2.5-flashを使用（高速な要約のため）
    const generativeModel = vertex_ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      safetySettings,
    });

    const prompt = `以下の会話履歴を日本語で要約してください。以下の形式で整理してください：

[ストーリー要約]
- 主な出来事や展開を簡潔に箇条書きでまとめてください

[イベント要約]
- 具体的なイベントやシーンを箇条書きでまとめてください

[キャラクターの役割]
- 各キャラクターの特徴、役割を簡潔にまとめてください

[ユーザーとキャラクターの関係]
- ユーザーとキャラクター間の現在の関係性を明確に記述してください
- 例: 友人、恋人、敵対関係、師弟関係、ビジネスパートナーなど
- 関係性の変化や発展があれば、その経緯も含めてください
- 好感度や信頼度などの感情的な側面も含めてください

要約は3000文字以内で、AIが理解しやすい形式で記述してください。

会話履歴：
${conversationText}`;

    const result = await generativeModel.generateContent(prompt);
    const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!summary) {
      return NextResponse.json({ error: '要約の生成に失敗しました。' }, { status: 500 });
    }

    // 要約を保存
    const updated = await prisma.chat.update({
      where: { id: chatIdNum },
      data: { backMemory: summary },
    });

    // ▼▼▼【ベクトル検索】要約のembeddingを生成▼▼▼
    (async () => {
      try {
        const embedding = await getEmbedding(summary);
        const embeddingString = `[${embedding.join(',')}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE "chat" SET "backMemoryEmbedding" = $1::vector WHERE "id" = $2`,
          embeddingString,
          chatIdNum
        );
      } catch (error) {
        console.error('バックメモリembedding生成エラー:', error);
      }
    })();
    // ▲▲▲

    return NextResponse.json({ summary: updated.backMemory || '' });
  } catch (error) {
    console.error('自動要約エラー:', error);
    return NextResponse.json({ error: '内部サーバーエラーが発生しました。' }, { status: 500 });
  }
}

