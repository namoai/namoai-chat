export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from 'next/server';
import { VertexAI, HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";

// VertexAIクライアントの初期化
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_PROJECT_ID,
  location: "asia-northeast1",
});

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export async function POST(request: NextRequest) {
  try {
    const { firstSituation } = await request.json();

    if (!firstSituation) {
      return NextResponse.json(
        { success: false, error: '最初の状況が必要です' },
        { status: 400 }
      );
    }

    const model = vertex_ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
    });

    const prompt = `あなたはキャラクターチャット用の日付・場所生成アシスタントです。
以下の最初の状況を読み取り、適切な日付と場所を抽出または生成してください。

最初の状況:
${firstSituation}

以下の形式でJSON形式で出力してください:
{
  "date": "YYYY-MM-DD形式の日付（状況から推測できない場合は適切な日付を生成）",
  "place": "場所の名称（状況から抽出、または状況に適した場所を生成）"
}

要件:
- 日付は状況から推測できる場合はそれを、できない場合は物語に適した日付を生成してください
- 場所は状況から具体的な場所名を抽出するか、状況に適した場所名を生成してください
- すべて日本語で記述してください（日付はYYYY-MM-DD形式）`;

    const result = await model.generateContent(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return NextResponse.json(
        { success: false, error: '日付・場所生成に失敗しました。応答が空でした。' },
        { status: 500 }
      );
    }

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // JSONが見つからない場合、デフォルト値を返す
      return NextResponse.json({
        success: true,
        date: new Date().toISOString().split('T')[0],
        place: '未設定',
      });
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // 日付の形式を検証
      let date = parsed.date || new Date().toISOString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        date = new Date().toISOString().split('T')[0];
      }
      
      return NextResponse.json({
        success: true,
        date: date,
        place: parsed.place || '未設定',
      });
    } catch {
      // JSON解析失敗時はデフォルト値を返す
      return NextResponse.json({
        success: true,
        date: new Date().toISOString().split('T')[0],
        place: '未設定',
      });
    }
  } catch (error) {
    console.error('日付・場所生成エラー:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 }
    );
  }
}




