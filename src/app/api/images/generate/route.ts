export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';

/**
 * AI画像生成 API (Replicate 使用)
 * 非同期生成: 予測IDを即返却し、クライアントがステータスをポーリング
 */
export async function POST(request: NextRequest) {
  console.log('[API] /api/images/generate POST start (async)');
  try {
    await ensureEnvVarsLoaded();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }
    const userId = parseInt(session.user.id as string, 10);
    if (Number.isNaN(userId)) {
      return NextResponse.json({ error: 'ユーザーIDを取得できませんでした。' }, { status: 401 });
    }

    const {
      prompt,
      negativePrompt = '',
      width = 512,
      height = 512,
      imageStyle = '2D',
      modelVersion,
    } = await request.json();

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'プロンプトを入力してください。' }, { status: 400 });
    }
    if (!modelVersion || typeof modelVersion !== 'string' || modelVersion.trim() === '') {
      return NextResponse.json({ error: 'モデルバージョンIDを指定してください。' }, { status: 400 });
    }
    if (imageStyle !== '2D') {
      return NextResponse.json({ error: '2D/アニメスタイルのみ対応しています。' }, { status: 400 });
    }

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN が設定されていません。' },
        { status: 500 }
      );
    }

    // コストチェック（先に確保、返金は別途検討）
    const COST_PER_IMAGE = 5;
    const NUM_OUTPUTS = 1;
    const TOTAL_COST = COST_PER_IMAGE;

    // ポイント残高確認
    const { getPointBalance } = await import('@/lib/point-manager');
    const balance = await getPointBalance(userId);

    if (balance.totalPoints < TOTAL_COST) {
      return NextResponse.json(
        { error: `ポイントが不足しています。${NUM_OUTPUTS}枚生成で${TOTAL_COST}ポイント必要です。` },
        { status: 402 }
      );
    }

    // プロンプト最適化（Danbooruタグ寄せ）
    let processedPrompt = prompt.trim();
    // 日本語サイトのため、日本語から英語への変換のみ対応
    const japaneseToEnglish: Record<string, string> = {
      '女の子': '1girl',
      '男の子': '1boy',
      '少女': 'girl',
      '少年': 'boy',
      '女性': 'woman',
      '男性': 'man',
      '学生': 'school uniform',
      '制服': 'school uniform',
      '笑顔': 'smile',
      '笑い': 'smile',
      '長髪': 'long hair',
      'ショートヘア': 'short hair',
      '目': 'eyes',
      '口': 'mouth',
      '顔': 'face',
    };
    for (const [japanese, english] of Object.entries(japaneseToEnglish)) {
      const regex = new RegExp(japanese, 'gi');
      processedPrompt = processedPrompt.replace(regex, english);
    }
    if (!processedPrompt || processedPrompt.length < 3) {
      processedPrompt = '1girl, solo';
    } else if (!/1girl|girl|woman|1boy|boy|man/i.test(processedPrompt)) {
      processedPrompt = `1girl, ${processedPrompt}`;
    }
    const qualityTags = 'masterpiece, best quality, very aesthetic, absurdres, sensitive, cinematic lighting, detailed face';
    const enforcedPrompt = `${processedPrompt}, ${qualityTags}`.trim();

    const userNegativePrompt = (negativePrompt || '').trim();
    const requiredNegative = [
      'low quality', 'worst quality', 'lowres', 'blurry', 'jpeg artifacts',
      'photorealistic', 'realistic', 'photo', '3d render', '3d model', 'CGI',
    ].join(', ');
    const negativeKeywords = [userNegativePrompt, requiredNegative]
      .filter((p) => p.trim())
      .join(', ')
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k);
    const enforcedNegativePrompt = Array.from(new Set(negativeKeywords)).join(', ');

    const versionHash = modelVersion.trim();
    if (!versionHash.match(/^[a-f0-9]{64}$/)) {
      return NextResponse.json(
        { error: `無効なモデルバージョンIDです: ${versionHash}` },
        { status: 400 }
      );
    }

    const inputParams: Record<string, unknown> = {
      prompt: enforcedPrompt,
      negative_prompt: enforcedNegativePrompt,
      num_outputs: NUM_OUTPUTS,
      width: Math.min(Math.max(width, 1024), 1536),
      height: Math.min(Math.max(height, 1024), 1536),
      guidance_scale: 7,
      num_inference_steps: 24, // 短縮して高速化
    };

    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: versionHash,
        input: inputParams,
      }),
    });

    if (!replicateResponse.ok) {
      const errJson = await replicateResponse.json().catch(() => ({}));
      const message = errJson?.detail || JSON.stringify(errJson) || '画像生成に失敗しました。';
      console.error('[Replicate] create prediction error:', message);
      return NextResponse.json({ error: message }, { status: replicateResponse.status });
    }

    const prediction = await replicateResponse.json();

    // ポイントを先に確定（失敗時の返金は別途検討）
    try {
      const { consumePoints } = await import('@/lib/point-manager');
      
      await consumePoints({
        userId,
        amount: TOTAL_COST,
        usageType: 'image_generation',
        description: `画像生成 - ${prompt.substring(0, 50)}...`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ポイント消費に失敗しました。';
      return NextResponse.json({ error: message }, { status: 402 });
    }

    return NextResponse.json({
      success: true,
      predictionId: prediction.id,
      status: prediction.status,
    });
  } catch (error) {
    console.error('画像生成エラー:', error);
    return NextResponse.json(
      { error: '画像生成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

/**
 * 予測ステータス取得エンドポイント
 * クライアントは predictionId を指定してポーリング
 */
export async function GET(request: NextRequest) {
  try {
    await ensureEnvVarsLoaded();

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN が設定されていません。' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const predictionId = searchParams.get('predictionId');
    if (!predictionId) {
      return NextResponse.json({ error: 'predictionId は必須です。' }, { status: 400 });
    }

    const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Token ${apiToken}` },
      cache: 'no-store',
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      return NextResponse.json({ error: errText || 'ステータス取得に失敗しました。' }, { status: statusRes.status });
    }

    const prediction = await statusRes.json() as {
      status: string;
      output?: unknown;
      error?: string;
    };

    if (prediction.status === 'succeeded') {
      let imageUrls: string[] = [];
      const output = prediction.output;
      if (Array.isArray(output)) {
        imageUrls = output as string[];
      } else if (typeof output === 'string') {
        imageUrls = [output];
      } else if (output && typeof output === 'object') {
        const outputObj = output as Record<string, unknown>;
        const candidate = outputObj.url ?? outputObj.image ?? (Array.isArray(outputObj) ? outputObj[0] : undefined);
        if (candidate) {
          imageUrls = Array.isArray(candidate) ? (candidate as string[]) : [candidate as string];
        }
      }
      return NextResponse.json({ success: true, status: prediction.status, imageUrls });
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      return NextResponse.json(
        { error: prediction.error || '画像生成に失敗しました。', status: prediction.status },
        { status: 500 }
      );
    }

    // 処理中
    return NextResponse.json({ success: false, status: prediction.status });
  } catch (error) {
    console.error('[Replicate] status error:', error);
    return NextResponse.json(
      { error: 'ステータス取得中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

