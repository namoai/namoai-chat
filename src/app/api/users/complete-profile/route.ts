export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from "@/lib/prisma";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import { sanitizeString } from '@/lib/validation';

type Body = {
  nickname: string;
  phone: string;
  birthdate?: string;
  ageConfirmation: 'adult' | 'minor';
};

function validatePhone(phone: string) {
  const phoneRegex = /^[\d\s\-+()]+$/;
  if (phone.length < 5 || phone.length > 30) return false;
  if (!phoneRegex.test(phone)) return false;
  if (!/\d/.test(phone)) return false;
  return true;
}

function deriveAge(birthdate?: string | null, declaredAdult?: boolean) {
  const today = new Date();
  if (birthdate) {
    const d = new Date(birthdate);
    if (isNaN(d.getTime()) || d > today) throw new Error('生年月日が不正です。');
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
    if (age < 0 || age > 120) throw new Error('生年月日が不正です。');
    return { date: d, isMinor: age < 18, declaredAdult: age >= 18 ? declaredAdult : false };
  }
  if (typeof declaredAdult === 'boolean') {
    return { date: null, isMinor: declaredAdult === false, declaredAdult };
  }
  throw new Error('年齢区分を選択してください。');
}

export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  const userId = parseInt(session.user.id, 10);

  const prisma = await getPrisma();
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { nickname: true, phone: true, dateOfBirth: true, declaredAdult: true, needsProfileCompletion: true },
  });
  if (!user) return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });

  return NextResponse.json({
    nickname: user.nickname,
    phone: user.phone ?? '',
    birthdate: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '',
    ageConfirmation: user.declaredAdult === false ? 'minor' : 'adult',
    needsProfileCompletion: user.needsProfileCompletion,
  });
}

export async function PUT(request: Request) {
  if (isBuildTime()) return buildTimeResponse();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  const userId = parseInt(session.user.id, 10);

  const prisma = await getPrisma();
  let payload: Body;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 });
  }

  const nickname = sanitizeString(payload.nickname || '');
  const phone = sanitizeString(payload.phone || '');
  const ageConfirmation = payload.ageConfirmation;
  const birthdate = payload.birthdate || null;

  if (!nickname || nickname.length < 2 || nickname.length > 12) {
    return NextResponse.json({ error: 'ニックネームは2〜12文字で入力してください。' }, { status: 400 });
  }
  if (!phone || !validatePhone(phone)) {
    return NextResponse.json({ error: '電話番号の形式が不正です。' }, { status: 400 });
  }
  if (ageConfirmation !== 'adult' && ageConfirmation !== 'minor') {
    return NextResponse.json({ error: '年齢区分を選択してください。' }, { status: 400 });
  }

  let ageInfo;
  try {
    ageInfo = deriveAge(birthdate, ageConfirmation === 'adult');
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '年齢情報が不正です。' }, { status: 400 });
  }

  try {
    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        nickname,
        phone,
        dateOfBirth: ageInfo.date,
        declaredAdult: ageInfo.declaredAdult,
        safetyFilter: ageInfo.isMinor ? true : true,
        needsProfileCompletion: false,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, userId: updated.id });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'ニックネームまたは電話番号が既に使用されています。' }, { status: 409 });
    }
    console.error('プロフィール更新エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}



