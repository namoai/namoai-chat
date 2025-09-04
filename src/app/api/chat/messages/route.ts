import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { VertexAI, HarmCategory, HarmBlockThreshold, Content } from "@google-cloud/vertexai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

export async function POST(
    request: NextRequest,
    { params }: { params: { chatId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }

    const chatId = parseInt(params.chatId, 10);
    const userId = parseInt(session.user.id, 10);
    const { message, settings } = await request.json();

    if (!message) {
        return NextResponse.json({ error: "メッセージは必須です。" }, { status: 400 });
    }

    try {
        // --- ポイント消費ロジック ---
        const boostMultiplier = settings?.responseBoostMultiplier || 1.0;
        const boostCostMap: { [key: number]: number } = { 1.5: 1, 3.0: 2, 5.0: 4 };
        const boostCost = boostCostMap[boostMultiplier] || 0;
        const totalPointsToConsume = 1 + boostCost;

        await prisma.$transaction(async (tx) => {
            const userPointsRecord = await tx.points.findUnique({ where: { user_id: userId } });
            const currentUserPoints = (userPointsRecord?.free_points || 0) + (userPointsRecord?.paid_points || 0);
            if (currentUserPoints < totalPointsToConsume) {
                throw new Error("ポイントが不足しています。");
            }
            let remainingCost = totalPointsToConsume;
            // ▼▼▼ 【修正】letをconstに変更 ▼▼▼
            const freePointsAfter = Math.max(0, (userPointsRecord?.free_points || 0) - remainingCost);
            remainingCost = Math.max(0, remainingCost - (userPointsRecord?.free_points || 0));
            // ▼▼▼ 【修正】letをconstに変更 ▼▼▼
            const paidPointsAfter = Math.max(0, (userPointsRecord?.paid_points || 0) - remainingCost);
            
            await tx.points.update({
                where: { user_id: userId },
                data: { free_points: freePointsAfter, paid_points: paidPointsAfter },
            });
        });


        const chatRoom = await prisma.chat.findUnique({
            where: { id: chatId },
            include: { characters: true, users: { select: { defaultPersonaId: true } } },
        });

        if (!chatRoom || !chatRoom.characters) {
            return NextResponse.json({ error: "チャットまたはキャラクターが見つかりません。" }, { status: 404 });
        }

        // ユーザーメッセージをDBに保存し、turnIdを取得
        const userMessage = await prisma.chat_message.create({
            data: {
                chatId: chatId,
                role: 'user',
                content: message,
                version: 1,
                isActive: true,
            }
        });
        await prisma.chat_message.update({
            where: { id: userMessage.id },
            data: { turnId: userMessage.id },
        });

        // --- AI応答生成 ---
        const history = await prisma.chat_message.findMany({
            where: { chatId: chatId, isActive: true, id: { not: userMessage.id } },
            orderBy: { createdAt: 'asc' },
        });
        const chatHistory: Content[] = history.map(msg => ({
            role: msg.role as 'user' | 'model',
            parts: [{ text: msg.content }],
        }));
        
        // システムプロンプト構築
        let userPersonaInfo = "";
        if (chatRoom.users.defaultPersonaId) {
            const p = await prisma.personas.findUnique({ where: { id: chatRoom.users.defaultPersonaId }});
            if (p) userPersonaInfo = `# ユーザーのペルソナ設定\n- ニックネーム: ${p.nickname}\n- 年齢: ${p.age||'未設定'}\n- 性別: ${p.gender||'未設定'}\n- 詳細情報: ${p.description}`;
        }
        const char = chatRoom.characters;
        let boostInstruction = "";
        if (boostMultiplier > 1.0) {
            boostInstruction = `\n# 追加指示\n- 今回の応答に限り、通常よりも意図的に長く、約${boostMultiplier}倍の詳細な内容で返答してください。`;
        }
        const systemInstructionText = [char.systemTemplate, userPersonaInfo, boostInstruction].filter(Boolean).join('\n\n');

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
                role: 'model',
                content: aiReply,
                turnId: userMessage.id,
                version: 1,
                isActive: true,
            }
        });
        
        return NextResponse.json({ newMessages: [userMessage, modelMessage] });

    } catch (error) {
        console.error("チャットAPIエラー:", error);
        const errorMessage = error instanceof Error ? error.message : "内部サーバーエラーが発生しました。";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}