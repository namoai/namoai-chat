export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
function toIntOrNull(v: unknown) {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (Number.isInteger(n)) return n as number;
  return null;
}
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ message, details }, { status: 400 });
}

type RoleSession = {
  user?: {
    role?: string;
  };
} | null;

async function requireAdmin() {
  const session = (await getServerSession(authOptions)) as RoleSession;
  const role = session?.user?.role;
  if (role !== 'ADMIN') {
    return { ok: false as const, res: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }
  return { ok: true as const };
}

// ── GET /api/admin/guides ───────────────────────────────────────────────
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const guides = await prisma.guides.findMany({
    orderBy: [{ displayOrder: 'asc' }, { id: 'desc' }],
  });
  return NextResponse.json(guides);
}

// ── POST /api/admin/guides ──────────────────────────────────────────────
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON');

  const { mainCategory, subCategory, title, content, displayOrder } = body as Record<string, unknown>;

  if (!isNonEmptyString(mainCategory)) return badRequest('mainCategory is required');
  if (!isNonEmptyString(subCategory)) return badRequest('subCategory is required');
  if (!isNonEmptyString(title)) return badRequest('title is required');
  if (!isNonEmptyString(content)) return badRequest('content is required');

  const displayOrderInt = toIntOrNull(displayOrder);
  if (displayOrderInt === null || displayOrderInt < 0) {
    return badRequest('displayOrder must be a non-negative integer');
  }

  const created = await prisma.guides.create({
    data: { mainCategory, subCategory, title, content, displayOrder: displayOrderInt },
  });
  return NextResponse.json(created, { status: 201 });
}

// ── PUT /api/admin/guides ───────────────────────────────────────────────
export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON');

  const { id, mainCategory, subCategory, title, content, displayOrder } = body as Record<string, unknown>;

  const idInt = toIntOrNull(id);
  if (idInt === null || idInt <= 0) return badRequest('id must be a positive integer');

  if (!isNonEmptyString(mainCategory)) return badRequest('mainCategory is required');
  if (!isNonEmptyString(subCategory)) return badRequest('subCategory is required');
  if (!isNonEmptyString(title)) return badRequest('title is required');
  if (!isNonEmptyString(content)) return badRequest('content is required');

  const displayOrderInt = toIntOrNull(displayOrder);
  if (displayOrderInt === null || displayOrderInt < 0) {
    return badRequest('displayOrder must be a non-negative integer');
  }

  const updated = await prisma.guides.update({
    where: { id: idInt },
    data: { mainCategory, subCategory, title, content, displayOrder: displayOrderInt },
  });
  return NextResponse.json(updated);
}

// ── DELETE /api/admin/guides ────────────────────────────────────────────
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const idInt = body ? toIntOrNull((body as Record<string, unknown>).id) : null;
  if (idInt === null || idInt <= 0) return badRequest('id must be a positive integer');

  await prisma.guides.delete({ where: { id: idInt } });
  return NextResponse.json({ ok: true });
}