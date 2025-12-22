"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ShieldCheck, RefreshCw, Sparkles, Terminal, AlertTriangle, ArrowLeft, Activity, Loader2, UploadCloud, Info, Lock, FileText, Server, CheckCircle, XCircle, Package, AlertCircle } from "lucide-react";
import { apiPost, ApiErrorResponse } from "@/lib/api-client";
import { ErrorCode } from "@/lib/error-handler";
import { fetchWithCsrf } from "@/lib/csrf-client";

type JsonRecord = Record<string, unknown>;
type SessionSecurityData = JsonRecord & { error?: string };

interface PasswordPolicyTestResult {
  password: string;
  passwordLength: number;
  isValid: boolean;
  strength: "weak" | "medium" | "strong" | "very-strong";
  strengthDescription: string;
  score: number;
  errors: string[];
  warnings: string[];
}

interface ApiAuthTestResult {
  generatedKey: string;
  keyLength: number;
  hashedKey: string;
  message: string;
}

interface TwoFactorTestResult {
  totpSecret: string;
  backupCodesCount: number;
  qrCodeUri: string;
  message: string;
}

interface EnvCheckResult {
  status: "ok" | "warning" | "error";
  message: string;
}

interface EnvSecurityTestResult {
  isSecure: boolean;
  checks: Record<string, EnvCheckResult>;
  issues: string[];
  warnings: string[];
  maskedValues: Record<string, string>;
}

interface EnvStatus {
  hasNextAuthSecret: boolean;
  hasCsrfSecret: boolean;
  nodeEnv: string;
  nextAuthSecretMasked: string;
  nextAuthSecretLength: number;
  csrfSecretLength: number;
  hasDatabaseUrl: boolean;
  securityIssues: string[];
  warnings: string[];
  isSecure: boolean;
  timestamp: string;
}

type ApiResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type RateLimitLog = {
  attempt: number;
  status: number;
  message: string;
  timestamp: string;
};

export default function SecurityTestPage() {
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rateLogs, setRateLogs] = useState<RateLimitLog[]>([]);
  const [runningRateTest, setRunningRateTest] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [inputSample, setInputSample] = useState('<script>alert("xss")</script>こんにちは！');
  const [sanitizeResult, setSanitizeResult] = useState<{ original: string; sanitized: string } | null>(null);
  const [sanitizeError, setSanitizeError] = useState<string | null>(null);
  const [isSanitizing, setIsSanitizing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; details?: Record<string, unknown> } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // 新規セキュリティ機能テスト用の状態
  const [csrfTestResult, setCsrfTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isCsrfTesting, setIsCsrfTesting] = useState(false);
  const [errorHandlingResult, setErrorHandlingResult] = useState<{ success: boolean; message: string; errorCode?: string } | null>(null);
  const [isErrorHandlingTesting, setIsErrorHandlingTesting] = useState(false);
  const [loggingResult, setLoggingResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoggingTesting, setIsLoggingTesting] = useState(false);
  const [sessionSecurityResult, setSessionSecurityResult] = useState<ApiResult<SessionSecurityData> | null>(null);
  const [isSessionSecurityTesting, setIsSessionSecurityTesting] = useState(false);
  const [envSecurityResult, setEnvSecurityResult] = useState<ApiResult<EnvSecurityTestResult> | null>(null);
  const [isEnvSecurityTesting, setIsEnvSecurityTesting] = useState(false);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [isRefreshingEnvStatus, setIsRefreshingEnvStatus] = useState(false);
  
  // 脆弱性評価用の状態
  const [securityStatus, setSecurityStatus] = useState<{
    audit?: {
      total: number;
      vulnerabilities: Record<string, number>;
      timestamp?: string;
    };
    currentAudit?: {
      total: number;
      vulnerabilities: Record<string, number>;
      timestamp?: string;
      error?: string;
    };
    tests?: {
      summary: {
        totalTests: number;
        passedTests: number;
        failedTests: number;
        vulnerabilities: number;
      };
      timestamp: string;
    };
    timestamp?: string;
  } | null>(null);
  const [isLoadingSecurityStatus, setIsLoadingSecurityStatus] = useState(false);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [isFixingAudit, setIsFixingAudit] = useState(false);
  const [fixResult, setFixResult] = useState<{ success: boolean; message: string; error?: string; needsForce?: boolean } | null>(null);
  
  // Phase 2 テスト用の状態
  const [passwordPolicyResult, setPasswordPolicyResult] = useState<ApiResult<PasswordPolicyTestResult[]> | null>(null);
  const [isPasswordPolicyTesting, setIsPasswordPolicyTesting] = useState(false);
  const [apiAuthResult, setApiAuthResult] = useState<ApiResult<ApiAuthTestResult> | null>(null);
  const [isApiAuthTesting, setIsApiAuthTesting] = useState(false);
  const [twoFactorResult, setTwoFactorResult] = useState<ApiResult<TwoFactorTestResult> | null>(null);
  const [isTwoFactorTesting, setIsTwoFactorTesting] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "SUPER_ADMIN") {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    setAuthorized(true);
    setLoading(false);
    
    // 環境変数の状態を取得
    fetchEnvStatus();
    // セキュリティステータスを取得
    fetchSecurityStatus();
  }, [session, status]);

  const fetchSecurityStatus = async (runAudit = false) => {
    setIsLoadingSecurityStatus(true);
    try {
      const url = runAudit 
        ? '/api/admin/security-status?runAudit=true'
        : '/api/admin/security-status';
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSecurityStatus(data);
      }
    } catch (error) {
      console.error('セキュリティステータスの取得に失敗:', error);
    } finally {
      setIsLoadingSecurityStatus(false);
      setIsRunningAudit(false);
    }
  };

  const handleRunAudit = async () => {
    setIsRunningAudit(true);
    setFixResult(null);
    await fetchSecurityStatus(true);
  };

  const handleFixAudit = async (useForce = false, useLegacy = false) => {
    if (!confirm(useForce 
      ? '⚠️ 注意: --forceオプションを使用すると、破壊的変更が含まれる可能性があります。続行しますか？'
      : useLegacy
      ? '--legacy-peer-depsオプションを使用してnpm audit fixを実行しますか？'
      : 'npm audit fixを実行しますか？'
    )) {
      return;
    }

    setIsFixingAudit(true);
    setFixResult(null);
    try {
      const res = await fetchWithCsrf('/api/admin/security-status/fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: useForce, legacy: useLegacy }),
      });
      const data = await res.json();
      setFixResult({
        success: data.success || false,
        message: data.message || (data.success ? '修正が完了しました' : '修正に失敗しました'),
        error: data.error || undefined,
        needsForce: data.needsForce || false,
      });
      // 修正後、再度ステータスを取得
      if (data.success) {
        setTimeout(() => {
          fetchSecurityStatus(true);
        }, 2000);
      }
      
      // --forceが必要な場合のメッセージ
      if (data.needsForce) {
        console.log('一部の脆弱性を修正するには--forceオプションが必要です。');
      }
    } catch (error) {
      setFixResult({
        success: false,
        message: 'npm audit fixの実行中にエラーが発生しました。',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsFixingAudit(false);
    }
  };

  const fetchEnvStatus = async () => {
    setIsRefreshingEnvStatus(true);
    try {
      const res = await fetch('/api/admin/security-test', {
        cache: 'no-store', // キャッシュを無効化
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setEnvStatus(data.envStatus as EnvStatus);
      } else {
        console.error('環境変数状態の取得に失敗:', res.status);
        const errorData = await res.json().catch(() => ({}));
        console.error('エラー詳細:', errorData);
      }
    } catch (error) {
      console.error('環境変数状態の取得に失敗:', error);
    } finally {
      setIsRefreshingEnvStatus(false);
    }
  };

  const runRateLimitTest = async () => {
    setRunningRateTest(true);
    setRateLogs([]);
    setRateError(null);
    try {
      for (let i = 1; i <= 6; i++) {
        const res = await fetchWithCsrf("/api/security-tests/rate-limit", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        setRateLogs((prev) => [
          ...prev,
          {
            attempt: i,
            status: res.status,
            message: data?.message || "レスポンスなし",
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        if (res.status === 429) break;
      }
    } catch (error) {
      console.error("Rate limit test failed:", error);
      setRateError("テスト中にエラーが発生しました。コンソールを確認してください。");
    } finally {
      setRunningRateTest(false);
    }
  };

  const handleSanitizeTest = async () => {
    setIsSanitizing(true);
    setSanitizeError(null);
    setSanitizeResult(null);
    const res = await fetchWithCsrf("/api/security-tests/sanitize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: inputSample }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSanitizeError(data.error || "サニタイズテストに失敗しました。");
    } else {
      setSanitizeResult({ original: data.original, sanitized: data.sanitized });
    }
    setIsSanitizing(false);
  };

  const clearRateLogs = () => setRateLogs([]);
  const resetUploadState = () => {
    setSelectedFile(null);
    setUploadResult(null);
  };

  const handleUploadTest = async () => {
    if (!selectedFile) {
      setUploadResult({ success: false, message: "テストする画像ファイルを選択してください。" });
      return;
    }
    setIsUploading(true);
    setUploadResult(null);
    const payload = new FormData();
    payload.append("file", selectedFile);
    try {
      const res = await fetchWithCsrf("/api/security-tests/upload", {
        method: "POST",
        body: payload,
      });
      const data = await res.json();
      setUploadResult(data);
    } catch (error) {
      console.error("Upload test failed:", error);
      setUploadResult({ success: false, message: "アップロードテストでエラーが発生しました。コンソールを確認してください。" });
    } finally {
      setIsUploading(false);
    }
  };

  // CSRFテスト
  const handleCsrfTest = async (testType: 'valid' | 'invalid') => {
    setIsCsrfTesting(true);
    setCsrfTestResult(null);
    try {
      if (testType === 'valid') {
        // 有効なトークンでテスト（apiPostを使用）
        const result = await apiPost<{ message?: string }>('/api/admin/security-test', { testType: 'csrf-valid' });
        setCsrfTestResult({ success: true, message: result.message ?? 'CSRFテスト成功' });
      } else {
        // 無効なトークンでテスト（CSRFトークンなしで直接fetch）
        const res = await fetch('/api/admin/security-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ testType: 'csrf-invalid' }),
        });
        const data = await res.json();
        if (res.status === 403 && data.error?.code === 'CSRF_TOKEN_INVALID') {
          setCsrfTestResult({ success: true, message: '期待通り: CSRFトークンが無効として検出されました。' });
        } else {
          setCsrfTestResult({ success: false, message: `予期しない応答: ${res.status}` });
        }
      }
    } catch (error) {
      if (error instanceof ApiErrorResponse) {
        if (testType === 'invalid' && error.code === ErrorCode.CSRF_TOKEN_INVALID) {
          setCsrfTestResult({ success: true, message: '期待通り: CSRFトークンが無効として検出されました。' });
        } else {
          setCsrfTestResult({ success: false, message: `エラー: ${error.message} (${error.code})` });
        }
      } else {
        setCsrfTestResult({ success: false, message: '予期しないエラーが発生しました。' });
      }
    } finally {
      setIsCsrfTesting(false);
    }
  };

  // エラーハンドリングテスト
  const handleErrorHandlingTest = async () => {
    setIsErrorHandlingTesting(true);
    setErrorHandlingResult(null);
    try {
      await apiPost('/api/admin/security-test', { testType: 'error-handling' });
      setErrorHandlingResult({ success: false, message: 'エラーが発生すべきでしたが、発生しませんでした。' });
    } catch (error) {
      if (error instanceof ApiErrorResponse) {
        setErrorHandlingResult({ 
          success: true, 
          message: `エラーハンドリングが正常に動作しています。エラーコード: ${error.code}`,
          errorCode: error.code
        });
      } else {
        setErrorHandlingResult({ success: false, message: '予期しないエラー形式です。' });
      }
    } finally {
      setIsErrorHandlingTesting(false);
    }
  };

  // ロギングテスト
  const handleLoggingTest = async () => {
    setIsLoggingTesting(true);
    setLoggingResult(null);
    try {
      const result = await apiPost<{ message?: string }>('/api/admin/security-test', { testType: 'logging' });
      setLoggingResult({ success: true, message: result.message ?? 'ログが記録されました。サーバーログを確認してください。' });
    } catch (error) {
      console.error("Logging test error:", error);
      setLoggingResult({ success: false, message: 'ロギングテストでエラーが発生しました。' });
    } finally {
      setIsLoggingTesting(false);
    }
  };

  // セッションセキュリティテスト
  const handleSessionSecurityTest = async () => {
    setIsSessionSecurityTesting(true);
    setSessionSecurityResult(null);
    try {
      const result = await apiPost<{ session: SessionSecurityData }>('/api/admin/security-test', { testType: 'session-security' });
      setSessionSecurityResult({ success: true, data: result.session });
    } catch (error) {
      console.error("Session security test error:", error);
    setSessionSecurityResult({ success: false, error: 'セッションセキュリティテストでエラーが発生しました。' });
    } finally {
      setIsSessionSecurityTesting(false);
    }
  };

  // 環境変数セキュリティテスト
  const handleEnvSecurityTest = async () => {
    setIsEnvSecurityTesting(true);
    setEnvSecurityResult(null);
    try {
      const result = await apiPost<{ envTest: EnvSecurityTestResult }>('/api/admin/security-test', { testType: 'env-security' });
      setEnvSecurityResult({ success: true, data: result.envTest });
    } catch (error) {
      console.error("Env security test error:", error);
      setEnvSecurityResult({ success: false, error: '環境変数セキュリティテストでエラーが発生しました。' });
    } finally {
      setIsEnvSecurityTesting(false);
    }
  };

  // パスワードポリシーテスト
  const handlePasswordPolicyTest = async () => {
    setIsPasswordPolicyTesting(true);
    setPasswordPolicyResult(null);
    try {
      const result = await apiPost<{ passwordTestResults: PasswordPolicyTestResult[] }>('/api/admin/security-test', { testType: 'password-policy' });
      setPasswordPolicyResult({ success: true, data: result.passwordTestResults });
    } catch (error) {
      console.error("Password policy test error:", error);
      setPasswordPolicyResult({ success: false, error: 'パスワードポリシーテストでエラーが発生しました。' });
    } finally {
      setIsPasswordPolicyTesting(false);
    }
  };

  // API認証テスト
  const handleApiAuthTest = async () => {
    setIsApiAuthTesting(true);
    setApiAuthResult(null);
    try {
      const result = await apiPost<{ apiAuthTest: ApiAuthTestResult }>('/api/admin/security-test', { testType: 'api-auth' });
      setApiAuthResult({ success: true, data: result.apiAuthTest });
    } catch (error) {
      console.error("API auth test error:", error);
    setApiAuthResult({ success: false, error: 'API認証テストでエラーが発生しました。' });
    } finally {
      setIsApiAuthTesting(false);
    }
  };

  // 2FAテスト
  const handleTwoFactorTest = async () => {
    setIsTwoFactorTesting(true);
    setTwoFactorResult(null);
    try {
      const result = await apiPost<{ twoFactorTest: TwoFactorTestResult }>('/api/admin/security-test', { testType: '2fa' });
      setTwoFactorResult({ success: true, data: result.twoFactorTest });
    } catch (error) {
      console.error("2FA test error:", error);
    setTwoFactorResult({ success: false, error: '2FAテストでエラーが発生しました。' });
    } finally {
      setIsTwoFactorTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-between bg-gray-900/60 border border-gray-800 rounded-2xl p-8">
          <h1 className="text-2xl font-semibold text-pink-400">アクセス権が必要です</h1>
          <p className="text-gray-300 text-sm">
            セキュリティテストページは SUPER_ADMIN 権限を持つユーザーのみアクセスできます。アクセスが必要な場合は管理者にお問い合わせください。
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center.justify-center px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 transition-colors text-sm font-semibold mt-4"
          >
            管理パネルに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-400" size={32} />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">セキュリティテストパネル</h1>
              <p className="text-gray-400 text-sm">SUPER_ADMIN専用: レート制限や入力検証を実際に確認できます。</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 border border-gray-700/60 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={16} />
              管理パネルへ
            </Link>
            <Link
              href="/test-session-timeout"
              className="flex items-center gap-2 px-4 py-2 bg-pink-600/80 hover:bg-pink-600 rounded-xl transition-colors"
            >
              <Activity size={16} />
              セッションテスト
            </Link>
          </div>
        </header>

        <section className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Terminal className="text-yellow-300" size={24} />
            <div>
              <h2 className="text-xl font-semibold">レート制限テスト</h2>
              <p className="text-sm text-gray-400">1分に5回まで許可されます。6回目で 429 応答が返ることを確認できます。</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={runRateLimitTest}
              disabled={runningRateTest}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {runningRateTest ? <Loader /> : <Sparkles size={16} />}
              連続リクエスト実行
            </button>
            <button
              onClick={clearRateLogs}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition"
            >
              ログをクリア
            </button>
          </div>
          {rateError && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
              <AlertTriangle size={16} className="inline mr-2" />
              {rateError}
            </div>
          )}
          <div className="bg-black/30 border border-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2 text-sm">
            {rateLogs.length === 0 && <p className="text-gray-500">まだテストを実行していません。</p>}
            {rateLogs.map((log) => (
              <div
                key={`${log.attempt}-${log.timestamp}`}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  log.status === 429 ? "bg-red-500/10 border border-red-500/40 text-red-200" : "bg-gray-800/60"
                }`}
              >
                <span>
                  #{log.attempt} - {log.message}
                </span>
                <span className="text-xs text-gray-400">
                  {log.timestamp} / {log.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="text-blue-300" size={24} />
            <div>
              <h2 className="text-xl font-semibold">入力検証・サニタイズテスト</h2>
              <p className="text-sm text-gray-400">scriptタグなどを含むテキストを入力し、サニタイズ結果を確認できます。</p>
            </div>
          </div>

          <textarea
            value={inputSample}
            onChange={(e) => setInputSample(e.target.value)}
            className="w-full min-h-[100px] bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-sm"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSanitizeTest}
              disabled={isSanitizing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isSanitizing ? <Loader /> : <RefreshCw size={16} />}
              サニタイズ実行
            </button>
            <button
              onClick={() => {
                setInputSample("");
                setSanitizeResult(null);
                setSanitizeError(null);
              }}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition"
            >
              入力をクリア
            </button>
          </div>

          {sanitizeError && (
            <div className="flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
              <AlertTriangle size={16} />
              {sanitizeError}
            </div>
          )}

          {sanitizeResult && (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <h3 className="font-medium text-gray-300 mb-2">元の入力</h3>
                <pre className="whitespace-pre-wrap text-gray-400 break-all">{sanitizeResult.original}</pre>
              </div>
              <div className="bg-gray-800/50 border border-emerald-600/40 rounded-lg p-3">
                <h3 className="font-medium text-gray-300 mb-2">サニタイズ結果</h3>
                <pre className="whitespace-pre-wrap text-emerald-200 break-all">{sanitizeResult.sanitized}</pre>
              </div>
            </div>
          )}
        </section>

        <section className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <UploadCloud className="text-purple-300" size={24} />
            <div>
              <h2 className="text-xl font-semibold">ファイルアップロード検証</h2>
              <p className="text-sm text-gray-400">検証ロジックのみ実行し、ストレージには保存しません。</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">テストする画像</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    setUploadResult(null);
                  }}
                  className="flex-1 text-sm text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-pink-600 file:text-white file:cursor-pointer bg-gray-800/60 border border-gray-700 rounded-lg"
                />
                {selectedFile && (
                  <button
                    onClick={resetUploadState}
                    className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition"
                  >
                    クリア
                  </button>
                )}
              </div>
              {selectedFile && (
                <div className="text-xs text-gray-400">
                  選択: {selectedFile.name}（{(selectedFile.size / 1024 / 1024).toFixed(2)} MB）
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleUploadTest}
                  disabled={isUploading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading ? <Loader /> : <UploadCloud size={16} />}
                  検証を実行
                </button>
              </div>
              <div className="text-xs text-gray-500 bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex gap-2">
                <Info size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p>許可形式: PNG / JPEG / WebP / GIF</p>
                  <p>最大サイズ: 5MB（アバターはサービス側で3MB）</p>
                  <p>ファイル名は UUID で安全に再生成されます。</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">結果</h3>
              <div className="bg-black/30 border border-gray-800 rounded-lg p-4 min-h-[160px] text-sm">
                {!uploadResult && <p className="text-gray-500">まだ検証を実行していません。</p>}
                {uploadResult && (
                  <div className={`${uploadResult.success ? "text-emerald-300" : "text-red-300"} space-y-2`}>
                    <p>{uploadResult.message}</p>
                    {uploadResult.details && (
                      <div className="text-xs text-gray-300 space-y-1">
                        {Object.entries(uploadResult.details).map(([key, value]) => (
                          <div key={key} className="flex justify-between border-b border-gray-800/60 py-1">
                            <span className="text-gray-500">{key}</span>
                            <span>{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 新規セキュリティ機能テストセクション */}
        <section className="bg-gray-900/40 border border-emerald-800/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-400" size={24} />
            <div>
              <h2 className="text-xl font-semibold">新規セキュリティ機能テスト</h2>
              <p className="text-sm text-gray-400">Phase 1で実装されたセキュリティ機能をテストします。</p>
            </div>
          </div>

          {/* CSRF保護テスト */}
          <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="text-blue-400" size={20} />
              <h3 className="font-semibold">CSRF保護テスト</h3>
            </div>
            <p className="text-sm text-gray-400">CSRFトークンの検証機能をテストします。</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleCsrfTest('valid')}
                disabled={isCsrfTesting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {isCsrfTesting ? <Loader /> : <CheckCircle size={16} />}
                有効なトークンでテスト
              </button>
              <button
                onClick={() => handleCsrfTest('invalid')}
                disabled={isCsrfTesting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {isCsrfTesting ? <Loader /> : <XCircle size={16} />}
                無効なトークンでテスト
              </button>
            </div>
            {csrfTestResult && (
              <div className={`text-sm p-3 rounded-lg ${
                csrfTestResult.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}>
                {csrfTestResult.message}
              </div>
            )}
          </div>

          {/* エラーハンドリングテスト */}
          <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-yellow-400" size={20} />
              <h3 className="font-semibold">エラーハンドリングテスト</h3>
            </div>
            <p className="text-sm text-gray-400">統一されたエラー応答フォーマットと内部情報の非表示を確認します。</p>
            <button
              onClick={handleErrorHandlingTest}
              disabled={isErrorHandlingTesting}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isErrorHandlingTesting ? <Loader /> : <RefreshCw size={16} />}
              エラーハンドリングをテスト
            </button>
            {errorHandlingResult && (
              <div className={`text-sm p-3 rounded-lg ${
                errorHandlingResult.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}>
                {errorHandlingResult.message}
                {errorHandlingResult.errorCode && (
                  <div className="mt-2 text-xs text-gray-400">
                    エラーコード: {errorHandlingResult.errorCode}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ロギングテスト */}
          <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="text-purple-400" size={20} />
              <h3 className="font-semibold">ロギング機能テスト</h3>
            </div>
            <p className="text-sm text-gray-400">アクセスログ、エラーログ、異常検知機能をテストします。</p>
            <button
              onClick={handleLoggingTest}
              disabled={isLoggingTesting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isLoggingTesting ? <Loader /> : <FileText size={16} />}
              ロギングをテスト
            </button>
            {loggingResult && (
              <div className={`text-sm p-3 rounded-lg ${
                loggingResult.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}>
                {loggingResult.message}
              </div>
            )}
          </div>

          {/* セッションセキュリティテスト */}
          <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="text-pink-400" size={20} />
              <h3 className="font-semibold">セッションセキュリティテスト</h3>
            </div>
            <p className="text-sm text-gray-400">セッション情報とセキュリティ設定を確認します。</p>
            <button
              onClick={handleSessionSecurityTest}
              disabled={isSessionSecurityTesting}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isSessionSecurityTesting ? <Loader /> : <Activity size={16} />}
              セッションセキュリティをテスト
            </button>
            {sessionSecurityResult && (
              <div className={`text-sm p-3 rounded-lg ${
                sessionSecurityResult.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/30' 
                  : 'bg-red-500/10 border border-red-500/30'
              }`}>
                {sessionSecurityResult.success ? (
                  <div className="text-emerald-300 space-y-2">
                    <p>セッション情報を取得しました:</p>
                    <pre className="text-xs bg-black/30 p-2 rounded overflow-auto">
                      {JSON.stringify(sessionSecurityResult.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-red-300">
                    {sessionSecurityResult.error || 'エラーが発生しました。'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 環境変数セキュリティテスト */}
          <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Server className="text-cyan-400" size={20} />
              <h3 className="font-semibold">環境変数セキュリティテスト</h3>
            </div>
            <p className="text-sm text-gray-400">環境変数の設定状態とマスク機能を確認します。</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleEnvSecurityTest}
                disabled={isEnvSecurityTesting}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {isEnvSecurityTesting ? <Loader /> : <Server size={16} />}
                環境変数をテスト
              </button>
              <button
                onClick={fetchEnvStatus}
                disabled={isRefreshingEnvStatus}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRefreshingEnvStatus ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <RefreshCw size={16} />
                )}
                状態を更新
              </button>
            </div>
            {envStatus && (
              <div className="space-y-3">
                {/* セキュリティ状態サマリー */}
                <div className={`text-sm p-3 rounded-lg border ${
                  envStatus.isSecure 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    {envStatus.isSecure ? (
                      <>
                        <CheckCircle size={16} />
                        <span>セキュリティ状態: 良好</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} />
                        <span>セキュリティ状態: 問題あり</span>
                      </>
                    )}
                  </div>
                  {envStatus.securityIssues && envStatus.securityIssues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="font-medium">重大な問題:</div>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        {envStatus.securityIssues.map((issue: string, idx: number) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {envStatus.warnings && envStatus.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="font-medium text-yellow-300">警告:</div>
                      <ul className="list-disc list-inside space-y-1 text-xs text-yellow-200">
                        {envStatus.warnings.map((warning: string, idx: number) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* 詳細情報 */}
                <div className="text-sm bg-black/30 p-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">NODE_ENV:</span>
                    <span className="text-white">{envStatus.nodeEnv || '未設定'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">NEXTAUTH_SECRET:</span>
                    <span className={
                      !envStatus.hasNextAuthSecret ? 'text-red-300' :
                      envStatus.nextAuthSecretLength < 32 ? 'text-red-300' :
                      envStatus.nextAuthSecretLength < 64 ? 'text-yellow-300' :
                      'text-emerald-300'
                    }>
                      {envStatus.hasNextAuthSecret 
                        ? `${envStatus.nextAuthSecretMasked} (${envStatus.nextAuthSecretLength}文字)` 
                        : '未設定'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">CSRF_SECRET:</span>
                    <span className={
                      !envStatus.hasCsrfSecret ? 'text-yellow-300' :
                      envStatus.csrfSecretLength < 32 ? 'text-red-300' :
                      'text-emerald-300'
                    }>
                      {envStatus.hasCsrfSecret 
                        ? `設定済み (${envStatus.csrfSecretLength}文字)` 
                        : '未設定（NEXTAUTH_SECRETを使用）'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">DATABASE_URL:</span>
                    <span className={envStatus.hasDatabaseUrl ? 'text-emerald-300' : 'text-red-300'}>
                      {envStatus.hasDatabaseUrl ? '設定済み' : '未設定'}
                    </span>
                  </div>
                  {envStatus.timestamp && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                      <span className="text-gray-500 text-xs">最終更新:</span>
                      <span className="text-gray-500 text-xs">
                        {new Date(envStatus.timestamp).toLocaleString('ja-JP')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {envSecurityResult && (
              <div className={`text-sm p-3 rounded-lg border ${
                envSecurityResult.success && envSecurityResult.data?.isSecure
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : envSecurityResult.success && !envSecurityResult.data?.isSecure
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                {envSecurityResult.success ? (
                  <div className="space-y-3">
                    {/* サマリー */}
                    <div className={`flex items-center gap-2 font-semibold ${
                      envSecurityResult.data?.isSecure ? 'text-emerald-300' : 'text-red-300'
                    }`}>
                      {envSecurityResult.data?.isSecure ? (
                        <>
                          <CheckCircle size={16} />
                          <span>検証結果: 問題なし</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={16} />
                          <span>検証結果: 問題あり</span>
                        </>
                      )}
                    </div>
                    
                    {/* チェック結果 */}
                    {envSecurityResult.data?.checks && (
                      <div className="space-y-2">
                        <div className="font-medium text-gray-300">各項目のチェック結果:</div>
                        {Object.entries(envSecurityResult.data.checks).map(([key, check]: [string, EnvCheckResult]) => (
                          <div key={key} className="flex items-center justify-between text-xs bg-gray-800/50 p-2 rounded">
                            <span className="text-gray-400">{key}:</span>
                            <span className={
                              check.status === 'ok' ? 'text-emerald-300' :
                              check.status === 'warning' ? 'text-yellow-300' :
                              'text-red-300'
                            }>
                              {check.message}
                              {check.status === 'ok' && ' ✓'}
                              {check.status === 'warning' && ' ⚠'}
                              {check.status === 'error' && ' ✗'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 問題リスト */}
                    {envSecurityResult.data?.issues && envSecurityResult.data.issues.length > 0 && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded p-2 space-y-1">
                        <div className="font-medium text-red-300">重大な問題:</div>
                        <ul className="list-disc list-inside space-y-1 text-xs text-red-200">
                          {envSecurityResult.data.issues.map((issue: string, idx: number) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* 警告リスト */}
                    {envSecurityResult.data?.warnings && envSecurityResult.data.warnings.length > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 space-y-1">
                        <div className="font-medium text-yellow-300">警告:</div>
                        <ul className="list-disc list-inside space-y-1 text-xs text-yellow-200">
                          {envSecurityResult.data.warnings.map((warning: string, idx: number) => (
                            <li key={idx}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* マスクされた値 */}
                    {envSecurityResult.data?.maskedValues && (
                      <div className="bg-gray-800/50 rounded p-2 space-y-1 text-xs">
                        <div className="font-medium text-gray-300">マスクされた値:</div>
                        {Object.entries(envSecurityResult.data.maskedValues).map(([key, value]: [string, string]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-400">{key}:</span>
                            <span className="text-gray-300">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-300">
                    {envSecurityResult.error || 'エラーが発生しました。'}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Phase 2 セキュリティ機能テスト */}
        <section className="bg-gray-900/40 border border-blue-800/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-blue-400" size={24} />
            <div>
              <h2 className="text-xl font-semibold">Phase 2 セキュリティ機能テスト</h2>
              <p className="text-sm text-gray-400">パスワードポリシー、API認証、2FA機能をテストします。</p>
            </div>
          </div>

          {/* パスワードポリシーテスト */}
          <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="text-green-400" size={20} />
              <h3 className="font-semibold">パスワードポリシーテスト</h3>
            </div>
            <p className="text-sm text-gray-400">様々な強度のパスワードをテストして、ポリシー検証機能を確認します。</p>
            <button
              onClick={handlePasswordPolicyTest}
              disabled={isPasswordPolicyTesting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isPasswordPolicyTesting ? <Loader /> : <Lock size={16} />}
              パスワードポリシーをテスト
            </button>
            {passwordPolicyResult && (
              <div className={`text-sm p-3 rounded-lg border ${
                passwordPolicyResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                {passwordPolicyResult.success ? (
                  <div className="space-y-3">
                    <div className="font-semibold text-emerald-300">テスト結果:</div>
                    <div className="space-y-2">
                      {passwordPolicyResult.data?.map((result: PasswordPolicyTestResult, idx: number) => (
                        <div key={idx} className="bg-gray-800/50 p-2 rounded text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">パスワード: {result.password}</span>
                            <span className={
                              result.isValid ? 'text-emerald-300' : 'text-red-300'
                            }>
                              {result.isValid ? '✓ 有効' : '✗ 無効'}
                            </span>
                          </div>
                          {result.passwordLength !== undefined && (
                            <div className="flex items-center justify-between text-gray-500">
                              <span>長さ:</span>
                              <span>{result.passwordLength}文字</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">強度:</span>
                            <span className={
                              result.strength === 'very-strong' ? 'text-emerald-300' :
                              result.strength === 'strong' ? 'text-blue-300' :
                              result.strength === 'medium' ? 'text-yellow-300' :
                              'text-red-300'
                            }>
                              {result.strengthDescription} ({result.score}点)
                            </span>
                          </div>
                          {result.errors && result.errors.length > 0 && (
                            <div className="mt-1 text-red-300 text-xs">
                              <div className="font-medium mb-0.5">エラー:</div>
                              <ul className="list-disc list-inside space-y-0.5">
                                {result.errors.map((error: string, errIdx: number) => (
                                  <li key={errIdx}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.warnings && result.warnings.length > 0 && (
                            <div className="mt-1 text-yellow-300 text-xs">
                              <div className="font-medium mb-0.5">警告:</div>
                              <ul className="list-disc list-inside space-y-0.5">
                                {result.warnings.map((warning: string, warnIdx: number) => (
                                  <li key={warnIdx}>{warning}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-red-300">
                    {passwordPolicyResult.error || 'エラーが発生しました。'}
                  </div>
                )}
            </div>
          )}
            <div className="flex items-center gap-2">
              <Server className="text-orange-400" size={20} />
              <h3 className="font-semibold">API認証テスト</h3>
            </div>
            <p className="text-sm text-gray-400">APIキーの生成とハッシュ化機能をテストします。</p>
            <button
              onClick={handleApiAuthTest}
              disabled={isApiAuthTesting}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isApiAuthTesting ? <Loader /> : <Server size={16} />}
              API認証をテスト
            </button>
            {apiAuthResult && (
              <div className={`text-sm p-3 rounded-lg border ${
                apiAuthResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                {apiAuthResult.success ? (
                  <div className="text-emerald-300 space-y-2">
                    <p className="font-semibold">{apiAuthResult.data?.message}</p>
                    <div className="bg-gray-800/50 p-2 rounded text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400">生成されたキー:</span>
                        <span className="text-gray-300">{apiAuthResult.data?.generatedKey}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">キー長:</span>
                        <span className="text-gray-300">{apiAuthResult.data?.keyLength}文字</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">ハッシュ化されたキー:</span>
                        <span className="text-gray-300">{apiAuthResult.data?.hashedKey}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-300">
                    {apiAuthResult.error || 'エラーが発生しました。'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2FAテスト */}
          <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-purple-400" size={20} />
              <h3 className="font-semibold">2要素認証（2FA）テスト</h3>
            </div>
            <p className="text-sm text-gray-400">TOTPシークレット生成、バックアップコード生成、QRコードURI生成をテストします。</p>
            <button
              onClick={handleTwoFactorTest}
              disabled={isTwoFactorTesting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isTwoFactorTesting ? <Loader /> : <ShieldCheck size={16} />}
              2FA機能をテスト
            </button>
            {twoFactorResult && (
              <div className={`text-sm p-3 rounded-lg border ${
                twoFactorResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                {twoFactorResult.success ? (
                  <div className="text-emerald-300 space-y-2">
                    <p className="font-semibold">{twoFactorResult.data?.message}</p>
                    <div className="bg-gray-800/50 p-2 rounded text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400">TOTPシークレット:</span>
                        <span className="text-gray-300">{twoFactorResult.data?.totpSecret}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">バックアップコード数:</span>
                        <span className="text-gray-300">{twoFactorResult.data?.backupCodesCount}個</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">QRコードURI:</span>
                        <span className="text-gray-300 break-all">{twoFactorResult.data?.qrCodeUri}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-300">
                    {twoFactorResult.error || 'エラーが発生しました。'}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 脆弱性評価と侵入テスト */}
        <section className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="text-blue-400" size={24} />
              <div>
                <h2 className="text-xl font-bold">脆弱性評価と侵入テスト</h2>
                <p className="text-sm text-gray-400">依存関係の脆弱性スキャンとセキュリティテスト結果</p>
              </div>
            </div>
            <button
              onClick={() => fetchSecurityStatus(false)}
              disabled={isLoadingSecurityStatus}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition disabled:opacity-50"
            >
              {isLoadingSecurityStatus ? <Loader /> : <RefreshCw size={16} />}
              更新
            </button>
          </div>

          {/* npm audit結果 */}
          <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="text-blue-400" size={18} />
                <h3 className="font-semibold">依存関係の脆弱性 (npm audit)</h3>
              </div>
              <button
                onClick={handleRunAudit}
                disabled={isRunningAudit}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 text-sm flex items-center gap-2"
              >
                {isRunningAudit ? <Loader /> : <Terminal size={14} />}
                実行
              </button>
            </div>
            
            {securityStatus?.currentAudit && (
              <div className={`p-3 rounded-lg border ${
                securityStatus.currentAudit.total === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {securityStatus.currentAudit.total === 0 ? (
                    <CheckCircle className="text-emerald-400" size={18} />
                  ) : (
                    <AlertCircle className="text-red-400" size={18} />
                  )}
                  <span className={`font-semibold ${
                    securityStatus.currentAudit.total === 0 ? 'text-emerald-300' : 'text-red-300'
                  }`}>
                    {securityStatus.currentAudit.total === 0 
                      ? '脆弱性は見つかりませんでした' 
                      : `${securityStatus.currentAudit.total}件の脆弱性が見つかりました`}
                  </span>
                </div>
                {securityStatus.currentAudit.total > 0 && (
                  <div className="text-sm space-y-1 mt-2">
                    {Object.entries(securityStatus.currentAudit.vulnerabilities).map(([severity, count]) => (
                      count > 0 && (
                        <div key={severity} className="flex justify-between">
                          <span className="text-gray-400 capitalize">{severity}:</span>
                          <span className="text-gray-300">{count}</span>
                        </div>
                      )
                    ))}
                  </div>
                )}
                {securityStatus.currentAudit.timestamp && (
                  <div className="text-xs text-gray-500 mt-2">
                    実行日時: {new Date(securityStatus.currentAudit.timestamp).toLocaleString('ja-JP')}
                  </div>
                )}
                {securityStatus.currentAudit.total > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => handleFixAudit(false, false)}
                      disabled={isFixingAudit}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50 text-sm flex items-center gap-2"
                    >
                      {isFixingAudit ? <Loader /> : <CheckCircle size={14} />}
                      自動修正
                    </button>
                    <button
                      onClick={() => handleFixAudit(false, true)}
                      disabled={isFixingAudit}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 text-sm flex items-center gap-2"
                      title="--legacy-peer-depsオプションを使用して依存関係の競合を回避"
                    >
                      {isFixingAudit ? <Loader /> : <RefreshCw size={14} />}
                      互換性モード修正
                    </button>
                    <button
                      onClick={() => handleFixAudit(true, false)}
                      disabled={isFixingAudit}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg transition disabled:opacity-50 text-sm flex items-center gap-2"
                    >
                      {isFixingAudit ? <Loader /> : <AlertTriangle size={14} />}
                      強制修正
                    </button>
                  </div>
                )}
              </div>
            )}

            {securityStatus?.audit && !securityStatus.currentAudit && (
              <div className={`p-3 rounded-lg border ${
                securityStatus.audit.total === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Info className="text-yellow-400" size={18} />
                  <span className="font-semibold text-yellow-300">
                    保存されたレポート: {securityStatus.audit.total}件の脆弱性
                  </span>
                </div>
                {securityStatus.audit.total > 0 && (
                  <div className="text-sm space-y-1 mt-2">
                    {Object.entries(securityStatus.audit.vulnerabilities).map(([severity, count]) => (
                      count > 0 && (
                        <div key={severity} className="flex justify-between">
                          <span className="text-gray-400 capitalize">{severity}:</span>
                          <span className="text-gray-300">{count}</span>
                        </div>
                      )
                    ))}
                  </div>
                )}
                {securityStatus.audit.timestamp && (
                  <div className="text-xs text-gray-500 mt-2">
                    実行日時: {new Date(securityStatus.audit.timestamp).toLocaleString('ja-JP')}
                  </div>
                )}
              </div>
            )}

            {!securityStatus?.audit && !securityStatus?.currentAudit && (
              <div className="text-sm text-gray-400 p-3 bg-gray-800/30 rounded-lg">
                npm auditを実行して脆弱性を確認してください。
              </div>
            )}

            {/* 修正結果 */}
            {fixResult && (
              <div className={`p-3 rounded-lg border ${
                fixResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {fixResult.success ? (
                    <CheckCircle className="text-emerald-400" size={18} />
                  ) : (
                    <AlertCircle className="text-red-400" size={18} />
                  )}
                  <span className={`font-semibold ${
                    fixResult.success ? 'text-emerald-300' : 'text-red-300'
                  }`}>
                    {fixResult.message}
                  </span>
                </div>
                {fixResult.error && (
                  <div className="text-xs text-gray-400 mt-2 bg-gray-900/50 p-2 rounded font-mono overflow-x-auto">
                    <div className="whitespace-pre-wrap break-words">
                      {fixResult.error}
                    </div>
                  </div>
                )}
                {fixResult.success && fixResult.needsForce && (
                  <div className="text-xs text-yellow-400 mt-2 bg-yellow-500/10 p-2 rounded">
                    💡 一部の脆弱性を修正するには「強制修正」ボタンが必要な場合があります。
                  </div>
                )}
              </div>
            )}
          </div>

          {/* セキュリティテスト結果 */}
          {securityStatus?.tests && (
            <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-purple-400" size={18} />
                <h3 className="font-semibold">セキュリティテスト結果</h3>
              </div>
              <div className="p-3 rounded-lg border bg-gray-900/50 border-gray-700/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">テスト総数:</span>
                    <span className="ml-2 text-gray-300">{securityStatus.tests.summary.totalTests}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">成功:</span>
                    <span className="ml-2 text-emerald-300">{securityStatus.tests.summary.passedTests}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">失敗:</span>
                    <span className="ml-2 text-red-300">{securityStatus.tests.summary.failedTests}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">脆弱性:</span>
                    <span className={`ml-2 ${securityStatus.tests.summary.vulnerabilities === 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {securityStatus.tests.summary.vulnerabilities}
                    </span>
                  </div>
                </div>
                {securityStatus.tests.timestamp && (
                  <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700/50">
                    実行日時: {new Date(securityStatus.tests.timestamp).toLocaleString('ja-JP')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 情報 */}
          <div className="text-xs text-gray-500 bg-gray-800/30 p-3 rounded-lg">
            <p className="mb-1">💡 ヒント:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>npm auditは依存関係の脆弱性をスキャンします</li>
              <li>GitHub Actionsで毎週自動実行されます（.github/workflows/security-audit.yml）</li>
              <li>セキュリティテストは <code className="text-gray-300">npm run security:test</code> で実行できます</li>
            </ul>
          </div>
        </section>

        <section className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-6 space-y-3 text-sm text-gray-400">
          <p>近日追加予定:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>ファイルアップロード検証（MIME/マジックナンバー/サイズ）</li>
            <li>レスポンスヘッダー自動チェック</li>
            <li>CORS設定テスト</li>
          </ul>
          <p className="text-xs text-gray-500">アップデート時に本ページへテスト機能を随時追加します。</p>
        </section>
      </div>
    </div>
  );
}

function Loader() {
  return <Loader2 className="animate-spin" size={16} />;
}

