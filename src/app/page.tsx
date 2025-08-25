// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Search, User, Trophy, Users, PlusCircle } from "lucide-react";
import Image from "next/image"; // ← next/image を用いて最適化（LCP/帯域に有利）

// キャラクターのデータ型
type Character = {
  id: number;
  name: string;
  description: string | null;
  characterImages: { imageUrl: string }[];
};

// メインページのデータ型
type MainPageData = {
  trendingCharacters: Character[];
  newTopCharacters: Character[];
  specialCharacters: Character[];
  generalCharacters: Character[];
};

// 1つの横並びセクション（カードグリッド）
const CharacterRow = ({
  title,
  characters,
  moreLink,
}: {
  title: string;
  characters: Character[];
  moreLink?: string;
}) => {
  if (!characters || characters.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{title}</h2>
        {moreLink && (
          // ホバー/カーソルの演出
          <a
            href={moreLink}
            className="p-1 text-gray-400 hover:text-pink-500 transition-colors cursor-pointer"
            title="もっと見る"
          >
            <PlusCircle size={22} />
          </a>
        )}
      </div>

      {/* 画像は next/image の fill + 親の aspect-square でレイアウト安定 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {characters.map((char) => {
          // フォールバックURL（外部ドメインは next.config.ts の images.remotePatterns に登録が必要）
          const src =
            char.characterImages[0]?.imageUrl ||
            "https://placehold.co/300x300/1a1a1a/ffffff?text=?";

          return (
            <a
              href={`/characters/${char.id}`}
              key={char.id}
              className="cursor-pointer group"
            >
              <div className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden mb-2 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-pink-500/30">
                <Image
                  src={src}
                  alt={char.name}
                  fill
                  // 画面幅に応じた表示サイズのヒント
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  // priority // ← ヒーロー級の画像にしたい場合のみ有効化（LCP 改善）
                  // 注意: next/image では <img> のような src 差し替え onError は非推奨。
                  // 代わりに上の src 生成時点でフォールバックを決めるのが安全。
                />
              </div>
              <h3 className="font-semibold truncate">{char.name}</h3>
              <p className="text-sm text-gray-400 truncate">
                {char.description || " "}
              </p>
            </a>
          );
        })}
      </div>
    </section>
  );
};

export default function HomePage() {
  const [pageData, setPageData] = useState<MainPageData | null>(null);
  const [loading, setLoading] = useState(true);

  // 初期ロード時にメインページデータを取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/main-page");
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();
        setPageData(data);
      } catch (error) {
        console.error("データの取得に失敗しました:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        ローディング中...
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        データの読み込みに失敗しました。
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-white p-4 pb-20">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-pink-500">ナモアイ</h1>
        {/* ヘッダーアイコン（ホバー演出/カーソル指定） */}
        <div className="flex items-center gap-2 text-gray-300">
          <a
            href="/charlist"
            title="キャラクター一覧"
            className="p-2 rounded-full hover:bg-pink-500/20 hover:text-white transition-colors cursor-pointer"
          >
            <Users />
          </a>
          <a
            href="/search"
            title="検索"
            className="p-2 rounded-full hover:bg-pink-500/20 hover:text-white transition-colors cursor-pointer"
          >
            <Search />
          </a>
          <a
            href="/ranking"
            title="ランキング"
            className="p-2 rounded-full hover:bg-pink-500/20 hover:text-white transition-colors cursor-pointer"
          >
            <Trophy />
          </a>
          <a
            href="/MyPage"
            title="マイページ"
            className="p-2 rounded-full hover:bg-pink-500/20 hover:text-white transition-colors cursor-pointer"
          >
            <User />
          </a>
        </div>
      </header>

      {/* バナー（簡易プロモーション） */}
      <div className="bg-pink-500 rounded-lg p-4 mb-8 text-center hover:bg-pink-600 transition-colors cursor-pointer">
        <h2 className="font-bold">毎日出席して最大10倍の報酬をゲット！</h2>
      </div>

      <CharacterRow
        title="今話題のキャラクター"
        characters={pageData.trendingCharacters}
        moreLink="/chatlist"
      />
      <CharacterRow
        title="ホットな新作TOP10"
        characters={pageData.newTopCharacters}
      />
      <CharacterRow
        title="見逃せない特集キャラクター"
        characters={pageData.specialCharacters}
      />
      <CharacterRow
        title="新規キャラクター紹介"
        characters={pageData.generalCharacters}
        moreLink="/charlist"
      />
    </div>
  );
}