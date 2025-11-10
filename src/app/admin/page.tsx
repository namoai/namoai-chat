"use client";

import { useState, useEffect } from 'react';
// Next.jsのナビゲーション機能をインポートします
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from 'next-auth';
import { Users, FileText, ArrowLeft, BrainCircuit, Flag } from 'lucide-react';

export default function AdminDashboardPage() {
  // ▼▼▼【修正点】useRouterを使用します ▼▼▼
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const sessionData = await res.json();

        if (sessionData && Object.keys(sessionData).length > 0) {
          setSession(sessionData);
          setStatus('authenticated');

          if (sessionData.user?.role === 'USER') {
            // alertはユーザー体験を損なう可能性があるため、実際にはモーダル等への置き換えを推奨します
            alert('管理者権限がありません。');
            // ▼▼▼【修正点】router.pushでページ遷移します ▼▼▼
            router.push('/'); 
          }
        } else {
          setStatus('unauthenticated');
          // ▼▼▼【修正点】router.pushでページ遷移します ▼▼▼
          router.push('/login');
        }
      } catch (error) {
        console.error("セッション確認エラー:", error);
        setStatus('unauthenticated');
        // ▼▼▼【修正点】router.pushでページ遷移します ▼▼▼
        router.push('/login');
      }
    };
    checkSession();
  }, [router]); // routerを依存配列に追加

  if (status === 'loading' || !session) {
    return <div className="bg-black text-white min-h-screen flex justify-center items-center">読み込み中...</div>;
  }

  const userRole = session.user.role;

  return (
    <div className="bg-black text-white min-h-screen p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">管理パネル</h1>
        {/* ▼▼▼【修正点】<a>タグを<Link>コンポーネントに変更 ▼▼▼ */}
        <Link href="/MyPage" className="flex items-center bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors">
          <ArrowLeft size={16} className="mr-2" />
          マイページに戻る
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(userRole === 'SUPER_ADMIN') && (
          // ▼▼▼【修正点】<a>タグを<Link>コンポーネントに変更 ▼▼▼
          <Link href="/admin/users" className="bg-gray-900 p-6 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer flex flex-col items-center text-center">
            <Users size={40} className="text-pink-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">ユーザー管理</h2>
            <p className="text-gray-400 text-sm">ユーザーの役割を変更します。</p>
          </Link>
        )}

        {(userRole === 'MODERATOR' || userRole === 'SUPER_ADMIN') && (
          // ▼▼▼【修正点】<a>タグを<Link>コンポーネントに変更 ▼▼▼
          <Link href="/admin/guides" className="bg-gray-900 p-6 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer flex flex-col items-center text-center">
            <FileText size={40} className="text-pink-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">ガイド管理</h2>
            <p className="text-gray-400 text-sm">ユーザーガイドの内容を管理します。</p>
          </Link>
        )}
        
        {(userRole === 'CHAR_MANAGER' || userRole === 'SUPER_ADMIN') && (
            // ▼▼▼【修正点】<a>タグを<Link>コンポーネントに変更 ▼▼▼
            <Link href="/admin/characters" className="bg-gray-900 p-6 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer flex flex-col items-center text-center">
              <BrainCircuit size={40} className="text-pink-400 mb-4" />
              <h2 className="text-xl font-bold mb-2">キャラクター管理</h2>
              <p className="text-gray-400 text-sm">すべてのキャラクターを管理します。</p>
            </Link>
        )}

        {(userRole === 'MODERATOR' || userRole === 'SUPER_ADMIN') && (
          <Link href="/admin/reports" className="bg-gray-900 p-6 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer flex flex-col items-center text-center">
            <Flag size={40} className="text-pink-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">通報・要望・お問い合わせ管理</h2>
            <p className="text-gray-400 text-sm">通報、要望、お問い合わせを管理します。</p>
          </Link>
        )}
      </div>
    </div>
  );
}
