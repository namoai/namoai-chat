import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { getPrisma } from "@/lib/prisma";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// 未読通知数取得 (GET) - ポーリング用の軽量エンドポイント
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const userId = parseInt(session.user.id);

    const unreadCount = await prisma.notifications.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error("未読数取得エラー:", error);
    return NextResponse.json({ unreadCount: 0 });
  }
}

