"use client";

import { useState, useEffect } from "react";

interface Activity {
  id: number;
  type: string;
  message: string;
  timeAgo: string;
}

interface UserStats {
  followers: number;
  following: number;
  characterCount: number;
  loading: boolean;
}

export default function MyPageRightSidebar() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({ followers: 0, following: 0, characterCount: 0, loading: true });

  useEffect(() => {
    // 簡易的な活動履歴（実際のAPIがなければ空配列）
    // TODO: 実際のAPIエンドポイントが用意されたら実装
    const mockActivities: Activity[] = [
      { id: 1, type: "chat", message: "新しいチャットを開始", timeAgo: "2時間前" },
      { id: 2, type: "character", message: "キャラクターを作成", timeAgo: "1日前" },
    ];
    
    setTimeout(() => {
      setActivities(mockActivities);
      setActivitiesLoading(false);
    }, 300);

    // ユーザー統計データ取得
    const fetchUserStats = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session');
        if (!sessionRes.ok) return;
        const session = await sessionRes.json();
        if (!session?.user?.id) return;

        const userId = session.user.id;
        const profileRes = await fetch(`/api/profile/${userId}`);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setStats({
            followers: profileData._count?.followers || 0,
            following: profileData._count?.following || 0,
            characterCount: profileData.characters?.length || 0,
            loading: false
          });
        } else {
          setStats(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error("ユーザー統計取得エラー:", error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchUserStats();
  }, []);

  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  if (activitiesLoading || stats.loading) {
    return (
      <aside className="w-80 flex-shrink-0 bg-black/80 backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto">
        <div className="flex justify-center items-center py-8">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 flex-shrink-0 bg-black/80 backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto">
      {/* ユーザー統計 */}
      <div className="mb-6">
        <h3 className="font-semibold mb-4 text-gray-300">ユーザー統計</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <span className="text-sm text-gray-400">フォロワー</span>
            <span className="text-sm text-white font-semibold">
              {formatNumber(stats.followers)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <span className="text-sm text-gray-400">フォロー中</span>
            <span className="text-sm text-white font-semibold">
              {formatNumber(stats.following)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <span className="text-sm text-gray-400">作成キャラ</span>
            <span className="text-sm text-white font-semibold">
              {formatNumber(stats.characterCount)}
            </span>
          </div>
        </div>
      </div>

      {/* 最近のアクティビティ */}
      <div className="mb-6">
        <h3 className="font-semibold mb-4 text-gray-300">最近のアクティビティ</h3>
        <div className="space-y-3">
          {activities.length > 0 ? (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <p className="text-sm text-gray-300 mb-1">{activity.message}</p>
                <p className="text-xs text-gray-500">{activity.timeAgo}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              アクティビティがありません
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

