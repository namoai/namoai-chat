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
    const { genre, characterType } = await request.json();

    const model = vertex_ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
    });

    const prompt = `あなたはキャラクターチャット用のプロフィール作成アシスタントです。
1人用のキャラクターのプロフィールを自動生成してください。

${genre ? `ジャンル: ${genre}` : 'ジャンル: 自由（ファンタジー、ロマンス、ホラー、SF、現代劇など、適切なジャンルを選択）'}
${characterType ? `キャラクタータイプ: ${characterType}` : 'キャラクタータイプ: 自由（魅力的で興味深いキャラクターを作成）'}

以下の形式で出力してください（JSON形式）:
{
  "name": "キャラクター名（20文字以内、魅力的で印象的なタイトル）",
  "description": "作品紹介文（250文字以内、魅力的で興味を引く内容）"
}

作品紹介文の要件:
- キャラクターの設定や世界観を説明
- ユーザーとの関係性やストーリーの導入部分を含める
- キャラクターが魅力的で、ユーザーがチャットを始めたくなるような内容
- 具体的で詳細な描写を含める
- ユーザーがキャラクターと対話したくなるような興味深い設定

例:
- 名前: "어둠의 여왕 릴리스" (暗闇の女王リリス)
- 作品紹介: "リリスは夜の世界を支配する強力な魔女です。彼女の視線だけで人々を悪夢の中に引きずり込むことができます。あなたはリリスの呪いにかかり、永遠の夜の世界に閉じ込められてしまいます。果たしてあなたは光の世界に戻ることができるでしょうか？"

このような形式で、創造的で魅力的なキャラクターを作成してください。`;

    const result = await model.generateContent(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'プロフィール生成に失敗しました。応答が空でした。' },
        { status: 500 }
      );
    }

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // JSONが見つからない場合、テキストから推測
      const lines = text.split('\n').filter(line => line.trim());
      const name = lines.find(line => line.includes('name') || line.includes('名前') || line.includes('タイトル'))?.replace(/.*[:：]\s*/, '').replace(/["'「」]/g, '').trim() || 'キャラクター';
      const description = lines.find(line => line.includes('description') || line.includes('紹介') || line.includes('説明'))?.replace(/.*[:：]\s*/, '').replace(/["'「」]/g, '').trim() || text.substring(0, 250);
      
      return NextResponse.json({
        success: true,
        name: name.substring(0, 20),
        description: description.substring(0, 250),
      });
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        success: true,
        name: (parsed.name || 'キャラクター').substring(0, 20),
        description: (parsed.description || '').substring(0, 250),
      });
    } catch {
      // JSON解析失敗時はテキストから抽出
      const nameMatch = text.match(/name["':：\s]*["'「]?([^"'」\n]+)["'」]?/i);
      const descMatch = text.match(/description["':：\s]*["'「]?([^"'」\n]+)["'」]?/i);
      
      return NextResponse.json({
        success: true,
        name: (nameMatch?.[1] || 'キャラクター').substring(0, 20),
        description: (descMatch?.[1] || text.substring(0, 250)).substring(0, 250),
      });
    }
  } catch (error) {
    console.error('プロフィール生成エラー:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 }
    );
  }
}

