/**
 * Suspicious IP detection / blocking (minimal implementation).
 *
 * NOTE:
 * - `middleware.ts` imports `isIpBlocked` from here.
 * - Current project uses env var `IP_BLACKLIST` as a comma-separated list (see `/api/admin/ip-block`).
 * - Middleware runs in an edge-like environment, so keep this module dependency-free and fast.
 */

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns true if the given IP is blocked.
 *
 * Current behavior:
 * - Uses `process.env.IP_BLACKLIST` (comma-separated list of IPs).
 * - Unknown/empty IP is treated as not blocked (to avoid false positives).
 */
export async function isIpBlocked(ip: string): Promise<boolean> {
  const normalized = (ip || "").trim();
  if (!normalized || normalized === "unknown") return false;

  const blacklist = parseCsvEnv(process.env.IP_BLACKLIST);
  const { ipMatches } = await import('@/lib/security/ip-match');
  return blacklist.some((pattern) => ipMatches(normalized, pattern));
}


