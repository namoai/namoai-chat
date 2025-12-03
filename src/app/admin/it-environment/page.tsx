"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from 'next-auth';
import { ArrowLeft, Play, Square, RefreshCw, Database, AlertCircle } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf-client';

interface ITEnvironmentStatus {
  status: string;
  displayStatus: string;
  canStart: boolean;
  canStop: boolean;
  instanceIdentifier?: string;
  engine?: string;
  engineVersion?: string;
  instanceClass?: string;
  endpoint?: {
    address: string;
    port: number;
  } | null;
  message?: string;
}

export default function ITEnvironmentPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [itStatus, setItStatus] = useState<ITEnvironmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const sessionData = await res.json();

        if (sessionData && Object.keys(sessionData).length > 0) {
          setSession(sessionData);
          setStatus('authenticated');

          if (sessionData.user?.role !== 'SUPER_ADMIN') {
            alert('管理者権限がありません。');
            router.push('/');
            return;
          }

          // 세션이 확인되면 IT 환경 상태 로드
          loadITStatus();
        } else {
          setStatus('unauthenticated');
          router.push('/login');
        }
      } catch (error) {
        console.error("セッション確認エラー:", error);
        setStatus('unauthenticated');
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  const loadITStatus = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/it-environment');
      const data = await res.json();
      
      if (res.ok) {
        setItStatus(data);
      } else {
        // エラーメッセージを文字列に変換
        const errorMessage = typeof data.error === 'string' 
          ? data.error 
          : typeof data.message === 'string'
          ? data.message
          : typeof data.details === 'string'
          ? data.details
          : data.error?.message || data.message || '状態を読み込めませんでした。';
        
        setItStatus({
          status: 'error',
          displayStatus: 'エラー',
          canStart: false,
          canStop: false,
          message: errorMessage,
        });
      }
    } catch (error) {
      console.error('IT 환경 상태 로드 오류:', error);
      setItStatus({
        status: 'error',
        displayStatus: 'エラー',
        canStart: false,
        canStop: false,
        message: '状態を読み込めませんでした。',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStart = async () => {
    if (!confirm('IT環境データベースを起動しますか？\n約5-10分かかります。')) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetchWithCsrf('/api/admin/it-environment', {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message || '起動リクエストが完了しました。' });
        // 상태 새로고침 (약간의 지연 후)
        setTimeout(() => {
          loadITStatus();
        }, 2000);
      } else {
        // エラーメッセージを文字列に変換
        const errorMessage = typeof data.error === 'string' 
          ? data.error 
          : data.error?.message || data.message || '起動リクエスト中にエラーが発生しました。';
        setMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      console.error('IT 환경 시작 오류:', error);
      setMessage({ type: 'error', text: '起動リクエスト中にエラーが発生しました。' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    if (!confirm('IT環境データベースを停止しますか？\nコスト削減のため停止することを推奨します。')) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetchWithCsrf('/api/admin/it-environment', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message || '停止リクエストが完了しました。' });
        // 상태 새로고침 (약간의 지연 후)
        setTimeout(() => {
          loadITStatus();
        }, 2000);
      } else {
        // エラーメッセージを文字列に変換
        const errorMessage = typeof data.error === 'string' 
          ? data.error 
          : data.error?.message || data.message || '停止リクエスト中にエラーが発生しました。';
        setMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      console.error('IT 환경 중지 오류:', error);
      setMessage({ type: 'error', text: '停止リクエスト中にエラーが発生しました。' });
    } finally {
      setIsLoading(false);
    }
  };

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

  const getStatusColor = (status: string) => {
    if (status === 'available' || status === '実行中') return 'text-green-400';
    if (status === 'stopped' || status === '停止中') return 'text-gray-400';
    if (status === 'starting' || status === '起動中...') return 'text-yellow-400';
    if (status === 'stopping' || status === '停止中...') return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-black text-white min-h-screen">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24">
          {/* ヘッダー */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                IT テスト環境管理
              </h1>
              <p className="text-gray-400 text-sm">
                AWS RDS インスタンスの開始・停止を管理します
              </p>
            </div>
            <Link 
              href="/admin" 
              className="flex items-center bg-gray-800/50 hover:bg-gray-700/50 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all border border-gray-700/50"
            >
              <ArrowLeft size={16} className="mr-2" />
              管理パネルに戻る
            </Link>
          </div>

          {/* メッセージ */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl border ${
              message.type === 'success' 
                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          {/* ステータスカード */}
          <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Database size={24} className="text-purple-400" />
                環境状態
              </h2>
              <button
                onClick={loadITStatus}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-all text-sm disabled:opacity-50"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                更新
              </button>
            </div>

            {itStatus ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">状態:</span>
                  <span className={`font-semibold ${getStatusColor(itStatus.displayStatus)}`}>
                    {itStatus.displayStatus}
                  </span>
                </div>

                {itStatus.instanceIdentifier && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">インスタンス ID:</span>
                    <span className="font-mono text-sm">{itStatus.instanceIdentifier}</span>
                  </div>
                )}

                {itStatus.instanceClass && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">インスタンスクラス:</span>
                    <span>{itStatus.instanceClass}</span>
                  </div>
                )}

                {itStatus.endpoint && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">エンドポイント:</span>
                    <span className="font-mono text-sm">
                      {itStatus.endpoint.address}:{itStatus.endpoint.port}
                    </span>
                  </div>
                )}

                {itStatus.message && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <AlertCircle size={20} className="text-yellow-400 mt-0.5" />
                    <span className="text-yellow-400 text-sm">{itStatus.message}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400">状態を読み込み中...</div>
            )}
          </div>

          {/* 操作ボタン */}
          <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
            <h2 className="text-xl font-bold mb-4">操作</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleStart}
                disabled={!itStatus?.canStart || isLoading || isRefreshing}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={20} />
                {isLoading ? '処理中...' : '開始'}
              </button>

              <button
                onClick={handleStop}
                disabled={!itStatus?.canStop || isLoading || isRefreshing}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Square size={20} />
                {isLoading ? '処理中...' : '停止'}
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400">
                💡 <strong>コスト削減のヒント:</strong> IT環境はテスト時のみ起動し、使用しない時は停止することで月額コストを大幅に削減できます。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


