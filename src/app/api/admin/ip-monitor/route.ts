export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';

/**
 * IP観察データを取得
 * GET /api/admin/ip-monitor
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const nickname = searchParams.get('nickname');
    const searchQuery = searchParams.get('query'); // ユーザー検索用
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const prisma = await getPrisma();

    // IPアドレス取得関数
    const getClientIp = (req: NextRequest): string => {
      const forwarded = req.headers.get('x-forwarded-for');
      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }
      const realIp = req.headers.get('x-real-ip');
      if (realIp) {
        return realIp.trim();
      }
      return req.ip || 'unknown';
    };

    // ユーザー検索（ID、メール、ニックネームで検索）
    if (userId || email || nickname || searchQuery) {
      let user;
      
      if (userId) {
        user = await prisma.users.findUnique({
          where: { id: parseInt(userId, 10) },
        });
      } else if (email) {
        user = await prisma.users.findUnique({
          where: { email },
        });
      } else if (nickname) {
        user = await prisma.users.findUnique({
          where: { nickname },
        });
      } else if (searchQuery) {
        // 検索クエリでID、メール、ニックネームを検索
        const queryNum = parseInt(searchQuery, 10);
        if (!isNaN(queryNum)) {
          user = await prisma.users.findUnique({
            where: { id: queryNum },
          });
        }
        
        if (!user) {
          user = await prisma.users.findFirst({
            where: {
              OR: [
                { email: { contains: searchQuery, mode: 'insensitive' } },
                { nickname: { contains: searchQuery, mode: 'insensitive' } },
              ],
            },
          });
        }

        // ユーザーが見つからない場合、ユーザー一覧を返す
        if (!user) {
          const users = await prisma.users.findMany({
            where: {
              OR: [
                { email: { contains: searchQuery, mode: 'insensitive' } },
                { nickname: { contains: searchQuery, mode: 'insensitive' } },
                { name: { contains: searchQuery, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              email: true,
              nickname: true,
              name: true,
              role: true,
              created_at: true,
            },
            take: 20,
            orderBy: { created_at: 'desc' },
          });

          return NextResponse.json({ users });
        }
      }

      if (!user) {
        return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
      }

      // ユーザーのセッション情報を取得（現在アクティブなセッション）
      const sessions = await prisma.session.findMany({
        where: { 
          userId: user.id,
          expires: { gt: new Date() }, // 有効なセッションのみ
        },
        orderBy: { expires: 'desc' },
        take: 10,
      });

      // 現在のリクエストIP（セッションにはIPが保存されていないため、現在のIPを表示）
      const currentIp = getClientIp(request);

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          registeredAt: user.created_at,
          role: user.role,
        },
        sessions: sessions.map(s => ({
          id: s.id,
          expires: s.expires,
          createdAt: s.expires, // 簡易実装
        })),
        currentIp, // 現在のリクエストIP
        accessLogs: [], // 将来の実装: アクセスログテーブルから取得
        message: 'セッション情報を表示しています。IPアドレスは将来の実装でアクセスログテーブルから取得されます。',
      });
    } else {
      // 全体的なIP統計 - 現在アクティブなセッションから集計
      const activeSessions = await prisma.session.findMany({
        where: {
          expires: { gt: new Date() },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nickname: true,
              role: true,
            },
          },
        },
        orderBy: { expires: 'desc' },
        take: limit,
      });

      // ユーザー別のアクティブセッション数
      const userSessionCounts = new Map<number, number>();
      activeSessions.forEach(session => {
        const count = userSessionCounts.get(session.userId) || 0;
        userSessionCounts.set(session.userId, count + 1);
      });

      // 管理者のセッション情報
      const adminSessions = activeSessions.filter(s => 
        s.user.role === 'ADMIN' || s.user.role === 'SUPER_ADMIN'
      );

      return NextResponse.json({
        totalUsers: await prisma.users.count(),
        activeSessions: activeSessions.length,
        adminSessions: adminSessions.length,
        recentSessions: activeSessions.slice(0, 50).map(s => ({
          userId: s.user.id,
          userEmail: s.user.email,
          userNickname: s.user.nickname,
          userRole: s.user.role,
          sessionId: s.id,
          expires: s.expires,
        })),
        ipStats: [], // 将来の実装: IP別統計
        message: '現在アクティブなセッション情報を表示しています。IPアドレスは将来の実装でアクセスログテーブルから取得されます。',
      });
    }
  } catch (error) {
    console.error('[IP Monitor] エラー:', error);
    return NextResponse.json({ error: '取得に失敗しました。' }, { status: 500 });
  }
}

