import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from '@/lib/nextauth';
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import NoticeForm from "@/components/NoticeForm";
// ▼▼▼ 変更点: 型安全性のためにRole Enumをインポートします ▼▼▼
import { Role } from "@prisma/client";

// このページはサーバーコンポーネントとして動作します
export default async function NoticeCreateAdminPage() {
  const session = await getServerSession(authOptions);

  // ▼▼▼ 変更点: 権限チェックを MODERATOR と SUPER_ADMIN に変更します ▼▼▼
  const userRole = session?.user?.role;
  if (userRole !== Role.MODERATOR && userRole !== Role.SUPER_ADMIN) {
    redirect('/notice');
  }

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center p-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10 border-b border-gray-800">
          {/* ✅ お知らせ一覧ページに戻る */}
          <Link href="/notice" className="p-2 rounded-full hover:bg-gray-800 transition-colors">
            <ArrowLeft />
          </Link>
          <h1 className="font-bold text-lg absolute left-1/2 -translate-x-1/2">お知らせ作成</h1>
        </header>
        <main>
          <NoticeForm />
        </main>
      </div>
    </div>
  );
}