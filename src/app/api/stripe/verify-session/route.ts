export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import Stripe from 'stripe';

// Stripeインスタンス初期化
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY環境変数が設定されていません。');
    }
    stripeInstance = new Stripe(secretKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2024-11-20.acacia' as any,
    });
  }
  return stripeInstance;
}

export async function GET(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  await ensureEnvVarsLoaded();

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'セッションIDが必要です。' }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const prisma = await getPrisma();

    // Stripeセッション情報を取得
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ 
        completed: false, 
        payment_status: checkoutSession.payment_status 
      });
    }

    // 決済レコードを検索
    const paymentId = checkoutSession.metadata?.payment_id;
    if (!paymentId) {
      return NextResponse.json({ 
        completed: false, 
        error: '決済IDが見つかりません。' 
      });
    }

    const payment = await prisma.payments.findUnique({
      where: { id: parseInt(paymentId, 10) },
    });

    if (!payment) {
      return NextResponse.json({ 
        completed: false, 
        error: '決済レコードが見つかりません。' 
      });
    }

    // まだ完了していない場合は、手動で完了処理
    if (payment.status !== 'completed') {
      await prisma.payments.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          stripe_payment_id: checkoutSession.payment_intent as string,
          completed_at: new Date(),
        },
      });

      // ポイント管理システムを使用してポイント付与（point_transactionsテーブルに記録）
      const { grantPoints } = await import('@/lib/point-manager');
      
      await grantPoints({
        userId: payment.user_id,
        amount: payment.points,
        type: 'paid',
        source: 'purchase',
        description: `ポイント購入 - ¥${payment.amount.toLocaleString()}`,
        paymentId: payment.id,
      });

      console.log(`手動で決済完了処理: Payment ID ${payment.id}, User ID ${payment.user_id}, Points ${payment.points}`);

      // 紹介報酬処理（初回決済の場合）
      const { processReferralReward } = await import('@/lib/referral');
      const rewardProcessed = await processReferralReward(payment.user_id, payment.id);
      
      if (rewardProcessed) {
        console.log(`紹介報酬付与完了: Payment ID ${payment.id}, User ID ${payment.user_id}`);
      }
    }

    return NextResponse.json({ 
      completed: true,
      payment_id: payment.id,
      points: payment.points
    });
  } catch (error) {
    console.error('セッション確認エラー:', error);
    return NextResponse.json(
      { error: 'セッション確認に失敗しました。' },
      { status: 500 }
    );
  }
}




