export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { safeJsonParse } from '@/lib/api-helpers';
import { getClientIpFromRequest } from '@/lib/security/client-ip';

function pickCookie(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(/;\s*/).filter(Boolean);
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq <= 0) continue;
    const k = p.slice(0, eq).trim();
    if (k !== name) continue;
    return p.slice(eq + 1).trim() || null;
  }
  return null;
}

/**
 * Public endpoint for logging page navigations reliably from the browser.
 * - Uses request headers (CloudFront/proxy) to resolve client IP.
 * - Uses NextAuth session cookie to resolve userId (best-effort).
 */
export async function POST(request: NextRequest) {
  const parseResult = await safeJsonParse<{
    path: string;
    referrer?: string;
  }>(request);
  if (!parseResult.success) return parseResult.error;

  const { path } = parseResult.data;
  const ip = getClientIpFromRequest(request) || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const prisma = await getPrisma();

    let userId: number | null = null;
    try {
      const cookieHeader = request.headers.get('cookie') || '';
      const token =
        pickCookie(cookieHeader, '__Secure-next-auth.session-token') ??
        pickCookie(cookieHeader, 'next-auth.session-token') ??
        null;
      if (token) {
        const sessionRow = await prisma.session.findUnique({
          where: { sessionToken: token },
          select: { userId: true },
        });
        userId = sessionRow?.userId ?? null;
      }
    } catch {
      userId = null;
    }

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
    await prisma.$executeRawUnsafe(`ALTER TABLE "api_access_logs" ADD COLUMN IF NOT EXISTS "userId" INTEGER`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_createdAt_idx" ON "api_access_logs" ("createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_ip_idx" ON "api_access_logs" ("ip")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_path_idx" ON "api_access_logs" ("path")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_userId_idx" ON "api_access_logs" ("userId")`);

    await prisma.$executeRaw`
      INSERT INTO "api_access_logs" ("userId","ip","userAgent","path","method","statusCode","durationMs")
      VALUES (${userId}, ${ip}, ${userAgent}, ${path || 'unknown'}, ${'NAVIGATE'}, ${200}, ${null})
    `;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[api/log-access] error:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

