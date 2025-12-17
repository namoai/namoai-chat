export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from "@/lib/prisma";
// ▼▼▼ 変更点: Prismaの型とEnumを `@prisma/client` から正しくインポートします ▼▼▼
import { Prisma, Role } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse, safeJsonParse } from "@/lib/api-helpers";

// GET: ユーザーリストを取得します。検索クエリがあればフィルタリングします。
export async function GET(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  // ▼▼▼ 変更点: SUPER_ADMIN のみアクセスを許可します ▼▼▼
  if (session?.user?.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  try {
    const prisma = await getPrisma();
    const whereClause: Prisma.usersWhereInput = query ? {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { nickname: { contains: query, mode: 'insensitive' } },
      ],
    } : {};

    const users = await prisma.users.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        nickname: true,
        role: true,
        created_at: true,
        suspendedUntil: true,
        suspensionReason: true,
        phone: true,
        bio: true,
        emailVerified: true, // ✅ メール認証状態を追加
        lockedUntil: true, // ✅ アカウントロック期限を追加
        loginAttempts: true, // ✅ ログイン失敗回数を追加
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("ユーザーリスト取得エラー:", error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// PUT: ユーザーの役割を更新します
export async function PUT(request: NextRequest) {
    if (isBuildTime()) return buildTimeResponse();
    
    const session = await getServerSession(authOptions);
    // ▼▼▼ 変更点: SUPER_ADMIN のみアクセスを許可します ▼▼▼
    if (session?.user?.role !== Role.SUPER_ADMIN) {
        return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    try {
        const parseResult = await safeJsonParse<{ userId: number; newRole: Role }>(request);
        if (!parseResult.success) return parseResult.error;
        const { userId, newRole } = parseResult.data;

        // ▼▼▼ 変更点: 新しい役割がRole Enumに存在するか動的に検証します ▼▼▼
        if (!userId || !newRole || !Object.values(Role).includes(newRole)) {
            return NextResponse.json({ error: '無効なデータです。役割が存在しません。' }, { status: 400 });
        }

        const prisma = await getPrisma();
        const updatedUser = await prisma.users.update({
            where: { id: userId },
            data: { role: newRole }, // newRoleは既にRole型として検証済み
        });
        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("ユーザー役割更新エラー:", error);
        return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
    }
}