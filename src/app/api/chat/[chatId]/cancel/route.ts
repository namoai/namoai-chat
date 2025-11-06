import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

// 生成中にページを離脱した場合のメッセージ削除とポイント返金
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const { chatId } = await params;
  const chatIdNum = parseInt(chatId, 10);
  if (isNaN(chatIdNum)) {
    return NextResponse.json({ error: '無効なチャットIDです。' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const turnIdParam = searchParams.get('turnId');
  const refundParam = searchParams.get('refund');

  if (!turnIdParam || refundParam !== 'true') {
    return NextResponse.json({ error: 'パラメータが不正です。' }, { status: 400 });
  }

  const turnId = parseInt(turnIdParam, 10);
  if (isNaN(turnId)) {
    return NextResponse.json({ error: '無効なターンIDです。' }, { status: 400 });
  }

  try {
    // チャットの所有者確認
    const chat = await prisma.chat.findUnique({
      where: { id: chatIdNum },
      select: { userId: true },
    });

    if (!chat) {
      return NextResponse.json({ error: 'チャットが見つかりません。' }, { status: 404 });
    }

    if (chat.userId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    // ユーザーメッセージと関連するAIメッセージを削除
    const deletedMessages = await prisma.chat_message.deleteMany({
      where: {
        OR: [
          { id: turnId, role: 'user' },
          { turnId: turnId, role: 'model' },
        ],
      },
    });

    // ポイント返金（1ポイント）
    const userId = parseInt(session.user.id, 10);
    await prisma.$transaction(async (tx) => {
      const points = await tx.points.findUnique({ where: { user_id: userId } });
      if (points) {
        // 無料ポイントを優先して返金
        await tx.points.update({
          where: { user_id: userId },
          data: {
            free_points: (points.free_points || 0) + 1,
          },
        });
      }
    });

    return NextResponse.json({ 
      success: true, 
      deletedCount: deletedMessages.count,
      message: 'メッセージが削除され、ポイントが返金されました。'
    });
  } catch (error) {
    console.error('キャンセル処理エラー:', error);
    return NextResponse.json({ error: '内部サーバーエラーが発生しました。' }, { status: 500 });
  }
}

