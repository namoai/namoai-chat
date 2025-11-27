"use client";

import { useState, useEffect } from 'react';
// ▼▼▼【修正点】useRouterをインポートします ▼▼▼
import { useRouter } from 'next/navigation';
import { ArrowLeft, Gift, CheckCircle, HelpCircle } from 'lucide-react';
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
  { yen: 1100, points: 100 },
  { yen: 2200, points: 250 },
  { yen: 5500, points: 700 },
  { yen: 11000, points: 1500 },
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
          <button onClick={onClose} className="bg-pink-600 hover:bg-pink-700 py-2 px-4 rounded-lg">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default function PointPage() {
  // ▼▼▼【修正点】useRouterを使用します ▼▼▼
  const router = useRouter();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  // ▼▼▼【修正点】モーダル用のstateを追加 ▼▼▼
  const [modalState, setModalState] = useState({ isOpen: false, title: '', message: '' });
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    fetchPoints();
  }, []);

  const closeModal = () => setModalState({ isOpen: false, title: '', message: '' });

  const fetchPoints = async () => {
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
      setModalState({ isOpen: true, title: 'エラー', message: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

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
  
  const handleCharge = async (amount: number) => {
    try {
      const response = await fetchWithCsrf('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'charge', amount: amount }),
      });
      const data = await response.json();
      setModalState({ isOpen: true, title: 'お知らせ', message: data.message });
      if (response.ok) {
        fetchPoints(); // ポイント情報を更新
      }
    } catch (error) {
       console.error('ポイント課金処理エラー:', error);
       setModalState({ isOpen: true, title: 'エラー', message: 'エラーが発生しました。' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  const totalPoints = (pointsData?.free_points ?? 0) + (pointsData?.paid_points ?? 0);

  return (
    <>
      <CustomModal {...modalState} onClose={closeModal} />
      <div className="bg-black min-h-screen text-white">
        {/* 背景装飾 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
            <header className="relative flex justify-center items-center mb-8">
              <button onClick={() => router.back()} className="absolute left-0 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                ポイント
              </h1>
              <button
                onClick={() => setIsHelpOpen(true)}
                className="absolute right-0 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
                aria-label="ヘルプ"
              >
                <HelpCircle size={24} />
              </button>
            </header>

            <div className="bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-purple-500/20 backdrop-blur-sm p-6 md:p-8 rounded-2xl mb-8 border border-gray-800/50">
              <p className="text-gray-400 text-sm mb-2">保有ポイント</p>
              <p className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                {totalPoints.toLocaleString()}
              </p>
              <div className="mt-4 text-sm text-gray-400 space-y-1">
                <p>有料ポイント: <span className="text-pink-400 font-semibold">{pointsData?.paid_points?.toLocaleString() ?? 0}</span></p>
                <p>無料ポイント: <span className="text-yellow-400 font-semibold">{pointsData?.free_points?.toLocaleString() ?? 0}</span></p>
              </div>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl mb-8 border border-gray-800/50">
              <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                毎日出席イベント
              </h2>
              <button 
                onClick={handleAttendance}
                disabled={pointsData?.attendedToday}
                className={`w-full p-5 rounded-xl font-bold transition-all flex items-center justify-center ${
                  pointsData?.attendedToday 
                    ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border border-gray-700/50' 
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 cursor-pointer shadow-lg shadow-pink-500/30'
                }`}
              >
                {pointsData?.attendedToday ? (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pointPackages.map(pkg => (
                  <div key={pkg.yen} className="bg-gray-900/50 backdrop-blur-sm p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 border border-gray-800/50 hover:border-pink-500/30 transition-all">
                    <div>
                      <p className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        {pkg.points.toLocaleString()} ポイント
                      </p>
                      {pkg.bonus && (
                        <p className="text-sm text-pink-400 mt-1">+{pkg.bonus} ボーナス</p>
                      )}
                    </div>
                    <button 
                      onClick={() => handleCharge(pkg.points)}
                      className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-pink-500/30 whitespace-nowrap"
                    >
                      ￥{pkg.yen.toLocaleString()}
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
              <h3 className="text-lg font-semibold text-pink-400 mb-2">概要</h3>
              <p className="text-gray-300">
                ポイントページでは、保有ポイントの確認、毎日出席イベントへの参加、ポイントの購入ができます。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">ポイントの種類</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-2">
                <li><strong className="text-pink-400">有料ポイント:</strong> 購入したポイントです。すべての機能で使用できます。</li>
                <li><strong className="text-yellow-400">無料ポイント:</strong> 毎日出席イベントなどで獲得できるポイントです。基本的な機能で使用できます。</li>
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
                <li>チャット機能を使用する際にポイントが消費されます</li>
                <li>有料ポイントと無料ポイントは自動的に適切に使用されます</li>
                <li>ポイントが不足している場合は、チャット機能を使用できません</li>
              </ul>
            </div>
          </div>
        }
      />
    </>
  );
}
