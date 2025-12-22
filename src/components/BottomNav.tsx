"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, User, Users, Award } from "lucide-react";

// ナビゲーションアイテムのデータ
const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/chatlist", label: "チャット", icon: MessageCircle },
  { href: "/charlist", label: "キャラ一覧", icon: Users },
  { href: "/ranking", label: "ランキング", icon: Award },
  { href: "/MyPage", label: "マイページ", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

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
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" />
              )}
              
              <div className={`relative p-2 rounded-xl transition-all duration-200 ${
                isActive 
                  ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400" 
                  : "text-gray-400 group-hover:text-blue-400 group-hover:bg-blue-500/10"
              }`}>
                <item.icon
                  size={22}
                  className={isActive ? "text-blue-400" : "text-gray-400 group-hover:text-blue-400"}
                />
              </div>
              
              <span
                className={`text-sm font-medium transition-colors ${
                  isActive ? "text-blue-400" : "text-gray-400 group-hover:text-blue-400"
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
