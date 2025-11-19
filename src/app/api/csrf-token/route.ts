/**
 * CSRFトークン取得エンドポイント
 */
import { NextRequest, NextResponse } from 'next/server';
import { generateAndSetCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { response } = await generateAndSetCsrfToken();
    
    logger.debug('CSRF token generated', {
      ip: getClientIp(request),
    });
    
    return response;
  } catch (error) {
    logger.error('Failed to generate CSRF token', {
      error: error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : {
            name: 'UnknownError',
            message: String(error),
          },
    });
    
    return NextResponse.json(
      { error: 'CSRFトークンの生成に失敗しました。' },
      { status: 500 }
    );
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

