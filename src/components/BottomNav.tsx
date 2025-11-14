"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, PlusSquare, User, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// ナビゲーションアイテムのデータ
const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/chatlist", label: "チャット", icon: MessageCircle },
  { href: "/characters/create", label: "作成", icon: PlusSquare },
  { href: "/notifications", label: "通知", icon: Bell, showBadge: true },
  { href: "/MyPage", label: "マイページ", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname(); 
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

  // ★ 未読通知数をポーリングで取得（リアルタイム対応）
  useEffect(() => {
    if (!session?.user) return;

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count");
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      } catch (error) {
        console.error("未読通知数取得エラー:", error);
      }
    };

    // 初回取得
    fetchUnreadCount();

    // 5秒ごとにポーリング（リアルタイムに近い更新）
    const interval = setInterval(fetchUnreadCount, 5000);

    // ページがアクティブになったときに即座に更新
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ページにフォーカスが戻ったときに即座に更新
    const handleFocus = () => {
      fetchUnreadCount();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-gray-900/50">
      <div className="flex justify-around items-center h-20 max-w-7xl mx-auto py-2">
        {navItems.map((item) => {
          // ✅ ホームボタンの判定ロジックを修正しました
          // これでキャラクター詳細ページでもホームがアクティブになります
          const isActive = item.href === "/"
            ? pathname === "/" || pathname.startsWith("/characters/") && pathname !== "/characters/create"
            : pathname === item.href;
          
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 text-xs transition-all duration-200 relative group"
            >
              {/* アクティブインジケーター */}
              {isActive && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full" />
              )}
              
              <div className={`relative p-2 rounded-xl transition-all duration-200 ${
                isActive 
                  ? "bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-400" 
                  : "text-gray-400 group-hover:text-pink-400 group-hover:bg-pink-500/10"
              }`}>
                <item.icon
                  size={22}
                  className={isActive ? "text-pink-400" : "text-gray-400 group-hover:text-pink-400"}
                />
                
                {/* ★ 通知バッジ（未読がある場合のみ表示） */}
                {item.showBadge && unreadCount > 0 && (
                  <>
                    {/* 点滅する赤い点（ライブインジケーター） */}
                    <div className="absolute top-0 right-0 w-3 h-3">
                      <div className="absolute inset-0 bg-red-500 rounded-full animate-ping"></div>
                      <div className="absolute inset-0 bg-red-500 rounded-full"></div>
                    </div>
                    
                    {/* 数字バッジ */}
                    <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-pulse border-2 border-black shadow-lg shadow-red-500/50">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </div>
                  </>
                )}
              </div>
              
              <span
                className={`text-sm font-medium transition-colors ${
                  isActive ? "text-pink-400" : "text-gray-400 group-hover:text-pink-400"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
