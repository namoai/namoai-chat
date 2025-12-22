"use client";

import Link from "next/link";
import { Bell, User } from "lucide-react";
import SearchBar from "./SearchBar";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function PCHeader() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

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

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 5000);

    return () => clearInterval(interval);
  }, [session]);

  return (
    <header className="flex-shrink-0 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-8 py-4 z-50 sticky top-0">
      <div className="flex items-center justify-between gap-4 w-full">
        {/* Logo */}
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <Link href="/" className="text-lg md:text-xl font-bold text-white whitespace-nowrap">
            ナモアイ
          </Link>
        </div>

        {/* Search Bar - 프로필 아이콘 공간 확보 */}
        <div className="flex-1 max-w-md md:max-w-xl min-w-0 mx-2 md:mx-4">
          <SearchBar />
        </div>

        {/* Notifications & Profile - 항상 보이도록, 더 왼쪽으로 */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <Link
            href="/notifications"
            className="relative p-1.5 md:p-2 rounded-lg hover:bg-blue-500/10 hover:text-blue-400 transition-colors"
          >
            <Bell className="w-5 h-5 md:w-6 md:h-6 text-gray-300" />
            {unreadCount > 0 && (
              <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-black" />
            )}
          </Link>
          <Link
            href="/MyPage"
            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
            title="マイページ"
          >
            <User className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </Link>
        </div>
      </div>
    </header>
  );
}



