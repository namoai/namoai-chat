import { NextRequest, NextResponse } from "next/server";
import { validateImageFile } from "@/lib/upload/validateImage";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "ファイルが添付されていません。" }, { status: 400 });
    }

    const validated = await validateImageFile(file, { maxSizeBytes: 5 * 1024 * 1024 });

    return NextResponse.json({
      success: true,
      message: "検証に成功しました。以下の情報をご確認ください。",
      details: {
        originalName: file.name,
        detectedMime: validated.mimeType,
        sizeBytes: file.size,
        sizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
        extension: validated.extension,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "検証中に不明なエラーが発生しました。";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}


