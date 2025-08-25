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

// params를 any로 지정해서 타입 충돌 방지
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
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center p-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10 border-b border-gray-800">
          <Link
            href={`/notice/${noticeId}`}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors duration-200 cursor-pointer"
          >
            <ArrowLeft />
          </Link>
          <h1 className="font-bold text-lg mx-auto">お知らせ修正</h1>
        </header>
        <main>
          <NoticeForm initialData={notice} noticeId={noticeId} />
        </main>
      </div>
    </div>
  );
}