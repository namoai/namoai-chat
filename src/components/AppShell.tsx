"use client"; // このファイルがクライアントコンポーネントであることを宣言します

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import BottomNav from "./BottomNav";
import Footer from "./Footer";
import PCHeader from "./PCHeader";
import PCSidebar from "./PCSidebar";

// 下部のナビゲーションバーを非表示にするパスのリスト
// ✅ お知らせページ(`/notice`)のパスを追加して、メニューバーを非表示にします。
const HIDE_NAV_PATHS = ["/login", "/register", "/chat/", "/complete-profile"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  // 現在のURLパスを取得します
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isMobile, setIsMobile] = useState(false);

  // モバイル/PC判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
  // PCの場合はログイン/登録ページでもナビゲーションを表示
  const shouldShowNav = isMobile 
    ? !HIDE_NAV_PATHS.some(path => pathname.startsWith(path))
    : !HIDE_NAV_PATHS.filter(path => path !== "/login" && path !== "/register").some(path => pathname.startsWith(path));

  // モバイル版レイアウト
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-950">
        <main className="flex-1 flex flex-col">
          <div className="flex-1">{children}</div>
          
          {/* Footer - 하단 네비게이션 바 위에 배치 (스크롤 시 보임) */}
          {shouldShowNav && (
            <div className="mt-auto pb-20">
              <Footer />
            </div>
          )}
        </main>
        
        {/* モバイル用ハムバーガーナビゲーション（BottomNav） */}
        {shouldShowNav && <BottomNav />}
      </div>
    );
  }

  // PC版レイアウト
  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* PCヘッダー */}
      {shouldShowNav && <PCHeader />}
      
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1">
          {/* PCサイドバー */}
          {shouldShowNav && <PCSidebar />}
          
          {/* メインコンテンツエリア - サイドバーがある場合のみマージンを追加 */}
          <div className={`flex-1 flex flex-col ${shouldShowNav ? 'ml-20' : ''}`}>
            <main className="flex-1 overflow-y-auto">{children}</main>
            
            {/* Footer - メインコンテンツと同じ幅 */}
            {shouldShowNav && <Footer />}
          </div>
        </div>
      </div>
    </div>
  );
}
