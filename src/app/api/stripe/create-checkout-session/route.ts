export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';
import { isBuildTime, buildTimeResponse, safeJsonParse } from '@/lib/api-helpers';
import Stripe from 'stripe';
import { getUserSafetyContext } from '@/lib/age';

// Stripeインスタンス初期化
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY環境変数が設定されていません。');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia',
    });
  }
  return stripeInstance;
}

// ポイントパッケージ定義
const POINT_PACKAGES: Record<number, { points: number; amount: number }> = {
  100: { points: 100, amount: 1100 },
  250: { points: 250, amount: 2200 },
  700: { points: 700, amount: 5500 },
  1500: { points: 1500, amount: 11000 },
};

export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  await ensureEnvVarsLoaded();

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  const parseResult = await safeJsonParse<{ points: number }>(request);
  if (!parseResult.success) return parseResult.error;
  const { points } = parseResult.data;

  // ポイントパッケージ確認
  const packageInfo = POINT_PACKAGES[points];
  if (!packageInfo) {
    return NextResponse.json(
      { error: '無効なポイントパッケージです。' },
      { status: 400 }
    );
  }

  try {
    const prisma = await getPrisma();
    const { ageStatus } = await getUserSafetyContext(prisma, userId);
    if (ageStatus.isMinor) {
      return NextResponse.json(
        { error: '未成年のため決済できません。ポイント購入には親権者の同意が必要です。' },
        { status: 403 }
      );
    }
    const stripe = getStripe();

    // 決済レコード作成
    const payment = await prisma.payments.create({
      data: {
        user_id: userId,
        amount: packageInfo.amount,
        points: packageInfo.points,
        status: 'pending',
        currency: 'jpy',
      },
    });

    // アプリのURLを取得（環境変数またはリクエストから）
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (request.headers.get('origin') || 'http://localhost:3000');
    
    // Stripe Checkoutセッション作成
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: `${packageInfo.points}ポイント`,
              description: 'ポイント購入',
            },
            unit_amount: packageInfo.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/points?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/points?payment_cancelled=true`,
      client_reference_id: payment.id.toString(),
      metadata: {
        payment_id: payment.id.toString(),
        user_id: userId.toString(),
        points: packageInfo.points.toString(),
      },
    });
    
    console.log('Stripe Checkoutセッション作成:', {
      sessionId: checkoutSession.id,
      successUrl: `${appUrl}/payment/success?session_id=${checkoutSession.id}`,
      cancelUrl: `${appUrl}/payment/cancel`
    });

    // 決済レコードにセッションID保存
    await prisma.payments.update({
      where: { id: payment.id },
      data: { stripe_session_id: checkoutSession.id },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Stripe Checkoutセッション作成エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    return NextResponse.json(
      { 
        error: '決済セッションの作成に失敗しました。',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

