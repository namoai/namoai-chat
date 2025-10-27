export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createClient } from '@supabase/supabase-js';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// ▼▼▼【追加】 キャラクター作成APIと同様のヘルパー関数をここに追加します。 ▼▼▼
// ───────────────────────────────────────────────────────────────
//  ランタイムで GCP サービスアカウント認証ファイルを保証
// ───────────────────────────────────────────────────────────────
async function ensureGcpCredsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;
  if (!raw && !b64) return;

  const fs = await import('node:fs/promises');
  const path = '/tmp/gcp-sa.json';
  const content = raw ?? Buffer.from(b64!, 'base64').toString('utf8');
  await fs.writeFile(path, content, { encoding: 'utf8' });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
}

// ───────────────────────────────────────────────────────────────
//  GCP プロジェクト ID を解決
// ───────────────────────────────────────────────────────────────
async function resolveGcpProjectId(): Promise<string> {
  const envProject =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GOOGLE_PROJECT_ID;
  if (envProject && envProject.trim().length > 0) return envProject.trim();

  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;
  try {
    if (raw || b64) {
      const jsonStr = raw ?? Buffer.from(b64!, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed?.project_id === 'string' && parsed.project_id) return parsed.project_id;
    }
  } catch {}

  try {
    const fs = await import('node:fs/promises');
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/tmp/gcp-sa.json';
    const buf = await fs.readFile(path, { encoding: 'utf8' });
    const parsed = JSON.parse(buf);
    if (typeof parsed?.project_id === 'string' && parsed.project_id) return parsed.project_id;
  } catch {}

  throw new Error('GCP project id が存在しません');
}

// ───────────────────────────────────────────────────────────────
//  Secret Manager からシークレットを取得
// ───────────────────────────────────────────────────────────────
async function loadSecret(name: string, version = 'latest') {
  const projectId = await resolveGcpProjectId();
  const client = new SecretManagerServiceClient({ fallback: true });
  const [acc] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/${version}`,
  });
  const value = acc.payload?.data ? Buffer.from(acc.payload.data).toString('utf8') : '';
  return value.trim(); // ▼▼▼【重要】前後の空白・改行を削除
}

// ───────────────────────────────────────────────────────────────
//  Supabase 関連の環境変数をランタイムで補完
// ───────────────────────────────────────────────────────────────
async function ensureSupabaseEnv() {
  await ensureGcpCredsFile();
  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = await loadSecret('SUPABASE_URL');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = await loadSecret('SUPABASE_SERVICE_ROLE_KEY');
  }

  // ▼▼▼【重要】Netlify環境変数に含まれる可能性のある空白・改行・タブを全て削除
  if (process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL
      .replace(/\s/g, '')  // 実際のホワイトスペース削除
      .replace(/\\n|\\r|\\t/g, '');  // リテラル文字列 \n \r \t 削除
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
      .replace(/\s/g, '')  // 実際のホワイトスペース削除
      .replace(/\\n|\\r|\\t/g, '');  // リテラル文字列 \n \r \t 削除
  }
  // ▲▲▲
}


// GET: 現在ログインしているユーザーのプロフィール情報を取得します
export async function GET() {
  const セッション = await getServerSession(authOptions);
  if (!セッション?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }
  const ユーザーID = parseInt(セッション.user.id, 10);
  try {
    const ユーザー = await prisma.users.findUnique({
      where: { id: ユーザーID },
      select: { nickname: true, bio: true, image_url: true, },
    });
    if (!ユーザー) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json(ユーザー);
  } catch (エラー) {
    console.error('プロファイル取得エラー:', エラー);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}


// PUT: ユーザーのプロフィール情報を更新します
export async function PUT(リクエスト: Request) {
  await ensureSupabaseEnv();

  const セッション = await getServerSession(authOptions);
  if (!セッション?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }
  const ユーザーID = parseInt(セッション.user.id, 10);

  try {
    const フォームデータ = await リクエスト.formData();
    const ニックネーム = フォームデータ.get('nickname') as string;
    const 自己紹介 = フォームデータ.get('bio') as string;
    const 画像ファイル = フォームデータ.get('image') as File | null;

    let 画像URL: string | undefined = undefined;

    if (画像ファイル && 画像ファイル.size > 0) {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const バケット名 = 'usersImage';

      if (!supabaseUrl || !serviceRoleKey) {
        console.error('[PUT] 環境変数不足: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        return NextResponse.json({ message: 'サーバー設定エラー（Storage接続情報不足）' }, { status: 500 });
      }

      const supabaseクライアント = createClient(supabaseUrl, serviceRoleKey);
      
      // 元のファイル名から英数字、ドット、ハイフン、アンダースコア以外を全てアンダースコア(_)に置換
      const 安全なファイル名 = 画像ファイル.name.replace(/[^\w.\-]/g, '_');
      const ファイル名 = `${Date.now()}-${安全なファイル名}`;
      const オブジェクトキー = `avatars/${ファイル名}`;
      
      const バッファ = Buffer.from(await 画像ファイル.arrayBuffer());

      const { error: アップロードエラー } = await supabaseクライアント.storage
        .from(バケット名)
        .upload(オブジェクトキー, バッファ, {
          contentType: 画像ファイル.type || 'application/octet-stream',
          upsert: false,
        });

      if (アップロードエラー) {
        console.error(`[PUT] Supabaseアップロード失敗:`, アップロードエラー);
        // ▼▼▼【修正】残っていた韓国語のコメントを日本語に修正しました。▼▼▼
        // エラーオブジェクト全体をログに出力して詳細を確認
        console.error(アップロードエラー); 
        return NextResponse.json({ message: '画像アップロードに失敗しました。' }, { status: 500 });
      }

      const { data: 公開URLデータ } = supabaseクライアント.storage.from(バケット名).getPublicUrl(オブジェクトキー);
      画像URL = 公開URLデータ.publicUrl;
    }

    const 更新後のユーザー = await prisma.users.update({
      where: { id: ユーザーID },
      data: {
        nickname: ニックネーム,
        bio: 自己紹介,
        // 画像URLが存在する場合のみ、データを更新
        ...(画像URL ? { image_url: 画像URL } : {}),
      },
    });

    return NextResponse.json({ message: 'プロフィールが正常に更新されました。', user: 更新後のユーザー });

  } catch (エラー) {
    console.error('プロファイル更新エラー:', エラー);
    if (エラー instanceof Prisma.PrismaClientKnownRequestError && エラー.code === 'P2002') {
      return NextResponse.json(
        { error: 'このニックネームは既に使用されています。' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}