import { NextResponse, NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextauth";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// URLからチャットIDを抽出するヘルパー関数
function extractChatId(url: string): number | null {
    const segments = url.split('/');
    const noteIndex = segments.indexOf('note');
    if (noteIndex > 1) {
        const idStr = segments[noteIndex - 1];
        const id = parseInt(idStr, 10);
        return isNaN(id) ? null : id;
    }
    return null;
}

// PATCH: 特定のチャットのユーザーノートを更新します
export async function PATCH(request: NextRequest) {
    if (isBuildTime()) return buildTimeResponse();
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "認証されていません。" }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);

    const chatId = extractChatId(request.url);
    if (chatId === null) {
        return NextResponse.json({ error: "無効なチャットIDです。" }, { status: 400 });
    }

    try {
        const prisma = await getPrisma();
        const { userNote } = await request.json();
        
        // userNoteが文字列であるかを確認
        if (typeof userNote !== 'string') {
            return NextResponse.json({ error: "ノートの内容が無効です。" }, { status: 400 });
        }

        // ▼▼▼【ここから修正】文字数制限の検証を追加 ▼▼▼
        const MAX_NOTE_LENGTH = 1000;
        if (userNote.length > MAX_NOTE_LENGTH) {
            return NextResponse.json(
                { error: `ユーザーノートは${MAX_NOTE_LENGTH}文字以内で入力してください。` },
                { status: 400 }
            );
        }
        // ▲▲▲【ここまで修正】▲▲▲

        // ユーザーがこのチャットの所有者であることを確認
        const chat = await prisma.chat.findFirst({
            where: {
                id: chatId,
                userId: userId,
            },
        });

        if (!chat) {
            return NextResponse.json({ error: "チャットが見つからないか、アクセス権がありません。" }, { status: 404 });
        }

        // ユーザーノートを更新
        const updatedChat = await prisma.chat.update({
            where: { id: chatId },
            data: { userNote: userNote },
        });

        return NextResponse.json({ success: true, userNote: updatedChat.userNote });

    } catch (error) {
        console.error("ユーザーノートの更新エラー:", error);
        return NextResponse.json({ error: "サーバーエラーが発生しました。" }, { status: 500 });
    }
}
