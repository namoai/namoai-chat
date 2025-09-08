"use client";

import React, { useState, useEffect } from 'react';
// ▼▼▼【修正】Next.js特有のインポートを削除し、標準Web APIを使用するようにします ▼▼▼
import { Heart, MessageSquare, MoreVertical, ArrowLeft } from 'lucide-react';
import Comments from '../../../components/Comments'; // 相対パスでインポート

/** 型定義 */
type Author = {
  id: number;
  name: string;
  nickname: string;
};

type CharacterImage = {
  imageUrl: string;
};

// ▼▼▼【修正】セッションの型を直接定義します ▼▼▼
type ManualSession = {
  user?: {
      id?: string | null;
      role?: string | null;
  } | null;
} | null;


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
  isFavorited?: boolean;
};

export default function CharacterDetailPage() {
  // ▼▼▼【修正】useRouter, useParamsの代わりにuseStateとuseEffectでIDを取得します ▼▼▼
  const [characterId, setCharacterId] = useState<string | null>(null);
  
  // ▼▼▼【修正】useSessionの代わりに仮のセッションデータを使用します ▼▼▼
  // 実際の環境では認証状態の管理方法を別途実装する必要があります
  const sessionStatus = 'authenticated';
  const session: ManualSession = { user: { id: '1', role: 'SUPER_ADMIN' } };

  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    // URLからキャラクターIDを抽出
    const pathSegments = window.location.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1];
    if (id) {
        setCharacterId(id);
    }
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
        setIsLiked(data.isFavorited || false);
        setLikeCount(data._count.favorites);
      } catch (err) {
        setError(err instanceof Error ? err.message : '未知のエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    })();
  }, [characterId]);

  const handleLike = async () => {
    if (sessionStatus !== 'authenticated') {
      // ▼▼▼【修正】router.push を window.location.href に変更します
      window.location.href = '/login';
      return;
    }

    const originalLiked = isLiked;
    const originalLikeCount = likeCount;
    setIsLiked(!originalLiked);
    setLikeCount(originalLikeCount + (!originalLiked ? 1 : -1));

    try {
      const res = await fetch(`/api/characters/${characterId}/like`, { method: 'POST' });
      if (!res.ok) {
        setIsLiked(originalLiked);
        setLikeCount(originalLikeCount);
        throw new Error('いいねの更新に失敗しました。');
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'エラーが発生しました。');
      setIsLiked(originalLiked);
      setLikeCount(originalLikeCount);
    }
  };

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
      // ▼▼▼【修正】router.push を window.location.href に変更します
      window.location.href = `/chat/${characterId}?chatId=${chat.id}`;
    } catch (err) {
      console.error(err);
      alert('チャットの開始に失敗しました。');
    } finally {
      setIsCreatingChat(false);
    }
  };

  // ▼▼▼【修正】router.back を window.history.back に変更します
  const handleGoBack = () => window.history.back();

  if (loading) return <div className="min-h-screen bg-black text-white flex justify-center items-center">読み込み中...</div>;
  if (error) return <div className="min-h-screen bg-black text-white flex justify-center items-center">エラー: {error}</div>;
  if (!character) return <div className="min-h-screen bg-black text-white flex justify-center items-center">キャラクターが見つかりません。</div>;

  const canEdit = session?.user?.id === character.author?.id?.toString() || session?.user?.role === 'SUPER_ADMIN';

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="mx-auto max-w-2xl pb-24">
        <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
          <button onClick={handleGoBack} className="p-2 rounded-full hover:bg-gray-800 transition-colors" aria-label="戻る"><ArrowLeft /></button>
          <h1 className="font-bold text-lg absolute left-1/2 -translate-x-1/2">{character.name}</h1>
          {canEdit && <div className="relative"><button className="p-2 rounded-full hover:bg-gray-800 transition-colors" aria-label="メニュー"><MoreVertical /></button></div>}
        </header>

        <main>
          <div className="relative w-full aspect-[4/3]">
            {/* ▼▼▼【修正】Image を標準の img タグに変更します ▼▼▼ */}
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
                <p className="text-sm text-gray-400">作成者: {character.author?.nickname || '不明'}</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1 transition-colors ${isLiked ? 'text-pink-500' : 'text-gray-400 hover:text-white'}`}
                  aria-label="お気に入り"
                >
                  <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
                  <span>{likeCount}</span>
                </button>
                <div className="flex items-center gap-1 text-gray-400" aria-label="チャット数">
                  <MessageSquare size={20} />
                  <span>{character._count.chat}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 my-4">
              {character.hashtags.map((tag) => <span key={tag} className="bg-gray-800 text-pink-400 text-xs font-semibold px-2.5 py-1 rounded-full">#{tag}</span>)}
            </div>

            <p className="text-gray-300 whitespace-pre-wrap">{character.description}</p>
            
            {/* characterIdがnullでないことを保証してからCommentsをレンダリング */}
            {characterId && <Comments 
              characterId={characterId} 
              characterAuthorId={character.author?.id ?? null}
              session={session}
            />}
          </div>
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black border-t border-gray-800">
        <div className="mx-auto max-w-2xl flex gap-4">
          {sessionStatus === 'authenticated' ? (
            <>
              {/* ▼▼▼【修正】Link を標準の a タグに変更します ▼▼▼ */}
              <a href={`/chat/${characterId}`} className="flex-1">
                <button className="w-full bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors">続きから会話</button>
              </a>
              <button onClick={handleNewChat} disabled={isCreatingChat} className="flex-1 w-full bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 transition-colors disabled:bg-pink-800 disabled:cursor-not-allowed">
                {isCreatingChat ? '作成中...' : '新しいチャットを開始'}
              </button>
            </>
          ) : (
            // ▼▼▼【修正】router.push を window.location.href に変更します
            <button onClick={() => window.location.href = '/login'} className="w-full bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 transition-colors">
              チャットするにはログインが必要です
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

