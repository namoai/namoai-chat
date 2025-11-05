import { NextResponse, NextRequest } from "next/server";
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


// --- 新規メッセージ作成または再生成 (POST) ---
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }
    const userId = parseInt(session.user.id);

    const { chatId, turnId, settings } = await request.json();

    if (!chatId || !turnId) {
        return NextResponse.json({ error: "チャットIDとターンIDは必須です。" }, { status: 400 });
    }

    try {
        // ポイント消費ロジック
        const boostMultiplier = settings?.responseBoostMultiplier || 1.0;
        const boostCostMap: { [key: number]: number } = { 1.5: 1, 3.0: 2, 5.0: 4 };
        const boostCost = boostCostMap[boostMultiplier] || 0;
        const totalPointsToConsume = 1 + boostCost;

        await prisma.$transaction(async (tx) => {
            const userPointsRecord = await tx.points.findUnique({ where: { user_id: userId } });
            const currentUserPoints = (userPointsRecord?.free_points || 0) + (userPointsRecord?.paid_points || 0);
            if (currentUserPoints < totalPointsToConsume) throw new Error("ポイントが不足しています。");
            
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
            include: { 
                characters: { 
                    include: { characterImages: true } 
                }, 
                users: { select: { defaultPersonaId: true } } 
            },
        });

        if (!chatRoom || !chatRoom.characters) return NextResponse.json({ error: "チャットまたはキャラクターが見つかりません。" }, { status: 404 });
        
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

        const userMessageForTurn = await prisma.chat_message.findUnique({ where: { id: turnId } });
        if (!userMessageForTurn) throw new Error("対象のメッセージが見つかりません。");

        const historyMessages = await prisma.chat_message.findMany({
            where: {
                chatId: chatId,
                isActive: true,
                createdAt: { lt: userMessageForTurn.createdAt }, 
            },
            orderBy: { createdAt: 'asc' },
        });

        const chatHistory: Content[] = historyMessages.map(msg => ({
            role: msg.role as "user" | "model",
            parts: [{ text: msg.content }],
        }));

        const generativeModel = vertex_ai.getGenerativeModel({ model: "gemini-2.5-pro", safetySettings });
        const chat = generativeModel.startChat({ 
            history: chatHistory, 
            systemInstruction: systemInstructionText 
        });
        
        const result = await chat.sendMessage(userMessageForTurn.content);

        const aiReply = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!aiReply) throw new Error("モデルから有効な応答がありませんでした。");
        
        // ▼▼▼【効率的な画像出力】応答テキストからキーワードマッチング ▼▼▼
        const matchedImageUrls: string[] = [];
        const availableImages = chatRoom.characters.characterImages || [];
        const lowerReply = aiReply.toLowerCase();
        
        for (const img of availableImages) {
            if (img.keyword && !img.isMain) {
                const lowerKeyword = img.keyword.toLowerCase();
                if (lowerReply.includes(lowerKeyword)) {
                    matchedImageUrls.push(img.imageUrl);
                }
            }
        }
        console.log(`📸 再生成時の画像マッチング: ${matchedImageUrls.length}件`);
        // ▲▲▲ 効率的な画像出力ここまで ▲▲▲
        
        const latestVersion = await prisma.chat_message.findFirst({
            where: { turnId: turnId, role: 'model' },
            orderBy: { version: 'desc' }
        });
        await prisma.chat_message.updateMany({
            where: { turnId: turnId, role: 'model' },
            data: { isActive: false }
        });

        const newMessage = await prisma.chat_message.create({
            data: {
                chatId: chatId,
                role: 'model',
                content: aiReply,
                turnId: turnId,
                version: (latestVersion?.version || 0) + 1,
                isActive: true,
            }
        });

        return NextResponse.json({ newMessage, imageUrls: matchedImageUrls });

    } catch (error) {
        console.error("再生成APIエラー:", error);
        const errorMessage = error instanceof Error ? error.message : "内部サーバーエラーが発生しました。";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// --- メッセージの編集または表示バージョンの切り替え (PUT) ---
export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });

    const { messageId, newContent, turnId, activeMessageId } = await request.json();

    try {
        // 表示バージョンの切り替え
        if (turnId && activeMessageId) {
            await prisma.$transaction([
                prisma.chat_message.updateMany({
                    where: { turnId: turnId, role: 'model' },
                    data: { isActive: false },
                }),
                prisma.chat_message.update({
                    where: { id: activeMessageId },
                    data: { isActive: true },
                }),
            ]);
            return NextResponse.json({ success: true });
        }

        // メッセージ内容の編集
        if (messageId && newContent) {
            const updatedMessage = await prisma.chat_message.update({
                where: { id: messageId },
                data: { content: newContent },
            });
            return NextResponse.json(updatedMessage);
        }

        return NextResponse.json({ error: "無効なリクエストです。" }, { status: 400 });
    } catch (error) {
        console.error("メッセージ更新APIエラー:", error);
        return NextResponse.json({ error: "更新に失敗しました。" }, { status: 500 });
    }
}

// --- メッセージの削除 (DELETE) ---
export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });

    const body = await request.json();
    
    // 一括削除（再生成時に使用）
    if (body.messageIds && Array.isArray(body.messageIds)) {
        try {
            await prisma.chat_message.deleteMany({
                where: { id: { in: body.messageIds } }
            });
            return NextResponse.json({ message: `${body.messageIds.length}件のメッセージが削除されました。` });
        } catch (error) {
            console.error("一括メッセージ削除エラー:", error);
            return NextResponse.json({ error: "一括削除中にエラーが発生しました。" }, { status: 500 });
        }
    }

    const { messageId } = body;
    if (!messageId) return NextResponse.json({ error: "メッセージIDが必要です。" }, { status: 400 });

    try {
        const messageToDelete = await prisma.chat_message.findUnique({ where: { id: messageId } });
        if (!messageToDelete) return NextResponse.json({ error: "メッセージが見つかりません。" }, { status: 404 });

        // ユーザーメッセージが削除された場合、関連するAIメッセージも全て削除
        if (messageToDelete.role === 'user') {
            await prisma.chat_message.deleteMany({
                where: {
                    OR: [
                        { id: messageId },
                        { turnId: messageId, role: 'model' }
                    ]
                }
            });
        } else { // AIメッセージのみ削除
            await prisma.chat_message.delete({ where: { id: messageId } });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("メッセージ削除APIエラー:", error);
        return NextResponse.json({ error: "削除に失敗しました。" }, { status: 500 });
    }
}
