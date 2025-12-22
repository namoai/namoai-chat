"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, PlusSquare, User, Users, Award, X } from "lucide-react";

interface MobileDrawerNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/chatlist", label: "チャット", icon: MessageCircle },
  { href: "/charlist", label: "キャラクター一覧", icon: Users },
  { href: "/ranking", label: "ランキング", icon: Award },
  { href: "/characters/create", label: "作成", icon: PlusSquare },
  { href: "/MyPage", label: "マイページ", icon: User },
];

export default function MobileDrawerNav({ isOpen, onClose }: MobileDrawerNavProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || (pathname.startsWith("/characters/") && pathname !== "/characters/create");
    }
    return pathname === href;
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-[280px] bg-black/80 backdrop-blur-xl border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-white">メニュー</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6 text-gray-300" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 flex-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    active
                      ? "bg-white/5 hover:bg-white/10"
                      : "hover:bg-white/10"
                  }`}
                >
                  <item.icon
                    className={`w-5 h-5 ${active ? "text-white" : "text-gray-400"}`}
                  />
                  <span className={`${active ? "text-white" : "text-gray-400"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
