import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { VertexAI } from '@google-cloud/vertexai';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  // 管理者権限チェック
  if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'MODERATOR') {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const { results } = await request.json();

    // 環境変数チェック
    if (!process.env.GOOGLE_PROJECT_ID) {
      console.error('GOOGLE_PROJECT_ID が設定されていません');
      return NextResponse.json(
        { error: 'AI分析機能を使用するにはGOOGLE_PROJECT_IDの設定が必要です。' },
        { status: 500 }
      );
    }

    // VertexAIクライアントの初期化
    let vertex_ai: VertexAI;
    try {
      vertex_ai = new VertexAI({
        project: process.env.GOOGLE_PROJECT_ID,
        location: 'asia-northeast1',
      });
    } catch (initError) {
      console.error('VertexAI初期化エラー:', initError);
      return NextResponse.json(
        { error: `VertexAIの初期化に失敗しました: ${initError instanceof Error ? initError.message : '不明なエラー'}` },
        { status: 500 }
      );
    }

    let model;
    try {
      model = vertex_ai.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });
    } catch (modelError) {
      console.error('モデル初期化エラー:', modelError);
      // フォールバック: 通常のモデルを使用
      try {
        model = vertex_ai.getGenerativeModel({
          model: 'gemini-1.5-flash',
        });
      } catch (fallbackError) {
        console.error('フォールバックモデル初期化エラー:', fallbackError);
        return NextResponse.json(
          { error: `AIモデルの初期化に失敗しました: ${fallbackError instanceof Error ? fallbackError.message : '不明なエラー'}` },
          { status: 500 }
        );
      }
    }

    type TestResult = {
      category?: string;
      name: string;
      status: 'success' | 'error' | 'pending' | 'running';
      message?: string;
      duration?: number;
    };

    const totalTests = results.length;
    const passedTests = results.filter((r: TestResult) => r.status === 'success').length;
    const failedTests = results.filter((r: TestResult) => r.status === 'error').length;
    const avgDuration = results
      .filter((r: TestResult) => r.duration !== undefined)
      .reduce((sum: number, r: TestResult) => sum + (r.duration || 0), 0) / 
      results.filter((r: TestResult) => r.duration !== undefined).length || 0;

    const prompt = `あなたはソフトウェアテストの専門家です。以下のテスト結果を分析して、問題点や改善点を指摘してください。

## テスト結果サマリー
- 総テスト数: ${totalTests}
- 成功: ${passedTests}
- 失敗: ${failedTests}
- 平均実行時間: ${Math.round(avgDuration)}ms

## 詳細なテスト結果
${results.map((r: TestResult, idx: number) => `
${idx + 1}. 【${r.category}】${r.name}
   - ステータス: ${r.status === 'success' ? '✅ 成功' : r.status === 'error' ? '❌ 失敗' : '⏳ 待機中'}
   - メッセージ: ${r.message || 'なし'}
   - 実行時間: ${r.duration ? r.duration + 'ms' : 'N/A'}
`).join('\n')}

## 分析依頼
以下の観点で分析してください：
1. 失敗したテストの原因分析
2. パフォーマンスの問題（実行時間が長いテスト）
3. 潜在的な問題や改善点
4. テストカバレッジの評価
5. 推奨される追加テスト

簡潔で実用的な分析を日本語で提供してください。`;

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (generateError) {
      console.error('コンテンツ生成エラー:', generateError);
      return NextResponse.json(
        { error: `AIコンテンツ生成に失敗しました: ${generateError instanceof Error ? generateError.message : '不明なエラー'}` },
        { status: 500 }
      );
    }

    const response = result.response;
    // candidatesから直接取得
    const analysis = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!analysis || analysis.trim().length === 0) {
      return NextResponse.json(
        { error: 'AI分析結果が空です。' },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('AI分析エラー:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    return NextResponse.json(
      { error: `AI分析中にエラーが発生しました: ${errorMessage}` },
      { status: 500 }
    );
  }
}

