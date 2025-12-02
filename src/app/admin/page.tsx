"use client";

import { useState, useEffect } from 'react';
// Next.jsのナビゲーション機能をインポートします
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from 'next-auth';
import { Users, FileText, ArrowLeft, BrainCircuit, Flag, TestTube, Timer, ShieldCheck, Server } from 'lucide-react';

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
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  const userRole = session.user.role;

  return (
    <div className="bg-black text-white min-h-screen">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              管理パネル
            </h1>
            <Link href="/MyPage" className="flex items-center bg-gray-800/50 hover:bg-gray-700/50 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all border border-gray-700/50">
              <ArrowLeft size={16} className="mr-2" />
              マイページに戻る
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {(userRole === 'SUPER_ADMIN') && (
              <Link href="/admin/users" className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl hover:bg-gray-800/50 transition-all cursor-pointer flex flex-col items-center text-center border border-gray-800/50 hover:border-pink-500/30 group">
                <div className="p-4 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 mb-4 group-hover:scale-110 transition-transform">
                  <Users size={40} className="text-pink-400" />
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-pink-400 transition-colors">ユーザー管理</h2>
                <p className="text-gray-400 text-sm">ユーザーの役割を変更します。</p>
              </Link>
            )}

            {(userRole === 'MODERATOR' || userRole === 'SUPER_ADMIN') && (
              <Link href="/admin/guides" className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl hover:bg-gray-800/50 transition-all cursor-pointer flex flex-col items-center text-center border border-gray-800/50 hover:border-pink-500/30 group">
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-4 group-hover:scale-110 transition-transform">
                  <FileText size={40} className="text-blue-400" />
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-pink-400 transition-colors">ガイド管理</h2>
                <p className="text-gray-400 text-sm">ユーザーガイドの内容を管理します。</p>
              </Link>
            )}
            
            {(userRole === 'CHAR_MANAGER' || userRole === 'SUPER_ADMIN') && (
              <Link href="/admin/characters" className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl hover:bg-gray-800/50 transition-all cursor-pointer flex flex-col items-center text-center border border-gray-800/50 hover:border-pink-500/30 group">
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 mb-4 group-hover:scale-110 transition-transform">
                  <BrainCircuit size={40} className="text-purple-400" />
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-pink-400 transition-colors">キャラクター管理</h2>
                <p className="text-gray-400 text-sm">すべてのキャラクターを管理します。</p>
              </Link>
            )}

            {(userRole === 'MODERATOR' || userRole === 'SUPER_ADMIN') && (
              <Link href="/admin/reports" className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl hover:bg-gray-800/50 transition-all cursor-pointer flex flex-col items-center text-center border border-gray-800/50 hover:border-pink-500/30 group">
                <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 mb-4 group-hover:scale-110 transition-transform">
                  <Flag size={40} className="text-red-400" />
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-pink-400 transition-colors">通報・要望・お問い合わせ管理</h2>
                <p className="text-gray-400 text-sm">通報、要望、お問い合わせを管理します。</p>
              </Link>
            )}

            {(userRole === 'MODERATOR' || userRole === 'SUPER_ADMIN' || userRole === 'CHAR_MANAGER') && (
              <Link href="/admin/test" className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl hover:bg-gray-800/50 transition-all cursor-pointer flex flex-col items-center text-center border border-gray-800/50 hover:border-pink-500/30 group">
                <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mb-4 group-hover:scale-110 transition-transform">
                  <TestTube size={40} className="text-cyan-400" />
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-pink-400 transition-colors">機能テストツール</h2>
                <p className="text-gray-400 text-sm">すべての機能をテストして問題を確認します。</p>
              </Link>
            )}

            {(userRole === 'SUPER_ADMIN') && (
              <Link href="/test-session-timeout" className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl hover:bg-gray-800/50 transition-all cursor-pointer flex flex-col items-center text-center border border-gray-800/50 hover:border-pink-500/30 group">
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-4 group-hover:scale-110 transition-transform">
                  <Timer size={40} className="text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-pink-400 transition-colors">セッションテスト</h2>
                <p className="text-gray-400 text-sm">タイムアウト動作を専用ツールで確認します。</p>
              </Link>
            )}

            {(userRole === 'SUPER_ADMIN') && (
              <Link href="/admin/security-test" className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl hover:bg-gray-800/50 transition-all cursor-pointer flex flex-col items-center text-center border border-gray-800/50 hover:border-pink-500/30 group">
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-500/20 to-gray-500/20 mb-4 group-hover:scale-110 transition-transform">
                  <ShieldCheck size={40} className="text-emerald-300" />
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-pink-400 transition-colors">セキュリティテスト</h2>
                <p className="text-gray-400 text-sm">レート制限やサニタイズを即時確認します。</p>
              </Link>
            )}

            {(userRole === 'SUPER_ADMIN') && (
              <Link href="/admin/it-environment" className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl hover:bg-gray-800/50 transition-all cursor-pointer flex flex-col items-center text-center border border-gray-800/50 hover:border-pink-500/30 group">
                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mb-4 group-hover:scale-110 transition-transform">
                  <Server size={40} className="text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-pink-400 transition-colors">IT テスト環境管理</h2>
                <p className="text-gray-400 text-sm">AWS RDS インスタンスの開始・停止を管理します。</p>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
