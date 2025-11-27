import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { getPrisma } from "@/lib/prisma";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// 通知を削除する (DELETE)
export async function DELETE(req: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);
    const body = await req.json();
    const { notificationIds, deleteAll } = body;

    if (deleteAll) {
      // 全ての通知を削除
      await prisma.notifications.deleteMany({
        where: { userId },
      });

      return NextResponse.json({ success: true, message: "全ての通知を削除しました" });
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // 指定された通知を削除
      await prisma.notifications.deleteMany({
        where: {
          id: { in: notificationIds },
          userId, // セキュリティ: 自分の通知のみ削除可能
        },
      });

      return NextResponse.json({ success: true, message: "通知を削除しました" });
    } else {
      return NextResponse.json(
        { error: "notificationIds または deleteAll が必要です" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("通知削除エラー:", error);
    return NextResponse.json(
      { error: "通知の削除に失敗しました" },
      { status: 500 }
    );
  }
}

