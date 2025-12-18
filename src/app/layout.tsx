import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
// 1. AppShellとProvidersコンポーネントをインポートします
import AppShell from "@/components/AppShell";
import Providers from "@/components/Providers";
import AccessLogger from "@/components/AccessLogger";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // サイトのタイトルと説明を適切に設定します
  title: "NAMOAI Chat",
  description: "AIキャラクターチャットサイト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // ページの言語を日本語に設定します
    <html lang="ja">
      {/* ▼▼▼ 変更点: bodyタグ内の不要な空白を削除しました ▼▼▼ */}
      <body className={`${geistSans.variable} antialiased`}>
        {/* NextAuthのセッション状態をアプリ全体で共有するためにProvidersでラップします */}
        <Providers>
          <AccessLogger />
          {/* 全てのページ内容({children})をAppShellコンポーネントでラップします。
            これにより、AppShellがパスに応じてナビゲーションバーの表示・非表示を管理します。
          */}
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
