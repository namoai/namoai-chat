"use client";

import type { Session } from "next-auth";
import {
  Heart, ChevronRight, Megaphone, Users, BookUser,
  User, ShieldCheck, BrainCircuit, LogOut, Coins, Shield, Loader2, MessageSquare, HelpCircle,
} from "lucide-react";
import HelpModal from "@/components/HelpModal";
import { useState, useEffect, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from 'next/link';

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
          <button onClick={onConfirm} className={`bg-pink-600 text-white hover:bg-pink-700 py-2 px-4 rounded-lg`}>{confirmText || 'OK'}</button>
        </div>
      </div>
    </div>
  );
};

// メニューアイテムの型定義
type MenuItem = {
  icon: ReactNode;
  text: string;
  action: string | (() => void);
  badge?: string;
};

// ログインしているユーザー向けのビュー
const LoggedInView = ({ session }: { session: Session }) => {
  const [points, setPoints] = useState<{ total: number; loading: boolean }>({ total: 0, loading: true });
  const [isSafetyFilterOn, setIsSafetyFilterOn] = useState<boolean | null>(null); // null = ローディング中
  const [modalState, setModalState] = useState<Omit<ModalProps, 'onClose'>>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const userRole = session?.user?.role;
  const isAdmin = userRole && userRole !== 'USER';

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

        const filterRes = await fetch('/api/users/safety-filter', { cache: 'no-store' }); // キャッシュを無効化
        if (filterRes.ok) {
          const filterData = await filterRes.json();
          // nullの場合はtrue（フィルターON）として処理、即座に反映
          setIsSafetyFilterOn(filterData.safetyFilter ?? true);
        } else {
          // API呼び出し失敗時はデフォルト値で設定
          setIsSafetyFilterOn(true);
        }
      } catch (error) {
        console.error(error);
        setPoints({ total: 0, loading: false });
        // エラー発生時はデフォルト値で設定
        setIsSafetyFilterOn(true);
      }
    };
    fetchData();
  }, []);

  const closeModal = () => setModalState(prev => ({ ...prev, isOpen: false }));

  const updateSafetyFilter = async (newStatus: boolean) => {
    try {
      const response = await fetch('/api/users/safety-filter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safetyFilter: newStatus }),
        cache: 'no-store', // キャッシュを無効化
      });
      if (!response.ok) throw new Error('設定の変更に失敗しました。');

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
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: 'エラーが発生しました。',
        onConfirm: closeModal,
        isAlert: true,
      });
    }
  };

  const handleSafetyFilterToggle = () => {
    // ローディング中ならクリック無視
    if (isSafetyFilterOn === null) return;
    
    if (isSafetyFilterOn) {
      // ON → OFF: 年齢確認 + 法律上の確認
      setModalState({
        isOpen: true,
        title: "年齢確認および法律上の確認",
        message: "あなたは成人ですか？\n\n「はい」を選択すると、成人向けコンテンツが表示される可能性があります。\n\n日本の法律に従い、18歳以上の成人であることを確認してください。この設定を変更することにより、成人向けコンテンツへのアクセスが可能になります。",
        confirmText: "はい（18歳以上です）",
        cancelText: "いいえ",
        onConfirm: () => {
          closeModal();
          updateSafetyFilter(false);
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

  const handleLogout = () => {
    setModalState({
      isOpen: true,
      title: "ログアウト",
      message: "本当にログアウトしますか？",
      confirmText: "はい",
      cancelText: "いいえ",
      onConfirm: () => signOut({ callbackUrl: '/' }),
    });
  };


  const myMenuItems: MenuItem[] = [
    { icon: <User size={20} className="text-pink-400" />, text: "キャラクター管理", action: "/character-management" },
    {
      icon: <ShieldCheck size={20} className="text-pink-400" />,
      text: "セーフティフィルター",
      badge: isSafetyFilterOn === null ? "" : (isSafetyFilterOn ? "ON" : "OFF"),
      action: handleSafetyFilterToggle
    },
    { icon: <BrainCircuit size={20} className="text-pink-400" />, text: "ペルソナ設定", action: "/persona/list" },
    { icon: <MessageSquare size={20} className="text-pink-400" />, text: "お問い合わせ", action: "/MyPage/inquiries" },
  ];
  const infoMenuItems: Omit<MenuItem, 'badge'>[] = [
    { icon: <Users size={20} className="text-pink-400" />, text: "ディスコード", action: "/discord" },
    { icon: <BookUser size={20} className="text-pink-400" />, text: "ユーザーガイド", action: "/guide" },
    { icon: <Megaphone size={20} className="text-pink-400" />, text: "お知らせ", action: "/notice" },
  ];

  const MenuItemComponent = ({ item }: { item: MenuItem | Omit<MenuItem, 'badge'> }) => {
    const commonClasses = "w-full flex items-center text-left p-4 hover:bg-pink-500/10 transition-all duration-200 cursor-pointer group";
    const content = (
      <>
        <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 group-hover:from-pink-500/30 group-hover:to-purple-500/30 transition-all">
          {item.icon}
        </div>
        <span className="ml-4 text-base group-hover:text-pink-400 transition-colors">{item.text}</span>
        {'badge' in item && (
          <span
            className={`ml-auto text-sm px-3 py-1 rounded-full flex items-center justify-center font-semibold ${
              isSafetyFilterOn === null 
                ? 'bg-gray-600 text-white w-6 h-6' 
                : (isSafetyFilterOn ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' : 'bg-gradient-to-r from-red-500 to-rose-600 text-white')
            }`}
          >
            {isSafetyFilterOn === null ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              item.badge
            )}
          </span>
        )}
        {typeof item.action === 'string' && (
          <ChevronRight size={20} className="text-gray-400 ml-auto group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
        )}
      </>
    );

    if (typeof item.action === 'string') {
      return (
        <Link href={item.action} className={commonClasses}>
          {content}
        </Link>
      );
    }
    return (
      <button onClick={item.action} className={commonClasses}>
        {content}
      </button>
    );
  };

  return (
    <>
      <CustomModal {...modalState} onClose={closeModal} />
      <div className="fixed top-4 right-4 z-10">
        <button
          onClick={() => setIsHelpOpen(true)}
          className="p-3 rounded-xl bg-gray-900/80 backdrop-blur-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all border border-gray-800/50 shadow-lg"
          aria-label="ヘルプ"
        >
          <HelpCircle size={24} />
        </button>
      </div>
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="マイページの使い方"
        content={
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">概要</h3>
              <p className="text-gray-300">
                マイページでは、アカウント設定、ポイント管理、各種機能へのアクセスが可能です。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">主要機能</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-2">
                <li><strong>保有ポイント</strong>: 現在のポイント残高を確認・管理</li>
                <li><strong>キャラクター管理</strong>: 作成したキャラクターの管理</li>
                <li><strong>セーフティフィルター</strong>: 不適切なコンテンツのフィルタリング設定</li>
                <li><strong>ペルソナ設定</strong>: チャット時の自分の役割・設定</li>
                <li><strong>お問い合わせ</strong>: サポートへの問い合わせ</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">その他</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                <li>マイプロフィール: プロフィール編集ページへ</li>
                <li>ログアウト: アカウントからログアウト</li>
                <li>会員退会: アカウントの削除（管理者の場合は管理パネルも表示）</li>
              </ul>
            </div>
          </div>
        }
      />
      <main className="flex flex-col gap-6">
        <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl flex items-center border border-gray-800/50 hover:border-pink-500/30 transition-all">
          <div className="mr-4">
            {session.user?.image ? (
              <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-pink-500/30">
                <Image
                  src={session.user.image}
                  alt="User Avatar"
                  width={64}
                  height={64}
                  className="rounded-full object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center ring-2 ring-pink-500/30">
                <User size={32} className="text-pink-400" />
              </div>
            )}
          </div>
          <div className="flex-grow">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-xl bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                {session.user?.name || "ユーザー"}
              </p>
              {isAdmin && (
                <span className="text-xs bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-1 px-3 rounded-full">
                  {userRole}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">{session.user?.email}</p>
          </div>
          <Link
            href={`/profile/${session.user?.id}`}
            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all shadow-lg shadow-pink-500/30"
          >
            マイプロフィール
          </Link>
        </div>

        <Link
          href="/points"
          className="w-full bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-purple-500/20 backdrop-blur-sm p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:from-yellow-500/30 hover:via-pink-500/30 hover:to-purple-500/30 transition-all border border-gray-800/50 hover:border-pink-500/30 group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/30 to-orange-500/30">
              <Coins size={24} className="text-yellow-400" />
            </div>
            <span className="font-semibold text-lg">保有ポイント</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-2xl bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              {points.loading ? '...' : `${points.total.toLocaleString()} P`}
            </span>
            <ChevronRight size={20} className="text-gray-400 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        {isAdmin && (
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 overflow-hidden">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">管理</h2>
            </div>
            <nav>
              <Link href="/admin" className="w-full flex items-center text-left p-4 hover:bg-pink-500/10 transition-colors duration-200 cursor-pointer group">
                <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                  <Shield size={20} className="text-pink-400" />
                </div>
                <span className="ml-4 text-base group-hover:text-pink-400 transition-colors">管理パネル</span>
                <ChevronRight size={20} className="text-gray-400 ml-auto group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
              </Link>
            </nav>
          </div>
        )}

        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 overflow-hidden">
          <div className="px-6 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">MY</h2>
          </div>
          <nav className="flex flex-col">
            {myMenuItems.map((item) => <MenuItemComponent key={item.text} item={item} />)}
          </nav>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 overflow-hidden">
          <div className="px-6 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">コミュニケーション・案内</h2>
          </div>
          <nav className="flex flex-col">
            {infoMenuItems.map((item) => <MenuItemComponent key={item.text} item={item} />)}
          </nav>
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
        className="w-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-sm p-5 rounded-2xl flex items-center cursor-pointer hover:from-pink-500/30 hover:via-purple-500/30 hover:to-pink-500/30 transition-all border border-gray-800/50 hover:border-pink-500/30 group"
      >
        <div className="bg-gradient-to-br from-pink-500 to-purple-600 p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform">
          <Heart size={24} className="text-white" fill="white" />
        </div>
        <div className="text-left flex-grow">
          <p className="font-semibold text-lg bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            ログインして始める
          </p>
        </div>
        <ChevronRight size={20} className="text-gray-400 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
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
              className="w-full flex items-center text-left p-4 hover:bg-pink-500/10 transition-all cursor-pointer group"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                {item.icon}
              </div>
              <span className="ml-4 text-base group-hover:text-pink-400 transition-colors">{item.text}</span>
              {item.badge && (
                <span className="ml-auto text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold px-3 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
              <ChevronRight size={20} className="text-gray-400 ml-auto group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
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
    <div className="min-h-screen bg-black text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
          <header className="text-center py-6 mb-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 via-blue-400 to-pink-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradient-shift_3s_ease_infinite]">
              マイページ
            </h1>
          </header>
          {status === "loading" && (
            <div className="flex justify-center items-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                <p className="text-gray-400">読み込み中...</p>
              </div>
            </div>
          )}
          {status === "authenticated" && session && <LoggedInView session={session} />}
          {status === "unauthenticated" && <LoggedOutView />}
        </div>
      </div>
    </div>
  );
}

