import type { NextRequest } from 'next/server';

function firstForwardedFor(value: string): string | null {
  const first = value.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function parseCloudfrontViewerAddress(value: string): string | null {
  // cloudfront-viewer-address: "IP:PORT" (e.g. "203.0.113.1:12345" or "2001:db8::1:12345")
  // We only need the IP part.
  const v = value.trim();
  if (!v) return null;

  // IPv4:PORT
  const ipv4Match = v.match(/^([0-9]{1,3}(?:\.[0-9]{1,3}){3}):\d+$/);
  if (ipv4Match?.[1]) return ipv4Match[1];

  // IPv6:PORT (best-effort: take everything before last ':')
  const lastColon = v.lastIndexOf(':');
  if (lastColon > 0) {
    const maybeIp = v.slice(0, lastColon).trim();
    if (maybeIp) return maybeIp;
  }

  return null;
}

export function getClientIpFromRequest(request: NextRequest): string {
  // Prefer edge/CDN-provided single-IP headers when present
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp?.trim()) return cfConnectingIp.trim();

  const trueClientIp = request.headers.get('true-client-ip');
  if (trueClientIp?.trim()) return trueClientIp.trim();

  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp?.trim()) return xRealIp.trim();

  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const first = firstForwardedFor(xForwardedFor);
    if (first) return first;
  }

  const cloudfrontViewerAddress = request.headers.get('cloudfront-viewer-address');
  if (cloudfrontViewerAddress) {
    const parsed = parseCloudfrontViewerAddress(cloudfrontViewerAddress);
    if (parsed) return parsed;
  }

  return 'unknown';
}

export function isLocalOrPrivateIp(ip: string): boolean {
  const v = (ip || '').trim().toLowerCase();
  if (!v || v === 'unknown') return true;

  // IPv6 loopback
  if (v === '::1') return true;

  // IPv4 loopback
  if (v.startsWith('127.')) return true;

  // IPv4-mapped loopback
  if (v.startsWith('::ffff:127.')) return true;

  // IPv4 private ranges
  if (v.startsWith('10.')) return true;
  if (v.startsWith('192.168.')) return true;
  if (v.startsWith('169.254.')) return true; // link-local

  // 172.16.0.0/12
  if (v.startsWith('172.')) {
    const p = v.split('.')[1];
    const n = p ? Number.parseInt(p, 10) : NaN;
    if (Number.isFinite(n) && n >= 16 && n <= 31) return true;
  }

  // IPv6 unique local / link-local
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:')) return true;

  return false;
}
