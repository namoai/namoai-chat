"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import SearchBar from "./SearchBar";
import MobileDrawerNav from "./MobileDrawerNav";

export default function MobileHeader() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-300" />
            </button>
            <Link href="/" className="text-lg font-bold text-white">
              ナモアイ
            </Link>
          </div>
          <SearchBar mobile={true} />
        </div>
      </header>

      <MobileDrawerNav isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}
