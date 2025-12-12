export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';

/**
 * AI画像生成 API (Replicate 使用)
 * 2D/アニメ / セミリアルスタイルに対応
 * 完全な実写はネガティブプロンプトで抑止
 */
export async function POST(request: NextRequest) {
  console.log('[API] /api/images/generate POST start');
  try {
    // Ensure server env vars (e.g., REPLICATE_API_TOKEN) are loaded in Lambda/Amplify
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

    // スタイル検証（2D/アニメ専用）
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

    // ポイント消費チェック（1枚生成で1ポイント）
    const COST_PER_IMAGE = 1;
    const NUM_OUTPUTS = 1; // Anything V4.0: 1 または 4 が許容。最速のため1枚生成。
    const TOTAL_COST = COST_PER_IMAGE;
    const prisma = await getPrisma();

    const ensureAndCheckPoints = async () => {
      const existing = await prisma.points.findUnique({
        where: { user_id: userId },
      });
      if (!existing) {
        await prisma.points.create({ data: { user_id: userId, free_points: 0, paid_points: 0 } });
        return { free_points: 0, paid_points: 0 };
      }
      return existing;
    };

    const points = await ensureAndCheckPoints();
    const totalPoints = (points.free_points ?? 0) + (points.paid_points ?? 0);
    if (totalPoints < TOTAL_COST) {
      return NextResponse.json(
        { error: `ポイントが不足しています。${NUM_OUTPUTS}枚生成で${TOTAL_COST}ポイント必要です。` },
        { status: 402 }
      );
    }

    // スタイルに応じてプロンプトを調整（Animagine XL 3.1はDanbooruタグ形式推奨）

    // Animagine XL 3.1: 韓国語/日本語を英語Danbooruタグに変換
    // 注意: このモデルはDanbooruスタイルのタグに最適化されている
    let processedPrompt = prompt.trim();
    
    // 基本的な韓国語→英語変換（Danbooruタグ形式）
    const koreanToEnglish: { [key: string]: string } = {
      '여자': '1girl',
      '남자': '1boy',
      '소녀': 'girl',
      '소년': 'boy',
      '여성': 'woman',
      '남성': 'man',
      '학생': 'school uniform',
      '교복': 'school uniform',
      '미소': 'smile',
      '웃음': 'smile',
      '긴머리': 'long hair',
      '단발': 'short hair',
      '눈': 'eyes',
      '입': 'mouth',
      '얼굴': 'face',
    };
    
    // 韓国語 키워드를 영어 태그로 변환
    for (const [korean, english] of Object.entries(koreanToEnglish)) {
      const regex = new RegExp(korean, 'gi');
      processedPrompt = processedPrompt.replace(regex, english);
    }
    
    // プロンプトが空または短すぎる場合、基本タグを追加
    if (!processedPrompt || processedPrompt.length < 3) {
      processedPrompt = '1girl, solo';
    } else {
      // 基本タグが含まれていない場合、追加
      const hasGirlTag = /1girl|girl|woman|1boy|boy|man/i.test(processedPrompt);
      if (!hasGirlTag) {
        processedPrompt = `1girl, ${processedPrompt}`;
      }
    }
    
    // 基本品質タグを自動追加（ユーザー入力に関係なく）
    const qualityTags = 'masterpiece, best quality, very aesthetic, absurdres, sensitive, cinematic lighting, detailed face';
    const enforcedPrompt = `${processedPrompt}, ${qualityTags}`.trim();
    
    // ▼▼▼【ネガティブプロンプト最適化】必須項目を自動付与し、重複除去 ▼▼▼
    const userNegativePrompt = (negativePrompt || '').trim();
    const requiredNegative = [
      // 품질/노이즈
      'low quality', 'worst quality', 'lowres', 'blurry', 'jpeg artifacts',
      // 실사/3D 억제
      'photorealistic', 'realistic', 'photo', '3d render', '3d model', 'CGI',
    ].join(', ');
    const allNegativeParts = [userNegativePrompt, requiredNegative].filter((p) => p.trim()).join(', ');
    const negativeKeywords = allNegativeParts
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k);
    const enforcedNegativePrompt = Array.from(new Set(negativeKeywords)).join(', ');

    // Replicate API 呼び出し
    // Animagine XL 3.1のみ使用
    const versionHash = modelVersion.trim();
    
    // バージョンハッシュIDの形式チェック
    if (!versionHash.match(/^[a-f0-9]{64}$/)) {
      return NextResponse.json(
        { error: `無効なモデルバージョンIDです: ${versionHash}` },
        { status: 400 }
      );
    }
    
    // Animagine XL 3.1 최적화 파라미터
    const inputParams: Record<string, unknown> = {
      prompt: enforcedPrompt,
      negative_prompt: enforcedNegativePrompt,
      num_outputs: NUM_OUTPUTS,
      // SDXL 모델은 최소 1024x1024 권장 (512x512로 제한하면 이미지가 깨짐)
      width: Math.min(Math.max(width, 1024), 1536), // 1024-1536 범위
      height: Math.min(Math.max(height, 1024), 1536), // 1024-1536 범위
      // Animagine XL 3.1 최적화 파라미터
      guidance_scale: 7, // Animagine XL 3.1의推奨値（5-7）
      num_inference_steps: 28, // 速度優先で50→28に削減（品質維持、30以下推奨）
    };
    
    // Replicate APIはversion（ハッシュID）のみサポート
    const requestBody = {
      version: versionHash,
      input: inputParams,
    };
    
    console.log(`[Replicate] Using model: Animagine XL 3.1, steps: ${inputParams.num_inference_steps}, version: ${versionHash.substring(0, 20)}...`);
    
    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!replicateResponse.ok) {
      const errJson = await replicateResponse.json().catch(() => ({}));
      const message = errJson?.detail || JSON.stringify(errJson) || '画像生成に失敗しました。';
      console.error('[Replicate] create prediction error:', message);
      return NextResponse.json({ error: message }, { status: replicateResponse.status });
    }

    // ポーリングで完了待ち（最適化・タイムアウト延長）
    type Prediction = {
      id: string;
      status: string;
      output?: unknown;
      error?: string;
    };
    let prediction: Prediction = await replicateResponse.json();
    let attempts = 0;
    const maxAttempts = 300; // 300秒（5分）でタイムアウト（大幅延長）
    const pollInterval = 1000; // 1秒ごとにチェック（API負荷軽減）
    const startTime = Date.now();
    
    console.log(`[Replicate] Prediction started: ${prediction.id}, status: ${prediction.status}`);
    
    while ((prediction.status === 'starting' || prediction.status === 'processing') && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, pollInterval));
      
      try {
        const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { Authorization: `Token ${apiToken}` },
        });
        
        if (!statusRes.ok) {
          const errorText = await statusRes.text();
          console.error(`[Replicate] Status check failed: ${statusRes.status} - ${errorText}`);
          // エラーでも数回リトライ
          if (attempts < 10) {
            await new Promise((r) => setTimeout(r, 2000));
            attempts++;
            continue;
          }
          throw new Error(`ステータス確認に失敗しました: ${statusRes.status}`);
        }
        
        prediction = await statusRes.json();
        attempts++;
        
        // 進捗ログ（30秒ごと）
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed % 30 === 0 && attempts > 1) {
          console.log(`[Replicate] Still processing... (${elapsed}s elapsed, status: ${prediction.status})`);
        }
      } catch (fetchError) {
        console.error('[Replicate] Polling error:', fetchError);
        // ネットワークエラーの場合は数回リトライ
        if (attempts < 10) {
          await new Promise((r) => setTimeout(r, 3000)); // 3秒待ってリトライ
          attempts++;
          continue;
        }
        throw fetchError;
      }
    }

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    console.log(`[Replicate] Prediction completed after ${elapsedSeconds}s, status: ${prediction.status}`);

    if (prediction.status === 'processing' || prediction.status === 'starting') {
      console.error('[Replicate] timeout waiting prediction:', {
        id: prediction.id,
        status: prediction.status,
        elapsed: elapsedSeconds,
        attempts,
      });
      return NextResponse.json(
        { error: `画像生成に時間がかかりすぎています（${elapsedSeconds}秒経過）。サーバーが混雑している可能性があります。しばらく待ってから再試行してください。` },
        { status: 504 }
      );
    }

    if (prediction.status !== 'succeeded') {
      const message = prediction?.error || '画像生成に失敗しました。';
      console.error('[Replicate] prediction failed:', prediction);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // ReplicateはURLを返すので全て返却（今回は1枚）
    // Animagine XL 3.1の出力形式を確認
    console.log('[Replicate] prediction.output:', JSON.stringify(prediction.output, null, 2));
    
    let imageUrls: string[] = [];
    const output = prediction.output;
    if (Array.isArray(output)) {
      imageUrls = output.slice(0, NUM_OUTPUTS) as string[];
    } else if (typeof output === 'string') {
      imageUrls = [output];
    } else if (output && typeof output === 'object') {
      const outputObj = output as Record<string, unknown>;
      const candidate = outputObj.url ?? outputObj.image ?? (Array.isArray(outputObj) ? outputObj[0] : undefined);
      if (candidate) {
        imageUrls = Array.isArray(candidate) ? (candidate as string[]) : [candidate as string];
      }
    }
    
    if (imageUrls.length === 0) {
      console.error('[Replicate] No image URLs found in output:', prediction.output);
      return NextResponse.json({ error: '画像URLを取得できませんでした。' }, { status: 500 });
    }

    // --- ポイント消費を確定（二重実行防止のため再確認して減算） ---
    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.points.findUnique({ where: { user_id: userId } });
        if (!current) {
          throw new Error(`ポイントが不足しています。${NUM_OUTPUTS}枚生成で${TOTAL_COST}ポイント必要です。`);
        }
        const currentTotal = (current.free_points ?? 0) + (current.paid_points ?? 0);
        if (currentTotal < TOTAL_COST) {
          throw new Error(`ポイントが不足しています。${NUM_OUTPUTS}枚生成で${TOTAL_COST}ポイント必要です。`);
        }

        const freeUse = Math.min(current.free_points ?? 0, TOTAL_COST);
        const paidUse = TOTAL_COST - freeUse;

        await tx.points.update({
          where: { user_id: userId },
          data: {
            free_points: { decrement: freeUse },
            paid_points: paidUse > 0 ? { decrement: paidUse } : undefined,
          },
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ポイント消費に失敗しました。';
      return NextResponse.json({ error: message }, { status: 402 });
    }

    return NextResponse.json({
      success: true,
      imageUrls,
    });
  } catch (error) {
    console.error('画像生成エラー:', error);
    return NextResponse.json(
      { error: '画像生成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

