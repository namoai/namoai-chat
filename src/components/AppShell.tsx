"use client"; // このファイルがクライアントコンポーネントであることを宣言します

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import BottomNav from "./BottomNav";

// 下部のナビゲーションバーを非表示にするパスのリスト
// ✅ お知らせページ(`/notice`)のパスを追加して、メニューバーを非表示にします。
const HIDE_NAV_PATHS = ["/login", "/register", "/chat/", "/characters/", "/notice", "/guide", "/complete-profile"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  // 現在のURLパスを取得します
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  // ✅ Googleログイン後の追加情報入力チェック
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") return;
    
    // 既に登録完了ページにいる場合はスキップ
    if (pathname === "/register/google" || pathname === "/complete-profile") return;
    
    const needsProfileCompletion =
      typeof session?.user === 'object' &&
      session?.user &&
      'needsProfileCompletion' in session.user &&
      (session.user as { needsProfileCompletion?: boolean }).needsProfileCompletion === true;

    if (needsProfileCompletion) {
      // Googleアカウントでログインしているかチェック（Accountテーブルで確認する必要があるが、簡易的にemailVerifiedで判断）
      // Googleログインの場合は /register/google へ、通常ログインの場合は /complete-profile へ
      const isGoogleLogin = session?.user?.email && session?.user?.image; // Googleログインは通常imageがある
      
      if (isGoogleLogin) {
        console.log('[AppShell] Googleログイン後の追加情報入力が必要です。 /register/google へリダイレクト');
        router.push('/register/google');
      } else {
        console.log('[AppShell] プロフィール未完了。 /complete-profile へリダイレクト');
        router.push('/complete-profile');
      }
    }
  }, [session, status, pathname, router]);

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
      <main className={shouldShowNav ? "pb-24" : ""}>{children}</main>
      
      {/* shouldShowNavがtrueの場合のみ、BottomNavコンポーネントをレンダリングします */}
      {shouldShowNav && <BottomNav />}
    </>
  );
}
