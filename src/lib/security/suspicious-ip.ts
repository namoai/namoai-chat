/**
 * Suspicious IP detection / blocking (minimal implementation).
 *
 * NOTE:
 * - `middleware.ts` imports `isIpBlocked` from here.
 * - Current project uses env var `IP_BLACKLIST` as a comma-separated list (see `/api/admin/ip-block`).
 * - Middleware runs in an edge-like environment, so keep this module dependency-free and fast.
 */

import type { NextRequest } from "next/server";

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extract client IP in a way that works in both Node + Edge runtimes.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // NOTE:
  // Some runtimes may expose `request.ip` at runtime, but NextRequest's public TypeScript type
  // does not include it, which breaks `next build` type-checking in CI (e.g. Amplify).
  // Stick to header-based extraction for build stability.
  return "unknown";
}

/**
 * Returns true if the given IP is blocked.
 *
 * Current behavior:
 * - Checks database `ip_block` table first.
 * - Falls back to `process.env.IP_BLACKLIST` (comma-separated list of IPs) for backward compatibility.
 * - Unknown/empty IP is treated as not blocked (to avoid false positives).
 */
export async function isIpBlocked(ip: string): Promise<boolean> {
  const normalized = (ip || "").trim();
  if (!normalized || normalized === "unknown") return false;

  const { ipMatches } = await import('@/lib/security/ip-match');

  // Try database first (if available)
  try {
    const { getPrisma } = await import('@/lib/prisma');
    const prisma = await getPrisma();
    
    // Get all blocked IPs from database using parameterized query
    // Note: ip_block table is created dynamically, so we use $queryRaw with type assertion
    let dbBlocks: Array<{ ip: string }> = [];
    try {
      dbBlocks = await prisma.$queryRaw<Array<{ ip: string }>>`
        SELECT "ip" FROM "ip_block" LIMIT 1000
      `;
    } catch {
      // Table might not exist yet, fall back to env var
      dbBlocks = [];
    }

    // Check if the IP matches any blocked pattern
    for (const block of dbBlocks) {
      if (ipMatches(normalized, block.ip)) {
        return true;
      }
    }
  } catch {
    // Database not available or table doesn't exist, fall back to env var
  }

  // Fallback to environment variable
  const blacklist = parseCsvEnv(process.env.IP_BLACKLIST);
  return blacklist.some((pattern) => ipMatches(normalized, pattern));
}


