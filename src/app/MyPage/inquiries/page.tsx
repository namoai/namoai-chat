"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Flag, MessageSquare, FileText, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';
import type { Session } from 'next-auth';

type Report = {
  id: number;
  type: string;
  characterId: number | null;
  reason: string;
  content: string;
  status: string;
  adminNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  characters: {
    id: number;
    name: string;
  } | null;
};

export default function InquiriesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const sessionData = await res.json();
        if (sessionData && Object.keys(sessionData).length > 0) {
          setSession(sessionData);
          setStatus('authenticated');
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

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== 'ALL') params.append('type', filterType);
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      
      const res = await fetch(`/api/reports/my?${params.toString()}`);
      if (!res.ok) throw new Error('お問い合わせ一覧の取得に失敗しました。');
      const data = await res.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('お問い合わせ一覧取得エラー:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchReports();
    }
  }, [status, fetchReports]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock size={16} className="text-yellow-400" />;
      case 'REVIEWED': return <CheckCircle size={16} className="text-blue-400" />;
      case 'RESOLVED': return <CheckCircle size={16} className="text-green-400" />;
      case 'REJECTED': return <XCircle size={16} className="text-red-400" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return '保留中';
      case 'REVIEWED': return '検討中';
      case 'RESOLVED': return '解決済み';
      case 'REJECTED': return '却下';
      default: return status;
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

  const getTypeText = (type: string) => {
    switch (type) {
      case 'CHARACTER_REPORT': return '通報';
      case 'SUGGESTION': return '要望';
      case 'INQUIRY': return 'お問い合わせ';
      default: return type;
    }
  };

  const filteredReports = reports.filter(report => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        report.reason.toLowerCase().includes(searchLower) ||
        report.content.toLowerCase().includes(searchLower) ||
        (report.characters?.name.toLowerCase().includes(searchLower) || false)
      );
    }
    return true;
  });

  if (status === 'loading' || !session) {
    return <div className="min-h-screen bg-black text-white flex justify-center items-center">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/MyPage')} className="p-2 rounded-full hover:bg-gray-800">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold">お問い合わせ履歴</h1>
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

      {/* ▼▼▼【お問い合わせ一覧】▼▼▼ */}
      {loading ? (
        <div className="text-center py-8">読み込み中...</div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-8 text-gray-400">お問い合わせ履歴がありません。</div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(report.type)}
                    <span className="font-semibold">{getTypeText(report.type)}</span>
                    {getStatusIcon(report.status)}
                    <span className="text-sm text-gray-400">{getStatusText(report.status)}</span>
                  </div>
                  <div className="text-sm text-gray-300 mb-1">
                    <span className="font-medium">理由:</span> {report.reason}
                  </div>
                  {report.characters && (
                    <div className="text-sm text-gray-400 mb-1">
                      キャラクター: {report.characters.name}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    {new Date(report.createdAt).toLocaleString('ja-JP')}
                  </div>
                  {report.adminNotes && (
                    <div className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-300">
                      <span className="font-medium">管理者からの返信:</span> {report.adminNotes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ▲▲▲ */}
    </div>
  );
}

