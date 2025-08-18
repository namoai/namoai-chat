export const runtime = 'nodejs';

import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
  Content,
} from "@google-cloud/vertexai";

// PrismaとVertex AIを初期化
const prisma = new PrismaClient();
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_PROJECT_ID || "meta-scanner-466006-v8",
  location: "us-central1",
});

const generativeModel = vertex_ai.getGenerativeModel({
  model: "gemini-1.5-pro",
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ],
});

// ✅ Vercelビルドエラーを回避するため、URLから直接IDを解析するヘルパー関数
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
    // --- 1. データベースからチャットとキャラクター情報を取得 ---
    const chatRoom = await prisma.chat.findUnique({
      where: { id: numericChatId },
      include: {
        characters: true, // スキーマに合わせて `characters` をインクルード
      },
    });

    if (!chatRoom || !chatRoom.characters) {
      return NextResponse.json({ error: "チャットまたはキャラクターが見つかりません。" }, { status: 404 });
    }

    const persona = chatRoom.characters; // DBから取得したキャラクター情報をペルソナとして使用

    const systemInstruction = `
      あなたは以下の設定を持つキャラクターとしてロールプレイを行ってください。
      # キャラクター設定
      - システムテンプレート: ${persona.systemTemplate || "設定なし"}
      - 詳細設定: ${persona.detailSetting || "設定なし"}
    `;

    const dbMessages = await prisma.chat_message.findMany({
      where: { chatId: numericChatId },
      orderBy: { createdAt: "asc" },
    });

    const chatHistory: Content[] = dbMessages.map((msg) => ({
      role: msg.role as "user" | "model",
      parts: [{ text: msg.content }],
    }));

    // --- 2. Vertex AIにリクエストを送信 ---
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

    // --- 3. 新しいメッセージをデータベースに保存 ---
    await prisma.$transaction([
      prisma.chat_message.create({
        data: {
          chatId: numericChatId,
          role: "user",
          content: message,
        },
      }),
      prisma.chat_message.create({
        data: {
          chatId: numericChatId,
          role: "model",
          content: aiReply,
        },
      }),
    ]);

    // --- 4. AIの返信をクライアントに返す ---
    return NextResponse.json({ reply: aiReply });

  } catch (error) {
    console.error("APIルートエラー:", error);
    return NextResponse.json({ error: "内部サーバーエラーが発生しました。" }, { status: 500 });
  }
}
