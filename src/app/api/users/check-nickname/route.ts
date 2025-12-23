export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse, safeJsonParse } from '@/lib/api-helpers';
import { sanitizeString } from '@/lib/validation';

/**
 * ニックネーム重複確認
 * POST /api/users/check-nickname
 * Body: { nickname: string }
 */
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const parseResult = await safeJsonParse<{ nickname: string }>(request);
    if (!parseResult.success) return parseResult.error;
    const { nickname } = parseResult.data;

    if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 12) {
      return NextResponse.json({ error: 'ニックネームは2〜12文字で入力してください。' }, { status: 400 });
    }

    const trimmedNickname = nickname.trim();
    const sanitizedNickname = sanitizeString(trimmedNickname);
    
    // sanitizeStringが空文字列を返した場合、元の値を使用（日本語文字が含まれている可能性があるため）
    if (!sanitizedNickname || sanitizedNickname.length === 0) {
      return NextResponse.json({ error: 'ニックネームが無効です。' }, { status: 400 });
    }
    
    // サニタイズ後の長さチェック
    if (sanitizedNickname.length < 2 || sanitizedNickname.length > 50) {
      return NextResponse.json({ error: 'ニックネームは2〜50文字で入力してください。' }, { status: 400 });
    }
    
    const prisma = await getPrisma();

    // 現在ログイン中のユーザーのニックネームか確認（編集時は自分のニックネームは重複として処理しない）
    let currentUserId: number | null = null;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        currentUserId = parseInt(session.user.id, 10);
      }
    } catch {
      // セッションがなくても継続進行（会員登録時）
    }

    const existingUser = await prisma.users.findFirst({
      where: {
        nickname: sanitizedNickname,
        ...(currentUserId ? { NOT: { id: currentUserId } } : {}), // 自分自身は除外
      },
    });

    if (existingUser) {
      return NextResponse.json({ available: false, message: 'このニックネームは既に使用されています。' }, { status: 200 });
    }

    return NextResponse.json({ available: true, message: 'このニックネームは使用可能です。' }, { status: 200 });
  } catch (error) {
    console.error('[Check Nickname] エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

