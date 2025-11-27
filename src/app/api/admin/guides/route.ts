export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { Role } from '@prisma/client'; // Role Enumをインポート
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
 * ▼▼▼ 変更点: 権限チェック関数を修正 ▼▼▼
 * ガイド管理権限 (MODERATOR または SUPER_ADMIN) があるか確認します。
 */
async function requireGuideManagementPermission() {
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

// ── GET /api/admin/guides ───────────────────────────────────────────────
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  const auth = await requireGuideManagementPermission();
  if (!auth.ok) return auth.res;

  const prisma = await getPrisma();
  const guides = await prisma.guides.findMany({
    orderBy: [{ mainCategory: 'asc' }, { subCategory: 'asc' }, { displayOrder: 'asc' }],
  });
  return NextResponse.json(guides);
}

// ── POST /api/admin/guides ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const auth = await requireGuideManagementPermission();
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

  const { mainCategory, subCategory, title, content, displayOrder } = body as Record<string, unknown>;

  if (!isNonEmptyString(mainCategory)) return badRequest('「大メニュー」は必須です。');
  if (!isNonEmptyString(subCategory)) return badRequest('「小メニュー」は必須です。');
  if (!isNonEmptyString(title)) return badRequest('「タイトル」は必須です。');
  if (!isNonEmptyString(content)) return badRequest('「内容」は必須です。');

  const displayOrderInt = toIntOrNull(displayOrder);
  if (displayOrderInt === null || displayOrderInt < 0) {
    return badRequest('「表示順」は0以上の整数である必要があります。');
  }

  const prisma = await getPrisma();
  const created = await prisma.guides.create({
    data: { mainCategory, subCategory, title, content, displayOrder: displayOrderInt },
  });
  return NextResponse.json(created, { status: 201 });
}

// ── PUT /api/admin/guides ───────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const auth = await requireGuideManagementPermission();
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

  const { id, mainCategory, subCategory, title, content, displayOrder } = body as Record<string, unknown>;

  const idInt = toIntOrNull(id);
  if (idInt === null || idInt <= 0) return badRequest('IDは正の整数である必要があります。');

  if (!isNonEmptyString(mainCategory)) return badRequest('「大メニュー」は必須です。');
  if (!isNonEmptyString(subCategory)) return badRequest('「小メニュー」は必須です。');
  if (!isNonEmptyString(title)) return badRequest('「タイトル」は必須です。');
  if (!isNonEmptyString(content)) return badRequest('「内容」は必須です。');

  const displayOrderInt = toIntOrNull(displayOrder);
  if (displayOrderInt === null || displayOrderInt < 0) {
    return badRequest('「表示順」は0以上の整数である必要があります。');
  }

  try {
    const prisma = await getPrisma();
    const updated = await prisma.guides.update({
      where: { id: idInt },
      data: { mainCategory, subCategory, title, content, displayOrder: displayOrderInt },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("ガイド更新エラー:", error);
    return NextResponse.json({ message: "更新に失敗しました。指定されたIDのガイドが存在しない可能性があります。" }, { status: 500 });
  }
}

// ── DELETE /api/admin/guides ────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const auth = await requireGuideManagementPermission();
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
    await prisma.guides.delete({ where: { id: idInt } });
    return NextResponse.json({ message: 'ガイドが正常に削除されました。' });
  } catch (error) {
    console.error("ガイド削除エラー:", error);
    return NextResponse.json({ message: "削除に失敗しました。指定されたIDのガイドが存在しない可能性があります。" }, { status: 500 });
  }
}
