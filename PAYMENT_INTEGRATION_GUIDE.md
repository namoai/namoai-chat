# 💳 決済システム統合ガイド

## 📊 PayPay vs PayPal 比較

### 推奨: **PayPay** を主力として使用

| 項目 | PayPay | PayPal |
|------|--------|--------|
| **手数料** | 1.98%~3.24% | 3.6% + 40円 |
| **対象地域** | 日本のみ | 全世界 |
| **月額固定費** | 0円~1,980円 | 0円 |
| **決済速度** | 即座 | 即座 |
| **日本での人気** | ✅ 非常に高い | ⚠️ 中程度 |
| **実装難易度** | 中 | 易 |

**結論**: 日本市場をターゲットにしているため、**PayPayを主力**に、海外ユーザー向けに**PayPalを補助**として提供するのが最適です。

---

## 🎯 実装戦略

### Phase 1: PayPay 実装（優先）
- 日本ユーザーの80%以上をカバー
- 手数料が最も安い（1.98%~）

### Phase 2: PayPal 追加（海外展開時）
- 在日外国人、海外展開準備
- PayPay使えないユーザー向け

---

## 📦 1. PayPay 決済の実装

### ⚠️ 重要: 申請・承認プロセス

**PayPayは「登録してすぐ使える」ものではありません！**

実際の実装には以下が必要です：
- ✅ 事業者登録（法人または個人事業主）
- ✅ PayPay for Business 申請（審査期間: 2〜4週間）
- ✅ 銀行口座連携・確認（2〜3営業日）
- ✅ APIキー取得（審査通過後）
- ✅ サンドボックステスト（1〜2週間）
- ✅ 本番環境申請（1週間）

**目安期間: 約2〜3ヶ月**

詳細な申請プロセスは `PAYMENT_APPLICATION_PROCESS.md` を参照してください。

### 1.1 PayPay 加盟店申請

1. **PayPay for Business** に登録
   - URL: https://paypay.ne.jp/business/
   - 必要書類: 
     - 法人登記簿謄本（法人の場合）
     - 開業届出書（個人事業主の場合）
     - 銀行口座情報
     - 事業内容説明書
     - ウェブサイトURL

2. **審査プロセス**（2〜4週間）
   - 事業者の実在性確認
   - 事業内容の適切性確認
   - ウェブサイトの内容確認
   - 規約遵守の可能性確認

3. **API キー取得**（審査通過後）
   - 管理画面から「API連携」を選択
   - `CLIENT_ID` と `CLIENT_SECRET` を取得

### 1.2 環境変数設定

```bash
# .env.local または Secret Manager に追加
PAYPAY_CLIENT_ID=your_client_id_here
PAYPAY_CLIENT_SECRET=your_client_secret_here
PAYPAY_MERCHANT_ID=your_merchant_id_here
PAYPAY_API_KEY=your_api_key_here
PAYPAY_ENVIRONMENT=sandbox  # 本番環境では 'production'
```

### 1.3 PayPay SDK インストール

```bash
npm install @paypay/paypayopa
```

### 1.4 PayPay 決済 API 実装

`src/app/api/payments/paypay/create-payment/route.ts` を作成:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import paypayopa from '@paypay/paypayopa';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import prisma from '@/lib/prisma';

// PayPay SDK 設定
paypayopa.Configure({
  clientId: process.env.PAYPAY_CLIENT_ID!,
  clientSecret: process.env.PAYPAY_CLIENT_SECRET!,
  merchantId: process.env.PAYPAY_MERCHANT_ID!,
  productionMode: process.env.PAYPAY_ENVIRONMENT === 'production',
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const { pointAmount, planId } = await request.json();

    // ポイントプランの定義
    const POINT_PLANS: Record<string, { points: number; price: number }> = {
      plan_100: { points: 100, price: 120 },
      plan_500: { points: 500, price: 600 },
      plan_1000: { points: 1000, price: 1200 },
      plan_3000: { points: 3000, price: 3400 },
      plan_5000: { points: 5000, price: 5500 },
      plan_10000: { points: 10000, price: 10000 },
    };

    const selectedPlan = POINT_PLANS[planId];
    if (!selectedPlan) {
      return NextResponse.json({ error: '無効なプランです' }, { status: 400 });
    }

    // 注文IDを生成
    const orderId = `order_${userId}_${Date.now()}`;

    // PayPay 決済リクエストを作成
    const payload = {
      merchantPaymentId: orderId,
      amount: {
        amount: selectedPlan.price,
        currency: 'JPY',
      },
      orderDescription: `${selectedPlan.points}ポイント購入`,
      userAgent: request.headers.get('user-agent') || 'namos-chat',
    };

    // PayPay QRコード/ディープリンク生成
    const response = await paypayopa.code.createQRCode(payload);

    if (response.STATUS !== 'SUCCESS') {
      console.error('PayPay決済作成エラー:', response);
      return NextResponse.json(
        { error: 'PayPay決済の作成に失敗しました' },
        { status: 500 }
      );
    }

    // 決済情報をDBに保存（pending状態）
    await prisma.payment_transactions.create({
      data: {
        userId: userId,
        orderId: orderId,
        paymentMethod: 'paypay',
        amount: selectedPlan.price,
        pointAmount: selectedPlan.points,
        status: 'pending',
        paymentData: JSON.stringify(response.DATA),
      },
    });

    // QRコードURLとディープリンクを返す
    return NextResponse.json({
      success: true,
      paymentUrl: response.DATA.url, // ユーザーがアクセスするURL
      deeplink: response.DATA.deeplink, // モバイルアプリ用
      orderId: orderId,
      expiresAt: response.DATA.expiryDate,
    });
  } catch (error) {
    console.error('PayPay決済エラー:', error);
    return NextResponse.json(
      { error: '決済処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
```

### 1.5 PayPay Webhook 実装

`src/app/api/payments/paypay/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import paypayopa from '@paypay/paypayopa';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantPaymentId } = body;

    console.log('PayPay Webhook受信:', body);

    // PayPay APIで決済状態を確認
    const paymentDetails = await paypayopa.payment.getPaymentDetails(merchantPaymentId);

    if (paymentDetails.STATUS !== 'SUCCESS') {
      return NextResponse.json({ error: '決済確認失敗' }, { status: 400 });
    }

    const paymentData = paymentDetails.DATA;

    // トランザクションを取得
    const transaction = await prisma.payment_transactions.findUnique({
      where: { orderId: merchantPaymentId },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'トランザクションが見つかりません' }, { status: 404 });
    }

    // 既に処理済みの場合はスキップ
    if (transaction.status === 'completed') {
      return NextResponse.json({ message: '既に処理済み' });
    }

    // 決済が成功している場合
    if (paymentData.status === 'COMPLETED') {
      await prisma.$transaction(async (tx) => {
        // ポイントを付与
        await tx.points.update({
          where: { user_id: transaction.userId },
          data: {
            paid_points: { increment: transaction.pointAmount },
          },
        });

        // トランザクション状態を更新
        await tx.payment_transactions.update({
          where: { id: transaction.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            paymentData: JSON.stringify(paymentData),
          },
        });

        // ポイント履歴に記録
        await tx.point_history.create({
          data: {
            userId: transaction.userId,
            type: 'purchase',
            amount: transaction.pointAmount,
            paymentMethod: 'paypay',
            orderId: merchantPaymentId,
            description: `PayPay決済 - ${transaction.pointAmount}ポイント購入`,
          },
        });
      });

      console.log(`✅ PayPay決済完了: User ${transaction.userId} に ${transaction.pointAmount} ポイント付与`);

      return NextResponse.json({ success: true });
    }

    // 決済失敗の場合
    if (paymentData.status === 'FAILED' || paymentData.status === 'CANCELED') {
      await prisma.payment_transactions.update({
        where: { id: transaction.id },
        data: {
          status: 'failed',
          paymentData: JSON.stringify(paymentData),
        },
      });

      return NextResponse.json({ message: '決済失敗またはキャンセル' });
    }

    return NextResponse.json({ message: 'ステータス確認完了' });
  } catch (error) {
    console.error('PayPay Webhook エラー:', error);
    return NextResponse.json({ error: 'Webhook処理エラー' }, { status: 500 });
  }
}
```

### 1.6 フロントエンド実装

`src/app/points/page.tsx` にPayPayボタンを追加:

```typescript
const handlePayPayPayment = async (planId: string) => {
  try {
    setLoading(true);
    
    const response = await fetch('/api/payments/paypay/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });

    const data = await response.json();

    if (data.success) {
      // PayPay決済画面にリダイレクト
      window.location.href = data.paymentUrl;
      
      // モバイルの場合はディープリンクを使用
      // if (isMobile) {
      //   window.location.href = data.deeplink;
      // }
    } else {
      alert('決済の開始に失敗しました');
    }
  } catch (error) {
    console.error('PayPay決済エラー:', error);
    alert('エラーが発生しました');
  } finally {
    setLoading(false);
  }
};

// UIに追加
<button
  onClick={() => handlePayPayPayment('plan_1000')}
  className="bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg"
>
  PayPayで購入 (1,200円)
</button>
```

---

## 💳 2. PayPal 決済の実装

### ⚠️ 重要: 申請・承認プロセス

**PayPalも「登録してすぐ使える」ものではありません！**

実際の実装には以下が必要です：
- ✅ PayPal Business アカウント作成
- ✅ ビジネス情報登録・本人確認（1〜2週間）
- ✅ 銀行口座連携・確認（2〜3営業日）
- ✅ 審査通過
- ✅ REST API キー取得
- ✅ サンドボックステスト（1週間）
- ✅ 本番環境申請

**目安期間: 約1〜2ヶ月**

詳細な申請プロセスは `PAYMENT_APPLICATION_PROCESS.md` を参照してください。

### 2.1 PayPal アカウント設定

1. **PayPal Business アカウント作成**
   - URL: https://www.paypal.com/jp/business
   - ビジネス情報登録
   - 本人確認書類のアップロード
   
2. **審査プロセス**（1〜2週間）
   - ビジネスの実在性確認
   - 本人確認
   - 事業内容の適切性確認

3. **REST API キー取得**（審査通過後）
   - https://developer.paypal.com/ にログイン
   - 「My Apps & Credentials」から Client ID と Secret を取得
   - サンドボックス用と本番用で異なる

### 2.2 環境変数設定

```bash
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox  # 本番環境では 'live'
```

### 2.3 PayPal SDK インストール

```bash
npm install @paypal/checkout-server-sdk
```

### 2.4 PayPal 決済 API 実装

`src/app/api/payments/paypal/create-order/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import prisma from '@/lib/prisma';

// PayPal環境設定
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;

  if (process.env.PAYPAL_MODE === 'live') {
    return new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
  }
  return new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
}

const client = () => new checkoutNodeJssdk.core.PayPalHttpClient(environment());

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const { planId } = await request.json();

    const POINT_PLANS: Record<string, { points: number; price: number }> = {
      plan_100: { points: 100, price: 120 },
      plan_500: { points: 500, price: 600 },
      plan_1000: { points: 1000, price: 1200 },
      plan_3000: { points: 3000, price: 3400 },
      plan_5000: { points: 5000, price: 5500 },
      plan_10000: { points: 10000, price: 10000 },
    };

    const selectedPlan = POINT_PLANS[planId];
    if (!selectedPlan) {
      return NextResponse.json({ error: '無効なプランです' }, { status: 400 });
    }

    const orderId = `paypal_${userId}_${Date.now()}`;

    // PayPal注文作成
    const orderRequest = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    orderRequest.prefer('return=representation');
    orderRequest.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: orderId,
          description: `${selectedPlan.points}ポイント購入`,
          amount: {
            currency_code: 'JPY',
            value: selectedPlan.price.toString(),
          },
        },
      ],
      application_context: {
        return_url: `${process.env.NEXTAUTH_URL}/points?status=success`,
        cancel_url: `${process.env.NEXTAUTH_URL}/points?status=cancel`,
        brand_name: 'namos-chat',
        user_action: 'PAY_NOW',
      },
    });

    const order = await client().execute(orderRequest);

    // DBに保存
    await prisma.payment_transactions.create({
      data: {
        userId: userId,
        orderId: orderId,
        paymentMethod: 'paypal',
        amount: selectedPlan.price,
        pointAmount: selectedPlan.points,
        status: 'pending',
        paymentData: JSON.stringify(order.result),
      },
    });

    // 承認URLを返す
    const approvalUrl = order.result.links?.find((link: any) => link.rel === 'approve')?.href;

    return NextResponse.json({
      success: true,
      orderId: order.result.id,
      approvalUrl: approvalUrl,
    });
  } catch (error) {
    console.error('PayPal注文作成エラー:', error);
    return NextResponse.json({ error: '決済処理エラー' }, { status: 500 });
  }
}
```

### 2.5 PayPal 決済確定 API

`src/app/api/payments/paypal/capture-order/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import prisma from '@/lib/prisma';

// (environment, client 関数は上記と同じ)

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { orderID } = await request.json();

    // PayPal決済をキャプチャ
    const captureRequest = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderID);
    captureRequest.requestBody({});

    const capture = await client().execute(captureRequest);

    if (capture.result.status !== 'COMPLETED') {
      return NextResponse.json({ error: '決済が完了していません' }, { status: 400 });
    }

    // トランザクションを検索
    const paymentData = capture.result;
    const referenceId = paymentData.purchase_units[0].reference_id;

    const transaction = await prisma.payment_transactions.findUnique({
      where: { orderId: referenceId },
    });

    if (!transaction || transaction.status === 'completed') {
      return NextResponse.json({ message: '既に処理済み' });
    }

    // ポイント付与
    await prisma.$transaction(async (tx) => {
      await tx.points.update({
        where: { user_id: transaction.userId },
        data: { paid_points: { increment: transaction.pointAmount } },
      });

      await tx.payment_transactions.update({
        where: { id: transaction.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          paymentData: JSON.stringify(paymentData),
        },
      });

      await tx.point_history.create({
        data: {
          userId: transaction.userId,
          type: 'purchase',
          amount: transaction.pointAmount,
          paymentMethod: 'paypal',
          orderId: referenceId,
          description: `PayPal決済 - ${transaction.pointAmount}ポイント購入`,
        },
      });
    });

    return NextResponse.json({ success: true, points: transaction.pointAmount });
  } catch (error) {
    console.error('PayPal決済確定エラー:', error);
    return NextResponse.json({ error: '決済確定エラー' }, { status: 500 });
  }
}
```

---

## 🗄️ 3. データベーススキーマ追加

`prisma/schema.prisma` に追加:

```prisma
model payment_transactions {
  id            Int       @id @default(autoincrement())
  userId        Int       @map("user_id")
  orderId       String    @unique @map("order_id")
  paymentMethod String    @map("payment_method") // 'paypay' or 'paypal'
  amount        Int       // 決済金額（円）
  pointAmount   Int       @map("point_amount") // 付与するポイント数
  status        String    @default("pending") // 'pending', 'completed', 'failed'
  paymentData   String?   @map("payment_data") @db.Text // JSON形式の決済データ
  createdAt     DateTime  @default(now()) @map("created_at")
  completedAt   DateTime? @map("completed_at")
  
  user          users     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("payment_transactions")
}

model point_history {
  id            Int      @id @default(autoincrement())
  userId        Int      @map("user_id")
  type          String   // 'purchase', 'consume', 'attend', 'admin'
  amount        Int      // 変動量（正数=獲得、負数=消費）
  paymentMethod String?  @map("payment_method") // 'paypay', 'paypal', null
  orderId       String?  @map("order_id")
  description   String
  createdAt     DateTime @default(now()) @map("created_at")
  
  user          users    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("point_history")
}
```

マイグレーション実行:

```bash
npx prisma migrate dev --name add_payment_tables
npx prisma generate
```

---

## 🎨 4. フロントエンド完全実装

`src/app/points/page.tsx` の完全版:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const POINT_PLANS = [
  { id: 'plan_100', points: 100, price: 120, bonus: 0 },
  { id: 'plan_500', points: 500, price: 600, bonus: 0 },
  { id: 'plan_1000', points: 1000, price: 1200, bonus: 50, popular: true },
  { id: 'plan_3000', points: 3000, price: 3400, bonus: 200 },
  { id: 'plan_5000', points: 5000, price: 5500, bonus: 500 },
  { id: 'plan_10000', points: 10000, price: 10000, bonus: 1500 },
];

export default function PointPurchasePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paypay' | 'paypal'>('paypay');

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  const handlePurchase = async () => {
    if (!selectedPlan) {
      alert('プランを選択してください');
      return;
    }

    setLoading(true);

    try {
      if (paymentMethod === 'paypay') {
        // PayPay決済
        const response = await fetch('/api/payments/paypay/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: selectedPlan }),
        });

        const data = await response.json();
        if (data.success) {
          window.location.href = data.paymentUrl;
        } else {
          alert('決済の開始に失敗しました');
        }
      } else {
        // PayPal決済
        const response = await fetch('/api/payments/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: selectedPlan }),
        });

        const data = await response.json();
        if (data.success) {
          window.location.href = data.approvalUrl;
        } else {
          alert('決済の開始に失敗しました');
        }
      }
    } catch (error) {
      console.error('決済エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">ポイント購入</h1>

        {/* 決済方法選択 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">決済方法を選択</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setPaymentMethod('paypay')}
              className={`px-6 py-3 rounded-lg font-bold ${
                paymentMethod === 'paypay'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              PayPay （推奨）
            </button>
            <button
              onClick={() => setPaymentMethod('paypal')}
              className={`px-6 py-3 rounded-lg font-bold ${
                paymentMethod === 'paypal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              PayPal
            </button>
          </div>
        </div>

        {/* プラン選択 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {POINT_PLANS.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative p-6 rounded-lg border-2 cursor-pointer transition ${
                selectedPlan === plan.id
                  ? 'border-blue-500 bg-blue-900'
                  : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              } ${plan.popular ? 'ring-2 ring-yellow-400' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-4 py-1 rounded-full text-sm font-bold">
                  人気
                </div>
              )}
              <div className="text-center">
                <div className="text-3xl font-bold mb-2">{plan.points}P</div>
                {plan.bonus > 0 && (
                  <div className="text-yellow-400 text-sm mb-2">+{plan.bonus}P ボーナス!</div>
                )}
                <div className="text-2xl font-bold">¥{plan.price}</div>
                <div className="text-gray-400 text-sm mt-2">
                  ({(plan.price / plan.points).toFixed(2)}円/P)
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 購入ボタン */}
        <div className="mt-8 text-center">
          <button
            onClick={handlePurchase}
            disabled={!selectedPlan || loading}
            className={`px-8 py-4 rounded-lg font-bold text-lg ${
              !selectedPlan || loading
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : paymentMethod === 'paypay'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? '処理中...' : `${paymentMethod === 'paypay' ? 'PayPay' : 'PayPal'}で購入`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## ✅ チェックリスト

### PayPay（申請プロセス）
- [ ] 事業者登録（法人または個人事業主）
- [ ] 銀行口座開設（法人名義または個人事業主名義）
- [ ] ウェブサイト準備（最低限のページ）
- [ ] PayPay for Business アカウント作成
- [ ] 事業者情報登録・書類アップロード
- [ ] 銀行口座登録・確認
- [ ] 審査通過（2〜4週間）
- [ ] API キー取得
- [ ] 環境変数設定
- [ ] `@paypay/paypayopa` インストール
- [ ] 決済作成 API 実装
- [ ] Webhook API 実装
- [ ] フロントエンド実装
- [ ] サンドボックステスト（1〜2週間）
- [ ] 本番環境申請（1週間）
- [ ] 本番環境開始

**合計期間: 約2〜3ヶ月**

### PayPal（申請プロセス）
- [ ] PayPal Business アカウント作成
- [ ] ビジネス情報登録
- [ ] 本人確認書類アップロード
- [ ] 銀行口座登録・確認
- [ ] 審査通過（1〜2週間）
- [ ] REST API キー取得（Developer Portal）
- [ ] 環境変数設定
- [ ] `@paypal/checkout-server-sdk` インストール
- [ ] 注文作成 API 実装
- [ ] 決済確定 API 実装
- [ ] フロントエンド実装
- [ ] サンドボックステスト（1週間）
- [ ] 本番環境申請
- [ ] 本番環境開始

**合計期間: 約1〜2ヶ月**

### データベース
- [ ] `payment_transactions` テーブル作成
- [ ] `point_history` テーブル作成
- [ ] マイグレーション実行

---

## 🔒 セキュリティ考慮事項

1. **二重決済防止**: `orderId` のユニーク制約
2. **金額検証**: サーバー側で必ず金額を再計算
3. **Webhook認証**: PayPay/PayPalの署名検証
4. **トランザクション**: ポイント付与は必ずDBトランザクション内で実行
5. **環境変数**: 本番APIキーは絶対にコミットしない

---

## 📞 サポート

### PayPay
- **サポート**: https://paypay.ne.jp/business/support/
- **電話**: 0120-628-628（平日 9:00〜18:00）
- **メール**: business-support@paypay.ne.jp

### PayPal
- **サポート**: https://www.paypal.com/jp/smarthelp/home
- **電話**: 0120-271-888（24時間対応）
- **メール**: サポートページから問い合わせ

---

## 📚 関連ドキュメント

- **詳細な申請プロセス**: `PAYMENT_APPLICATION_PROCESS.md` を参照
  - 申請に必要な書類一覧
  - 審査プロセスの詳細
  - タイムライン（目安）
  - よくある問題と対処法

---

## ⏰ 実装スケジュール（推奨）

### 開発開始2〜3ヶ月前
1. **事業者登録**（法人設立または個人事業主開業届）
2. **銀行口座開設**
3. **ウェブサイト準備**（最低限のページ）

### 開発開始1ヶ月前
1. **PayPay申請開始**（審査期間2〜4週間）
2. **PayPal申請開始**（審査期間1〜2週間、並行申請可能）

### 開発中
1. **サンドボックス環境で開発**（承認前でも開発可能）
2. **テストアカウントで動作確認**

### リリース直前
1. **本番環境申請**
2. **最終テスト**
3. **本番環境開始**


