export const runtime = 'nodejs';

console.log("✅ /api/register ルート実行!");

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { rateLimit, buildRateLimitHeaders } from "@/lib/rateLimit";
import { registerSchema, sanitizeString } from "@/lib/validation";
import { validatePassword } from "@/lib/password-policy";

const getClientIp = (req: Request): string => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  return realIp ?? "unknown";
};

export async function POST(req: Request) {
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
    };

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

    // ✅ ユーザーとポイントレコードを同時に作成
    const newUser = await prisma.users.create({
      data: {
        email: sanitized.email,
        password: hashedPassword,
        name: sanitized.name,
        phone: sanitized.phone,
        nickname: sanitized.nickname,
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

    // 成功レスポンスをJSONで返却
    return NextResponse.json(
      { message: "会員登録が完了しました。", user: newUser },
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