import { NextRequest, NextResponse } from "next/server";
import { rateLimit, buildRateLimitHeaders } from "@/lib/rateLimit";

const getClientIp = (request: NextRequest): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  return realIp ?? "unknown";
};

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIp(request);

    const result = await rateLimit({
        identifier: `security-test:${identifier}`,
        limit: 5,
        windowMs: 60 * 1000,
      });

    const headers = buildRateLimitHeaders(result);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "レート制限に達しました。1分後に再試行してください。",
          result,
        },
        { status: 429, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "許可されました。この結果を連続リクエストで確認できます。",
        result,
      },
      { headers }
    );
  } catch (error) {
    console.error("[security-tests/rate-limit] error", error);
    return NextResponse.json(
      {
        success: false,
        message: "レート制限テスト中にエラーが発生しました。",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

