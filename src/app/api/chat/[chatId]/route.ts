import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VertexAI, HarmCategory, HarmBlockThreshold, Content } from "@google-cloud/vertexai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth"; 

// VertexAIクライアントの初期化
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_PROJECT_ID,
  location: "us-central1",
});

// 安全性設定
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(request: Request, context: any) {
  const { params } = (context ?? {}) as { params?: Record<string, string | string[]> };
  const rawChatId = params?.chatId;
  const chatIdStr = Array.isArray(rawChatId) ? rawChatId[0] : rawChatId;

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }

  const chatId = parseInt(String(chatIdStr), 10);
  if (isNaN(chatId)) {
    return NextResponse.json({ error: "無効なチャットIDです。" }, { status: 400 });
  }
  const userId = parseInt(String(session.user.id), 10);

  const { message, settings } = await request.json();
  if (!message) {
    return NextResponse.json({ error: "メッセージは必須です。" }, { status: 400 });
  }

  try {
    const boostMultiplier = settings?.responseBoostMultiplier || 1.0;
    const boostCostMap: { [key: number]: number } = { 1.5: 1, 3.0: 2, 5.0: 4 };
    const boostCost = boostCostMap[boostMultiplier] || 0;
    const totalPointsToConsume = 1 + boostCost;

    await prisma.$transaction(async (tx) => {
      const p = await tx.points.findUnique({ where: { user_id: userId } });
      const currentPoints = (p?.free_points || 0) + (p?.paid_points || 0);
      if (currentPoints < totalPointsToConsume) throw new Error("ポイントが不足しています。");
      let cost = totalPointsToConsume;
      const freeAfter = Math.max(0, (p?.free_points || 0) - cost);
      cost = Math.max(0, cost - (p?.free_points || 0));
      const paidAfter = Math.max(0, (p?.paid_points || 0) - cost);
      await tx.points.update({ where: { user_id: userId }, data: { free_points: freeAfter, paid_points: paidAfter }});
    });

    const chatRoom = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { 
        characters: { include: { lorebooks: { orderBy: { id: 'asc' } } } }, 
        users: { select: { defaultPersonaId: true, nickname: true } } // ユーザーのニックネームも取得
      },
    });

    if (!chatRoom || !chatRoom.characters) {
      return NextResponse.json({ error: "チャットまたはキャラクターが見つかりません。" }, { status: 404 });
    }

    // --- プレースホルダー置換処理 ---
    const char = chatRoom.characters;
    const user = chatRoom.users;
    let persona = null;
    if (user.defaultPersonaId) {
      persona = await prisma.personas.findUnique({ where: { id: user.defaultPersonaId } });
    }
    
    // ▼▼▼【新規追加】プレースホルダーを置換する関数 ▼▼▼
    const characterName = char.name;
    const userNickname = persona?.nickname || user.nickname || 'ユーザー';

    const replacePlaceholders = (text: string | null | undefined): string => {
      if (!text) return '';
      return text
        .replace(/{{char}}/g, characterName)
        .replace(/{{user}}/g, userNickname);
    };

    const userMessage = await prisma.chat_message.create({
      data: { chatId: chatId, role: "user", content: message, version: 1, isActive: true },
    });
    await prisma.chat_message.update({ where: { id: userMessage.id }, data: { turnId: userMessage.id }});

    const history = await prisma.chat_message.findMany({
      where: { chatId: chatId, isActive: true, id: { not: userMessage.id } },
      orderBy: { createdAt: "asc" },
    });
    
    // ▼▼▼【修正】チャット履歴にもプレースホルダー置換を適用 ▼▼▼
    const chatHistory: Content[] = history.map((msg) => ({
      role: msg.role as "user" | "model",
      parts: [{ text: replacePlaceholders(msg.content) }],
    }));

    // --- システムプロンプト構築 ---
    let lorebookInfo = "";
    const triggeredLorebooks = [];
    if (char.lorebooks && char.lorebooks.length > 0) {
      for (const lore of char.lorebooks) {
        if (lore.keywords.some(keyword => message.includes(keyword))) {
          // ▼▼▼【修正】ロアブックの内容にもプレースホルダー置換を適用 ▼▼▼
          triggeredLorebooks.push(replacePlaceholders(lore.content));
        }
        if (triggeredLorebooks.length >= 5) break;
      }
    }

    if (triggeredLorebooks.length > 0) {
      lorebookInfo = `# 関連情報 (ロアブック)
- 以下の情報は、ユーザーとの会話中に特定のキーワードがトリガーとなって有効化された追加設定です。
- 最大5個のロアブックが同時に使用され、このリストの上にあるものが最も優先度が高いです。この優先順位を考慮して応答してください。
- ${triggeredLorebooks.join("\n- ")}`;
    }
    
    const userPersonaInfo = persona ? `# ユーザーのペルソナ設定
- ニックネーム: ${persona.nickname}
- 年齢: ${persona.age || "未設定"}
- 性別: ${persona.gender || "未設定"}
- 詳細情報: ${replacePlaceholders(persona.description)}` : "";

    let boostInstruction = "";
    if (boostMultiplier > 1.0) {
      boostInstruction = `\n# 追加指示
- 今回の応答に限り、通常よりも意図的に長く、約${boostMultiplier}倍の詳細な内容で返答してください。`;
    }

    // ▼▼▼【修正】システムテンプレートにもプレースホルダー置換を適用 ▼▼▼
    const systemTemplate = replacePlaceholders(char.systemTemplate);
    const systemInstructionText = [systemTemplate, userPersonaInfo, lorebookInfo, boostInstruction]
      .filter(Boolean)
      .join("\n\n");

    const generativeModel = vertex_ai.getGenerativeModel({ model: "gemini-2.5-pro", safetySettings });
    const chat = generativeModel.startChat({ history: chatHistory, systemInstruction: systemInstructionText });
    const result = await chat.sendMessage(message);

    const aiReply = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiReply) {
      throw new Error("モデルから有効な応答がありませんでした。");
    }

    const modelMessage = await prisma.chat_message.create({
      data: {
        chatId: chatId,
        role: "model",
        content: aiReply,
        turnId: userMessage.id,
        version: 1,
        isActive: true,
      },
    });

    return NextResponse.json({ newMessages: [userMessage, modelMessage] });
  } catch (error) {
    console.error("チャットAPIエラー:", error);
    const errorMessage = error instanceof Error ? error.message : "内部サーバーエラーが発生しました。";
    if (error instanceof Error && error.message === "ポイントが不足しています。") {
        return NextResponse.json({ error: error.message }, { status: 402 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

