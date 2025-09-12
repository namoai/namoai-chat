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

const カスタムモーダル = ({ isOpen, onClose, title, message }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        <p className="text-sm text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end">
          <button onClick={onClose} className="bg-pink-600 hover:bg-pink-700 py-2 px-4 rounded-lg">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// デフォルトアバターアイコン
const デフォルトアバターアイコン = ({ size = 96 }: { size?: number }) => (
  <div
    className="rounded-full bg-gray-700 flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <User size={size * 0.6} className="text-gray-400" />
  </div>
);

export default function プロフィール編集ページ() {
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
    return <div className="flex h-screen items-center justify-center bg-black text-white">ローディング中...</div>;
  }

  return (
    <>
      <カスタムモーダル {...モーダル状態} onClose={モーダルを閉じる} />
      <div className="bg-black min-h-screen text-white">
        <div className="mx-auto max-w-2xl">
          <header className="flex items-center justify-between p-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
            <button onClick={() => ルーター.back()} className="p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer"><ArrowLeft /></button>
            <h1 className="font-bold text-lg">プロフィール編集</h1>
            <div className="w-10 h-10"></div>
          </header>

          <form onSubmit={送信ハンドラ} className="p-4 space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-2">
                {画像プレビュー ? (
                  <Image
                    src={画像プレビュー}
                    alt="Profile Preview"
                    width={96}
                    height={96}
                    className="rounded-full object-cover w-24 h-24"
                  />
                ) : (
                  <デフォルトアバターアイコン size={96} />
                )}
                <button
                  type="button"
                  onClick={() => ファイル入力Ref.current?.click()}
                  className="absolute bottom-0 right-0 bg-gray-700 p-2 rounded-full hover:bg-gray-600 transition-colors cursor-pointer"
                >
                  <Camera size={16} />
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
            
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-400 mb-1">ニックネーム</label>
              <input
                id="nickname"
                type="text"
                value={ニックネーム}
                onChange={(e) => setニックネーム(e.target.value)}
                className="w-full bg-gray-800 border-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-400 mb-1">自己紹介</label>
              <textarea
                id="bio"
                value={自己紹介}
                onChange={(e) => set自己紹介(e.target.value)}
                rows={4}
                className="w-full bg-gray-800 border-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
            
            <button
              type="submit"
              disabled={送信中}
              className="w-full bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 disabled:bg-pink-800 transition-colors cursor-pointer"
            >
              {送信中 ? '保存中...' : '保存'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}