export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';
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
      apiVersion: '2025-11-17.clover',
    });
  }
  return stripeInstance;
}

export async function POST(request: NextRequest) {
  await ensureEnvVarsLoaded();

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Stripe signatureがありません。' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRETが設定されていません。');
    return NextResponse.json(
      { error: 'Webhook secretが設定されていません。' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const error = err as Error;
    console.error('Webhook signature検証失敗:', error.message);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  try {
    const prisma = await getPrisma();

    // 決済成功イベント処理
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // メタデータから決済ID取得
      const paymentId = session.metadata?.payment_id;
      if (!paymentId) {
        console.error('決済IDがメタデータにありません。');
        return NextResponse.json({ received: true });
      }

      // 決済レコード検索
      const payment = await prisma.payments.findUnique({
        where: { id: parseInt(paymentId, 10) },
      });

      if (!payment) {
        console.error(`決済レコードが見つかりません: ${paymentId}`);
        return NextResponse.json({ received: true });
      }

      // 既に処理済みの場合はスキップ
      if (payment.status === 'completed') {
        console.log(`決済が既に処理されました: ${paymentId}`);
        return NextResponse.json({ received: true });
      }

      // 決済情報更新
      await prisma.payments.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          stripe_payment_id: session.payment_intent as string,
          completed_at: new Date(),
        },
      });

      // ポイント管理システムを使用してポイント付与
      const { grantPoints } = await import('@/lib/point-manager');
      
      await grantPoints({
        userId: payment.user_id,
        amount: payment.points,
        type: 'paid',
        source: 'purchase',
        description: `ポイント購入 - ¥${payment.amount.toLocaleString()}`,
        paymentId: payment.id,
      });

      console.log(`決済完了およびポイント追加: Payment ID ${payment.id}, User ID ${payment.user_id}, Points ${payment.points}`);
    }

    // 決済失敗イベント処理
    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.payment_id;

      if (paymentId) {
        await prisma.payments.update({
          where: { id: parseInt(paymentId, 10) },
          data: { status: 'failed' },
        });
        console.log(`決済失敗: Payment ID ${paymentId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook処理エラー:', error);
    return NextResponse.json(
      { error: 'Webhook処理中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

