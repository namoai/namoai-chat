"use client";

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { ArrowLeft, Camera, User, Shield, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf-client';

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
          <button onClick={onClose} className="bg-blue-600 text-white hover:bg-blue-700 py-2 px-4 rounded-lg">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// ▼▼▼【修正】Reactのルールに従い、コンポーネント名を大文字のアルファベットで始まるように変更します。▼▼▼
export default function ProfileEditPage() {
  const ルーター = useRouter();
  const { data: セッション, update: セッション更新 } = useSession();

  const [ニックネーム, setニックネーム] = useState('');
  const [自己紹介, set自己紹介] = useState('');
  const [電話番号, set電話番号] = useState('');
  const [画像プレビュー, set画像プレビュー] = useState<string | null>(null);
  const [画像ファイル, set画像ファイル] = useState<File | null>(null);
  const [読み込み中, set読み込み中] = useState(true);
  const [送信中, set送信中] = useState(false);
  const [モーダル状態, setモーダル状態] = useState({ isOpen: false, title: '', message: '' });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(true); // Googleアカウント有無（パスワードがない場合はGoogle専用）
  const [password, setPassword] = useState(''); // 会員情報変更時のパスワード確認
  const [showPassword, setShowPassword] = useState(false); // パスワード表示/非表示
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [originalNickname, setOriginalNickname] = useState(''); // 元のニックネーム保存
  const ファイル入力Ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const プロフィール取得 = async () => {
      try {
        const レスポンス = await fetch('/api/users/profile');
        if (!レスポンス.ok) throw new Error('プロファイル読み込み失敗');
        const データ = await レスポンス.json();
        setニックネーム(データ.nickname || '');
        set自己紹介(データ.bio || '');
        set電話番号(データ.phone || '');
        set画像プレビュー(データ.image || null);
        setTwoFactorEnabled(データ.twoFactorEnabled || false);
        setHasPassword(データ.hasPassword !== false); // APIからhasPassword返却、なければデフォルト値true
        setOriginalNickname(データ.nickname || ''); // 元のニックネーム保存
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

  // ニックネーム重複確認
  const handleCheckNickname = async () => {
    if (!ニックネーム || ニックネーム.trim().length < 2 || ニックネーム.trim().length > 12) {
      setモーダル状態({
        isOpen: true,
        title: '入力エラー',
        message: 'ニックネームは2〜12文字で入力してください。',
      });
      return;
    }

    // 元のニックネームと同じ場合は重複確認不要
    if (ニックネーム.trim() === originalNickname) {
      setNicknameChecked(true);
      setNicknameAvailable(true);
      setモーダル状態({
        isOpen: true,
        title: '確認完了',
        message: 'ニックネームは変更されていません。',
      });
      return;
    }

    setCheckingNickname(true);
    try {
      const response = await fetch('/api/users/check-nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: ニックネーム }),
      });

      const data = await response.json();
      setNicknameChecked(true);
      
      if (data.available) {
        setNicknameAvailable(true);
        setモーダル状態({
          isOpen: true,
          title: '確認完了',
          message: data.message || 'このニックネームは使用可能です。',
        });
      } else {
        setNicknameAvailable(false);
        setモーダル状態({
          isOpen: true,
          title: 'エラー',
          message: data.message || 'このニックネームは既に使用されています。',
        });
      }
    } catch (error) {
      console.error('ニックネーム重複確認エラー:', error);
      setモーダル状態({
        isOpen: true,
        title: 'エラー',
        message: 'サーバーエラーが発生しました。',
      });
    } finally {
      setCheckingNickname(false);
    }
  };

  // 2FA有効化/無効化
  const handle2FAToggle = async () => {
    setTwoFactorLoading(true);
    try {
      const endpoint = twoFactorEnabled 
        ? '/api/auth/2fa/email/disable'
        : '/api/auth/2fa/email/enable';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      
      if (!response.ok) {
        setモーダル状態({
          isOpen: true,
          title: 'エラー',
          message: data.error || '2FA設定の変更に失敗しました。',
        });
        return;
      }

      setTwoFactorEnabled(!twoFactorEnabled);
      setモーダル状態({
        isOpen: true,
        title: '成功',
        message: data.message || (twoFactorEnabled ? '2FAが無効化されました。' : '2FAが有効化されました。'),
      });
    } catch (error) {
      console.error('2FA toggle error:', error);
      setモーダル状態({
        isOpen: true,
        title: 'エラー',
        message: '2FA設定の変更中にエラーが発生しました。',
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const 画像変更ハンドラ = (イベント: ChangeEvent<HTMLInputElement>) => {
    if (イベント.target.files && イベント.target.files[0]) {
      const ファイル = イベント.target.files[0];
      set画像ファイル(ファイル);
      set画像プレビュー(URL.createObjectURL(ファイル));
    }
  };

  const 送信ハンドラ = async (イベント: FormEvent<HTMLFormElement>) => {
    イベント.preventDefault();

    // パスワード確認必須
    if (!password || password.trim().length === 0) {
      setモーダル状態({
        isOpen: true,
        title: '入力エラー',
        message: 'パスワードを入力してください。',
      });
      return;
    }

    // ニックネームが変更された場合は重複確認必要
    if (ニックネーム.trim() !== originalNickname) {
      if (!nicknameChecked || !nicknameAvailable) {
        setモーダル状態({
          isOpen: true,
          title: '確認必要',
          message: 'ニックネームの重複確認を完了してください。',
        });
        return;
      }
    }

    set送信中(true);
    
    const フォームデータ = new FormData();
    フォームデータ.append('nickname', ニックネーム);
    フォームデータ.append('bio', 自己紹介);
    フォームデータ.append('phone', 電話番号);
    フォームデータ.append('password', password); // パスワード確認
    if (画像ファイル) {
      フォームデータ.append('image', 画像ファイル);
    }

    try {
      const レスポンス = await fetchWithCsrf('/api/users/profile', {
        method: 'PUT',
        body: フォームデータ,
      });

      if (!レスポンス.ok) {
          // エラーフォーマットが複数あり得るため安全に抽出
          const エラーデータ = (await レスポンス.json().catch(() => ({}))) as Record<string, unknown>;
          const メッセージ =
            typeof エラーデータ?.error === 'string'
              ? (エラーデータ.error as string)
              : typeof エラーデータ?.message === 'string'
              ? (エラーデータ.message as string)
              : typeof (エラーデータ as { error?: unknown })?.error === 'object' &&
                (エラーデータ as { error?: { message?: unknown } })?.error?.message &&
                typeof (エラーデータ as { error?: { message?: unknown } })?.error?.message === 'string'
              ? ((エラーデータ as { error: { message: string } }).error.message)
              : typeof (エラーデータ as { error?: { code?: unknown } })?.error?.code === 'string'
              ? `エラー: ${(エラーデータ as { error: { code: string } }).error.code}`
              : 'プロファイル更新失敗';
          throw new Error(メッセージ);
      }
      
      const 更新後のプロフィール = await レスポンス.json();

      // Next-Authのセッション情報を更新
      await セッション更新({
        name: 更新後のプロフィール.user.nickname,
        image: 更新後のプロフィール.user.image,
      });
      
      // ニックネームが変更された場合は元のニックネーム更新
      setOriginalNickname(ニックネーム);
      setPassword(''); // パスワードフィールド初期化
      setNicknameChecked(false); // 重複確認状態初期化
      setNicknameAvailable(null);
      
      setモーダル状態({ 
          isOpen: true, 
          title: '成功', 
          message: '会員情報を更新しました！',
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
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
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
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 pb-24">
            <header className="flex items-center justify-between mb-8 sticky top-0 bg-black/80 backdrop-blur-xl z-10 py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-900/50">
              <button onClick={() => ルーター.back()} className="p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                会員情報変更
              </h1>
              <div className="w-10 h-10"></div>
            </header>

            <form onSubmit={送信ハンドラ} className="space-y-6">
              <div className="flex flex-col items-center mb-8">
                <div className="relative w-32 h-32 mb-4">
                  {画像プレビュー ? (
                    <div className="relative w-32 h-32 rounded-full overflow-hidden ring-4 ring-blue-500/30">
                      <Image
                        src={画像プレビュー}
                        alt="Profile Preview"
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="128px"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center ring-4 ring-blue-500/30">
                      <User size={64} className="text-blue-400" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => ファイル入力Ref.current?.click()}
                    className="absolute bottom-0 right-0 bg-gradient-to-r from-blue-500 to-cyan-600 p-3 rounded-full hover:from-blue-600 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/30"
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
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  ニックネーム
                  {nicknameChecked && nicknameAvailable && (
                    <span className="text-green-400 text-xs">✓ 使用可能</span>
                  )}
                  {nicknameChecked && !nicknameAvailable && (
                    <span className="text-red-400 text-xs">✗ 使用不可</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    id="nickname"
                    type="text"
                    value={ニックネーム}
                    onChange={(e) => {
                      setニックネーム(e.target.value);
                      // ニックネームが変更されたら重複確認状態をリセット
                      if (e.target.value.trim() !== originalNickname) {
                        setNicknameChecked(false);
                        setNicknameAvailable(null);
                      } else {
                        setNicknameChecked(true);
                        setNicknameAvailable(true);
                      }
                    }}
                    className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-gray-500"
                    placeholder="ニックネームを入力"
                  />
                  <button
                    type="button"
                    onClick={handleCheckNickname}
                    disabled={checkingNickname || !ニックネーム || ニックネーム.trim().length < 2 || ニックネーム.trim().length > 12 || ニックネーム.trim() === originalNickname}
                    className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {checkingNickname ? '確認中...' : '重複確認'}
                  </button>
                </div>
              </div>

              {/* パスワード確認フィールド */}
              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Lock size={16} className="text-blue-400" />
                  パスワード確認 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 pr-12 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-gray-500"
                    placeholder="パスワードを入力して変更を確認"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">会員情報を変更するには、パスワードの確認が必要です。</p>
              </div>

              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Phone size={16} />
                  電話番号
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={電話番号}
                  onChange={(e) => set電話番号(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-gray-500"
                  placeholder="電話番号を入力（任意）"
                />
                <p className="text-xs text-gray-400 mt-2">電話番号は任意です。他のユーザーとは共有されません。</p>
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

              {/* 2FA設定 - パスワードがあるアカウント（メール/パスワードログイン可能）のみ表示 */}
              {hasPassword && (
                <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield size={20} className="text-blue-400" />
                      <div>
                        <label className="block text-sm font-medium text-gray-300">二要素認証（2FA）</label>
                        <p className="text-xs text-gray-400 mt-1">
                          ログイン時にメール認証コードが必要になります
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handle2FAToggle}
                      disabled={twoFactorLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        twoFactorEnabled ? 'bg-blue-500' : 'bg-gray-600'
                      } ${twoFactorLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
              
              <button
                type="submit"
                disabled={送信中}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
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