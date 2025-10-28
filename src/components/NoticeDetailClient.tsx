"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

// お知らせ詳細データの型定義
type NoticeDetail = {
  id: number;
  category: string;
  title: string;
  createdAt: string;
  content: string;
};

// このクライアントコンポーネントが受け取るpropsの型
interface NoticeDetailClientProps {
  noticeId: string;
}

// ▼▼▼【新規追加】汎用モーダルコンポーネント ▼▼▼
type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  isAlert?: boolean;
};

const ConfirmationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
  if (!modalState.isOpen) return null;

  const handleClose = () => {
    modalState.onCancel?.();
    setModalState({ ...modalState, isOpen: false });
  };
  const handleConfirm = () => {
    modalState.onConfirm?.();
    setModalState({ ...modalState, isOpen: false });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
        <h2 className="text-xl font-bold mb-4 text-white">{modalState.title}</h2>
        <p className="text-gray-200 mb-6">{modalState.message}</p>
        <div className={`flex ${modalState.isAlert ? 'justify-end' : 'justify-between'} gap-4`}>
          {!modalState.isAlert && (
            <button onClick={handleClose} className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg transition-colors">
              キャンセル
            </button>
          )}
          <button 
            onClick={handleConfirm} 
            className={`px-4 py-2 text-white ${modalState.confirmText?.includes('削除') ? 'bg-red-600 hover:bg-red-500' : 'bg-pink-600 hover:bg-pink-500'} rounded-lg transition-colors`}
          >
            {modalState.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
// ▲▲▲【追加完了】▲▲▲

export default function NoticeDetailClient({ noticeId }: NoticeDetailClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    if (noticeId) {
      const fetchNoticeDetail = async () => {
        try {
          setIsLoading(true);
          const response = await fetch(`/api/notice/${noticeId}`);
          if (!response.ok)
            throw new Error("お知らせの読み込みに失敗しました。");
          const data = await response.json();
          setNotice(data);
        } catch (error) {
          console.error(error);
          router.push("/notice");
        } finally {
          setIsLoading(false);
        }
      };
      fetchNoticeDetail();
    }
  }, [noticeId, router]);

  const handleDelete = async () => {
    setModalState({
      isOpen: true,
      title: 'お知らせの削除',
      message: 'このお知らせを本当に削除しますか？',
      confirmText: '削除',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const response = await fetch(`/api/notice/${noticeId}`, { method: "DELETE" });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "削除に失敗しました。");
          }
          setModalState({ isOpen: true, title: '成功', message: 'お知らせが削除されました。', isAlert: true, onConfirm: () => { router.push("/notice"); router.refresh(); } });
        } catch (error) {
          console.error(error);
          setModalState({ isOpen: true, title: 'エラー', message: (error as Error).message, isAlert: true });
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        ローディング中...
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        お知らせが見つかりません。
      </div>
    );
  }

  const getCategoryClass = (category: string) => {
    switch (category) {
      case "アップデート": return "text-green-400";
      case "重要": return "text-red-400";
      case "イベント": return "text-blue-400";
      default: return "text-gray-400";
    }
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between p-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10 border-b border-gray-800">
          <Link href="/notice" className="p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer">
            <ArrowLeft />
          </Link>
          <h1 className="font-bold text-lg">お知らせ詳細</h1>
          {session?.user?.role === "ADMIN" ? (
            <div className="flex items-center gap-2">
              <Link href={`/notice/admin/${noticeId}`} className={`p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                <Edit className="w-5 h-5" />
              </Link>
              <button onClick={handleDelete} disabled={isProcessing} className="p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50">
                <Trash2 className="w-5 h-5 text-red-500" />
              </button>
            </div>
          ) : (
            <div className="w-20" />
          )}
        </header>

        <main className="p-6">
          <p className={`text-sm font-bold ${getCategoryClass(notice.category)}`}>
            [{notice.category}]
          </p>
          <h2 className="text-2xl font-bold text-white mt-2">{notice.title}</h2>
          <p className="text-xs text-gray-500 mt-3">
            {new Date(notice.createdAt).toLocaleDateString("ja-JP")}
          </p>
          <div className="border-t border-gray-800 my-6"></div>
          <article
            className="prose prose-invert prose-p:text-gray-300 prose-strong:text-pink-400"
            dangerouslySetInnerHTML={{ __html: notice.content }}
          />
        </main>
      </div>
    </div>
  );
}
