import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "next-auth/react"; // next-authのセッション取得方法に変更が必要な場合があります
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // authOptionsをインポート
import { VertexAI, HarmCategory, HarmBlockThreshold, Content } from "@google-cloud/vertexai";

// VertexAIクライアントの初期化 (既存のroute.tsからコピー)
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_PROJECT_ID,
  location: "us-central1",
});
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
];


/**
 * PUT: 既存のチャットメッセージ（ユーザーの質問とAIの回答）を更新する
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }

  const { turnId, userMessageContent, modelMessageContent } = await request.json();

  if (!turnId || !userMessageContent || !modelMessageContent) {
    return NextResponse.json({ error: "必須パラメータが不足しています。" }, { status: 400 });
  }

  try {
    // トランザクション内でユーザーメッセージとAIメッセージを更新
    const [updatedUserMessage, updatedModelMessage] = await prisma.$transaction([
      prisma.chat_message.update({
        where: { id: turnId },
        data: { content: userMessageContent },
      }),
      prisma.chat_message.updateMany({
        where: { turnId: turnId, isActive: true },
        data: { content: modelMessageContent },
      }),
    ]);

    // 実際に更新されたmodelMessageを取得して返す
    const finalModelMessage = await prisma.chat_message.findFirst({
        where: { turnId: turnId, isActive: true }
    });


    return NextResponse.json({ userMessage: updatedUserMessage, modelMessage: finalModelMessage });
  } catch (error) {
    console.error("メッセージ編集エラー:", error);
    return NextResponse.json({ error: "メッセージの編集に失敗しました。" }, { status: 500 });
  }
}

/**
 * DELETE: 特定のターン（ユーザーの質問とそれに関連するすべてのAI回答）を削除する
 */
export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }

    const { turnId } = await request.json();

    if (!turnId) {
        return NextResponse.json({ error: "turnIdが必要です。" }, { status: 400 });
    }

    try {
        // ターンIDに関連するすべてのメッセージ（ユーザーの質問 + AIの全バージョンの回答）を削除
        await prisma.chat_message.deleteMany({
            where: {
                OR: [
                    { id: turnId },
                    { turnId: turnId }
                ]
            }
        });

        return NextResponse.json({ success: true, message: "ターンが正常に削除されました。" });
    } catch (error) {
        console.error("メッセージ削除エラー:", error);
        return NextResponse.json({ error: "メッセージの削除に失敗しました。" }, { status: 500 });
    }
}


/**
 * POST: AIの回答を再生成する
 */
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }

    const { chatId, turnId } = await request.json();
     if (!chatId || !turnId ) {
        return NextResponse.json({ error: "chatIdとturnIdは必須です。" }, { status: 400 });
    }

    try {
        // --- ポイント消費ロジック (通常のメッセージ送信と同様) ---
        const totalPointsToConsume = 1; // 再生成は基本コスト1Pのみ
        await prisma.$transaction(async (tx) => {
            const userPointsRecord = await tx.points.findUnique({ where: { user_id: parseInt(userId, 10) } });
            const currentUserPoints = (userPointsRecord?.free_points || 0) + (userPointsRecord?.paid_points || 0);
            if (currentUserPoints < totalPointsToConsume) {
                throw new Error("ポイントが不足しています。");
            }
            let freePointsAfter = Math.max(0, (userPointsRecord?.free_points || 0) - totalPointsToConsume);
            let remainingCost = Math.max(0, totalPointsToConsume - (userPointsRecord?.free_points || 0));
            let paidPointsAfter = Math.max(0, (userPointsRecord?.paid_points || 0) - remainingCost);
            await tx.points.update({
                where: { user_id: parseInt(userId, 10) },
                data: { free_points: freePointsAfter, paid_points: paidPointsAfter },
            });
        });


        // --- 再生成のための履歴とシステムプロンプトを構築 ---
        const chatRoom = await prisma.chat.findUnique({
            where: { id: chatId },
            include: { characters: { include: { characterImages: true } }, users: { select: { defaultPersonaId: true } } },
        });
        if (!chatRoom || !chatRoom.characters) return NextResponse.json({ error: "チャットまたはキャラクターが見つかりません。", status: 404 });

        // turnIdまでのアクティブなメッセージのみを履歴として使用
        const messagesUntilTurn = await prisma.chat_message.findMany({
            where: {
                chatId: chatId,
                isActive: true,
                createdAt: {
                    lt: (await prisma.chat_message.findUnique({ where: { id: turnId } }))?.createdAt,
                }
            },
            orderBy: { createdAt: 'asc' },
        });

        const userMessageToRegenerate = await prisma.chat_message.findUnique({ where: { id: turnId } });
        if (!userMessageToRegenerate) return NextResponse.json({ error: "再生成対象のメッセージが見つかりません。", status: 404 });


        // システムプロンプト構築 (既存のroute.tsからロジックを流用)
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
        let userNoteInstruction = chatRoom.userNote ? `# ユーザーノート\n${chatRoom.userNote}` : "";
        const roleplayInstruction = `# ロールプレイルール\n- 行動や状況描写はアスタリスク(*)で囲む。\n- セリフは鍵括弧「」で囲む。`;

        const systemInstruction = `あなたは以下の設定を持つキャラクターとしてロールプレイを行ってください。
        # あなた(AI)のキャラクター設定
        - 詳細設定: ${char.detailSetting || "設定なし"}
        ${imageInstructions}
        ${userPersonaInfo}
        ${userNoteInstruction}
        ${roleplayInstruction}`.trim();

        // --- AIへのリクエスト ---
        const chatHistory: Content[] = messagesUntilTurn.map((msg) => ({ role: msg.role as "user" | "model", parts: [{ text: msg.content }] }));

        const generativeModel = vertex_ai.getGenerativeModel({ model: "gemini-2.5-pro", safetySettings });
        const chat = generativeModel.startChat({
            history: chatHistory,
            systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
        });

        const result = await chat.sendMessage(userMessageToRegenerate.content);
        const aiReply = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiReply) {
            return NextResponse.json({ error: "モデルから有効な応答がありませんでした。" }, { status: 500 });
        }

        // --- データベースへの保存 ---
        // 既存の回答を非アクティブ化し、新しい回答をアクティブとして追加
        const latestVersion = await prisma.chat_message.aggregate({
            _max: { version: true },
            where: { turnId: turnId },
        });
        const newVersion = (latestVersion._max.version || 0) + 1;

        const [, newModelMessage] = await prisma.$transaction([
            prisma.chat_message.updateMany({
                where: { turnId: turnId },
                data: { isActive: false },
            }),
            prisma.chat_message.create({
                data: {
                    chatId: chatId,
                    role: "model",
                    content: aiReply,
                    turnId: turnId,
                    version: newVersion,
                    isActive: true,
                },
            }),
        ]);

        return NextResponse.json({ reply: newModelMessage });

    } catch (error) {
        console.error("回答再生成エラー:", error);
        const errorMessage = error instanceof Error ? error.message : "内部サーバーエラーが発生しました。";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
