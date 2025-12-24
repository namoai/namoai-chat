"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check, UserPlus, Gift, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';

type ReferralStats = {
  totalReferrals: number;
  totalRewardsEarned: number;
  successfulReferrals: number;
  pendingReferrals: number;
  recentReferrals: Array<{
    id: number;
    nickname: string;
    joinedAt: Date | string;
    rewardEarned: number;
    rewardDate: Date | string | null;
    isPending: boolean;
  }>;
};

export default function ReferralPage() {
  const router = useRouter();
  const [referralCode, setReferralCode] = useState<string>('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sessionRes, statsRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/referrals/stats'),
      ]);

      if (!sessionRes.ok || !statsRes.ok) {
        router.push('/login');
        return;
      }

      const sessionData = await sessionRes.json();
      const statsData = await statsRes.json();

      if (sessionData?.user?.referralCode) {
        setReferralCode(sessionData.user.referralCode);
      }

      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/MyPage"
              className="p-2 rounded-xl hover:bg-white/10 transition-all"
            >
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              紹介プログラム
            </h1>
          </div>
        </div>

        {/* 紹介コードカード */}
        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl p-6 md:p-8 border border-cyan-500/30 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <UserPlus className="text-cyan-400" size={28} />
            <h2 className="text-xl font-bold text-white">あなたの紹介コード</h2>
          </div>
          
          <div className="bg-black/30 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-400 mb-2">紹介コード</p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-3xl font-bold text-cyan-400 tracking-wider">
                {referralCode || '---'}
              </span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-all"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
                {copied ? 'コピー済み' : 'コピー'}
              </button>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-gray-300">
              <span className="text-cyan-400 font-semibold">1,000ポイント</span>獲得のチャンス！
            </p>
            <p className="text-gray-400">
              友達があなたのコードで登録し、<span className="text-white font-semibold">初回決済を完了</span>すると、
              あなたに1,000ポイントが付与されます。
            </p>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Users className="text-blue-400" size={20} />
              <p className="text-sm text-gray-400">総招待数</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.totalReferrals || 0}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="text-green-400" size={20} />
              <p className="text-sm text-gray-400">成功数</p>
            </div>
            <p className="text-2xl font-bold text-green-400">{stats?.successfulReferrals || 0}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-yellow-400" size={20} />
              <p className="text-sm text-gray-400">待機中</p>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{stats?.pendingReferrals || 0}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="text-cyan-400" size={20} />
              <p className="text-sm text-gray-400">獲得P</p>
            </div>
            <p className="text-2xl font-bold text-cyan-400">
              {stats?.totalRewardsEarned?.toLocaleString() || 0}
            </p>
          </div>
        </div>

        {/* 紹介履歴 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">最近の紹介</h3>
          
          {stats?.recentReferrals && stats.recentReferrals.length > 0 ? (
            <div className="space-y-3">
              {stats.recentReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="bg-black/20 rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-white mb-1">{referral.nickname}</p>
                    <p className="text-sm text-gray-400">
                      登録日: {new Date(referral.joinedAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div className="text-right">
                    {referral.isPending ? (
                      <span className="text-sm text-yellow-400 font-semibold">初回決済待ち</span>
                    ) : (
                      <div>
                        <p className="text-lg font-bold text-green-400">
                          +{referral.rewardEarned.toLocaleString()}P
                        </p>
                        <p className="text-xs text-gray-400">
                          {referral.rewardDate && new Date(referral.rewardDate).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UserPlus className="mx-auto mb-3 text-gray-600" size={48} />
              <p className="text-gray-400">まだ紹介がありません</p>
              <p className="text-sm text-gray-500 mt-2">
                友達にコードを共有して、ポイントを獲得しましょう！
              </p>
            </div>
          )}
        </div>

        {/* 利用方法 */}
        <div className="mt-6 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">利用方法</h3>
          <ol className="space-y-3 text-sm text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center font-bold">1</span>
              <span>上記の紹介コードを友達に共有します</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center font-bold">2</span>
              <span>友達が会員登録時に紹介コードを入力します</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center font-bold">3</span>
              <span>友達が初回ポイント購入を完了すると、自動的に1,000ポイントが付与されます</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

