"use client";

import type { Session } from "next-auth";
import {
  Heart, ChevronRight, Megaphone, Users, BookUser,
  User, ShieldCheck, BrainCircuit, LogOut, Coins, Shield, Loader2, MessageSquare,
} from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from 'next/link';

// ▼▼▼【修正】未使用のuseRouterのインポートを削除しました ▼▼▼
// import { useRouter } from 'next/navigation';

// ユーザーのプロフィール画像がない場合に表示するデフォルトのSVGアイコンコンポーネント
const DefaultAvatarIcon = ({ size = 48 }: { size?: number }) => (
  <div
    className="rounded-full bg-gray-700 flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <User size={size * 0.6} className="text-gray-400" />
  </div>
);

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
    { icon: <User size={20} className="text-gray-400" />, text: "キャラクター管理", action: "/character-management" },
    {
      icon: <ShieldCheck size={20} className="text-gray-400" />,
      text: "セーフティフィルター",
      badge: isSafetyFilterOn === null ? "" : (isSafetyFilterOn ? "ON" : "OFF"),
      action: handleSafetyFilterToggle
    },
    { icon: <BrainCircuit size={20} className="text-gray-400" />, text: "ペルソナ設定", action: "/persona/list" },
    { icon: <MessageSquare size={20} className="text-gray-400" />, text: "お問い合わせ", action: "/MyPage/inquiries" },
  ];
  const infoMenuItems: Omit<MenuItem, 'badge'>[] = [
    { icon: <Users size={20} className="text-gray-400" />, text: "ディスコード", action: "/discord" },
    { icon: <BookUser size={20} className="text-gray-400" />, text: "ユーザーガイド", action: "/guide" },
    { icon: <Megaphone size={20} className="text-gray-400" />, text: "お知らせ", action: "/notice" },
  ];

  const MenuItemComponent = ({ item }: { item: MenuItem | Omit<MenuItem, 'badge'> }) => {
    const commonClasses = "w-full flex items-center text-left p-4 hover:bg-gray-800 transition-colors duration-200 cursor-pointer";
    const content = (
      <>
        {item.icon}
        <span className="ml-4 text-base">{item.text}</span>
        {'badge' in item && (
          <span
            className={`ml-auto text-sm px-2 py-1 rounded flex items-center justify-center ${
              isSafetyFilterOn === null 
                ? 'bg-gray-600 text-white w-6 h-6' 
                : (isSafetyFilterOn ? 'bg-green-600 text-white' : 'bg-red-600 text-white')
            }`}
          >
            {isSafetyFilterOn === null ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              item.badge
            )}
          </span>
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

      <main className="flex flex-col gap-6">
        <div className="bg-[#1C1C1E] p-4 rounded-lg flex items-center">
          <div className="mr-4">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt="User Avatar"
                width={48}
                height={48}
                className="rounded-full"
              />
            ) : (
              <DefaultAvatarIcon size={48} />
            )}
          </div>
          <div className="flex-grow">
            <div className="flex items-center gap-2">
              <p className="font-bold text-lg">{session.user?.name || "ユーザー"}</p>
              {isAdmin && (
                <span className="text-xs bg-pink-600 text-white font-semibold py-1 px-2 rounded-md">
                  {userRole}
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/profile/${session.user?.id}`}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-4 rounded-lg transition-colors duration-200"
          >
            マイプロフィール
          </Link>
        </div>

        <Link
          href="/points"
          className="w-full bg-[#1C1C1E] p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-800 transition-colors duration-200"
        >
          <div className="flex items-center gap-2">
            <Coins size={20} className="text-yellow-400" />
            <span className="font-semibold">保有ポイント</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">
              {points.loading ? '読み込み中...' : `${points.total.toLocaleString()} P`}
            </span>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </Link>

        {isAdmin && (
          <div className="bg-[#1C1C1E] rounded-lg">
            <div className="px-4 pt-4 pb-2"><h2 className="text-xs text-gray-500">管理</h2></div>
            <nav>
              <Link href="/admin" className="w-full flex items-center text-left p-4 hover:bg-gray-800 transition-colors duration-200 cursor-pointer">
                <Shield size={20} className="text-gray-400" />
                <span className="ml-4 text-base">管理パネル</span>
              </Link>
            </nav>
          </div>
        )}

        <div className="bg-[#1C1C1E] rounded-lg">
          <div className="px-4 pt-4 pb-2"><h2 className="text-xs text-gray-500">MY</h2></div>
          <nav className="flex flex-col">
            {myMenuItems.map((item) => <MenuItemComponent key={item.text} item={item} />)}
          </nav>
        </div>

        <div className="bg-[#1C1C1E] rounded-lg">
          <div className="px-4 pt-4 pb-2"><h2 className="text-xs text-gray-500">コミュニケーション・案内</h2></div>
          <nav className="flex flex-col">
            {infoMenuItems.map((item) => <MenuItemComponent key={item.text} item={item} />)}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center text-left p-4 bg-[#1C1C1E] rounded-lg hover:bg-red-800/50 transition-colors duration-200 cursor-pointer"
        >
          <LogOut size={20} className="text-red-500 mr-3" />
          <span className="text-red-500 font-semibold">ログアウト</span>
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
        className="w-full bg-[#1C1C1E] p-4 rounded-lg flex items-center cursor-pointer hover:bg-gray-800 transition-colors duration-200"
      >
        <div className="bg-pink-500 p-3 rounded-full mr-4"><Heart size={24} className="text-white" fill="white" /></div>
        <div className="text-left"><p className="font-semibold">ログインして始める</p></div>
        <ChevronRight size={20} className="text-gray-400 ml-auto" />
      </Link>

      <div className="bg-[#1C1C1E] rounded-lg">
        <div className="px-4 pt-4 pb-2"><h2 className="text-xs text-gray-500">コミュニケーション・案内</h2></div>
        <nav className="flex flex-col">
          {menuItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              className="w-full flex items-center text-left p-4 hover:bg-gray-800 transition-colors duration-200 cursor-pointer"
            >
              {item.icon}
              <span className="ml-4 text-base">{item.text}</span>
              {item.badge && (<span className="ml-auto text-sm text-pink-400 font-semibold">{item.badge}</span>)}
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
    <div className="min-h-screen bg-black text-white p-4 font-sans pb-20">
      <header className="text-center py-4"><h1 className="text-lg font-bold">マイページ</h1></header>
      {status === "loading" && <p className="text-center">ローディング中...</p>}
      {status === "authenticated" && session && <LoggedInView session={session} />}
      {status === "unauthenticated" && <LoggedOutView />}
    </div>
  );
}

