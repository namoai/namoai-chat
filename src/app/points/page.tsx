"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Gift, CheckCircle } from 'lucide-react';

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

export default function PointPage() {
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPoints();
  }, []);

  const fetchPoints = async () => {
    try {
      const response = await fetch('/api/points');
      if (response.ok) {
        const data = await response.json();
        setPointsData(data);
      }
    } catch (error) {
      console.error("ポイントデータの取得に失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAttendance = async () => {
    if (pointsData?.attendedToday) return;
    try {
      const response = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attend' }),
      });
      const data = await response.json();
      setMessage(data.message);
      if (response.ok) {
        fetchPoints(); // ポイント情報を更新
      }
    } catch (error) {
      setMessage('エラーが発生しました。');
    }
  };
  
  const handleCharge = async (amount: number) => {
    // ここでは実際の決済は行わず、APIを呼び出すだけです。
    try {
      const response = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'charge', amount: amount }),
      });
      const data = await response.json();
      setMessage(data.message);
      if (response.ok) {
        fetchPoints(); // ポイント情報を更新
      }
    } catch (error) {
       setMessage('エラーが発生しました。');
    }
  };

  if (loading) {
    return <div className="bg-black min-h-screen text-white flex justify-center items-center">読み込み中...</div>;
  }

  const totalPoints = (pointsData?.free_points ?? 0) + (pointsData?.paid_points ?? 0);

  return (
    <div className="bg-black min-h-screen text-white p-4">
      <header className="relative flex justify-center items-center mb-6">
        <button onClick={() => window.history.back()} className="absolute left-0 p-2 rounded-full hover:bg-pink-500/20 transition-colors cursor-pointer">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">ポイント</h1>
      </header>

      {message && <div className="bg-pink-500/20 text-pink-300 p-3 rounded-lg mb-6 text-center">{message}</div>}

      <div className="bg-gray-900 p-6 rounded-lg mb-8">
        <p className="text-gray-400 text-sm">保有ポイント</p>
        <p className="text-4xl font-bold">{totalPoints.toLocaleString()}</p>
        <div className="mt-4 text-sm text-gray-500">
          <p>有料ポイント: {pointsData?.paid_points?.toLocaleString() ?? 0}</p>
          <p>無料ポイント: {pointsData?.free_points?.toLocaleString() ?? 0}</p>
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-lg mb-8">
        <h2 className="text-lg font-bold mb-4">毎日出席イベント</h2>
        <button 
          onClick={handleAttendance}
          disabled={pointsData?.attendedToday}
          className={`w-full p-4 rounded-lg font-bold transition-colors flex items-center justify-center ${
            pointsData?.attendedToday 
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
              : 'bg-pink-500 hover:bg-pink-600 cursor-pointer'
          }`}
        >
          {pointsData?.attendedToday ? (
            <>
              <CheckCircle className="mr-2" />
              <span>本日は出席済み</span>
            </>
          ) : (
            <>
              <Gift className="mr-2" />
              <span>出席して30ポイントGET</span>
            </>
          )}
        </button>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">ポイント購入</h2>
        <div className="space-y-4">
          {pointPackages.map(pkg => (
            <div key={pkg.yen} className="bg-gray-900 p-4 rounded-lg flex justify-between items-center">
              <div>
                <p className="text-lg font-bold">{pkg.points.toLocaleString()} ポイント</p>
                {pkg.bonus && <p className="text-sm text-pink-400">+{pkg.bonus} ボーナス</p>}
              </div>
              <button 
                onClick={() => handleCharge(pkg.points)}
                className="bg-pink-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-pink-600 transition-colors cursor-pointer"
              >
                ￥{pkg.yen.toLocaleString()}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
