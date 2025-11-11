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
    const { name, description, detailSetting } = await request.json();

    if (!detailSetting) {
      return NextResponse.json(
        { success: false, error: '詳細設定が必要です' },
        { status: 400 }
      );
    }

    const model = vertex_ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
    });

    const prompt = `あなたはキャラクターチャット用の開始状況作成アシスタントです。
以下のキャラクター情報を基に、自然で魅力的な開始状況と最初のメッセージを日本語で作成してください。

キャラクター名: ${name || '未設定'}
作品紹介: ${description || '未設定'}
詳細設定:
${detailSetting}

以下の形式でJSON形式で出力してください:
{
  "firstSituation": "最初の状況（1000文字以内、具体的で魅力的な場面設定）",
  "firstMessage": "キャラクターの最初のメッセージ（500文字以内、キャラクターの性格が表れる自然な会話）"
}

要件:
- 最初の状況は、キャラクターとユーザーが出会う場面や状況を具体的に描写してください
- キャラクターの性格、外見、背景が自然に反映されるようにしてください
- 最初のメッセージは、キャラクターの性格や口調が表れる自然な会話にしてください
- ユーザーがすぐに会話に入りやすいような導入にしてください
- すべて日本語で記述してください`;

    const result = await model.generateContent(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return NextResponse.json(
        { success: false, error: '開始状況生成に失敗しました。応答が空でした。' },
        { status: 500 }
      );
    }

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // JSONが見つからない場合、テキストから推測
      const situationMatch = text.match(/最初の状況["':：\s]*["'「]?([^"'」\n]+)["'」]?/i) || 
        text.match(/firstSituation["':：\s]*["'「]?([^"'」\n]+)["'」]?/i);
      const messageMatch = text.match(/最初のメッセージ["':：\s]*["'「]?([^"'」\n]+)["'」]?/i) ||
        text.match(/firstMessage["':：\s]*["'「]?([^"'」\n]+)["'」]?/i);
      
      return NextResponse.json({
        success: true,
        firstSituation: (situationMatch?.[1] || text.substring(0, 1000)).substring(0, 1000),
        firstMessage: (messageMatch?.[1] || text.substring(0, 500)).substring(0, 500),
      });
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        success: true,
        firstSituation: (parsed.firstSituation || '').substring(0, 1000),
        firstMessage: (parsed.firstMessage || '').substring(0, 500),
      });
    } catch {
      // JSON解析失敗時はテキストから抽出
      const situationMatch = text.match(/firstSituation["':：\s]*["'「]?([^"'」\n]+)["'」]?/i);
      const messageMatch = text.match(/firstMessage["':：\s]*["'「]?([^"'」\n]+)["'」]?/i);
      
      return NextResponse.json({
        success: true,
        firstSituation: (situationMatch?.[1] || text.substring(0, 1000)).substring(0, 1000),
        firstMessage: (messageMatch?.[1] || text.substring(0, 500)).substring(0, 500),
      });
    }
  } catch (error) {
    console.error('開始状況生成エラー:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 }
    );
  }
}

