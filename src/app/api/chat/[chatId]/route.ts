import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { VertexAI, HarmCategory, HarmBlockThreshold, Content } from "@google-cloud/vertexai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = 'nodejs';

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


/**
 * POST: チャットメッセージを処理し、ポイントを消費してAIからの返信を生成する。
 */
// ▼▼▼【エラー修正】関数の定義に2番目の引数 { params } を追加しました。▼▼▼
export async function POST(
    request: NextRequest,
    { params }: { params: { chatId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "認証情報が見つかりません。" }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);

    const { message, settings } = await request.json();
    // ▼▼▼【エラー修正】paramsからchatIdを取得するように変更し、手動での抽出関数を削除しました。▼▼▼
    const numericChatId = parseInt(params.chatId, 10);

    // --- 入力値のバリデーション ---
    if (isNaN(numericChatId)) return NextResponse.json({ error: "無効なチャットIDです。" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "メッセージがありません。" }, { status: 400 });

    // --- ポイント消費ロジック ---
    const boostMultiplier = settings?.responseBoostMultiplier || 1.0;
    const boostCostMap: { [key: number]: number } = { 1.5: 1, 3.0: 2, 5.0: 4 };
    const boostCost = boostCostMap[boostMultiplier] || 0;
    const totalPointsToConsume = 1 + boostCost;

    const userPointsRecord = await prisma.points.findUnique({
        where: { user_id: userId },
    });
    const currentUserPoints = (userPointsRecord?.free_points || 0) + (userPointsRecord?.paid_points || 0);

    if (currentUserPoints < totalPointsToConsume) {
        return NextResponse.json({ error: "ポイントが不足しています。" }, { status: 402 });
    }

    let remainingCost = totalPointsToConsume;
    const freePointsAfter = Math.max(0, (userPointsRecord?.free_points || 0) - remainingCost);
    remainingCost = Math.max(0, remainingCost - (userPointsRecord?.free_points || 0));
    const paidPointsAfter = Math.max(0, (userPointsRecord?.paid_points || 0) - remainingCost);
    
    await prisma.points.update({
        where: { user_id: userId },
        data: { free_points: freePointsAfter, paid_points: paidPointsAfter },
    });

    // --- チャットとキャラクター情報の取得 ---
    const chatRoom = await prisma.chat.findUnique({
      where: { id: numericChatId, userId: userId },
      include: { 
          characters: { include: { characterImages: { orderBy: { displayOrder: 'asc' } } } }, 
          users: { select: { defaultPersonaId: true } } 
      },
    });
    if (!chatRoom || !chatRoom.characters) return NextResponse.json({ error: "チャットまたはキャラクターが見つかりません。" }, { status: 404 });
    
    // --- システムプロンプトの構築 ---
    let userPersonaInfo = "";
    if (chatRoom.users.defaultPersonaId) {
        const p = await prisma.personas.findUnique({ where: { id: chatRoom.users.defaultPersonaId }});
        if (p) userPersonaInfo = `# ユーザーのペルソナ設定\n- ニックネーム: ${p.nickname}\n- 年齢: ${p.age||'未設定'}\n- 性別: ${p.gender||'未設定'}\n- 詳細情報: ${p.description}`;
    }
    const char = chatRoom.characters;
    let imageInstructions = "";
    if (char.characterImages && char.characterImages.length > 1) {
        const list = char.characterImages.slice(1).map((img, i) => `- {img:${i+1}}: ${img.keyword||'説明なし'}`).join('\n');
        imageInstructions = `# 利用可能な画像リスト\n${list}`;
    }
    const userNoteInstruction = chatRoom.userNote ? `# ユーザーノート\n${chatRoom.userNote}` : "";
    const roleplayInstruction = `# ロールプレイルール\n- 行動や状況描写はアスタリスク(*)で囲む。\n- セリフは鍵括弧「」で囲む。`;

    let boostInstruction = "";
    if (boostMultiplier > 1.0) {
        boostInstruction = `\n# 追加指示\n- 今回の応答に限り、通常よりも意図的に長く、約${boostMultiplier}倍の詳細な内容で返答してください。`;
    }

    const systemInstruction = `あなたは以下の設定を持つキャラクターとしてロールプレイを行ってください。
# あなた(AI)のキャラクター設定
- 詳細設定: ${char.detailSetting || "設定なし"}
${imageInstructions}
${userPersonaInfo}
${userNoteInstruction}
${roleplayInstruction}
${boostInstruction}`.trim();

    // --- AIへのリクエスト ---
    const dbMessages = await prisma.chat_message.findMany({ 
        where: { chatId: numericChatId, isActive: true }, 
        orderBy: { createdAt: "asc" } 
    });
    const chatHistory: Content[] = dbMessages.map((msg) => ({ role: msg.role as "user" | "model", parts: [{ text: msg.content }] }));
    
    const generativeModel = vertex_ai.getGenerativeModel({
        model: "gemini-1.5-pro-preview-0409",
        safetySettings,
    });

    const chat = generativeModel.startChat({
      history: chatHistory,
      systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    });

    const result = await chat.sendMessage(message);
    const aiReply = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiReply) return NextResponse.json({ error: "モデルから有効な応答がありませんでした。" }, { status: 500 });

    // --- データベースへの保存 ---
    const userMessage = await prisma.chat_message.create({
        data: {
            chatId: numericChatId,
            role: "user",
            content: message,
            isActive: true,
            version: 1,
        }
    });

    const modelMessage = await prisma.chat_message.create({
        data: {
            chatId: numericChatId,
            role: "model",
            content: aiReply,
            turnId: userMessage.id,
            isActive: true,
            version: 1,
        }
    });
    
    return NextResponse.json({ newMessages: [userMessage, modelMessage] });

  } catch (error) {
    console.error("APIルートエラー:", error);
    const errorMessage = error instanceof Error ? error.message : "内部サーバーエラーが発生しました。";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

