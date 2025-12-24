"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, TrendingDown, TrendingUp, Calendar, Filter } from 'lucide-react';

type HistoryItem = {
  id: number;
  category: 'earn' | 'spend';
  points: number;
  type?: 'free' | 'paid';
  balance?: number;
  source?: string;
  usage_type?: string;
  description?: string;
  acquired_at?: string;
  expires_at?: string;
  created_at: string;
};

type BalanceDetail = {
  id: number;
  type: 'free' | 'paid';
  balance: number;
  expiresAt: string;
  source: string;
};

export default function PointHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [balanceDetails, setBalanceDetails] = useState<BalanceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'earn' | 'spend'>('all');
  const [totalBalance, setTotalBalance] = useState({ free: 0, paid: 0, total: 0 });

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [historyRes, balanceRes] = await Promise.all([
        fetch(`/api/points/history?type=${filter}`),
        fetch('/api/points/balance'),
      ]);

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
      }

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setTotalBalance({
          free: balanceData.totalFreePoints || 0,
          paid: balanceData.totalPaidPoints || 0,
          total: balanceData.totalPoints || 0,
        });
        setBalanceDetails(balanceData.details || []);
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceLabel = (source?: string, usageType?: string) => {
    if (source) {
      const labels: Record<string, string> = {
        attendance: '出席チェック',
        purchase: 'ポイント購入',
        admin_grant: '管理者付与',
        migration: 'データ移行',
      };
      return labels[source] || source;
    }
    if (usageType) {
      const labels: Record<string, string> = {
        chat: 'チャット',
        image_generation: '画像生成',
        boost: 'ブースト',
        other: 'その他',
      };
      return labels[usageType] || usageType;
    }
    return '不明';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
          {/* ヘッダー */}
          <header className="relative flex items-center justify-between mb-8">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              ポイント履歴
            </h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </header>

          {/* 残高サマリー */}
          <div className="bg-gradient-to-r from-yellow-500/20 via-blue-500/20 to-cyan-500/20 backdrop-blur-sm p-6 rounded-2xl mb-6 border border-gray-800/50">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="text-yellow-400" size={24} />
              <h2 className="text-xl font-bold">現在の残高</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-yellow-400">{totalBalance.free.toLocaleString()}</p>
                <p className="text-sm text-gray-400">無料</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{totalBalance.paid.toLocaleString()}</p>
                <p className="text-sm text-gray-400">有料</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalBalance.total.toLocaleString()}</p>
                <p className="text-sm text-gray-400">合計</p>
              </div>
            </div>
          </div>

          {/* 有効期限別の残高 */}
          {balanceDetails.length > 0 && (
            <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl mb-6 border border-gray-800/50">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="text-blue-400" size={20} />
                <h3 className="text-lg font-semibold">有効期限別の残高</h3>
              </div>
              <div className="space-y-3">
                {balanceDetails.map((detail) => {
                  const daysUntilExpiry = Math.ceil(
                    (new Date(detail.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  const isExpiringSoon = daysUntilExpiry <= 30;

                  return (
                    <div
                      key={detail.id}
                      className={`flex justify-between items-center p-3 rounded-lg ${
                        isExpiringSoon ? 'bg-red-500/10 border border-red-500/30' : 'bg-white/5'
                      }`}
                    >
                      <div>
                        <p className="font-semibold">
                          {detail.balance.toLocaleString()} P
                          <span className={`ml-2 text-sm ${detail.type === 'free' ? 'text-yellow-400' : 'text-blue-400'}`}>
                            ({detail.type === 'free' ? '無料' : '有料'})
                          </span>
                        </p>
                        <p className="text-sm text-gray-400">{getSourceLabel(detail.source)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm ${isExpiringSoon ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                          {isExpiringSoon && '⚠️ '} {daysUntilExpiry}日後に失効
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(detail.expiresAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* フィルター */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                filter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              <Filter size={16} />
              すべて
            </button>
            <button
              onClick={() => setFilter('earn')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                filter === 'earn'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              <TrendingUp size={16} />
              取得
            </button>
            <button
              onClick={() => setFilter('spend')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                filter === 'spend'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              <TrendingDown size={16} />
              使用
            </button>
          </div>

          {/* 履歴リスト */}
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-16">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p>履歴がありません</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {history.map((item) => (
                  <div key={`${item.category}-${item.id}`} className="p-4 hover:bg-white/5 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            item.category === 'earn' ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}
                        >
                          {item.category === 'earn' ? (
                            <TrendingUp className="text-green-400" size={20} />
                          ) : (
                            <TrendingDown className="text-red-400" size={20} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">
                            {getSourceLabel(item.source, item.usage_type)}
                          </p>
                          {item.description && (
                            <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">{formatDate(item.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-xl font-bold ${
                            item.category === 'earn' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {item.category === 'earn' ? '+' : '-'}
                          {item.points.toLocaleString()} P
                        </p>
                        {item.balance !== undefined && item.category === 'earn' && (
                          <p className="text-sm text-gray-400 mt-1">
                            残高: {item.balance.toLocaleString()} P
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
