"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, MessageSquare, MoreVertical, ArrowLeft } from 'lucide-react';
import { useSession } from 'next-auth/react'; // useSessionをインポート

type Author = {
  name: string;
  nickname: string;
};

type CharacterImage = {
  imageUrl: string;
};

type CharacterDetail = {
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
  const router = useRouter();
  const params = useParams<{ characterId: string }>();
  const { characterId } = params;
  const { data: session, status: sessionStatus } = useSession(); // セッション状態を取得

  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // エラーメッセージ用のstate
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  useEffect(() => {
    if (characterId) {
      const fetchCharacter = async () => {
        setLoading(true);
        setError(null); // フェッチ開始時にエラーをリセット
        try {
          const response = await fetch(`/api/characters/${characterId}`);
          const data = await response.json();

          if (!response.ok) {
            // APIからのエラーメッセージを優先して使用
            throw new Error(data.error || "キャラクター情報の読み込みに失敗しました。");
          }
          
          setCharacter(data);
        } catch (err) {
          console.error(err);
          setError((err as Error).message); // エラーメッセージをstateに保存
        } finally {
          setLoading(false);
        }
      };
      fetchCharacter();
    }
  }, [characterId]);

  const handleNewChat = async () => {
    setIsCreatingChat(true);
    try {
      const response = await fetch('/api/chats/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: Number(characterId), forceCreate: true }),
      });
      if (!response.ok) throw new Error('新規チャットの作成に失敗');
      const chat = await response.json();
      router.push(`/chat/${characterId}?chatId=${chat.id}`);
    } catch (error) {
      console.error(error);
      alert('新規チャットの作成に失敗しました。');
    } finally {
      setIsCreatingChat(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">ローディング中...</div>;
  }

  // ▼▼▼ 変更点: エラー発生時に専用UIを表示 ▼▼▼
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black text-white p-4 text-center">
        <p className="text-red-500 text-lg mb-4">エラー</p>
        <p className="mb-6">{error}</p>
        <button onClick={() => router.back()} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">
          前のページに戻る
        </button>
      </div>
    );
  }

  if (!character) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">キャラクターが見つかりません。</div>;
  }
  
  const creationDate = new Date(character.createdAt).toLocaleDateString('ja-JP');
  const updatedDate = new Date(character.updatedAt).toLocaleDateString('ja-JP');

  return (
    <div className="bg-black text-white min-h-screen">
      <div className="mx-auto max-w-2xl pb-20">
        <div className="relative">
          <header className="absolute top-0 left-0 right-0 z-10 flex justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
            <button onClick={() => router.back()} className="rounded-full p-1 hover:bg-black/50">
              <ArrowLeft />
            </button>
            <button className="rounded-full p-1 hover:bg-black/50">
              <MoreVertical />
            </button>
          </header>
          
          <div className="relative aspect-square w-full sm:aspect-[4/3]">
            <Image
              src={character.characterImages[0]?.imageUrl || 'https://placehold.co/600x800/1a1a1a/ffffff?text=?'}
              alt={character.name}
              fill
              className="object-cover"
              priority
            />
          </div>

          <div className="absolute bottom-0 left-0 right-0 text-white p-4 bg-black/40 backdrop-blur-sm">
            <h1 className="text-3xl font-bold">{character.name}</h1>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{character.author?.nickname || '作者不明'}</span>
            </div>
            <div className="flex items-center gap-4 text-gray-400">
              <div className="flex items-center gap-1">
                <MessageSquare size={16} />
                <span>{character._count.chat}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart size={16} />
                <span>{character._count.favorites}</span>
              </div>
            </div>
          </div>
          
          <p className="text-gray-300 mb-4">{character.description || 'キャラクター説明がありません。'}</p>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {character.hashtags.map(tag => (
              <span key={tag} className="bg-gray-800 text-pink-400 text-xs font-semibold px-2.5 py-1 rounded-full">{tag}</span>
            ))}
          </div>

          <div className="space-y-2 text-sm text-gray-400 border-t border-b border-gray-800 py-4">
            <div className="flex justify-between"><span>生成日</span><span>{creationDate}</span></div>
            <div className="flex justify-between"><span>最近のアップデート</span><span>{updatedDate}</span></div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-bold mb-4">コメント (408)</h2>
          </div>
        </div>
      </div>

      {/* ▼▼▼ 変更点: ログイン状態に応じてボタン表示を切り替え ▼▼▼ */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black border-t border-gray-800">
        <div className="mx-auto max-w-2xl flex gap-4">
          {sessionStatus === 'authenticated' ? (
            <>
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
          ) : sessionStatus === 'unauthenticated' ? (
            <button onClick={() => router.push('/login')} className="w-full bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 transition-colors">
              チャットするにはログインが必要です
            </button>
          ) : (
            <button className="w-full bg-gray-700 text-white font-bold py-3 px-4 rounded-lg" disabled>
              読み込み中...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
