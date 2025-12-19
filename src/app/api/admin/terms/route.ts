export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// --- ヘルパー関数 ---

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
function toIntOrNull(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (Number.isInteger(n)) return n;
  return null;
}
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ message, details }, { status: 400 });
}

/**
 * 約款管理権限 (MODERATOR または SUPER_ADMIN) があるか確認します。
 */
async function requireTermsManagementPermission() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  
  if (role !== Role.MODERATOR && role !== Role.SUPER_ADMIN) {
    return { 
      ok: false as const, 
      res: NextResponse.json({ message: '権限がありません。' }, { status: 403 }) 
    };
  }
  return { ok: true as const };
}

// ── GET /api/admin/terms ───────────────────────────────────────────────
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  const auth = await requireTermsManagementPermission();
  if (!auth.ok) return auth.res;

  const prisma = await getPrisma();
  const terms = await prisma.terms.findMany({
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json(terms);
}

// ── POST /api/admin/terms ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const auth = await requireTermsManagementPermission();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return badRequest('リクエストボディが空です。');
    }
    body = JSON.parse(text);
  } catch (parseError) {
    console.error("JSON解析エラー:", parseError);
    return badRequest('無効なJSON形式です。');
  }
  if (!body || typeof body !== 'object') return badRequest('無効なJSON形式です。');

  const { slug, title, content, displayOrder } = body as Record<string, unknown>;

  if (!isNonEmptyString(slug)) return badRequest('「スラッグ」は必須です。');
  if (!isNonEmptyString(title)) return badRequest('「タイトル」は必須です。');
  if (!isNonEmptyString(content)) return badRequest('「内容」は必須です。');

  const displayOrderInt = toIntOrNull(displayOrder) ?? 0;
  if (displayOrderInt < 0) {
    return badRequest('「表示順」は0以上の整数である必要があります。');
  }

  // slugのバリデーション（URLセーフな文字のみ）
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return badRequest('「スラッグ」は英数字とハイフンのみ使用できます。');
  }

  try {
    const prisma = await getPrisma();
    const created = await prisma.terms.create({
      data: { slug, title, content, displayOrder: displayOrderInt },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return badRequest('このスラッグは既に使用されています。');
    }
    console.error("約款作成エラー:", error);
    return NextResponse.json({ message: '約款の作成に失敗しました。' }, { status: 500 });
  }
}

// ── PUT /api/admin/terms ───────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const auth = await requireTermsManagementPermission();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return badRequest('リクエストボディが空です。');
    }
    body = JSON.parse(text);
  } catch (parseError) {
    console.error("JSON解析エラー:", parseError);
    return badRequest('無効なJSON形式です。');
  }
  if (!body || typeof body !== 'object') return badRequest('無効なJSON形式です。');

  const { id, slug, title, content, displayOrder } = body as Record<string, unknown>;

  const idInt = toIntOrNull(id);
  if (idInt === null || idInt <= 0) return badRequest('IDは正の整数である必要があります。');

  if (!isNonEmptyString(slug)) return badRequest('「スラッグ」は必須です。');
  if (!isNonEmptyString(title)) return badRequest('「タイトル」は必須です。');
  if (!isNonEmptyString(content)) return badRequest('「内容」は必須です。');

  const displayOrderInt = toIntOrNull(displayOrder) ?? 0;
  if (displayOrderInt < 0) {
    return badRequest('「表示順」は0以上の整数である必要があります。');
  }

  // slugのバリデーション
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return badRequest('「スラッグ」は英数字とハイフンのみ使用できます。');
  }

  try {
    const prisma = await getPrisma();
    const updated = await prisma.terms.update({
      where: { id: idInt },
      data: { slug, title, content, displayOrder: displayOrderInt },
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return badRequest('このスラッグは既に使用されています。');
    }
    console.error("約款更新エラー:", error);
    return NextResponse.json({ message: "更新に失敗しました。指定されたIDの約款が存在しない可能性があります。" }, { status: 500 });
  }
}

// ── DELETE /api/admin/terms ────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const auth = await requireTermsManagementPermission();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return badRequest('リクエストボディが空です。');
    }
    body = JSON.parse(text);
  } catch (parseError) {
    console.error("JSON解析エラー:", parseError);
    return badRequest('無効なJSON形式です。');
  }

  const idInt = body && typeof body === 'object' ? toIntOrNull((body as Record<string, unknown>).id) : null;
  if (idInt === null || idInt <= 0) return badRequest('IDは正の整数である必要があります。');

  try {
    const prisma = await getPrisma();
    await prisma.terms.delete({ where: { id: idInt } });
    return NextResponse.json({ message: '約款が正常に削除されました。' });
  } catch (error) {
    console.error("約款削除エラー:", error);
    return NextResponse.json({ message: "削除に失敗しました。指定されたIDの約款が存在しない可能性があります。" }, { status: 500 });
  }
}

