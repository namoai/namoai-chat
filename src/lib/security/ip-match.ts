/**
 * IP matching utilities for:
 * - exact match: "1.2.3.4"
 * - wildcard: "111.111.111.*"
 * - CIDR (IPv4): "111.111.111.0/24"
 *
 * NOTE: Kept dependency-free for middleware/edge usage.
 */

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function matchWildcardIpv4(ip: string, pattern: string): boolean {
  const ipParts = ip.split(".");
  const patParts = pattern.split(".");
  if (ipParts.length !== 4 || patParts.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const pat = patParts[i];
    if (pat === "*") continue;
    if (pat !== ipParts[i]) return false;
  }
  return true;
}

function matchCidrIpv4(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  if (!isValidIpv4(ip) || !isValidIpv4(base)) return false;
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0);
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

export function isSupportedPattern(pattern: string): boolean {
  const p = (pattern || "").trim();
  if (!p) return false;
  if (isValidIpv4(p)) return true;
  if (p.includes("*")) {
    // Only allow IPv4 wildcard patterns with "*" as full octet
    const parts = p.split(".");
    if (parts.length !== 4) return false;
    return parts.every((part) => part === "*" || (/^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255));
  }
  if (p.includes("/")) {
    const [base, bitsStr] = p.split("/");
    const bits = Number(bitsStr);
    return isValidIpv4(base) && Number.isInteger(bits) && bits >= 0 && bits <= 32;
  }
  // IPv6 not supported here (yet)
  return false;
}

export function ipMatches(ip: string, pattern: string): boolean {
  const target = (ip || "").trim();
  const p = (pattern || "").trim();
  if (!target || !p) return false;
  if (target === p) return true;
  if (p.includes("*")) return matchWildcardIpv4(target, p);
  if (p.includes("/")) return matchCidrIpv4(target, p);
  return false;
}



