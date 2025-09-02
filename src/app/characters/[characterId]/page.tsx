"use client";

import React, { useState, useEffect } from 'react';
// Next.jsのナビゲーション機能をインポートします
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, MessageSquare, MoreVertical, ArrowLeft } from 'lucide-react';

/** 型定義 */
type Author = {
  id: number;
  name: string;
  nickname: string;
};

type CharacterImage = {
  imageUrl: string;
};

type CharacterDetail = {
  id: number;
  name: string;
  description: string | null;
  hashtags: string[];
  createdAt: string;
  updatedAt: string;
  characterImages: CharacterImage[];
  author: Author | null;
  _count: {
    favorites: number;
    chat: number;
  };
};

export default function CharacterDetailPage() {
  // ▼▼▼【修正点】useRouterを使用します ▼▼▼
  const router = useRouter();

  const [characterId, setCharacterId] = useState<string | null>(null);
  // セッション関連は動作確認のため仮の値を設定
  const sessionStatus = 'authenticated';
  const session = { user: { id: '1', role: 'USER' } };

  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  useEffect(() => {
    const pathSegments = window.location.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1];
    setCharacterId(id);
  }, []);

  useEffect(() => {
    if (!characterId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/characters/${characterId}`, { cache: 'no-store' });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || 'キャラクターの読み込みに失敗しました。');
        }
        const data: CharacterDetail = await res.json();
        setCharacter(data);
      } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('未知のエラーが発生しました。');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [characterId]);

  const handleNewChat = async () => {
    if (!characterId) return;
    setIsCreatingChat(true);
    try {
      const res = await fetch('/api/chats/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: Number(characterId),
          forceNew: true,
        }),
      });
      if (!res.ok) throw new Error('チャットセッションの作成に失敗しました。');
      const chat = await res.json();
      // ▼▼▼【修正点】router.pushでページ遷移します ▼▼▼
      router.push(`/chat/${characterId}?chatId=${chat.id}`);
    } catch (err) {
      console.error(err);
      alert('チャットの開始に失敗しました。');
    } finally {
      setIsCreatingChat(false);
    }
  };

  // ▼▼▼【修正点】router.back()で前のページに戻ります ▼▼▼
  const handleGoBack = () => {
    router.back();
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex justify-center items-center">読み込み中...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-black text-white flex justify-center items-center">エラー: {error}</div>;
  }

  if (!character) {
    return <div className="min-h-screen bg-black text-white flex justify-center items-center">キャラクターが見つかりません。</div>;
  }

  const canEdit =
    session?.user?.id === character.author?.id?.toString() ||
    session?.user?.role === 'SUPER_ADMIN';

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="mx-auto max-w-2xl pb-24">
        <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
          <button onClick={handleGoBack} className="p-2 rounded-full hover:bg-gray-800 transition-colors" aria-label="戻る">
            <ArrowLeft />
          </button>
          <h1 className="font-bold text-lg absolute left-1/2 -translate-x-1/2">{character.name}</h1>
          {canEdit && (
            <div className="relative">
              <button className="p-2 rounded-full hover:bg-gray-800 transition-colors" aria-label="メニュー">
                <MoreVertical />
              </button>
            </div>
          )}
        </header>

        <main>
          <div className="relative w-full aspect-[4/3]">
            <img
              src={character.characterImages[0]?.imageUrl || 'https://placehold.co/800x600/1a1a1a/ffffff?text=?'}
              alt={character.name}
              className="object-cover w-full h-full"
            />
          </div>

          <div className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{character.name}</h2>
                <p className="text-sm text-gray-400">
                  作成者: {character.author?.nickname || '不明'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1 text-gray-400 hover:text-white" aria-label="お気に入り数">
                  <Heart size={20} />
                  <span>{character._count.favorites}</span>
                </button>
                <div className="flex items-center gap-1 text-gray-400" aria-label="チャット数">
                  <MessageSquare size={20} />
                  <span>{character._count.chat}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 my-4">
              {character.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="bg-gray-800 text-pink-400 text-xs font-semibold px-2.5 py-1 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <p className="text-gray-300 whitespace-pre-wrap">
              {character.description}
            </p>

            <div className="mt-6 border-t border-gray-800 pt-4">
              <h3 className="font-bold mb-4">コメント ({/* 仮の数 */ 408})</h3>
            </div>
          </div>
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black border-t border-gray-800">
        <div className="mx-auto max-w-2xl flex gap-4">
          {sessionStatus === 'authenticated' ? (
            <>
              {/* ▼▼▼【修正点】<a>タグを<Link>コンポーネントに変更 ▼▼▼ */}
              <Link href={`/chat/${characterId}`} className="flex-1">
                <button className="w-full bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors">
                  続きから会話
                </button>
              </Link>
              <button
                onClick={handleNewChat}
                disabled={isCreatingChat}
                className="flex-1 w-full bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 transition-colors disabled:bg-pink-800 disabled:cursor-not-allowed"
              >
                {isCreatingChat ? '作成中...' : '新しいチャットを開始'}
              </button>
            </>
          ) : (
            <button
              // ▼▼▼【修正点】router.pushでページ遷移します ▼▼▼
              onClick={() => router.push('/login')}
              className="w-full bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 transition-colors"
            >
              チャットするにはログインが必要です
            </button>
          )}
        </div>
      </div>
    </div>
  );
}