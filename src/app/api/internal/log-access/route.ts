export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { safeJsonParse } from '@/lib/api-helpers';

function pickCookie(cookieHeader: string, name: string): string | null {
  // Very small parser: split by ';', then by '='.
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
    const prisma = await getPrisma();

    // Resolve userId from NextAuth session cookie (works even when getServerSession isn't reliable here)
    let normalizedUserId: number | null = null;
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
        normalizedUserId = sessionRow?.userId ?? null;
      }
    } catch (sessionError) {
      console.warn('[internal/log-access] Failed to resolve userId from session:', sessionError);
      normalizedUserId = null;
    }

    // Create table if not exists
    try {
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
    } catch (tableError) {
      console.error('[internal/log-access] Failed to create table/indexes:', tableError);
      // Continue anyway - table might already exist
    }

    // Insert log entry (use parameterized query for safety)
    try {
      const safeIp = (ip || 'unknown').substring(0, 255);
      const safeUserAgent = (userAgent || 'unknown').substring(0, 500);
      const safePath = (path || 'unknown').substring(0, 500);
      const safeMethod = (method || 'GET').substring(0, 10);
      
      await prisma.$executeRawUnsafe(
        `INSERT INTO "api_access_logs" ("userId","ip","userAgent","path","method","statusCode","durationMs")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        normalizedUserId,
        safeIp,
        safeUserAgent,
        safePath,
        safeMethod,
        Number(statusCode) || 200,
        duration != null ? Number(duration) : null
      );
      console.log('[internal/log-access] Successfully inserted log:', { ip: safeIp, path: safePath, method: safeMethod, statusCode, userId: normalizedUserId });
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (insertError) {
      console.error('[internal/log-access] Failed to insert log entry:', insertError);
      console.error('[internal/log-access] Insert params:', { normalizedUserId, ip, userAgent, path, method, statusCode, duration });
      // Don't fail the request - logging is best-effort
      return NextResponse.json({ ok: false, error: String(insertError) }, { status: 200 });
    }
  } catch (error) {
    console.error('[internal/log-access] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}



