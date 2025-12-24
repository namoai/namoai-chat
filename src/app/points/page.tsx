"use client";

import { Suspense, useState, useEffect, useCallback } from 'react';
// ▼▼▼【修正点】useRouterをインポートします ▼▼▼
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Gift, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';
import HelpModal from '@/components/HelpModal';
import { fetchWithCsrf } from "@/lib/csrf-client";

// ポイントデータの型定義
type PointsData = {
  free_points: number;
  paid_points: number;
  attendedToday: boolean;
};

// ポイント商品の型定義
type PointPackage = {
  yen: number;
  points: number;
  bonus?: number;
};

const pointPackages: PointPackage[] = [
  { yen: 1100, points: 2200 },
  { yen: 2200, points: 4400 },
  { yen: 5500, points: 11000 },
  { yen: 11000, points: 30000 },
];

// ▼▼▼【修正点】汎用モーダルコンポーネントを追加 ▼▼▼
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
};

const CustomModal = ({ isOpen, onClose, title, message }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        <p className="text-sm text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end">
          <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-lg">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

function PointPageContent() {
  // ▼▼▼【修正点】useRouterを使用します ▼▼▼
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ▼▼▼【修正点】モーダル用のstateを追加 ▼▼▼
  const [modalState, setModalState] = useState({ isOpen: false, title: '', message: '' });
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  const closeModal = () => setModalState({ isOpen: false, title: '', message: '' });

  const fetchPoints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/points');
      if (response.ok) {
        const data = await response.json();
        setPointsData(data);
      } else {
        throw new Error('ポイントデータの取得に失敗しました。');
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'ポイントデータの取得に失敗しました。';
      setError(message);
      setPointsData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 決済成功後のリダイレクトパラメータを処理
  useEffect(() => {
    const paymentSuccess = searchParams.get('payment_success');
    const sessionId = searchParams.get('session_id');
    const paymentCancelled = searchParams.get('payment_cancelled');

    if (paymentSuccess === 'true' && sessionId) {
      // 決済成功を確認してポイントを更新
      const verifyPayment = async () => {
        try {
          const sessionResponse = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.completed) {
              // ポイント情報を更新
              await fetchPoints();
              // 成功メッセージを表示
              setShowPaymentSuccess(true);
            }
          }
        } catch (error) {
          console.error('決済確認エラー:', error);
        }
      };
      verifyPayment();
    }

    if (paymentCancelled === 'true') {
      setModalState({
        isOpen: true,
        title: 'お知らせ',
        message: '決済がキャンセルされました。'
      });
    }

    // URLパラメータをクリーンアップ（ヒストリーから削除）
    if (typeof window !== 'undefined' && (paymentSuccess || paymentCancelled || sessionId)) {
      window.history.replaceState(null, '', '/points');
    }
  }, [searchParams, fetchPoints]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  const handleAttendance = async () => {
    if (pointsData?.attendedToday) return;
    try {
      const response = await fetchWithCsrf('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attend' }),
      });
      const data = await response.json();
      setModalState({ isOpen: true, title: 'お知らせ', message: data.message });
      if (response.ok) {
        fetchPoints(); // ポイント情報を更新
      }
    } catch (error) {
      console.error('毎日出席イベント処理エラー:', error);
      setModalState({ isOpen: true, title: 'エラー', message: 'エラーが発生しました。' });
    }
  };
  
  const handleCharge = async (points: number) => {
    try {
      setLoading(true);
      console.log('ポイント購入開始:', { points });
      
      const response = await fetchWithCsrf('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });
      
      console.log('API応答:', { status: response.status, ok: response.ok });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'レスポンスの解析に失敗しました' }));
        const errorMsg = errorData.details 
          ? `${errorData.error}\n詳細: ${errorData.details}` 
          : errorData.error || '決済セッションの作成に失敗しました。';
        console.error('決済エラー:', { status: response.status, errorData });
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log('決済セッション作成成功:', { sessionId: data.sessionId, hasUrl: !!data.url });
      
      // Stripe Checkoutページへリダイレクト
      if (data.url) {
        console.log('Stripe Checkoutへリダイレクト:', data.url);
        window.location.href = data.url;
      } else {
        console.error('URLが存在しません:', data);
        throw new Error('決済URLが取得できませんでした。Stripe APIキーを確認してください。');
      }
    } catch (error) {
      console.error('ポイント課金処理エラー:', error);
      const message = error instanceof Error ? error.message : 'エラーが発生しました。';
      setModalState({ isOpen: true, title: 'エラー', message });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  const totalPoints = (pointsData?.free_points ?? 0) + (pointsData?.paid_points ?? 0);

  return (
    <>
      <CustomModal {...modalState} onClose={closeModal} />
      {/* 決済成功確認モーダル */}
      {showPaymentSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-4 text-center">決済が完了しました</h2>
            <p className="text-sm text-gray-300 mb-6 text-center">
              ポイントがアカウントに追加されました。
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowPaymentSuccess(false);
                  // このページに留まる
                }}
                className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                このページに留まる
              </button>
              <button
                onClick={() => {
                  setShowPaymentSuccess(false);
                  router.push('/');
                }}
                className="border border-gray-700 hover:border-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-black min-h-screen text-white">
        {/* 背景装飾 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
            <header className="relative flex justify-center items-center mb-8">
              <button onClick={() => router.back()} className="absolute left-0 p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-yellow-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                ポイント
              </h1>
              <Link
                href="/points/history"
                className="absolute left-12 px-3 py-2 text-sm rounded-xl bg-gray-900/50 hover:bg-gray-800/50 border border-gray-700/50 hover:border-blue-500/30 transition-all"
              >
                履歴
              </Link>
              <button
                onClick={() => setIsHelpOpen(true)}
                className="absolute right-0 p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all"
                aria-label="ヘルプ"
              >
                <HelpCircle size={24} />
              </button>
            </header>

            {pointsData ? (
              <>
                <div className="bg-gradient-to-r from-yellow-500/20 via-blue-500/20 to-cyan-500/20 backdrop-blur-sm p-6 md:p-8 rounded-2xl mb-8 border border-gray-800/50">
                  <p className="text-gray-400 text-sm mb-2">保有ポイント</p>
                  <p className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    {totalPoints.toLocaleString()}
                  </p>
                  <div className="mt-4 text-sm text-gray-400 space-y-1">
                    <p>有料ポイント: <span className="text-blue-400 font-semibold">{pointsData.paid_points.toLocaleString()}</span></p>
                    <p>無料ポイント: <span className="text-yellow-400 font-semibold">{pointsData.free_points.toLocaleString()}</span></p>
                  </div>
                </div>

                <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl mb-8 border border-gray-800/50">
                  <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    毎日出席イベント
                  </h2>
                  <button 
                    onClick={handleAttendance}
                    disabled={pointsData.attendedToday}
                    className={`w-full p-5 rounded-xl font-bold transition-all flex items-center justify-center ${
                      pointsData.attendedToday 
                        ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border border-gray-700/50' 
                        : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 cursor-pointer shadow-lg shadow-blue-500/30'
                    }`}
                  >
                    {pointsData.attendedToday ? (
                      <>
                        <CheckCircle className="mr-2" size={24} />
                        <span>本日は出席済み</span>
                      </>
                    ) : (
                      <>
                        <Gift className="mr-2" size={24} />
                        <span>出席して30ポイントGET</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    ポイント購入
                  </h2>
                  <div className="text-sm text-gray-400 mb-4 space-y-1">
                    <p>• 決済には親権者（法定代理人）の同意が必要です。</p>
                    <p>• 購入したポイントの有効期限は購入日から1年間です。</p>
                    <p>• 1ポイント = 約0.33円（10,000円 = 30,000ポイント）</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pointPackages.map(pkg => (
                      <div key={pkg.yen} className="bg-gray-900/50 backdrop-blur-sm p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 border border-gray-800/50 hover:border-blue-500/30 transition-all">
                        <div>
                          <p className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                            {pkg.points.toLocaleString()} ポイント
                          </p>
                          {pkg.bonus && (
                            <p className="text-sm text-blue-400 mt-1">+{pkg.bonus} ボーナス</p>
                          )}
                        </div>
                        <button 
                          onClick={() => handleCharge(pkg.points)}
                          disabled={loading}
                          className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 whitespace-nowrap"
                        >
                          {loading ? '処理中...' : `￥${pkg.yen.toLocaleString()}`}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 text-center">
                <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  ポイントデータを取得できませんでした
                </h2>
                <p className="text-gray-400 mb-6">{error ?? '時間をおいて再度お試しください。'}</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={fetchPoints}
                    className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-2 px-6 rounded-xl transition-all"
                  >
                    再読み込み
                  </button>
                  <button
                    onClick={() => router.back()}
                    className="border border-gray-700 hover:border-blue-400 text-white font-semibold py-2 px-6 rounded-xl transition-all"
                  >
                    戻る
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="ポイントページの使い方"
        content={
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-blue-400 mb-2">概要</h3>
              <p className="text-gray-300">
                ポイントページでは、保有ポイントの確認、毎日出席イベントへの参加、ポイントの購入ができます。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-400 mb-2">ポイントの種類</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-2">
                <li><strong className="text-blue-400">有料ポイント:</strong> 購入したポイントです。すべての機能で使用できます。有効期限は購入日から1年間です。</li>
                <li><strong className="text-yellow-400">無料ポイント:</strong> 毎日出席イベントなどで獲得できるポイントです。基本的な機能で使用できます。有効期限は獲得日から1年間です。</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">毎日出席イベント</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-2">
                <li>毎日1回、出席ボタンをクリックすると30ポイントを獲得できます</li>
                <li>1日1回のみ参加可能です（リセット時間: 午前0時）</li>
                <li>出席済みの場合は、ボタンが無効化されます</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">ポイント購入</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-2">
                <li>複数のポイントパッケージから選択して購入できます</li>
                <li>購入したポイントは即座にアカウントに反映されます</li>
                <li>ポイントはチャット機能などで使用できます</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">ポイントの使用</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-2">
                <li><strong>チャット:</strong> 1回のチャットで5ポイント消費されます</li>
                <li><strong>画像生成:</strong> 1枚の画像生成で5ポイント消費されます</li>
                <li>無料ポイントが優先的に消費され、不足分は有料ポイントから消費されます</li>
                <li>ポイントが不足している場合は、機能を使用できません</li>
                <li><strong>取得・使用履歴は<a href="/points/history" className="text-blue-400 hover:underline">ポイント履歴ページ</a>で確認できます</strong></li>
              </ul>
            </div>
          </div>
        }
      />
    </>
  );
}

export default function PointPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-gray-400">ポイント情報を読み込み中...</p>
          </div>
        </div>
      }
    >
      <PointPageContent />
    </Suspense>
  );
}
