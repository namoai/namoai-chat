"use client";

import { useState, useEffect } from 'react';
// useRouterフックはエラーの原因となるため削除し、標準のブラウザ機能を使用します。
import { Crown, Flame, MessageSquare, ArrowLeft } from 'lucide-react';

// キャラクターのデータ型を定義します。
type RankedCharacter = {
  id: number;
  name: string;
  description: string | null;
  characterImages: { imageUrl: string }[];
  chatCount: number; // APIから受け取ったチャット数
};

// タブの種類を定義します。
type Period = 'realtime' | 'daily' | 'weekly' | 'monthly';

export default function RankingPage() {
  // useRouterは削除しました。
  const [ranking, setRanking] = useState<RankedCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Period>('realtime');

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/ranking?period=${activeTab}`);
        if (!response.ok) throw new Error('ランキングデータの取得に失敗しました');
        const data = await response.json();
        setRanking(data);
      } catch (error) {
        console.error(error);
        setRanking([]); // エラー発生時はランキングを空にします。
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [activeTab]); // activeTabが変更されるたびにデータを再取得します。

  const getTabClassName = (tabName: Period) => {
    // ▼▼▼ 変更点: ボタンにカーソルポインターを追加 ▼▼▼
    return `px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
      activeTab === tabName
        ? 'bg-pink-500 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;
  };
  
  const getRankColor = (rank: number) => {
    if (rank === 0) return 'text-yellow-400';
    if (rank === 1) return 'text-gray-400';
    if (rank === 2) return 'text-yellow-600';
    return 'text-gray-500';
  };

  return (
    <div className="bg-black min-h-screen text-white p-4">
      {/* ヘッダーに「戻る」ボタンを追加 */}
      <header className="relative flex justify-center items-center mb-6">
        {/* ▼▼▼ 変更点: ボタンにホバーエフェクトとカーソル変更を追加 ▼▼▼ */}
        <button onClick={() => window.history.back()} className="absolute left-0 p-2 rounded-full hover:bg-pink-500/20 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-pink-500">ランキング</h1>
      </header>

      {/* ランキング期間選択タブ */}
      <div className="flex justify-center space-x-2 mb-6">
        <button onClick={() => setActiveTab('realtime')} className={getTabClassName('realtime')}>リアルタイム</button>
        <button onClick={() => setActiveTab('daily')} className={getTabClassName('daily')}>日間</button>
        <button onClick={() => setActiveTab('weekly')} className={getTabClassName('weekly')}>週間</button>
        <button onClick={() => setActiveTab('monthly')} className={getTabClassName('monthly')}>月間</button>
      </div>

      {/* ランキング一覧 */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-center text-gray-500">ランキングを読み込んでいます...</p>
        ) : ranking.length > 0 ? (
          ranking.map((char, index) => (
            // aタグでキャラクター詳細ページへのリンクを追加
            <a href={`/characters/${char.id}`} key={char.id} className="flex items-center bg-gray-900 p-3 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
              <div className="flex items-center w-12 flex-shrink-0">
                 {index < 3 ? (
                   <Crown size={24} className={getRankColor(index)} />
                 ) : (
                   <span className={`text-lg font-bold w-8 text-center ${getRankColor(index)}`}>{index + 1}</span>
                 )}
              </div>
              <img
                src={char.characterImages[0]?.imageUrl || 'https://placehold.co/100x100/1a1a1a/ffffff?text=?'}
                alt={char.name}
                className="w-16 h-16 rounded-md object-cover mr-4"
              />
              <div className="flex-grow overflow-hidden">
                <h3 className="font-bold truncate">{char.name}</h3>
                <p className="text-sm text-gray-400 truncate">{char.description}</p>
              </div>
              {/* すべてのタブでチャット数を表示 */}
              <div className="flex items-center text-gray-400 flex-shrink-0 ml-4">
                {activeTab === 'realtime' ? <Flame size={16} className="mr-1 text-pink-400" /> : <MessageSquare size={16} className="mr-1" />}
                <span className="text-sm font-semibold">{char.chatCount}</span>
              </div>
            </a>
          ))
        ) : (
          <p className="text-center text-gray-500">表示するランキング情報がありません。</p>
        )}
      </div>
    </div>
  );
}
