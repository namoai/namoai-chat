import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeString } from "@/lib/validation";

const schema = z.object({
  input: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "入力値が不正です。", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sanitized = sanitizeString(parsed.data.input);

  return NextResponse.json({
    success: true,
    original: parsed.data.input,
    sanitized,
  });
}


