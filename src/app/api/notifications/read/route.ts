import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";

// 通知を既読にする (PUT)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);
    const body = await req.json();
    const { notificationIds, markAllAsRead } = body;

    if (markAllAsRead) {
      // 全ての通知を既読にする
      await prisma.notifications.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return NextResponse.json({ success: true, message: "全ての通知を既読にしました" });
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // 指定された通知を既読にする
      await prisma.notifications.updateMany({
        where: {
          id: { in: notificationIds },
          userId, // セキュリティ: 自分の通知のみ更新可能
        },
        data: { isRead: true },
      });

      return NextResponse.json({ success: true, message: "通知を既読にしました" });
    } else {
      return NextResponse.json(
        { error: "notificationIds または markAllAsRead が必要です" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("通知既読処理エラー:", error);
    return NextResponse.json(
      { error: "通知の既読処理に失敗しました" },
      { status: 500 }
    );
  }
}

