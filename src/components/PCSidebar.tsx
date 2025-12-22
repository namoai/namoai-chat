"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, PlusSquare, Users, Award } from "lucide-react";

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/chatlist", label: "チャット", icon: MessageCircle },
  { href: "/charlist", label: "キャラクター一覧", icon: Users },
  { href: "/ranking", label: "ランキング", icon: Award },
  { href: "/characters/create", label: "作成", icon: PlusSquare },
];

export default function PCSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || (pathname.startsWith("/characters/") && pathname !== "/characters/create");
    }
    return pathname === href;
  };

  return (
    <aside className="w-20 flex-shrink-0 bg-black/80 backdrop-blur-xl border-r border-white/10 flex flex-col items-center py-6 fixed left-0 top-[73px] h-[calc(100vh-73px)] z-40">
      {/* Navigation Menu */}
      <nav className="flex flex-col gap-4 w-full items-center">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                active
                  ? "bg-gradient-to-br from-blue-500/50 to-cyan-500/50 shadow-lg hover:scale-110"
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              <item.icon
                className={`w-6 h-6 ${active ? "text-white" : "text-gray-300"}`}
              />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}



