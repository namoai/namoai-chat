"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError('セッションIDが見つかりません。');
      setLoading(false);
      return;
    }

    // 決済確認のため、セッション情報を確認してポイントを更新
    const checkPaymentAndRedirect = async () => {
      try {
        // Stripeセッション情報を確認
        const sessionResponse = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData.completed) {
            // ポイント情報を更新
            await fetch('/api/points', { method: 'GET', cache: 'no-store' });
            
            // 決済確認後、すぐにポイントページへリダイレクト
            // replaceを使用してヒストリーからこのページを完全に削除
            // これにより、戻るボタンでこのページに戻れなくなる
            setRedirecting(true);
            // ヒストリーを置き換えてから移動
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', '/points?payment_success=true');
            }
            router.replace('/points?payment_success=true');
            return;
          }
        }
      } catch (error) {
        console.error('決済確認エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    // 少し待ってから確認（ウェブフック処理時間を考慮）
    const timer = setTimeout(() => {
      checkPaymentAndRedirect();
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionId, router]);

  if (redirecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
          <p className="text-gray-400">ポイントページへ移動中...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
          <p className="text-gray-400">決済を確認しています...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 max-w-md w-full text-center">
          {error ? (
            <>
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h1 className="text-2xl font-bold mb-4 text-red-400">エラー</h1>
              <p className="text-gray-300 mb-6">{error}</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                決済が完了しました
              </h1>
              <p className="text-gray-300 mb-6">
                ポイントがアカウントに追加されました。
                <br />
                ポイントページでご確認ください。
              </p>
            </>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                // replaceを使用して、戻るボタンでこのページに戻れないようにする
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', '/points?payment_success=true');
                }
                router.replace('/points?payment_success=true');
              }}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all"
            >
              ポイントページへ
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', '/');
                }
                router.replace('/');
              }}
              className="border border-gray-700 hover:border-pink-400 text-white font-semibold py-3 px-6 rounded-xl transition-all"
            >
              ホームへ戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
