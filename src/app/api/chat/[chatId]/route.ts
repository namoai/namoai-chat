export const runtime = 'nodejs';

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
  Content,
} from "@google-cloud/vertexai";

// VertexAIクライアントの初期化
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_PROJECT_ID,
  location: "us-central1",
});

// 安全性設定を指定して生成モデルを取得
const generativeModel = vertex_ai.getGenerativeModel({
  model: "gemini-2.5-pro",
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ],
});

/**
 * リクエストURLからチャットIDを抽出するヘルパー関数
 */
function extractChatIdFromRequest(request: NextRequest): number | null {
  const url = new URL(request.url);
  const idStr = url.pathname.split('/').pop();
  if (!idStr) return null;
  const parsedId = parseInt(idStr, 10);
  return isNaN(parsedId) ? null : parsedId;
}

// POST: チャットメッセージを処理し、AIからの返信を生成する
export async function POST(
  request: NextRequest
) {
  const { message } = await request.json();
  const numericChatId = extractChatIdFromRequest(request);

  if (numericChatId === null) {
    return NextResponse.json({ error: "無効なチャットIDです。" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "メッセージがありません。" }, { status: 400 });
  }

  try {
    // データベースからチャットルームと関連情報を取得
    const chatRoom = await prisma.chat.findUnique({
      where: { id: numericChatId },
      include: {
        characters: {
          include: {
            characterImages: { orderBy: { displayOrder: 'asc' } }
          }
        },
        users: { select: { defaultPersonaId: true } }
      },
    });

    if (!chatRoom || !chatRoom.characters) {
      return NextResponse.json({ error: "チャットまたはキャラクターが見つかりません。" }, { status: 404 });
    }
    
    // ユーザーペルソナ情報を構築
    let userPersonaInfo = "ユーザーのペルソナは設定されていません。";
    if (chatRoom.users.defaultPersonaId) {
      const userPersona = await prisma.personas.findUnique({
        where: { id: chatRoom.users.defaultPersonaId }
      });
      if (userPersona) {
        userPersonaInfo = `
          # ユーザーのペルソナ設定
          - ニックネーム: ${userPersona.nickname}
          - 年齢: ${userPersona.age || '未設定'}
          - 性別: ${userPersona.gender || '未設定'}
          - 詳細情報: ${userPersona.description}
          `;
      }
    }

    const characterPersona = chatRoom.characters;
    
    // 画像リストの指示を構築 (基本画像 {img:0} は除外)
    let imageInstructions = "";
    if (characterPersona.characterImages && characterPersona.characterImages.length > 1) {
      const imageList = characterPersona.characterImages
        .slice(1) // 最初の画像を除外
        .map((img, index) => 
          `- {img:${index + 1}}: ${img.keyword || '説明なし'}`
        ).join('\n');
      
      imageInstructions = `
        # 利用可能な画像リスト
        あなたは以下の画像リストを参考にして、会話の文脈や感情に最も合う画像を \`{img:数字}\` の形式で応答に含めることができます。
        キーワードはあくまで参考です。会話の流れを最優先してください。
        ${imageList}
      `;
    }
    
    // ユーザーノートの指示を構築
    let userNoteInstruction = "";
    if (chatRoom.userNote) {
      userNoteInstruction = `
        # ユーザーが作成した追加設定（ユーザーノート）
        以下の内容はユーザーがあなたとの対話のために特別に作成したメモです。この設定を記憶し、会話に反映させてください。
        ---
        ${chatRoom.userNote}
        ---
      `;
    }

    // ▼▼▼【修正点】ロールプレイルールに外部リンク画像のルールを追加します ▼▼▼
    const roleplayInstruction = `
      # ロールプレイルール
      - あなたのすべての返答は、必ず以下の形式に従ってください。
      - 行動、状況描写、感情表現などは、必ずアスタリスク(*)で囲んで表現してください。例: *彼女は優しく微笑んだ。*
      - キャラクターが話すセリフは、必ず鍵括弧「」で囲んで表現してください。 例: 「いらっしゃい。」
      - 地文とセリフは組み合わせて使用できます。 例: *頷きながら* 「わかったわ。」
      - 外部の画像を表示するには、マークダウン形式を使用できます。例: ![](https://example.com/image.jpg)
    `;
    // ▲▲▲ ここまで ▲▲▲

    // システムプロンプト全体を構築
    const systemInstruction = `
      あなたは以下の設定を持つキャラクターとしてロールプレイを行ってください。
      そして、以下のペルソナを持つユーザーと対話しています。ユーザーのペルソナを記憶し、会話に反映させてください。

      # あなた(AI)のキャラクター設定
      - システムテンプレート: ${characterPersona.systemTemplate || "設定なし"}
      - 詳細設定: ${characterPersona.detailSetting || "設定なし"}
      ${imageInstructions}

      ${userPersonaInfo}
      
      ${userNoteInstruction}

      ${roleplayInstruction}
    `.trim();

    // データベースからチャット履歴を取得
    const dbMessages = await prisma.chat_message.findMany({
      where: { chatId: numericChatId },
      orderBy: { createdAt: "asc" },
    });

    const chatHistory: Content[] = dbMessages.map((msg) => ({
      role: msg.role as "user" | "model",
      parts: [{ text: msg.content }],
    }));

    // AIとのチャットセッションを開始
    const chat = generativeModel.startChat({
      history: chatHistory,
      systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const aiReply = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiReply) {
      return NextResponse.json({ error: "モデルから有効な応答がありませんでした。" }, { status: 500 });
    }

    // ユーザーのメッセージとAIの返信をデータベースに保存
    await prisma.$transaction([
      prisma.chat_message.create({
        data: { chatId: numericChatId, role: "user", content: message },
      }),
      prisma.chat_message.create({
        data: { chatId: numericChatId, role: "model", content: aiReply },
      }),
    ]);

    return NextResponse.json({ reply: aiReply });

  } catch (error) {
    console.error("APIルートエラー:", error);
    return NextResponse.json({ error: "内部サーバーエラーが発生しました。" }, { status: 500 });
  }
}
