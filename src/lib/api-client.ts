/**
 * セキュリティ強化されたAPIクライアント
 * CSRFトークンとエラーハンドリングを含む
 */

import { fetchWithCsrf } from './csrf-client';
import { ErrorCode } from './error-handler';

export interface ApiError {
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * APIリクエストを実行（CSRF保護付き）
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetchWithCsrf(url, {
      ...options,
      credentials: 'include', // クッキーを含める
    });

    const data = await response.json();

    // エラーレスポンスの場合
    if (!response.ok) {
      const error = data as ApiError;
      throw new ApiErrorResponse(
        error.error.code as ErrorCode,
        error.error.message,
        response.status,
        error.error.requestId
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiErrorResponse) {
      throw error;
    }
    
    // ネットワークエラーなど
    throw new ApiErrorResponse(
      ErrorCode.SERVICE_UNAVAILABLE,
      'ネットワークエラーが発生しました。',
      503
    );
  }
}

/**
 * APIエラーレスポンスクラス
 */
export class ApiErrorResponse extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiErrorResponse';
  }
}

/**
 * GETリクエスト
 */
export function apiGet<T = unknown>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: 'GET' });
}

/**
 * POSTリクエスト
 */
export function apiPost<T = unknown>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUTリクエスト
 */
export function apiPut<T = unknown>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETEリクエスト
 */
export function apiDelete<T = unknown>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: 'DELETE' });
}

