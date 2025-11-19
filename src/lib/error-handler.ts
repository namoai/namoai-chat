/**
 * セキュリティ強化: エラーハンドリング改善
 * エラー応答フォーマットの統一、内部情報の露出防止
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';
import { NextRequest } from 'next/server';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * エラーコード定義
 */
export enum ErrorCode {
  // 認証エラー
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // バリデーションエラー
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // リソースエラー
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  
  // サーバーエラー
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // レート制限
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // CSRFエラー
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
}

/**
 * エラーレスポンスを作成
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  requestId?: string
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  return NextResponse.json(response, { status: statusCode });
}

/**
 * エラーを安全に処理（内部情報を隠す）
 */
export function handleError(
  error: unknown,
  request?: NextRequest,
  userId?: string
): NextResponse<ErrorResponse> {
  // リクエストIDを生成（トレーシング用）
  const requestId = request?.headers.get('x-request-id') || 
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // エラーの種類を判定
  if (error instanceof Error) {
    // 既知のエラーコードを持つエラー
    if ('code' in error && typeof error.code === 'string') {
      const errorCode = error.code as ErrorCode;
      
      // クライアント向けエラー（400番台）
      if ([ErrorCode.UNAUTHORIZED, ErrorCode.FORBIDDEN, ErrorCode.VALIDATION_ERROR].includes(errorCode)) {
        logger.warn('Client error', {
          userId,
          error: {
            name: error.name,
            message: error.message,
          },
          requestId,
        });
        
        const statusCode = errorCode === ErrorCode.UNAUTHORIZED ? 401 :
                          errorCode === ErrorCode.FORBIDDEN ? 403 :
                          errorCode === ErrorCode.VALIDATION_ERROR ? 400 : 400;
        
        return createErrorResponse(errorCode, error.message, statusCode, requestId);
      }
    }

    // 認証関連のエラー
    if (error.message.includes('認証') || error.message.includes('authentication')) {
      logger.warn('Authentication error', {
        userId,
        error: {
          name: error.name,
          message: error.message,
        },
        requestId,
      });
      return createErrorResponse(ErrorCode.UNAUTHORIZED, '認証が必要です。', 401, requestId);
    }

    // 権限関連のエラー
    if (error.message.includes('権限') || error.message.includes('permission')) {
      logger.warn('Permission error', {
        userId,
        error: {
          name: error.name,
          message: error.message,
        },
        requestId,
      });
      return createErrorResponse(ErrorCode.FORBIDDEN, 'この操作を実行する権限がありません。', 403, requestId);
    }

    // バリデーションエラー
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      logger.warn('Validation error', {
        userId,
        error: {
          name: error.name,
          message: error.message,
        },
        requestId,
      });
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, '入力値が正しくありません。', 400, requestId);
    }
  }

  // その他のエラー（内部情報を隠す）
  logger.error('Internal server error', {
    userId,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { message: String(error) },
    requestId,
  });

  // 本番環境では詳細なエラー情報を隠す
  const isProduction = process.env.NODE_ENV === 'production';
  const publicMessage = isProduction
    ? 'サーバーでエラーが発生しました。しばらくしてから再度お試しください。'
    : error instanceof Error ? error.message : '不明なエラーが発生しました。';

  return createErrorResponse(ErrorCode.INTERNAL_ERROR, publicMessage, 500, requestId);
}

/**
 * 非同期関数をエラーハンドラーでラップ
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  request?: NextRequest,
  userId?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error, request, userId);
    }
  }) as T;
}

/**
 * APIルート用のエラーハンドラーミドルウェア
 */
export function apiErrorHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleError(error, request);
    }
  };
}

