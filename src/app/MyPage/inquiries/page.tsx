"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Flag, MessageSquare, FileText, CheckCircle, XCircle, Clock, Search, Filter, Plus, X, HelpCircle } from 'lucide-react';
import type { Session } from 'next-auth';
import HelpModal from '@/components/HelpModal';

type Report = {
  id: number;
  type: string;
  characterId: number | null;
  title: string | null;
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

const INQUIRY_TYPES = [
  { value: 'SYSTEM_ISSUE', label: 'システム問題' },
  { value: 'REFUND_REQUEST', label: '返金問題' },
  { value: 'FEATURE_REQUEST', label: '機能要望' },
  { value: 'BUG_REPORT', label: 'バグ報告' },
  { value: 'ACCOUNT_ISSUE', label: 'アカウント問題' },
  { value: 'PAYMENT_ISSUE', label: '決済問題' },
  { value: 'OTHER', label: 'その他' },
];

export default function InquiriesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryType, setInquiryType] = useState('');
  const [inquiryTitle, setInquiryTitle] = useState('');
  const [inquiryContent, setInquiryContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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

  const handleSubmitInquiry = async () => {
    if (!inquiryType || !inquiryTitle.trim() || !inquiryContent.trim()) {
      alert('すべての項目を入力してください。');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'INQUIRY',
          reason: INQUIRY_TYPES.find(t => t.value === inquiryType)?.label || inquiryType,
          title: inquiryTitle,
          content: inquiryContent,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'お問い合わせの送信に失敗しました。');
      }

      alert('お問い合わせを送信しました。');
      setShowInquiryModal(false);
      setInquiryType('');
      setInquiryTitle('');
      setInquiryContent('');
      fetchReports();
    } catch (error) {
      console.error('お問い合わせ送信エラー:', error);
      const errorMessage = error instanceof Error ? error.message : 'お問い合わせの送信に失敗しました。';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
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
      default: return <FileText size={16} className="text-gray-400" />;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'CHARACTER_REPORT': return '通報';
      case 'SUGGESTION': return '要望';
      case 'INQUIRY': return 'お問い合わせ';
      default: return INQUIRY_TYPES.find(t => t.value === type)?.label || type;
    }
  };

  const filteredReports = reports.filter(report => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        (report.title?.toLowerCase().includes(searchLower) || false) ||
        report.reason.toLowerCase().includes(searchLower) ||
        report.content.toLowerCase().includes(searchLower) ||
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

  const helpContent = (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-pink-400 mb-3">お問い合わせについて</h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          このページでは、サービスに関するお問い合わせや不適切なコンテンツの通報を行うことができます。
          お問い合わせは管理者が確認後、対応いたします。
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-pink-400 mb-3">お問い合わせの種類</h3>
        <div className="space-y-3">
          <div className="bg-black/30 border border-gray-800/80 rounded-xl p-4">
            <h4 className="text-base font-semibold text-pink-300 mb-2">📋 お問い合わせ</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">•</span>
                <span><strong>システム問題</strong>: サービスやシステムに関する問題</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">•</span>
                <span><strong>返金問題</strong>: ポイントの返金に関するお問い合わせ</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">•</span>
                <span><strong>機能要望</strong>: 新しい機能や改善要望</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">•</span>
                <span><strong>バグ報告</strong>: バグや不具合の報告</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">•</span>
                <span><strong>アカウント問題</strong>: アカウントに関する問題</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">•</span>
                <span><strong>決済問題</strong>: ポイント購入や決済に関する問題</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">•</span>
                <span><strong>その他</strong>: 上記以外のお問い合わせ</span>
              </li>
            </ul>
          </div>

          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
            <h4 className="text-base font-semibold text-red-300 mb-2">🚩 通報</h4>
            <p className="text-sm text-gray-300 leading-relaxed mb-2">
              不適切なキャラクターやコンテンツを発見した場合は、通報機能を使用してください。
              キャラクター詳細ページのメニューから通報できます。
            </p>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>通報理由を選択し、詳細内容を入力してください</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>管理者が確認後、適切に対応いたします</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-pink-400 mb-3">状態の種類</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">•</span>
            <span><strong>保留中</strong>: お問い合わせが受付されました。管理者が確認中です</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span><strong>検討中</strong>: 管理者が内容を検討しています</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">•</span>
            <span><strong>解決済み</strong>: お問い合わせへの対応が完了しました</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5">•</span>
            <span><strong>却下</strong>: お問い合わせが却下されました</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-pink-400 mb-3">機能</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-0.5">•</span>
            <span><strong>新規作成</strong>: 「+」ボタンから新しいお問い合わせを作成できます</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-0.5">•</span>
            <span><strong>検索</strong>: タイトルや内容でお問い合わせを検索できます</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-0.5">•</span>
            <span><strong>フィルター</strong>: 種類や状態でお問い合わせを絞り込めます</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-0.5">•</span>
            <span><strong>管理者からの返信</strong>: 対応済みのお問い合わせには管理者からの返信が表示されます</span>
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <HelpModal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          title="お問い合わせについて"
          content={helpContent}
        />
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
          <header className="flex items-center gap-2 sm:gap-4 mb-8 sticky top-0 bg-black/80 backdrop-blur-xl z-10 py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-900/50">
            <button onClick={() => router.push('/MyPage')} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all flex-shrink-0">
              <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
            </button>
            <h1 className="text-base sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex-1 truncate px-2">
              お問い合わせ
            </h1>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setIsHelpOpen(true)}
                className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
              >
                <HelpCircle size={20} className="sm:w-6 sm:h-6" />
              </button>
              <button
                onClick={() => setShowInquiryModal(true)}
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white p-2 sm:p-3 rounded-xl transition-all shadow-lg shadow-pink-500/30"
              >
                <Plus size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>
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
            <div className="flex justify-center items-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                <p className="text-gray-400">読み込み中...</p>
              </div>
            </div>
          ) : filteredReports.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p className="mb-4">お問い合わせ履歴がありません。</p>
          <button
            onClick={() => setShowInquiryModal(true)}
            className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            お問い合わせを作成
          </button>
        </div>
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
                  {report.title && (
                    <div className="text-lg font-bold text-white mb-2">{report.title}</div>
                  )}
                  <div className="text-sm text-gray-300 mb-1">
                    <span className="font-medium">種類:</span> {report.reason}
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

      {/* ▼▼▼【お問い合わせ作成モーダル】▼▼▼ */}
      {showInquiryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
          <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">お問い合わせ</h2>
              <button
                onClick={() => {
                  setShowInquiryModal(false);
                  setInquiryType('');
                  setInquiryTitle('');
                  setInquiryContent('');
                }}
                className="p-2 hover:bg-gray-700 rounded-full"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">お問い合わせ種類 *</label>
                <select
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">選択してください</option>
                  {INQUIRY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">タイトル *</label>
                <input
                  type="text"
                  value={inquiryTitle}
                  onChange={(e) => setInquiryTitle(e.target.value)}
                  placeholder="お問い合わせのタイトルを入力してください"
                  maxLength={255}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">内容 *</label>
                <textarea
                  value={inquiryContent}
                  onChange={(e) => setInquiryContent(e.target.value)}
                  placeholder="お問い合わせの詳細を入力してください"
                  rows={8}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowInquiryModal(false);
                    setInquiryType('');
                    setInquiryTitle('');
                    setInquiryContent('');
                  }}
                  className="flex-1 border border-gray-600 text-white hover:bg-gray-700 py-2 px-4 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmitInquiry}
                  disabled={submitting || !inquiryType || !inquiryTitle.trim() || !inquiryContent.trim()}
                  className="flex-1 bg-pink-600 text-white hover:bg-pink-700 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '送信中...' : '送信'}
                </button>
              </div>
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
