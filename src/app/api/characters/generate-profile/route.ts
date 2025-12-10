export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from 'next/server';
import { VertexAI, HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";
import { ensureGcpCreds } from "@/utils/ensureGcpCreds";

// VertexAIクライアントの初期化（遅延初期化）
let vertex_ai: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (!vertex_ai) {
    vertex_ai = new VertexAI({
      project: process.env.GOOGLE_PROJECT_ID,
      location: "asia-northeast1",
    });
  }
  return vertex_ai;
}

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
    
    const { genre, characterType } = await request.json();

    const model = getVertexAI().getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
    });

    const prompt = `あなたはキャラクターチャット用のプロフィール作成アシスタントです。
1人用のキャラクターのプロフィールを自動生成してください。

${genre ? `ジャンル: ${genre}` : 'ジャンル: 自由（ファンタジー、ロマンス、ホラー、SF、現代劇など、適切なジャンルを選択）'}
${characterType ? `キャラクタータイプ: ${characterType}` : 'キャラクタータイプ: 自由（魅力的で興味深いキャラクターを作成）'}

以下の形式で出力してください（JSON形式）:
{
  "name": "キャラクター名（20文字以内、魅力的で印象的な名前。作品タイトルではなく、キャラクターの個人名を生成してください）",
  "description": "作品紹介文（250文字以内、魅力的で興味を引く内容）"
}

重要な注意事項:
- "name"は必ずキャラクターの個人名（例: "リリス"、"太郎"、"エミリア"など）を生成してください
- 作品タイトルや作品名ではなく、キャラクターの名前を生成してください
- キャラクター名は20文字以内で、魅力的で覚えやすい名前を生成してください

作品紹介文の要件:
- キャラクターの設定や世界観を説明
- ユーザーとの関係性やストーリーの導入部分を含める
- キャラクターが魅力的で、ユーザーがチャットを始めたくなるような内容
- 具体的で詳細な描写を含める
- ユーザーがキャラクターと対話したくなるような興味深い設定

例:
- 名前: "リリス" (キャラクターの個人名)
- 作品紹介: "リリスは夜の世界を支配する強力な魔女です。彼女の視線だけで人々を悪夢の中に引きずり込むことができます。あなたはリリスの呪いにかかり、永遠の夜の世界に閉じ込められてしまいます。果たしてあなたは光の世界に戻ることができるでしょうか？"

このような形式で、創造的で魅力的なキャラクターを作成してください。`;

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
        { success: false, error: 'プロフィール生成に失敗しました。応答が空でした。' },
        { status: 500 }
      );
    }

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // JSONが見つからない場合、テキストから推測
      const lines = text.split('\n').filter(line => line.trim());
      // 名前の抽出: "タイトル"を含む行は除外し、キャラクター名のみを抽出
      let name = lines.find(line => 
        (line.includes('name') || line.includes('名前')) && 
        !line.includes('タイトル') && 
        !line.includes('作品')
      )?.replace(/.*[:：]\s*/, '').replace(/["'「」]/g, '').trim() || 'キャラクター';
      
      // 名前が長すぎる場合（作品タイトルの可能性）、最初の部分のみを取得
      if (name.length > 20) {
        name = name.split(/[、,・\s]/)[0].substring(0, 20);
      }
      
      const description = lines.find(line => 
        line.includes('description') || 
        line.includes('紹介') || 
        line.includes('説明')
      )?.replace(/.*[:：]\s*/, '').replace(/["'「」]/g, '').trim() || text.substring(0, 250);
      
      return NextResponse.json({
        success: true,
        name: name.substring(0, 20),
        description: description.substring(0, 250),
      });
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      let name = (parsed.name || 'キャラクター').trim();
      
      // 名前が長すぎる場合（作品タイトルの可能性）、最初の部分のみを取得
      if (name.length > 20) {
        name = name.split(/[、,・\s]/)[0].substring(0, 20);
      }
      
      return NextResponse.json({
        success: true,
        name: name.substring(0, 20),
        description: (parsed.description || '').substring(0, 250),
      });
    } catch {
      // JSON解析失敗時はテキストから抽出
      // 名前の抽出: "タイトル"を含む行は除外
      const nameMatch = text.match(/name["':：\s]*["'「]?([^"'」\n]+)["'」]?/i);
      let name = nameMatch?.[1]?.trim() || 'キャラクター';
      
      // 名前が長すぎる場合（作品タイトルの可能性）、最初の部分のみを取得
      if (name.length > 20) {
        name = name.split(/[、,・\s]/)[0].substring(0, 20);
      }
      
      const descMatch = text.match(/description["':：\s]*["'「]?([^"'」\n]+)["'」]?/i);
      
      return NextResponse.json({
        success: true,
        name: name.substring(0, 20),
        description: (descMatch?.[1] || text.substring(0, 250)).substring(0, 250),
      });
    }
  } catch (error) {
    console.error('プロフィール生成エラー:', error);
    
    // エラーの種類に応じて適切なメッセージを返す
    let errorMessage = '不明なエラー';
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = 'タイムアウトエラー: 生成に時間がかかりすぎました。もう一度お試しください。';
      } else if (error.message.includes('quota') || error.message.includes('QUOTA')) {
        errorMessage = 'クォータエラー: APIの利用制限に達しました。しばらく待ってから再度お試しください。';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
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

