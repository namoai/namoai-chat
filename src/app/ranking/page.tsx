"use client";

import { useState, useEffect } from "react";
// ▼▼▼【修正点】useRouter と Link をインポートします ▼▼▼
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Crown, Flame, MessageSquare, ArrowLeft } from "lucide-react";
import Image from "next/image";

// キャラクターのデータ型
type RankedCharacter = {
  id: number;
  name: string;
  description: string | null;
  characterImages: { imageUrl: string }[];
  chatCount: number;
};

// タブの種類
type Period = "realtime" | "daily" | "weekly" | "monthly";

export default function RankingPage() {
  // ▼▼▼【修正点】useRouterを使用します ▼▼▼
  const router = useRouter();
  const [ranking, setRanking] = useState<RankedCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Period>("realtime");

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/ranking?period=${activeTab}`);
        if (!response.ok) throw new Error("ランキングデータの取得に失敗しました");
        const data = await response.json();
        setRanking(data);
      } catch (error) {
        console.error(error);
        setRanking([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [activeTab]);

  const getTabClassName = (tabName: Period) => {
    return `px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
      activeTab === tabName
        ? "bg-pink-500 text-white"
        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
    }`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 0) return "text-yellow-400";
    if (rank === 1) return "text-gray-400";
    if (rank === 2) return "text-yellow-600";
    return "text-gray-500";
  };

  return (
    <div className="bg-black min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
          <header className="relative flex justify-center items-center mb-8">
            <button
              onClick={() => router.back()}
              className="absolute left-0 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              ランキング
            </h1>
          </header>

          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {(["realtime", "daily", "weekly", "monthly"] as Period[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30"
                    : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white"
                }`}
              >
                {tab === "realtime" ? "リアルタイム" : tab === "daily" ? "日間" : tab === "weekly" ? "週間" : "月間"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center items-center py-16">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                  <p className="text-gray-400">ランキングを読み込んでいます...</p>
                </div>
              </div>
            ) : ranking.length > 0 ? (
              ranking.map((char, index) => {
                const src = char.characterImages[0]?.imageUrl || "https://placehold.co/100x100/1a1a1a/ffffff?text=?";
                return (
                  <Link
                    href={`/characters/${char.id}`}
                    key={char.id}
                    className="group flex items-center bg-gray-900/50 backdrop-blur-sm p-4 rounded-xl hover:bg-gray-800/50 transition-all border border-gray-800/50 hover:border-pink-500/30"
                  >
                    <div className="flex items-center w-16 flex-shrink-0 justify-center">
                      {index < 3 ? (
                        <div className="relative">
                          <Crown size={32} className={getRankColor(index)} />
                          {index === 0 && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                          )}
                        </div>
                      ) : (
                        <span className={`text-2xl font-bold ${getRankColor(index)}`}>
                          {index + 1}
                        </span>
                      )}
                    </div>

                    <div className="relative w-20 h-20 mr-4 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
                      <Image
                        src={src}
                        alt={char.name}
                        fill
                        sizes="80px"
                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>

                    <div className="flex-grow overflow-hidden min-w-0">
                      <h3 className="font-bold text-lg truncate group-hover:text-pink-400 transition-colors">
                        {char.name}
                      </h3>
                      <p className="text-sm text-gray-400 truncate">
                        {char.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-gray-400 flex-shrink-0 ml-4 px-4 py-2 rounded-lg bg-gray-800/50">
                      {activeTab === "realtime" ? (
                        <Flame size={18} className="text-pink-400" />
                      ) : (
                        <MessageSquare size={18} />
                      )}
                      <span className="text-base font-bold">
                        {char.chatCount}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">
                  表示するランキング情報がありません。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}