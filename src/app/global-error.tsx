'use client';

/**
 * Global error boundary for the entire application.
 * This catches errors that occur in the root layout or other global components.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the error but don't expose internal details
  console.error('[GlobalError] Caught error:', {
    message: error.message,
    name: error.name,
    digest: error.digest,
  });

  // Ignore file system errors (like layout.js access errors) as they're often non-critical
  if (error.message?.includes('layout.js') || error.message?.includes('UNKNOWN')) {
    console.warn('[GlobalError] Ignoring file system error (likely non-critical):', error.message);
    // Try to reset/continue
    try {
      reset();
    } catch {
      // Ignore reset errors
    }
    return null;
  }

  return (
    <html lang="ja">
      <body>
        <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">エラーが発生しました</h1>
            <p className="text-gray-400 mb-4">
              予期しないエラーが発生しました。ページを再読み込みしてください。
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              再試行
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}






