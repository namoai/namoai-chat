import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";

// ユーザー削除 API (会員退会APIと同じロジック)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        // 管理者権限チェック
        if (!session || session.user?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: "権限がありません。" }, { status: 403 });
        }

        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: "ユーザーIDが必要です。" }, { status: 400 });
        }

        // トランザクションで全てのユーザー関連データを削除
        await prisma.$transaction(async (tx) => {
            // 1. ユーザーが作成したキャラクターの作成者を匿名化（キャラクターは残す）
            await tx.characters.updateMany({
                where: { author_id: userId },
                data: { author_id: null },
            });

            // 2. ユーザーのお気に入りを削除
            await tx.favorites.deleteMany({
                where: { user_id: userId },
            });

            // 3. ユーザーのインタラクションを削除
            await tx.interactions.deleteMany({
                where: { user_id: userId },
            });

            // 4. ユーザーのコメントを削除
            await tx.comments.deleteMany({
                where: { authorId: userId },
            });

            // 5. ユーザーのペルソナを削除
            await tx.personas.deleteMany({
                where: { authorId: userId },
            });

            // 6. ユーザーのチャットメッセージを削除
            const userChats = await tx.chat.findMany({
                where: { userId: userId },
                select: { id: true },
            });
            const chatIds = userChats.map(chat => chat.id);
            
            if (chatIds.length > 0) {
                await tx.chat_message.deleteMany({
                    where: { chatId: { in: chatIds } },
                });
            }

            // 7. ユーザーのチャットを削除
            await tx.chat.deleteMany({
                where: { userId: userId },
            });

            // 8. ユーザーのフォロー関係を削除
            await tx.follows.deleteMany({
                where: {
                    OR: [
                        { followerId: userId },
                        { followingId: userId },
                    ],
                },
            });

            // 9. ユーザーのブロック関係を削除
            await tx.block.deleteMany({
                where: {
                    OR: [
                        { blockerId: userId },
                        { blockingId: userId },
                    ],
                },
            });

            // 10. ユーザーのポイントを削除
            await tx.points.deleteMany({
                where: { user_id: userId },
            });

            // 11. ユーザーのセッションを削除
            await tx.session.deleteMany({
                where: { userId: userId },
            });

            // 12. ユーザーのアカウント接続を削除
            await tx.account.deleteMany({
                where: { userId: userId },
            });

            // 13. 最後にユーザー自身を削除
            await tx.users.delete({
                where: { id: userId },
            });
        });

        return NextResponse.json({ 
            success: true, 
            message: "ユーザーを削除しました。"
        });
    } catch (error) {
        console.error("ユーザー削除エラー:", error);
        return NextResponse.json({ error: "削除処理中にエラーが発生しました。" }, { status: 500 });
    }
}

