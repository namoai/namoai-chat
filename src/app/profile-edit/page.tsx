"use client";

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { ArrowLeft, Camera, User } from 'lucide-react';

// 汎用モーダルコンポーネント
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
};

// ▼▼▼【修正】コンポーネント名を大文字のアルファベットで始まるように変更 (カスタムモーダル -> CustomModal) ▼▼▼
const CustomModal = ({ isOpen, onClose, title, message }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4 text-white">{title}</h2>
        <p className="text-sm text-gray-200 mb-6">{message}</p>
        <div className="flex justify-end">
          <button onClick={onClose} className="bg-pink-600 text-white hover:bg-pink-700 py-2 px-4 rounded-lg">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// デフォルトアバターアイコン
// ▼▼▼【修正】コンポーネント名を大文字のアルファベットで始まるように変更 (デフォルトアバターアイコン -> DefaultAvatarIcon) ▼▼▼
const DefaultAvatarIcon = ({ size = 96 }: { size?: number }) => (
  <div
    className="rounded-full bg-gray-700 flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <User size={size * 0.6} className="text-gray-400" />
  </div>
);

// ▼▼▼【修正】Reactのルールに従い、コンポーネント名を大文字のアルファベットで始まるように変更します。▼▼▼
export default function ProfileEditPage() {
  const ルーター = useRouter();
  const { data: セッション, update: セッション更新 } = useSession();

  const [ニックネーム, setニックネーム] = useState('');
  const [自己紹介, set自己紹介] = useState('');
  const [画像プレビュー, set画像プレビュー] = useState<string | null>(null);
  const [画像ファイル, set画像ファイル] = useState<File | null>(null);
  const [読み込み中, set読み込み中] = useState(true);
  const [送信中, set送信中] = useState(false);
  const [モーダル状態, setモーダル状態] = useState({ isOpen: false, title: '', message: '' });
  const ファイル入力Ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const プロフィール取得 = async () => {
      try {
        const レスポンス = await fetch('/api/users/profile');
        if (!レスポンス.ok) throw new Error('プロファイル読み込み失敗');
        const データ = await レスポンス.json();
        setニックネーム(データ.nickname || '');
        set自己紹介(データ.bio || '');
        set画像プレビュー(データ.image_url || null);
      } catch (エラー) {
        console.error(エラー);
        setモーダル状態({ isOpen: true, title: 'エラー', message: (エラー as Error).message });
      } finally {
        set読み込み中(false);
      }
    };
    プロフィール取得();
  }, []);
  
  const モーダルを閉じる = () => setモーダル状態({ isOpen: false, title: '', message: '' });

  const 画像変更ハンドラ = (イベント: ChangeEvent<HTMLInputElement>) => {
    if (イベント.target.files && イベント.target.files[0]) {
      const ファイル = イベント.target.files[0];
      set画像ファイル(ファイル);
      set画像プレビュー(URL.createObjectURL(ファイル));
    }
  };

  const 送信ハンドラ = async (イベント: FormEvent<HTMLFormElement>) => {
    イベント.preventDefault();
    set送信中(true);
    
    const フォームデータ = new FormData();
    フォームデータ.append('nickname', ニックネーム);
    フォームデータ.append('bio', 自己紹介);
    if (画像ファイル) {
      フォームデータ.append('image', 画像ファイル);
    }

    try {
      const レスポンス = await fetch('/api/users/profile', {
        method: 'PUT',
        body: フォームデータ,
      });

      if (!レスポンス.ok) {
          const エラーデータ = await レスポンス.json();
          throw new Error(エラーデータ.error || 'プロファイル更新失敗');
      }
      
      const 更新後のプロフィール = await レスポンス.json();

      // Next-Authのセッション情報を更新
      await セッション更新({
        name: 更新後のプロフィール.user.nickname,
        image: 更新後のプロフィール.user.image_url,
      });
      
      setモーダル状態({ 
          isOpen: true, 
          title: '成功', 
          message: 'プロフィールを更新しました！',
      });
      
      // 1.5秒後にプロフィールページへ遷移
      setTimeout(() => {
        ルーター.push(`/profile/${セッション?.user?.id}`);
      }, 1500);

    } catch (エラー) {
      console.error(エラー);
      setモーダル状態({ isOpen: true, title: 'エラー', message: (エラー as Error).message });
    } finally {
        set送信中(false);
    }
  };

  if (読み込み中) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CustomModal {...モーダル状態} onClose={モーダルを閉じる} />
      <div className="bg-black min-h-screen text-white">
        {/* 背景装飾 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 pb-24">
            <header className="flex items-center justify-between mb-8 sticky top-0 bg-black/80 backdrop-blur-xl z-10 py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-900/50">
              <button onClick={() => ルーター.back()} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                プロフィール編集
              </h1>
              <div className="w-10 h-10"></div>
            </header>

            <form onSubmit={送信ハンドラ} className="space-y-6">
              <div className="flex flex-col items-center mb-8">
                <div className="relative w-32 h-32 mb-4">
                  {画像プレビュー ? (
                    <div className="relative w-32 h-32 rounded-full overflow-hidden ring-4 ring-pink-500/30">
                      <Image
                        src={画像プレビュー}
                        alt="Profile Preview"
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center ring-4 ring-pink-500/30">
                      <User size={64} className="text-pink-400" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => ファイル入力Ref.current?.click()}
                    className="absolute bottom-0 right-0 bg-gradient-to-r from-pink-500 to-purple-600 p-3 rounded-full hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg shadow-pink-500/30"
                  >
                    <Camera size={20} className="text-white" />
                  </button>
                  <input
                    type="file"
                    ref={ファイル入力Ref}
                    onChange={画像変更ハンドラ}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
              
              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-300 mb-2">ニックネーム</label>
                <input
                  id="nickname"
                  type="text"
                  value={ニックネーム}
                  onChange={(e) => setニックネーム(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all placeholder-gray-500"
                  placeholder="ニックネームを入力"
                />
              </div>

              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                <label htmlFor="bio" className="block text-sm font-medium text-gray-300 mb-2">自己紹介</label>
                <textarea
                  id="bio"
                  value={自己紹介}
                  onChange={(e) => set自己紹介(e.target.value)}
                  rows={6}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all resize-none placeholder-gray-500"
                  placeholder="自己紹介を入力"
                />
              </div>
              
              <button
                type="submit"
                disabled={送信中}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {送信中 ? '保存中...' : '保存'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}