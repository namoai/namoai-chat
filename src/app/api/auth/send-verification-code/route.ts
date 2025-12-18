export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

const CODE_TTL_MINUTES = 10;

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function generate6DigitCode(): string {
  // 000000-999999 (pad)
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, "0");
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Invalid content-type" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const prisma = await getPrisma();

    // Invalidate previous codes for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: `email_code:${email}` },
    });

    const code = generate6DigitCode();
    const token = hashCode(code); // store hash, not raw code
    const expires = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await prisma.verificationToken.create({
      data: {
        identifier: `email_code:${email}`,
        token,
        expires,
      },
    });

    try {
      await sendEmail({
        to: email,
        subject: "メール認証コード",
        text: `認証コード: ${code}\n有効期限: ${CODE_TTL_MINUTES}分`,
      });
    } catch (mailErr: unknown) {
      console.error("send-verification-code mail error:", mailErr);
      return NextResponse.json(
        {
          error:
            "メール送信設定が未設定です。ローカルの .env.local に EMAIL_USER / EMAIL_PASSWORD を設定してください。",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "認証コードを送信しました。" }, { status: 200 });
  } catch (e: unknown) {
    console.error("send-verification-code error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


