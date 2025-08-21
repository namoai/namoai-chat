"use client"; // このファイルがクライアントコンポーネントであることを宣言します

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

// 下部のナビゲーションバーを非表示にするパスのリスト
// ✅ お知らせページ(`/notice`)のパスを追加して、メニューバーを非表示にします。
const HIDE_NAV_PATHS = ["/login", "/register", "/chat/", "/characters/", "/notice", "/guide"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  // 現在のURLパスを取得します
  const pathname = usePathname();

  // 現在のパスが非表示リストに含まれていない場合にのみ、ナビゲーションバーを表示します
  const shouldShowNav = !HIDE_NAV_PATHS.some(path => {
    // `/characters/` は詳細ページ（例: /characters/123）のみ非表示対象とし、
    // 作成ページ（/characters/create）は対象外とします。
    if (path === "/characters/") {
      return pathname.startsWith(path) && pathname !== '/characters/create';
    }
    return pathname.startsWith(path);
  });

  return (
    <>
      {/* ナビゲーションバーが表示される場合のみ、下部にパディングを追加します。
        これにより、ページの内容がナビゲーションバーに隠れるのを防ぎます。
        表示されない場合はパディングをなくし、画面全体を使用できるようにします。
      */}
      <main className={shouldShowNav ? "pb-20" : ""}>{children}</main>
      
      {/* shouldShowNavがtrueの場合のみ、BottomNavコンポーネントをレンダリングします */}
      {shouldShowNav && <BottomNav />}
    </>
  );
}
