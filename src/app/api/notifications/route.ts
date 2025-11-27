export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { isBuildTime, buildTimeResponse, safeJsonParse } from "@/lib/api-helpers";

// 通知一覧取得 (GET)
export async function GET(req: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);
    const searchParams = req.nextUrl.searchParams;
    const isRead = searchParams.get("isRead");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // フィルター条件構築
    const where: { userId: number; isRead?: boolean } = { userId };
    if (isRead !== null) {
      where.isRead = isRead === "true";
    }

    // 通知取得
    const notifications = await prisma.notifications.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: {
          select: {
            id: true,
            nickname: true,
            image_url: true,
          },
        },
      },
    });

    // 未読数を取得
    const unreadCount = await prisma.notifications.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
      hasMore: notifications.length === limit,
    });
  } catch (error) {
    console.error("通知取得エラー:", error);
    return NextResponse.json(
      { error: "通知の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 通知作成 (POST) - 主にサーバーサイドで使用
export async function POST(req: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const parseResult = await safeJsonParse<{ userId: number; type: string; title: string; content: string; link?: string; actorId?: number; characterId?: number; commentId?: number; reportId?: number }>(req);
    if (!parseResult.success) return parseResult.error;
    const body = parseResult.data;
    const { userId, type, title, content, link, actorId, characterId, commentId, reportId } = body;

    // 必須フィールドのバリデーション
    if (!title || !content) {
      return NextResponse.json(
        { error: "titleとcontentは必須です" },
        { status: 400 }
      );
    }

    // 自分自身への通知は作成しない
    if (userId === actorId) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // データを構築
    const notificationData: {
      userId: number;
      type: string;
      title: string;
      content: string;
      link?: string | null;
      actorId?: number | null;
      characterId?: number | null;
      commentId?: number | null;
      reportId?: number | null;
    } = {
      userId,
      type,
      title,
      content,
    };

    if (link !== undefined) notificationData.link = link || null;
    if (actorId !== undefined) notificationData.actorId = actorId || null;
    if (characterId !== undefined) notificationData.characterId = characterId || null;
    if (commentId !== undefined) notificationData.commentId = commentId || null;
    if (reportId !== undefined) notificationData.reportId = reportId || null;

    const notification = await prisma.notifications.create({
      data: notificationData,
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("通知作成エラー:", error);
    return NextResponse.json(
      { error: "通知の作成に失敗しました" },
      { status: 500 }
    );
  }
}

