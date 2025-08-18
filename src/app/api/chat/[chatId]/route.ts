export const runtime = 'nodejs';

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
  Content,
} from "@google-cloud/vertexai";

// Vertex AIクライアントとモデルを初期化
// Google Cloud SDKが環境変数 'GOOGLE_APPLICATION_CREDENTIALS' を自動的に読み込み、
// 認証を処理するため、手動での認証情報パースは不要です。
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_PROJECT_ID,
  location: "us-central1",
});

const generativeModel = vertex_ai.getGenerativeModel({
  model: "gemini-2.5-pro",
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ],
});


// URLから直接IDを解析するヘルパー関数
function extractChatIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  const idStr = url.pathname.split('/').pop();
  if (!idStr) return null;
  const parsedId = parseInt(idStr, 10);
  return isNaN(parsedId) ? null : parsedId;
}

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
    // DBからチャットルーム情報を取得 (ユーザー情報も含む)
    const chatRoom = await prisma.chat.findUnique({
      where: { id: numericChatId },
      include: {
        characters: true,
        users: {
          select: {
            defaultPersonaId: true
          }
        }
      },
    });

    if (!chatRoom || !chatRoom.characters) {
      return NextResponse.json({ error: "チャットまたはキャラクターが見つかりません。" }, { status: 404 });
    }

    // ユーザーの基本ペルソナ情報を取得
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

    // システムプロンプトにユーザーペルソナ情報を追加
    const systemInstruction = `
      あなたは以下の設定を持つキャラクターとしてロールプレイを行ってください。
      そして、以下のペルソナを持つユーザーと対話しています。ユーザーのペルソナを記憶し、会話に反映させてください。

      # あなた(AI)のキャラクター設定
      - システムテンプレート: ${characterPersona.systemTemplate || "設定なし"}
      - 詳細設定: ${characterPersona.detailSetting || "設定なし"}

      ${userPersonaInfo}
    `;

    // 履歴を取得
    const dbMessages = await prisma.chat_message.findMany({
      where: { chatId: numericChatId },
      orderBy: { createdAt: "asc" },
    });

    const chatHistory: Content[] = dbMessages.map((msg) => ({
      role: msg.role as "user" | "model",
      parts: [{ text: msg.content }],
    }));

    // Vertex AIにリクエストを送信
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

    // DBにメッセージを保存
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
    // エラーオブジェクト全体をログに出力して詳細を確認
    console.error(error);
    return NextResponse.json({ error: "内部サーバーエラーが発生しました。" }, { status: 500 });
  }
}
