/**
 * クライアント側CSRFトークン管理
 */

let csrfToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

/**
 * CSRFトークンを取得（キャッシュ付き）
 */
export async function getCsrfToken(): Promise<string> {
  // 既にトークンがある場合はそれを返す
  if (csrfToken) {
    return csrfToken;
  }

  // 既に取得中の場合はそのPromiseを返す
  if (tokenPromise) {
    return tokenPromise;
  }

  // 新しいトークンを取得
  tokenPromise = fetch('/api/csrf-token')
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('CSRFトークンの取得に失敗しました');
      }
      const data = await response.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    })
    .catch((error) => {
      tokenPromise = null;
      throw error;
    });

  return tokenPromise;
}

/**
 * CSRFトークンをリセット（ログアウト時など）
 */
export function resetCsrfToken(): void {
  csrfToken = null;
  tokenPromise = null;
}

/**
 * fetchリクエストにCSRFトークンを自動的に追加
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getCsrfToken();
  
  const headers = new Headers(options.headers);
  headers.set('x-csrf-token', token);
  
  return fetch(url, {
    ...options,
    headers,
  });
}

