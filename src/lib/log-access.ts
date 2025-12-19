/**
 * Helper function to log API access directly from API routes.
 * This is more reliable than middleware's fetch-based logging, especially in AWS/Lambda environments.
 */

import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getClientIpFromRequest } from '@/lib/security/client-ip';

// Helper to extract IP from Request or NextRequest
function extractClientIp(request: Request | NextRequest): string {
  const headers = request.headers;
  // Try various headers that might contain the real client IP
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    // Return the first IP (original client IP)
    if (ips[0]) return ips[0];
  }
  
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;
  
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;
  
  const trueClientIp = headers.get('true-client-ip');
  if (trueClientIp) return trueClientIp;
  
  // Fallback for serverless environments
  return 'unknown';
}

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
 * Log API access directly to database.
 * This should be called from API routes (not middleware) for reliable logging in serverless environments.
 * Works with both Request and NextRequest types.
 */
export async function logApiAccess(
  request: Request | NextRequest,
  options: {
    statusCode: number;
    duration?: number;
    userId?: number | null;
  }
): Promise<void> {
  try {
    const prisma = await getPrisma();
    
    // Extract request details
    const requestUrl = request instanceof Request ? new URL(request.url) : request.nextUrl;
    const headers = request.headers;
    const method = request.method;
    const ip = extractClientIp(request);
    const userAgent = headers.get('user-agent') || 'unknown';
    const path = requestUrl.pathname;

    // Resolve userId from NextAuth session cookie if not provided
    let normalizedUserId: number | null = options.userId ?? null;
    if (!normalizedUserId) {
      try {
        const cookieHeader = headers.get('cookie') || '';
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
        // Ignore session resolution errors
      }
    }

    // Create table if not exists (best-effort)
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
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "api_access_logs" ADD COLUMN IF NOT EXISTS "userId" INTEGER`
      );
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_createdAt_idx" ON "api_access_logs" ("createdAt")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_ip_idx" ON "api_access_logs" ("ip")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_path_idx" ON "api_access_logs" ("path")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_access_logs_userId_idx" ON "api_access_logs" ("userId")`);
    } catch (tableError) {
      // Table might already exist, continue
    }

    // Insert log entry
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
      Number(options.statusCode) || 200,
      options.duration != null ? Number(options.duration) : null
    );
  } catch (error) {
    // Silently fail - logging is best-effort and should not break API responses
    console.warn('[log-access] Failed to log API access:', error);
  }
}

