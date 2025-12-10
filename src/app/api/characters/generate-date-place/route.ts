export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from 'next/server';
import { VertexAI, HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";
import { ensureGcpCreds } from "@/utils/ensureGcpCreds";

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
    // GCP認証情報を確保
    await ensureGcpCreds();
    
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

    // ▼▼▼【タイムアウト対策】タイムアウト設定を追加（Netlify環境でのタイムアウト対策）▼▼▼
    const timeoutMs = 25000; // 25秒（Netlifyのデフォルトタイムアウトより短く設定）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('タイムアウトエラー: 生成に時間がかかりすぎました。')), timeoutMs);
    });
    
    const generatePromise = model.generateContent(prompt);
    const result = await Promise.race([generatePromise, timeoutPromise]) as Awaited<ReturnType<typeof model.generateContent>>;
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // ▲▲▲

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
    
    // エラーの種類に応じて適切なメッセージを返す
    let errorMessage = '不明なエラー';
    if (error instanceof Error) {
      if (error.message.includes('タイムアウト') || error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = 'タイムアウトエラー: 生成に時間がかかりすぎました。もう一度お試しください。';
      } else if (error.message.includes('quota') || error.message.includes('QUOTA')) {
        errorMessage = 'クォータエラー: APIの利用制限に達しました。しばらく待ってから再度お試しください。';
      } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        errorMessage = 'ネットワークエラー: 接続に問題があります。インターネット接続を確認してください。';
      } else {
        errorMessage = `生成エラー: ${error.message}`;
      }
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}







