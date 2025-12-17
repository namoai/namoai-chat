export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse, safeJsonParse } from "@/lib/api-helpers";

function sanitizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str.trim().replace(/[<>]/g, '');
}

function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const phoneRegex = /^[\d\s()+\-]+$/;
  return phoneRegex.test(phone);
}

function deriveAge(birthdate?: string | null) {
  if (birthdate) {
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return {
      date: birth,
      declaredAdult: age >= 18 ? true : false,
      isMinor: age < 18,
    };
  }
  
  // 生年月日がない場合はnullを返す（後でセーフティフィルターOFF時に確認）
  return {
    date: null,
    declaredAdult: null,
    isMinor: true, // デフォルトは未成年として扱う
  };
}

// POST: Googleログイン後の追加情報登録
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  // Googleログインのみ許可
  if (!session.user.email) {
    return NextResponse.json({ error: 'Googleアカウントでログインしてください。' }, { status: 403 });
  }

  try {
    const parsed = await safeJsonParse<{
      name: string;
      nickname: string;
      phone: string;
      birthdate?: string | null;
    }>(request);
    
    if (!parsed.success) return parsed.error;
    
    const { name, nickname, phone, birthdate } = parsed.data;

    const sanitizedName = sanitizeString(name);
    const sanitizedNickname = sanitizeString(nickname);
    const sanitizedPhone = sanitizeString(phone);

    // バリデーション
    if (!sanitizedName || sanitizedName.trim().length === 0) {
      return NextResponse.json({ error: '氏名を入力してください。' }, { status: 400 });
    }
    if (!sanitizedNickname || sanitizedNickname.length < 2 || sanitizedNickname.length > 12) {
      return NextResponse.json({ error: 'ニックネームは2〜12文字で入力してください。' }, { status: 400 });
    }
    if (!sanitizedPhone || !validatePhone(sanitizedPhone)) {
      return NextResponse.json({ error: '電話番号の形式が不正です。' }, { status: 400 });
    }

    // 生年月日から年齢情報を取得
    const ageInfo = deriveAge(birthdate);

    const prisma = await getPrisma();
    const userId = parseInt(session.user.id, 10);

    // 既存ユーザー情報を確認
    const existingUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, needsProfileCompletion: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    if (!existingUser.needsProfileCompletion) {
      return NextResponse.json({ error: '既に登録が完了しています。' }, { status: 400 });
    }

    // ニックネーム重複チェック（自分以外）
    const nicknameConflict = await prisma.users.findFirst({
      where: {
        nickname: sanitizedNickname,
        id: { not: userId },
      },
    });

    if (nicknameConflict) {
      return NextResponse.json({ error: 'このニックネームは既に使用されています。' }, { status: 409 });
    }

    // 電話番号重複チェック（自分以外）
    const phoneConflict = await prisma.users.findFirst({
      where: {
        phone: sanitizedPhone,
        id: { not: userId },
      },
    });

    if (phoneConflict) {
      return NextResponse.json({ error: 'この電話番号は既に使用されています。' }, { status: 409 });
    }

    // ユーザー情報を更新
    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        name: sanitizedName,
        nickname: sanitizedNickname,
        phone: sanitizedPhone,
        dateOfBirth: ageInfo.date,
        declaredAdult: ageInfo.declaredAdult,
        safetyFilter: ageInfo.isMinor ? true : true,
        needsProfileCompletion: false, // 登録完了
      },
      select: { id: true, email: true, nickname: true },
    });

    console.log(`✅ Google会員登録完了: ${updated.email} (ID: ${updated.id})`);

    return NextResponse.json({ 
      success: true, 
      user: {
        id: updated.id,
        email: updated.email,
        nickname: updated.nickname,
      }
    });
  } catch (error: unknown) {
    console.error('Google会員登録完了エラー:', error);
    if (error && typeof error === 'object' && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'ニックネームまたは電話番号が既に使用されています。' }, { status: 409 });
    }
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

