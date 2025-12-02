/**
 * IT環境から混紡環境へのキャラクター移行API
 * Character migration API from IT environment to staging environment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { isIntegration } from '@/lib/environment';

export async function POST(request: NextRequest) {
  try {
    // 認証確認
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '認証が必要です。', message: 'Authentication required.' },
        { status: 401 }
      );
    }

    // IT環境でのみ実行可能
    // Only executable in IT environment
    if (!isIntegration()) {
      return NextResponse.json(
        { 
          error: 'この機能はIT環境でのみ利用可能です。',
          message: 'This feature is only available in IT environment.'
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { characterId } = body;

    if (!characterId) {
      return NextResponse.json(
        { 
          error: 'キャラクターIDが必要です。',
          message: 'Character ID is required.'
        },
        { status: 400 }
      );
    }

    // 混紡環境のURLを取得
    // Get staging environment URL
    const stagingUrl = process.env.NEXT_PUBLIC_STAGING_API_URL || 
                       process.env.NEXT_PUBLIC_STAGING_URL || 
                       '';

    if (!stagingUrl) {
      return NextResponse.json(
        { 
          error: '混紡環境のURLが設定されていません。',
          message: 'Staging environment URL is not configured.'
        },
        { status: 500 }
      );
    }

    // 混紡環境への移行URLを返す
    // Return migration URL to staging environment
    const migrationUrl = `${stagingUrl}/characters/${characterId}`;

    return NextResponse.json({
      success: true,
      migrationUrl,
      message: '混紡環境への移行URLを取得しました。',
      messageEn: 'Migration URL to staging environment retrieved.'
    });

  } catch (error) {
    console.error('[migrate-to-staging] Error:', error);
    return NextResponse.json(
      { 
        error: '移行処理中にエラーが発生しました。',
        message: 'An error occurred during migration.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

