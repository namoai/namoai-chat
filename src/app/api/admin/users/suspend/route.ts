import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";

// ユーザー停止 API
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        // 管理者権限チェック
        if (!session || session.user?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: "権限がありません。" }, { status: 403 });
        }

        const { userId, days, reason } = await request.json();

        if (!userId || days === undefined || !reason) {
            return NextResponse.json({ error: "必須パラメータが不足しています。" }, { status: 400 });
        }

        // 停止期限を計算
        let suspendedUntil: Date | null = null;
        if (days === -1) {
            // 永久停止 (100年後に設定)
            suspendedUntil = new Date();
            suspendedUntil.setFullYear(suspendedUntil.getFullYear() + 100);
        } else if (days > 0) {
            suspendedUntil = new Date();
            suspendedUntil.setDate(suspendedUntil.getDate() + days);
        }

        // ユーザーを停止
        const updatedUser = await prisma.users.update({
            where: { id: userId },
            data: {
                suspendedUntil: suspendedUntil,
                suspensionReason: reason,
            },
        });

        return NextResponse.json({ 
            success: true, 
            message: "ユーザーを停止しました。",
            user: {
                id: updatedUser.id,
                suspendedUntil: updatedUser.suspendedUntil,
                suspensionReason: updatedUser.suspensionReason,
            }
        });
    } catch (error) {
        console.error("ユーザー停止エラー:", error);
        return NextResponse.json({ error: "停止処理中にエラーが発生しました。" }, { status: 500 });
    }
}

// ユーザー停止解除 API
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

        // 停止を解除
        const updatedUser = await prisma.users.update({
            where: { id: userId },
            data: {
                suspendedUntil: null,
                suspensionReason: null,
            },
        });

        return NextResponse.json({ 
            success: true, 
            message: "ユーザーの停止を解除しました。",
            user: {
                id: updatedUser.id,
            }
        });
    } catch (error) {
        console.error("停止解除エラー:", error);
        return NextResponse.json({ error: "解除処理中にエラーが発生しました。" }, { status: 500 });
    }
}

