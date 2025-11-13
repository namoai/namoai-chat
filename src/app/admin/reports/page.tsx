"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Flag, MessageSquare, FileText, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';
import type { Session } from 'next-auth';

type Report = {
  id: number;
  type: string;
  characterId: number | null;
  reporterId: number;
  title: string | null;
  reason: string;
  content: string;
  status: string;
  adminNotes: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
  characters: {
    id: number;
    name: string;
    author: {
      id: number;
      nickname: string;
    } | null;
  } | null;
  reporter: {
    id: number;
    nickname: string;
    email: string;
  };
};

type ModalState = {
  isOpen: boolean;
  report: Report | null;
  action: 'view' | 'update';
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, report: null, action: 'view' });
  const [updateStatus, setUpdateStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== 'ALL') params.append('type', filterType);
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) throw new Error('通報一覧の取得に失敗しました。');
      const data = await res.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('通報一覧取得エラー:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const sessionData = await res.json();
        if (sessionData && Object.keys(sessionData).length > 0) {
          setSession(sessionData);
          setStatus('authenticated');
          const userRole = sessionData.user?.role;
          if (userRole !== 'MODERATOR' && userRole !== 'CHAR_MANAGER' && userRole !== 'SUPER_ADMIN') {
            alert('管理者権限が必要です。');
            router.push('/');
          }
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

  useEffect(() => {
    if (status === 'authenticated') {
      fetchReports();
    }
  }, [status, fetchReports]);

  const handleUpdateStatus = async () => {
    if (!modalState.report || !updateStatus) return;
    
    try {
      const res = await fetch(`/api/reports/${modalState.report.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updateStatus,
          adminNotes: adminNotes || null,
        }),
      });
      if (!res.ok) throw new Error('状態の更新に失敗しました。');
      await fetchReports();
      setModalState({ isOpen: false, report: null, action: 'view' });
      setUpdateStatus('');
      setAdminNotes('');
    } catch (error) {
      alert(error instanceof Error ? error.message : '状態更新中にエラーが発生しました。');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock size={16} className="text-yellow-400" />;
      case 'REVIEWED': return <CheckCircle size={16} className="text-blue-400" />;
      case 'RESOLVED': return <CheckCircle size={16} className="text-green-400" />;
      case 'REJECTED': return <XCircle size={16} className="text-red-400" />;
      default: return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CHARACTER_REPORT': return <Flag size={16} className="text-red-400" />;
      case 'SUGGESTION': return <MessageSquare size={16} className="text-blue-400" />;
      case 'INQUIRY': return <FileText size={16} className="text-green-400" />;
      default: return null;
    }
  };

  const filteredReports = reports.filter(report => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        (report.title?.toLowerCase().includes(searchLower) || false) ||
        report.reason.toLowerCase().includes(searchLower) ||
        report.content.toLowerCase().includes(searchLower) ||
        report.reporter.nickname.toLowerCase().includes(searchLower) ||
        (report.characters?.name.toLowerCase().includes(searchLower) || false)
      );
    }
    return true;
  });

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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24">
          <header className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/admin')} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              通報・要望・お問い合わせ管理
            </h1>
          </header>

      {/* ▼▼▼【フィルターおよび検索】▼▼▼ */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="ALL">すべての種類</option>
              <option value="CHARACTER_REPORT">通報</option>
              <option value="SUGGESTION">要望</option>
              <option value="INQUIRY">お問い合わせ</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="ALL">すべての状態</option>
              <option value="PENDING">保留中</option>
              <option value="REVIEWED">検討中</option>
              <option value="RESOLVED">解決済み</option>
              <option value="REJECTED">却下</option>
            </select>
          </div>
        </div>
      </div>
      {/* ▲▲▲ */}

      {/* ▼▼▼【通報一覧】▼▼▼ */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
            <p className="text-gray-400">読み込み中...</p>
          </div>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-8 text-gray-400">通報履歴がありません。</div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800 transition-colors cursor-pointer"
              onClick={() => setModalState({ isOpen: true, report, action: 'view' })}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(report.type)}
                    <span className="font-semibold">
                      {report.type === 'CHARACTER_REPORT' ? '通報' : report.type === 'SUGGESTION' ? '要望' : 'お問い合わせ'}
                    </span>
                    {getStatusIcon(report.status)}
                    <span className="text-sm text-gray-400">{report.status}</span>
                  </div>
                  {report.title && (
                    <div className="text-lg font-bold text-white mb-2">{report.title}</div>
                  )}
                  <div className="text-sm text-gray-300 mb-1">
                    <span className="font-medium">種類:</span> {report.reason}
                  </div>
                  {report.characters && (
                    <div className="text-sm text-gray-400 mb-1">
                      キャラクター: {report.characters.name} (作成者: {report.characters.author?.nickname || '不明'})
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    通報者: {report.reporter.nickname} | {new Date(report.createdAt).toLocaleString('ja-JP')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ▲▲▲ */}

      {/* ▼▼▼【詳細表示/編集モーダル】▼▼▼ */}
      {modalState.isOpen && modalState.report && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">詳細情報</h2>
              <button
                onClick={() => {
                  setModalState({ isOpen: false, report: null, action: 'view' });
                  setUpdateStatus('');
                  setAdminNotes('');
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-400">種類</label>
                <div className="mt-1 flex items-center gap-2">
                  {getTypeIcon(modalState.report.type)}
                  <span>
                    {modalState.report.type === 'CHARACTER_REPORT' ? '通報' : 
                     modalState.report.type === 'SUGGESTION' ? '要望' : 'お問い合わせ'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-400">状態</label>
                <div className="mt-1 flex items-center gap-2">
                  {getStatusIcon(modalState.report.status)}
                  <span>{modalState.report.status}</span>
                </div>
              </div>

              {modalState.report.title && (
                <div>
                  <label className="text-sm font-medium text-gray-400">タイトル</label>
                  <div className="mt-1 text-white font-bold">{modalState.report.title}</div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-400">種類</label>
                <div className="mt-1 text-white">{modalState.report.reason}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-400">詳細内容</label>
                <div className="mt-1 text-white whitespace-pre-wrap bg-gray-900 p-3 rounded">
                  {modalState.report.content || '(内容なし)'}
                </div>
              </div>

              {modalState.report.characters && (
                <div>
                  <label className="text-sm font-medium text-gray-400">キャラクター情報</label>
                  <div className="mt-1 text-white">
                    <a href={`/characters/${modalState.report.characters.id}`} className="text-pink-400 hover:underline">
                      {modalState.report.characters.name}
                    </a>
                    <span className="text-gray-400 ml-2">
                      (作成者: {modalState.report.characters.author?.nickname || '不明'})
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-400">通報者</label>
                <div className="mt-1 text-white">
                  {modalState.report.reporter.nickname} ({modalState.report.reporter.email})
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-400">通報日時</label>
                <div className="mt-1 text-white">
                  {new Date(modalState.report.createdAt).toLocaleString('ja-JP')}
                </div>
              </div>

              {modalState.report.adminNotes && (
                <div>
                  <label className="text-sm font-medium text-gray-400">管理者メモ</label>
                  <div className="mt-1 text-white whitespace-pre-wrap bg-gray-900 p-3 rounded">
                    {modalState.report.adminNotes}
                  </div>
                </div>
              )}

              {/* ▼▼▼【状態更新】▼▼▼ */}
              <div className="border-t border-gray-700 pt-4">
                <label className="block text-sm font-medium mb-2">状態変更</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">選択してください</option>
                  <option value="PENDING">保留中</option>
                  <option value="REVIEWED">検討中</option>
                  <option value="RESOLVED">解決済み</option>
                  <option value="REJECTED">却下</option>
                </select>
                <label className="block text-sm font-medium mb-2">管理者メモ</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="管理者メモを入力してください..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                  maxLength={1000}
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setModalState({ isOpen: false, report: null, action: 'view' });
                      setUpdateStatus('');
                      setAdminNotes('');
                    }}
                    className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={!updateStatus}
                    className="px-4 py-2 bg-pink-600 text-white hover:bg-pink-700 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    状態更新
                  </button>
                </div>
              </div>
              {/* ▲▲▲ */}
            </div>
          </div>
        </div>
      )}
      {/* ▲▲▲ */}
        </div>
      </div>
    </div>
  );
}

