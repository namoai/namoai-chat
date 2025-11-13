/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from '@/lib/nextauth';
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NoticeForm from "@/components/NoticeForm";
// ▼▼▼ 変更点: Role Enumとnotices型をインポートします ▼▼▼
import { Role, type notices } from "@prisma/client";

async function getNotice(id: number): Promise<notices | null> {
  try {
    return await prisma.notices.findUnique({ where: { id } });
  } catch (error) {
    console.error("Failed to fetch notice:", error);
    return null;
  }
}

// paramsをanyで指定して型衝突を防止
export default async function NoticeEditAdminPage({
  params,
}: {
  params: any;
}) {
  const session = await getServerSession(authOptions);

  // ▼▼▼ 変更点: 権限チェックを MODERATOR と SUPER_ADMIN に変更します ▼▼▼
  const userRole = session?.user?.role;
  if (userRole !== Role.MODERATOR && userRole !== Role.SUPER_ADMIN) {
    redirect('/notice');
  }

  const noticeId = parseInt(params.noticeId, 10);
  if (isNaN(noticeId)) {
    redirect('/notice');
  }

  const notice = await getNotice(noticeId);

  if (!notice) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        お知らせが見つかりません。
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-24">
          <header className="flex items-center justify-center mb-8 sticky top-0 bg-black/80 backdrop-blur-xl z-10 py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-900/50 relative">
            <Link
              href={`/notice/${noticeId}`}
              className="absolute left-4 md:left-6 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
            >
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              お知らせ修正
            </h1>
          </header>
          <main>
            <NoticeForm initialData={notice} noticeId={noticeId} />
          </main>
        </div>
      </div>
    </div>
  );
}