export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import crypto from "crypto";

const PROOF_TTL_MINUTES = 30;

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function newProofToken(): string {
  return crypto.randomUUID();
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Invalid content-type" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const code = String(body?.code || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const prisma = await getPrisma();

    const record = await prisma.verificationToken.findFirst({
      where: { identifier: `email_code:${email}` },
      orderBy: { expires: "desc" },
    });

    if (!record) {
      return NextResponse.json({ error: "認証コードが見つかりません。再送信してください。" }, { status: 400 });
    }
    if (record.expires < new Date()) {
      await prisma.verificationToken.deleteMany({ where: { identifier: `email_code:${email}` } });
      return NextResponse.json({ error: "認証コードの有効期限が切れています。再送信してください。" }, { status: 400 });
    }

    const expected = record.token;
    const actual = hashCode(code);
    if (expected !== actual) {
      return NextResponse.json({ error: "認証コードが正しくありません。" }, { status: 400 });
    }

    // Consume code
    await prisma.verificationToken.deleteMany({ where: { identifier: `email_code:${email}` } });

    // Issue a proof token for registration
    const proof = newProofToken();
    const proofExpires = new Date(Date.now() + PROOF_TTL_MINUTES * 60 * 1000);

    await prisma.verificationToken.deleteMany({ where: { identifier: `email_proof:${email}` } });
    await prisma.verificationToken.create({
      data: {
        identifier: `email_proof:${email}`,
        token: proof,
        expires: proofExpires,
      },
    });

    return NextResponse.json(
      { message: "メールアドレスの認証が完了しました。", proof },
      { status: 200 }
    );
  } catch (e: unknown) {
    console.error("verify-code error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}



