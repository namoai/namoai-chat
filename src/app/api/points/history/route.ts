export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';

// ポイント取引履歴を取得
export async function GET(request: NextRequest) {
  await ensureEnvVarsLoaded();

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const type = searchParams.get('type'); // 'earn' or 'spend' or 'all'

    const prisma = await getPrisma();

    // When type is 'all', we need to fetch more records to ensure proper pagination
    // after combining and sorting. Fetch enough to cover offset + limit.
    const fetchLimit = type === 'all' || !type ? (offset + limit) * 2 : limit + offset;

    // 取得履歴
    let earnTransactions: Array<{
      id: number;
      type: string;
      amount: number;
      balance: number;
      source: string;
      description: string | null;
      acquired_at: Date;
      expires_at: Date;
      created_at: Date;
    }> = [];
    if (type === 'earn' || type === 'all' || !type) {
      earnTransactions = await prisma.point_transactions.findMany({
        where: {
          user_id: userId,
        },
        orderBy: { created_at: 'desc' },
        take: type === 'earn' ? limit + offset : fetchLimit,
        skip: type === 'earn' ? offset : 0,
        select: {
          id: true,
          type: true,
          amount: true,
          balance: true,
          source: true,
          description: true,
          acquired_at: true,
          expires_at: true,
          created_at: true,
        },
      });
    }

    // 使用履歴
    let usageHistory: Array<{
      id: number;
      points_used: number;
      usage_type: string;
      description: string | null;
      related_chat_id: number | null;
      related_message_id: number | null;
      created_at: Date;
    }> = [];
    if (type === 'spend' || type === 'all' || !type) {
      usageHistory = await prisma.point_usage_history.findMany({
        where: {
          user_id: userId,
        },
        orderBy: { created_at: 'desc' },
        take: type === 'spend' ? limit + offset : fetchLimit,
        skip: type === 'spend' ? offset : 0,
        select: {
          id: true,
          points_used: true,
          usage_type: true,
          description: true,
          related_chat_id: true,
          related_message_id: true,
          transaction_details: true,
          created_at: true,
        },
      });
    }

    // 統合して時系列順にソート
    const allHistory = [
      ...earnTransactions.map((t) => ({
        ...t,
        category: 'earn' as const,
        points: t.amount,
      })),
      ...usageHistory.map((u) => ({
        ...u,
        category: 'spend' as const,
        points: u.points_used,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // ページネーション用の総数
    const [earnCount, spendCount] = await Promise.all([
      type === 'earn' || type === 'all' || !type
        ? prisma.point_transactions.count({ where: { user_id: userId } })
        : 0,
      type === 'spend' || type === 'all' || !type
        ? prisma.point_usage_history.count({ where: { user_id: userId } })
        : 0,
    ]);

    // Apply pagination to the combined and sorted result
    const paginatedHistory = allHistory.slice(offset, offset + limit);

    return NextResponse.json({
      history: paginatedHistory,
      total: earnCount + spendCount,
      hasMore: offset + limit < earnCount + spendCount,
    });
  } catch (error) {
    console.error('ポイント履歴取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
