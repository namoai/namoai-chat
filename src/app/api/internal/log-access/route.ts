export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { safeJsonParse } from '@/lib/api-helpers';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

/**
 * Internal endpoint used by middleware to persist API access logs for admin IP monitor.
 */
export async function POST(request: NextRequest) {
  const parseResult = await safeJsonParse<{
    ip: string;
    userAgent: string;
    path: string;
    method: string;
    statusCode: number;
    duration?: number;
  }>(request);
  if (!parseResult.success) return parseResult.error;

  const { ip, userAgent, path, method, statusCode, duration } = parseResult.data;

  try {
    const session = await getServerSession(authOptions);
    const userId =
      typeof session?.user?.id === 'number'
        ? session.user.id
        : typeof session?.user?.id === 'string'
          ? Number(session.user.id)
          : null;
    const normalizedUserId = Number.isFinite(userId) ? Number(userId) : null;

    const prisma = await getPrisma();

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "api_access_logs" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER,
        "ip" TEXT NOT NULL,
        "userAgent" TEXT NOT NULL,
        "path" TEXT NOT NULL,
        "method" TEXT NOT NULL,
        "statusCode" INTEGER NOT NULL,
        "durationMs" INTEGER,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
    // Backward-compatible: ensure column exists even if table was created earlier.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "api_access_logs" ADD COLUMN IF NOT EXISTS "userId" INTEGER`
    );
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_createdAt_idx" ON "api_access_logs" ("createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_ip_idx" ON "api_access_logs" ("ip")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_path_idx" ON "api_access_logs" ("path")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_userId_idx" ON "api_access_logs" ("userId")`);

    await prisma.$executeRaw`
      INSERT INTO "api_access_logs" ("userId","ip","userAgent","path","method","statusCode","durationMs")
      VALUES (${normalizedUserId}, ${ip || 'unknown'}, ${userAgent || 'unknown'}, ${path || 'unknown'}, ${method || 'GET'}, ${Number(statusCode) || 0}, ${duration != null ? Number(duration) : null})
    `;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[internal/log-access] error:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}



