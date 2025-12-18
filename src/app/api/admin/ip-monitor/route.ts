export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';
import { getClientIpFromRequest, isLocalOrPrivateIp } from '@/lib/security/client-ip';

function pickHeader(request: NextRequest, name: string): string | null {
  const v = request.headers.get(name);
  if (!v) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

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

    const resolvedIp = getClientIpFromRequest(request);
    const ipDebug = {
      resolvedIp,
      // Common proxy/CDN headers
      cfConnectingIp: pickHeader(request, 'cf-connecting-ip'),
      trueClientIp: pickHeader(request, 'true-client-ip'),
      xForwardedFor: pickHeader(request, 'x-forwarded-for'),
      xRealIp: pickHeader(request, 'x-real-ip'),
      forwarded: pickHeader(request, 'forwarded'),
      cloudfrontViewerAddress: pickHeader(request, 'cloudfront-viewer-address'),
      // AWS/CloudFront hints (safe)
      via: pickHeader(request, 'via'),
      xAmznTraceId: pickHeader(request, 'x-amzn-trace-id'),
      xAmzCfId: pickHeader(request, 'x-amz-cf-id'),
      host: pickHeader(request, 'host'),
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

      // NOTE: This is the IP of the *admin's current request*, not the searched user's IP.
      const currentIp = resolvedIp;

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
        ipDebug,
        // Access logs are stored by middleware in api_access_logs
        accessLogs: [], // filled below (best-effort)
        message: 'セッション情報を表示しています。',
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
        s.user.role === Role.SUPER_ADMIN
      );

      // Pull recent access logs (best-effort). Table is created by internal logging route.
      let ipStats: Array<{ ip: string; count: number }> = [];
      let internalIpStats: Array<{ ip: string; count: number }> = [];
      let rawTopIps: Array<{ ip: string; count: number }> = [];
      let recentLogSamples: Array<{ ip: string; path: string; createdAt: string }> = [];
      try {
        // Ensure table exists (so first-time admin visit doesn't silently show empty due to missing table)
        await prisma.$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS "api_access_logs" (
            "id" SERIAL PRIMARY KEY,
            "ip" TEXT NOT NULL,
            "userAgent" TEXT NOT NULL,
            "path" TEXT NOT NULL,
            "method" TEXT NOT NULL,
            "statusCode" INTEGER NOT NULL,
            "durationMs" INTEGER,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`
        );
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_createdAt_idx" ON "api_access_logs" ("createdAt")`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_ip_idx" ON "api_access_logs" ("ip")`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_path_idx" ON "api_access_logs" ("path")`);

        const recent: Array<{ ip: string }> = await prisma.$queryRawUnsafe(
          `SELECT "ip" FROM "api_access_logs" WHERE "createdAt" > NOW() - INTERVAL '24 hours' ORDER BY "createdAt" DESC LIMIT 2000`
        );
        const counts = new Map<string, number>();
        for (const row of recent) {
          const key = String((row as { ip?: unknown }).ip || 'unknown');
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        const all = Array.from(counts.entries())
          .map(([ip, count]) => ({ ip, count }))
          .sort((a, b) => b.count - a.count);

        rawTopIps = all.slice(0, 30);

        // Separate internal/loopback/private IPs so AWS environments don't look "broken"
        // when most traffic comes from internal server-side fetches.
        ipStats = all.filter((x) => !isLocalOrPrivateIp(x.ip)).slice(0, 30);
        internalIpStats = all.filter((x) => isLocalOrPrivateIp(x.ip)).slice(0, 30);

        const sampleRows: Array<{ ip: string; path: string; createdAt: string }> = await prisma.$queryRawUnsafe(
          `SELECT "ip","path", to_char("createdAt", 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as "createdAt"
           FROM "api_access_logs"
           ORDER BY "createdAt" DESC
           LIMIT 50`
        );
        recentLogSamples = sampleRows.map((r) => ({
          ip: String((r as { ip?: unknown }).ip || 'unknown'),
          path: String((r as { path?: unknown }).path || 'unknown'),
          createdAt: String((r as { createdAt?: unknown }).createdAt || ''),
        }));
      } catch {
        ipStats = [];
        internalIpStats = [];
        rawTopIps = [];
        recentLogSamples = [];
      }

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
        ipStats,
        internalIpStats,
        rawTopIps,
        recentLogSamples,
        ipDebug,
        message: '現在アクティブなセッション情報と、直近24時間のAPIアクセスIP統計を表示しています。',
      });
    }
  } catch (error) {
    console.error('[IP Monitor] エラー:', error);
    return NextResponse.json({ error: '取得に失敗しました。' }, { status: 500 });
  }
}

