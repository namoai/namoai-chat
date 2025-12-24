export const runtime = 'nodejs';

console.log("✅ /api/register ルート実行!");

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { rateLimit, buildRateLimitHeaders } from "@/lib/rateLimit";
import { registerSchema, sanitizeString } from "@/lib/validation";
import { validatePassword } from "@/lib/password-policy";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

const getClientIp = (req: Request): string => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  return realIp ?? "unknown";
};

export async function POST(req: Request) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "無効なContent-Typeです。application/jsonが必要です。" },
        { status: 400 }
      );
    }

    // Rate limiting: 1시간에 3회
    const clientIp = getClientIp(req);
    const rateResult = await rateLimit({
      identifier: `register:${clientIp}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "短時間に過度のリクエストが行われました。しばらくしてから再試行してください。" },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateResult),
        }
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力値が不正です。", details: parsed.error.flatten() },
        { status: 400, headers: buildRateLimitHeaders(rateResult) }
      );
    }

    const sanitized = {
      email: sanitizeString(parsed.data.email),
      password: parsed.data.password,
      name: sanitizeString(parsed.data.name),
      phone: sanitizeString(parsed.data.phone),
      nickname: sanitizeString(parsed.data.nickname),
      birthdate: parsed.data.birthdate,
      emailVerificationProof: parsed.data.emailVerificationProof,
      referralCode: parsed.data.referralCode ? sanitizeString(parsed.data.referralCode).toUpperCase() : undefined,
    };

    const prisma = await getPrisma();
    
    // 紹介コードが提供された場合、紹介者を検索
    let referrerUserId: number | undefined = undefined;
    if (sanitized.referralCode) {
      const referrer = await prisma.users.findUnique({
        where: { referralCode: sanitized.referralCode },
        select: { id: true },
      });
      
      if (referrer) {
        referrerUserId = referrer.id;
      } else {
        console.log(`[Register] Invalid referral code provided: ${sanitized.referralCode}`);
        // 無効な紹介コードでも登録は続行（エラーにしない）
      }
    }
    // ユーザー重複チェック
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { email: sanitized.email },
          { phone: sanitized.phone },
          { nickname: sanitized.nickname }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "すでに登録されているユーザー情報があります。" },
        { status: 409 }
      );
    }

    // パスワードポリシー検証
    const passwordValidation = validatePassword(sanitized.password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { 
          error: "パスワードがポリシーを満たしていません。", 
          details: passwordValidation.errors,
          warnings: passwordValidation.warnings,
        },
        { status: 400, headers: buildRateLimitHeaders(rateResult) }
      );
    }
    
    // パスワードをハッシュ化して保存
    const hashedPassword = await bcrypt.hash(sanitized.password, 12); // bcrypt roundsを12に増加（より安全）

    const birthdateValue = sanitized.birthdate ? new Date(sanitized.birthdate) : null;
    if (birthdateValue && (isNaN(birthdateValue.getTime()) || birthdateValue > new Date())) {
      return NextResponse.json(
        { error: "生年月日が不正です。" },
        { status: 400, headers: buildRateLimitHeaders(rateResult) }
      );
    }
    // 生年月日から年齢を計算してdeclaredAdultを決定
    let declaredAdult: boolean | null = null;
    if (birthdateValue) {
      const today = new Date();
      let age = today.getFullYear() - birthdateValue.getFullYear();
      const monthDiff = today.getMonth() - birthdateValue.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdateValue.getDate())) {
        age -= 1;
      }
      if (age < 0 || age > 120) {
        return NextResponse.json(
          { error: "生年月日が不正です。" },
          { status: 400, headers: buildRateLimitHeaders(rateResult) }
        );
      }
      declaredAdult = age >= 18;
    }

    // ✅ メール認証proofの検証（verify-code APIで発行されたもの）
    if (!sanitized.emailVerificationProof) {
      return NextResponse.json(
        { error: "メールアドレスの認証が必要です。（認証コードを確認してください）" },
        { status: 400, headers: buildRateLimitHeaders(rateResult) }
      );
    }

    const proofRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: `email_proof:${sanitized.email.toLowerCase()}`,
        token: sanitized.emailVerificationProof,
      },
    });

    if (!proofRecord || proofRecord.expires < new Date()) {
      await prisma.verificationToken.deleteMany({
        where: { identifier: `email_proof:${sanitized.email.toLowerCase()}` },
      });
      return NextResponse.json(
        { error: "メール認証の有効期限が切れています。再度認証してください。" },
        { status: 400, headers: buildRateLimitHeaders(rateResult) }
      );
    }

    // Consume proof (one-time)
    await prisma.verificationToken.deleteMany({
      where: { identifier: `email_proof:${sanitized.email.toLowerCase()}` },
    });

    // 紹介コードを生成
    const { generateReferralCode } = await import('@/lib/referral');
    const myReferralCode = await generateReferralCode();

    // ✅ ユーザーとポイントレコードを同時に作成（メール認証済みとして）
    const newUser = await prisma.users.create({
      data: {
        email: sanitized.email,
        password: hashedPassword,
        name: sanitized.name,
        phone: sanitized.phone,
        nickname: sanitized.nickname,
        dateOfBirth: birthdateValue,
        declaredAdult,
        needsProfileCompletion: false,
        safetyFilter: true, // 初期値は必ずON
        emailVerified: new Date(), // proof検証が完了しているため、認証済みとして設定
        referralCode: myReferralCode, // 自分の紹介コード
        referredByUserId: referrerUserId, // 誰が紹介したか（あれば）
        // 👇 ユーザーを作成する際に、関連するpointsレコードも一緒に作成するという意味です
        points: {
          create: {
            // free_pointsとpaid_pointsはスキーマでdefault(0)に設定されているため、
            // 空にしておくと自動的に0で生成されます。
          },
        },
      },
      // 生成されたユーザー情報にpoints情報も含めて返却します（任意）
      include: {
        points: true,
      },
    });

    // 会員登録ウェルカムボーナス: 500ポイント付与
    const { grantPoints } = await import('@/lib/point-manager');
    await grantPoints({
      userId: newUser.id,
      amount: 500,
      type: 'free',
      source: 'registration',
      description: '会員登録ウェルカムボーナス',
    });

    // 成功レスポンスをJSONで返却
    return NextResponse.json(
      { 
        message: "会員登録が完了しました。ログイン画面に移動します。",
        user: newUser,
      },
      {
        status: 201,
        headers: buildRateLimitHeaders(rateResult),
      }
    );

  } catch (error) {
    console.error("登録エラー:", error);

    // JSONでエラーレスポンス返却 (HTML防止)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}