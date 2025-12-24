"use client";

import type { Session } from "next-auth";
import {
  Heart, ChevronRight, Megaphone, Users, BookUser,
  User, ShieldCheck, BrainCircuit, LogOut, Coins, Shield, MessageSquare, HelpCircle,
} from "lucide-react";
import HelpModal from "@/components/HelpModal";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { fetchWithCsrf } from "@/lib/csrf-client";
import Image from "next/image";
import Link from 'next/link';
import MyPageRightSidebar from "@/components/MyPageRightSidebar";

// ▼▼▼【修正】未使用のuseRouterのインポートを削除しました ▼▼▼
// import { useRouter } from 'next/navigation';

// 確認モーダルコンポーネントの型定義
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
};

const CustomModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, isAlert }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4 text-white">{title}</h2>
        <p className="text-sm text-gray-200 mb-6 whitespace-pre-line">{message}</p>
        <div className={`flex ${isAlert ? 'justify-end' : 'justify-end gap-4'}`}>
          {!isAlert && (
            <button onClick={onClose} className="border border-gray-600 text-white hover:bg-gray-700 py-2 px-4 rounded-lg">{cancelText || 'キャンセル'}</button>
          )}
          <button onClick={onConfirm} className={`bg-blue-600 text-white hover:bg-blue-700 py-2 px-4 rounded-lg`}>{confirmText || 'OK'}</button>
        </div>
      </div>
    </div>
  );
};


// ログインしているユーザー向けのビュー
const LoggedInView = ({ session }: { session: Session }) => {
  const [points, setPoints] = useState<{ total: number; loading: boolean }>({ total: 0, loading: true });
  const [stats, setStats] = useState<{
    totalMessages: number;
    totalFavorites: number;
    totalCharacters: number;
    loading: boolean;
  }>({ totalMessages: 0, totalFavorites: 0, totalCharacters: 0, loading: true });
  const [profileStats, setProfileStats] = useState<{
    followers: number;
    following: number;
    characterCount: number;
    loading: boolean;
  }>({ followers: 0, following: 0, characterCount: 0, loading: true });
  const [isSafetyFilterOn, setIsSafetyFilterOn] = useState<boolean | null>(null); // null = ローディング中
  const [ageStatus, setAgeStatus] = useState<{ isMinor: boolean; source?: string } | null>(null);
  const [modalState, setModalState] = useState<Omit<ModalProps, 'onClose'>>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // 生年月日入力モーダル用の状態
  const [showBirthdateModal, setShowBirthdateModal] = useState(false);
  const [birthdate, setBirthdate] = useState({ year: '', month: '', day: '' });
  
  // 管理者権限チェック - より厳密にチェック
  // LoggedInViewは認証済みユーザーのみにレンダリングされるため、statusチェックは不要
  const isAdmin = (() => {
    // セッションが存在しない場合は false
    if (!session?.user) {
      return false;
    }
    
    const userRole = session.user.role;
    
    // roleが存在しない、またはUSERの場合は false
    if (!userRole || userRole === 'USER') {
      return false;
    }
    
    // 管理者権限のみ true
    return userRole === 'MODERATOR' || 
           userRole === 'CHAR_MANAGER' || 
           userRole === 'SUPER_ADMIN';
  })();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ▼▼▼【新機能】停止状態チェック ▼▼▼
        const profileRes = await fetch('/api/users/profile');
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.suspendedUntil) {
            const now = new Date();
            const suspendedUntil = new Date(profileData.suspendedUntil);
            if (suspendedUntil > now) {
              // 停止中の場合は停止ページにリダイレクト
              window.location.href = `/suspended?reason=${encodeURIComponent(profileData.suspensionReason || '不明な理由')}&until=${profileData.suspendedUntil}`;
              return;
            }
          }
        }
        // ▲▲▲ 停止チェック完了 ▲▲▲

        const pointsRes = await fetch('/api/users/points');
        if (pointsRes.ok) {
          const pointsData = await pointsRes.json();
          setPoints({ total: (pointsData.free_points || 0) + (pointsData.paid_points || 0), loading: false });
        } else {
          setPoints({ total: 0, loading: false });
        }

        // 活動統計データ取得
        const statsRes = await fetch('/api/users/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats({
            totalMessages: statsData.totalMessages || 0,
            totalFavorites: statsData.totalFavorites || 0,
            totalCharacters: statsData.totalCharacters || 0,
            loading: false
          });
        } else {
          setStats({ totalMessages: 0, totalFavorites: 0, totalCharacters: 0, loading: false });
        }

        // プロフィール統計データ取得（フォロワー、フォロー中、作成キャラ数）
        if (session?.user?.id) {
          const userId = session.user.id;
          const profileRes = await fetch(`/api/profile/${userId}`);
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setProfileStats({
              followers: profileData._count?.followers || 0,
              following: profileData._count?.following || 0,
              characterCount: profileData.characters?.length || 0,
              loading: false
            });
          } else {
            setProfileStats(prev => ({ ...prev, loading: false }));
          }
        } else {
          setProfileStats(prev => ({ ...prev, loading: false }));
        }

        const filterRes = await fetch('/api/users/safety-filter', { cache: 'no-store' }); // キャッシュを無効化
        if (filterRes.ok) {
          const filterData = await filterRes.json();
          // nullの場合はtrue（フィルターON）として処理、即座に反映
          setIsSafetyFilterOn(filterData.safetyFilter ?? true);
          setAgeStatus({ isMinor: !!filterData.isMinor, source: filterData.ageSource });
        } else {
          // API呼び出し失敗時はデフォルト値で設定
          setIsSafetyFilterOn(true);
          setAgeStatus(null);
        }

      } catch (error) {
        console.error(error);
        setPoints({ total: 0, loading: false });
        // エラー発生時はデフォルト値で設定
        setIsSafetyFilterOn(true);
      }
    };
    fetchData();
  }, [session.user.id]);

  const closeModal = () => setModalState(prev => ({ ...prev, isOpen: false }));

  const updateSafetyFilter = async (newStatus: boolean, birthdateValue?: string) => {
    try {
      const body: { safetyFilter: boolean; birthdate?: string } = { safetyFilter: newStatus };
      if (birthdateValue) {
        body.birthdate = birthdateValue;
      }

      const response = await fetchWithCsrf('/api/users/safety-filter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store', // キャッシュを無効化
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '設定の変更に失敗しました。');
      }

      const data = await response.json();
      // nullの場合はtrue（フィルターON）として処理、即座に反映
      setIsSafetyFilterOn(data.safetyFilter ?? true);
      
      // 成功メッセージ表示後、ページリロード
      setModalState({
        isOpen: true,
        title: '成功',
        message: `セーフティフィルターを${newStatus ? 'ON' : 'OFF'}にしました。設定を反映するためにページを再読み込みします。`,
        onConfirm: () => {
          closeModal();
          // ページを再読み込みしてキャッシュをクリア
          window.location.reload();
        },
        isAlert: true,
      });
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'エラーが発生しました。';
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: errorMessage,
        onConfirm: closeModal,
        isAlert: true,
      });
    }
  };

  const handleSafetyFilterToggle = () => {
    // ローディング中ならクリック無視
    if (isSafetyFilterOn === null) return;
    if (ageStatus?.isMinor) {
      setModalState({
        isOpen: true,
        title: "未成年のため変更できません",
        message: "18歳未満のアカウントではセーフティフィルターは常にONになります。",
        onConfirm: closeModal,
        isAlert: true,
      });
      return;
    }
    
    if (isSafetyFilterOn) {
      // ON → OFF: 年齢確認モーダル（画像のようにシンプルに）
      setModalState({
        isOpen: true,
        title: "年齢確認",
        message: "あなたは18歳以上ですか？\n\n18歳未満の方は\n安心フィルターをオフできません",
        confirmText: "はい",
        cancelText: "いいえ",
        onConfirm: () => {
          closeModal();
          // 生年月日入力モーダルを表示
          setShowBirthdateModal(true);
        },
      });
    } else {
      // OFF → ON: フィルターをONにする確認
      setModalState({
        isOpen: true,
        title: "セーフティフィルターをONにしますか？",
        message: "セーフティフィルターをONにすると、成人向けキャラクターは表示・チャットできなくなります。\n\nセーフティフィルターをONにしますか？",
        confirmText: "はい（ONにする）",
        cancelText: "キャンセル",
        onConfirm: () => {
          closeModal();
          updateSafetyFilter(true);
        },
      });
    }
  };

  const handleBirthdateSubmit = () => {
    // バリデーション
    const year = parseInt(birthdate.year, 10);
    const month = parseInt(birthdate.month, 10);
    const day = parseInt(birthdate.day, 10);

    if (!year || !month || !day) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '生年月日を正しく入力してください。',
        onConfirm: closeModal,
        isAlert: true,
      });
      return;
    }

    if (year < 1900 || year > new Date().getFullYear()) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '年が不正です。',
        onConfirm: closeModal,
        isAlert: true,
      });
      return;
    }

    if (month < 1 || month > 12) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '月が不正です。',
        onConfirm: closeModal,
        isAlert: true,
      });
      return;
    }

    if (day < 1 || day > 31) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '日が不正です。',
        onConfirm: closeModal,
        isAlert: true,
      });
      return;
    }

    // 日付の妥当性チェック
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime()) || dateObj > new Date()) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '正しい生年月日を入力してください。',
        onConfirm: closeModal,
        isAlert: true,
      });
      return;
    }

    // 生年月日を送信
    setShowBirthdateModal(false);
    updateSafetyFilter(false, dateStr);
    // リセット
    setBirthdate({ year: '', month: '', day: '' });
  };

  const handleLogout = () => {
    setModalState({
      isOpen: true,
      title: "ログアウト",
      message: "本当にログアウトしますか？",
      confirmText: "はい",
      cancelText: "いいえ",
      onConfirm: async () => {
        // ログアウト前にrefresh tokenを無効化
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
          console.error('ログアウトAPI呼び出しエラー:', error);
          // エラーが発生してもログアウト処理は続行
        }
        // NextAuthのsignOutを実行（events.signOutも呼び出される）
        signOut({ callbackUrl: '/' });
      },
    });
  };

  return (
    <>
      <CustomModal {...modalState} onClose={closeModal} />
      
      {/* 生年月日入力モーダル */}
      {showBirthdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-black">年齢確認</h2>
              <button
                onClick={() => {
                  setShowBirthdateModal(false);
                  setBirthdate({ year: '', month: '', day: '' });
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <p className="text-sm text-gray-700 mb-4">
              年齢確認のため、生年月日をご入力ください
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                生年月日<span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="YYYY"
                  maxLength={4}
                  value={birthdate.year}
                  onChange={(e) => setBirthdate({ ...birthdate, year: e.target.value.replace(/\D/g, '') })}
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="MM"
                  maxLength={2}
                  value={birthdate.month}
                  onChange={(e) => setBirthdate({ ...birthdate, month: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                  className="w-20 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="DD"
                  maxLength={2}
                  value={birthdate.day}
                  onChange={(e) => setBirthdate({ ...birthdate, day: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                  className="w-20 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="mb-6 space-y-3 text-xs text-gray-700 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-blue-500 font-bold mt-0.5">●</span>
                <p className="flex-1">ご入力いただいた生年月日は、セーフティフィルター設定の変更に必要な情報として記録されます。一度登録した生年月日情報は、セキュリティ上の理由により、後から変更することはできません。</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 font-bold mt-0.5">●</span>
                <p className="flex-1">本サービスは、利用規約第9条に定めるとおり、年齢を偽って登録した場合、予告なくアカウントを削除する場合があります。年齢を偽って登録されたことにより生じた一切の不利益（サービス利用の制限、アカウント削除、法的責任等を含む）について、当社は責任を負いかねます。あらかじめご了承ください。</p>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleBirthdateSubmit}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="fixed top-4 right-4 z-10 sm:top-4 sm:right-4">
        <button
          onClick={() => setIsHelpOpen(true)}
          className="p-2 sm:p-3 rounded-xl bg-gray-900/80 backdrop-blur-xl hover:bg-white/10 hover:text-blue-400 transition-all border border-gray-800/50 shadow-lg"
          aria-label="ヘルプ"
        >
          <HelpCircle size={20} className="sm:w-6 sm:h-6" />
        </button>
      </div>
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="マイページの使い方"
        content={
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-blue-400 mb-2">概要</h3>
              <p className="text-gray-300">
                マイページでは、アカウント設定、ポイント管理、各種機能へのアクセスが可能です。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-400 mb-2">主要機能</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-2">
                <li><strong>保有ポイント</strong>: 現在のポイント残高を確認・管理</li>
                <li><strong>キャラクター管理</strong>: 作成したキャラクターの管理</li>
                <li><strong>セーフティフィルター</strong>: 不適切なコンテンツのフィルタリング設定</li>
                <li><strong>ペルソナ設定</strong>: チャット時の自分の役割・設定</li>
                <li><strong>お問い合わせ</strong>: サポートへの問い合わせ</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-400 mb-2">その他</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                <li>プロフィール: プロフィールページへ</li>
                <li>ログアウト: アカウントからログアウト</li>
                <li>会員退会: アカウントの削除（管理者の場合は管理パネルも表示）</li>
              </ul>
            </div>
          </div>
        }
      />
      <main className="flex flex-col gap-6">
        {/* プロフィールヘッダー */}
        <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/10">
          <div className="flex items-center gap-6 md:gap-8">
            {/* アバター */}
            <div className="relative flex-shrink-0">
              {session.user?.image ? (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 p-1 shadow-2xl">
                  <div className="w-full h-full rounded-3xl bg-black flex items-center justify-center overflow-hidden">
                    <Image
                      src={session.user.image}
                      alt="User Avatar"
                      width={128}
                      height={128}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 p-1 shadow-2xl">
                  <div className="w-full h-full rounded-3xl bg-black flex items-center justify-center">
                    <User size={64} className="text-blue-400" />
                  </div>
                </div>
              )}
              <Link
                href={`/profile/${session.user?.id}`}
                className="absolute bottom-0 right-0 p-2 md:p-3 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors shadow-lg"
              >
                <User size={16} className="md:w-5 md:h-5 text-white" />
              </Link>
            </div>

            {/* ユーザー情報 */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-4xl font-bold mb-2 text-white truncate">
                {session.user?.name || "ユーザー"}
              </h1>
              <p className="text-gray-400 mb-4 md:mb-6 truncate">{session.user?.email}</p>
              <div className="flex gap-4 md:gap-8 mb-4 md:mb-6">
                <div>
                  <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {profileStats.loading ? '-' : profileStats.followers.toLocaleString()}
                  </div>
                  <div className="text-xs md:text-sm text-gray-400">フォロワー</div>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {profileStats.loading ? '-' : profileStats.following.toLocaleString()}
                  </div>
                  <div className="text-xs md:text-sm text-gray-400">フォロー中</div>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {profileStats.loading ? '-' : profileStats.characterCount.toLocaleString()}
                  </div>
                  <div className="text-xs md:text-sm text-gray-400">作成キャラ</div>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href={`/profile/${session.user?.id}`}
                  className="px-4 md:px-6 py-2 md:py-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm md:text-base font-semibold hover:scale-105 transition-transform shadow-lg"
                >
                  プロフィール
                </Link>
                <Link
                  href="/profile-edit"
                  className="px-4 md:px-6 py-2 md:py-3 rounded-full bg-white/5 text-white text-sm md:text-base font-semibold border border-white/20 hover:bg-white/10 transition-colors"
                >
                  会員情報変更
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* メニューカード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <Link href="/character-management" className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <User size={24} className="md:w-7 md:h-7 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors text-sm md:text-base">作成したキャラクター</h3>
                <p className="text-xs md:text-sm text-gray-400">管理・編集</p>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0" />
            </div>
          </Link>

          <Link href="/points" className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-yellow-500/30 to-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Coins size={24} className="md:w-7 md:h-7 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1 group-hover:text-yellow-400 transition-colors text-sm md:text-base">ポイント</h3>
                <p className="text-xs md:text-sm text-gray-400">
                  残高: {points.loading ? '...' : `${points.total.toLocaleString()} P`}
                </p>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-yellow-400 transition-colors flex-shrink-0" />
            </div>
          </Link>

          <Link href="/persona/list" className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center flex-shrink-0">
                <BrainCircuit size={24} className="md:w-7 md:h-7 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1 group-hover:text-purple-400 transition-colors text-sm md:text-base">ペルソナ設定</h3>
                <p className="text-xs md:text-sm text-gray-400">チャット時の役割・設定</p>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-purple-400 transition-colors flex-shrink-0" />
            </div>
          </Link>

          <button
            onClick={handleSafetyFilterToggle}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group border border-white/10 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-green-500/30 to-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={24} className="md:w-7 md:h-7 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1 group-hover:text-green-400 transition-colors text-sm md:text-base">セーフティフィルター</h3>
                <p className="text-xs md:text-sm text-gray-400">
                  {isSafetyFilterOn === null ? '読み込み中...' : (isSafetyFilterOn ? 'ON' : 'OFF')}
                </p>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-green-400 transition-colors flex-shrink-0" />
            </div>
          </button>

          <Link href="/MyPage/inquiries" className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <MessageSquare size={24} className="md:w-7 md:h-7 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors text-sm md:text-base">お問い合わせ</h3>
                <p className="text-xs md:text-sm text-gray-400">サポート・要望</p>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0" />
            </div>
          </Link>

          <Link href="/discord" className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0">
                <Users size={24} className="md:w-7 md:h-7 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1 group-hover:text-indigo-400 transition-colors text-sm md:text-base">ディスコード</h3>
                <p className="text-xs md:text-sm text-gray-400">コミュニティ</p>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
            </div>
          </Link>

          <Link href="/guide" className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center flex-shrink-0">
                <BookUser size={24} className="md:w-7 md:h-7 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors text-sm md:text-base">ユーザーガイド</h3>
                <p className="text-xs md:text-sm text-gray-400">使い方・ヘルプ</p>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
            </div>
          </Link>

          <Link href="/notice" className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-orange-500/30 to-red-500/30 flex items-center justify-center flex-shrink-0">
                <Megaphone size={24} className="md:w-7 md:h-7 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1 group-hover:text-orange-400 transition-colors text-sm md:text-base">お知らせ</h3>
                <p className="text-xs md:text-sm text-gray-400">最新情報・アップデート</p>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-orange-400 transition-colors flex-shrink-0" />
            </div>
          </Link>

          {isAdmin && (
            <Link href="/admin" className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group border border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <Shield size={24} className="md:w-7 md:h-7 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white mb-1 group-hover:text-purple-400 transition-colors text-sm md:text-base">管理パネル</h3>
                  <p className="text-xs md:text-sm text-gray-400">管理者機能</p>
                </div>
                <ChevronRight size={20} className="text-gray-400 group-hover:text-purple-400 transition-colors flex-shrink-0" />
              </div>
            </Link>
          )}
        </div>

        {/* 統計カード */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10">
          <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-white">活動統計</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                {stats.loading ? '...' : stats.totalMessages.toLocaleString()}
              </div>
              <div className="text-xs md:text-sm text-gray-400">総チャット数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                {stats.loading ? '...' : stats.totalCharacters.toLocaleString()}
              </div>
              <div className="text-xs md:text-sm text-gray-400">作成キャラ</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                {stats.loading ? '...' : stats.totalFavorites.toLocaleString()}
              </div>
              <div className="text-xs md:text-sm text-gray-400">お気に入り</div>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-red-500/20 to-rose-500/20 backdrop-blur-sm rounded-2xl hover:from-red-500/30 hover:to-rose-500/30 transition-all border border-red-500/30 hover:border-red-500/50 cursor-pointer group"
        >
          <div className="p-2 rounded-lg bg-red-500/30">
            <LogOut size={20} className="text-red-400" />
          </div>
          <span className="text-red-400 font-semibold text-lg group-hover:text-red-300 transition-colors">ログアウト</span>
        </button>

      </main>
    </>
  );
};

const LoggedOutView = () => {
  const menuItems = [
    { icon: <Users size={20} className="text-gray-400" />, text: "ディスコード", href: "/discord" },
    { icon: <BookUser size={20} className="text-gray-400" />, text: "ユーザーガイド", href: "/guide" },
    { icon: <Megaphone size={20} className="text-gray-400" />, text: "お知らせ", badge: "アップデート", href: "/notice" },
  ];
  return (
    <main className="flex flex-col gap-6">
      <Link
        href="/login"
        className="w-full bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 backdrop-blur-sm p-5 rounded-2xl flex items-center cursor-pointer hover:from-blue-500/30 hover:via-cyan-500/30 hover:to-blue-500/30 transition-all border border-white/10 hover:border-blue-500/30 group"
      >
        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform">
          <Heart size={24} className="text-white" fill="white" />
        </div>
        <div className="text-left flex-grow">
          <p className="font-semibold text-lg text-white">
            ログインして始める
          </p>
        </div>
        <ChevronRight size={20} className="text-gray-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
      </Link>

      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">コミュニケーション・案内</h2>
        </div>
        <nav className="flex flex-col">
          {menuItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              className="w-full flex items-center text-left p-4 hover:bg-white/10 transition-all cursor-pointer group"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                {item.icon}
              </div>
              <span className="ml-4 text-base group-hover:text-blue-400 transition-colors">{item.text}</span>
              {item.badge && (
                <span className="ml-auto text-sm bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold px-3 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
              <ChevronRight size={20} className="text-gray-400 ml-auto group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
};

export default function MyPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          if (data && Object.keys(data).length > 0) {
            setSession(data);
            setStatus("authenticated");
          } else {
            setStatus("unauthenticated");
          }
        } else {
          setStatus("unauthenticated");
        }
      } catch (error) {
        console.error("セッションの取得に失敗しました:", error);
        setStatus("unauthenticated");
      }
    };
    fetchSession();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {!isMobile ? (
          <div className="flex max-w-[1920px] mx-auto">
            <main className="flex-1 px-4 md:px-6 py-6 md:py-8">
              <header className="text-center py-6 mb-6">
                <h1 className="text-3xl font-bold text-white">
                  マイページ
                </h1>
              </header>
              {status === "loading" && (
                <div className="flex justify-center items-center py-16">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-gray-400">読み込み中...</p>
                  </div>
                </div>
              )}
              {status === "authenticated" && session && <LoggedInView session={session} />}
              {status === "unauthenticated" && <LoggedOutView />}
            </main>
            <MyPageRightSidebar />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
            <header className="text-center py-6 mb-6">
              <h1 className="text-3xl font-bold text-white">
                マイページ
              </h1>
            </header>
            {status === "loading" && (
              <div className="flex justify-center items-center py-16">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-gray-400">読み込み中...</p>
                </div>
              </div>
            )}
            {status === "authenticated" && session && <LoggedInView session={session} />}
            {status === "unauthenticated" && <LoggedOutView />}
          </div>
        )}
      </div>
    </div>
  );
}

