export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { notifyOnInquiryResponse } from '@/lib/notifications'; // ★ 通知関数をインポート
import { isBuildTime, buildTimeResponse, safeJsonParse } from '@/lib/api-helpers';

// 通報状態更新 (PUT) - 管理者用
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const userRole = session.user.role;
  if (userRole !== 'MODERATOR' && userRole !== 'CHAR_MANAGER' && userRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: '管理者権限が必要です。' }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const reportId = parseInt(id, 10);
    const parseResult = await safeJsonParse<{ status: string; adminNotes?: string }>(request);
    if (!parseResult.success) return parseResult.error;
    const body = parseResult.data;
    const { status, adminNotes } = body;

    if (!status) {
      return NextResponse.json({ error: '状態は必須です。' }, { status: 400 });
    }

    const userId = parseInt(session.user.id, 10);

    const prisma = await getPrisma();
    const updatedReport = await prisma.reports.update({
      where: { id: reportId },
      data: {
        status,
        adminNotes: adminNotes || null,
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
      include: {
        reporter: true,
      },
    });

    // ★ お問い合わせが解決された場合、ユーザーに通知
    if (status === 'RESOLVED' && updatedReport.reporterId) {
      notifyOnInquiryResponse(updatedReport.id, updatedReport.reporterId).catch(err => 
        console.error('通知作成エラー:', err)
      );
    }

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (error) {
    console.error('通報状態更新エラー:', error);
    return NextResponse.json(
      { error: '通報状態更新中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

// 通報削除 (DELETE) - 管理者用
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const userRole = session.user.role;
  if (userRole !== 'MODERATOR' && userRole !== 'CHAR_MANAGER' && userRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: '管理者権限が必要です。' }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const reportId = parseInt(id, 10);

    await prisma.reports.delete({
      where: { id: reportId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('通報削除エラー:', error);
    return NextResponse.json(
      { error: '通報削除中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

