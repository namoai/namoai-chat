export const runtime = 'nodejs';

import { prisma } from "@/lib/prisma";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import bcrypt from 'bcrypt';
import { validatePassword } from '@/lib/password-policy';
import { changePasswordSchema } from '@/lib/validation';
import { handleError } from '@/lib/error-handler';

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const userId = parseInt(session.user.id, 10);

    // バリデーション
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '入力値が不正です。', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    // ユーザーにパスワードが設定されているかを確認します。
    // OAuthなどで登録したユーザーはパスワードがnullの場合があるため、このチェックが必要です。
    if (!user.password) {
      return NextResponse.json({ error: 'パスワードが設定されていないため、変更できません。SNSアカウントでログインしている可能性があります。' }, { status: 400 });
    }

    // 現在のパスワード検証
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: '現在のパスワードが正しくありません。' }, { status: 400 });
    }

    // 新しいパスワードが現在のパスワードと同じでないかチェック
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return NextResponse.json({ error: '新しいパスワードは現在のパスワードと異なる必要があります。' }, { status: 400 });
    }

    // パスワードポリシー検証
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'パスワードがポリシーを満たしていません。', 
          details: passwordValidation.errors,
          warnings: passwordValidation.warnings,
        },
        { status: 400 }
      );
    }

    // パスワードをハッシュ化して保存
    const hashedNewPassword = await bcrypt.hash(newPassword, 12); // bcrypt roundsを12に増加

    await prisma.users.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return NextResponse.json({ 
      message: 'パスワードが正常に変更されました。',
      strength: passwordValidation.strength,
      score: passwordValidation.score,
    });

  } catch (error) {
    return handleError(error, request as NextRequest, session.user.id);
  }
}