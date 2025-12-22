"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30分

const notifyTimeoutRefresh = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("session-timeout-refresh"));
  }
};

export default function TestSessionTimeoutPage() {
  const { status } = useSession();
  const router = useRouter();
  const [testTimeout, setTestTimeout] = useState<string>("30000");
  const [isTestModeActive, setIsTestModeActive] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    const testMode = localStorage.getItem("sessionTimeoutTestMode");
    if (testMode) {
      setIsTestModeActive(true);
      setTestTimeout(testMode);
    }
  }, []);

  useEffect(() => {
    if (!isTestModeActive) return;

    const interval = setInterval(() => {
      const testMode = localStorage.getItem("sessionTimeoutTestMode");
      if (testMode) {
        const timeout = parseInt(testMode, 10);
        const lastActivityStr = localStorage.getItem("sessionTimeoutLastActivity");
        if (lastActivityStr) {
          const lastActivityTime = parseInt(lastActivityStr, 10);
          const elapsed = Date.now() - lastActivityTime;
          const remaining = Math.max(0, timeout - elapsed);
          setTimeRemaining(remaining);
          setLastActivity(new Date(lastActivityTime));
        }
      } else {
        setIsTestModeActive(false);
        setTimeRemaining(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTestModeActive]);

  const handleStartTest = () => {
    const timeoutMs = parseInt(testTimeout, 10);
    if (isNaN(timeoutMs) || timeoutMs <= 0) {
      alert("有効な時間(ミリ秒)を入力してください。例: 30000 (30秒)");
      return;
    }

    localStorage.setItem("sessionTimeoutTestMode", timeoutMs.toString());
    localStorage.setItem("sessionTimeoutLastActivity", Date.now().toString());
    setIsTestModeActive(true);
    setLastActivity(new Date());
    setTimeRemaining(timeoutMs);
    notifyTimeoutRefresh();

    alert(`テストモードを有効化しました: ${timeoutMs / 1000}秒タイムアウト\nページをリロードせずに即時反映されます。`);
  };

  const handleStopTest = () => {
    localStorage.removeItem("sessionTimeoutTestMode");
    localStorage.removeItem("sessionTimeoutLastActivity");
    setIsTestModeActive(false);
    setTimeRemaining(null);
    setLastActivity(null);
    notifyTimeoutRefresh();

    alert("テストモードを無効化しました。再度30分タイムアウトが適用されます。");
  };

  const handleResetToDefault = () => {
    localStorage.removeItem("sessionTimeoutTestMode");
    localStorage.removeItem("sessionTimeoutLastActivity");
    setIsTestModeActive(false);
    setTimeRemaining(null);
    setLastActivity(null);
    setTestTimeout(DEFAULT_TIMEOUT_MS.toString());
    notifyTimeoutRefresh();

    alert("タイムアウト時間をデフォルト(30分)に戻しました。");
  };

  const handleSimulateActivity = () => {
    localStorage.setItem("sessionTimeoutLastActivity", Date.now().toString());
    setLastActivity(new Date());
    const timeout = parseInt(localStorage.getItem("sessionTimeoutTestMode") || "30000", 10);
    setTimeRemaining(timeout);
    alert("操作をシミュレーションしました。タイマーをリセットしました。");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-xl">ログインが必要です。</p>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-pink-600 hover:bg-pink-700 rounded-lg transition-colors"
          >
            ログインする
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分 ${remainingSeconds}秒`;
    }
    return `${seconds}秒`;
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/60 border border-gray-700/60">
                ←
              </span>
              戻る
            </button>
            <div>
              <h1 className="text-2xl font-bold mb-1 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                セッションタイムアウトテストツール
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm">
                任意の時間を設定して自動ログアウトの挙動を即座に検証できます。テスト後は30分にリセットしてください。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">タイムアウト時間 (ミリ秒)</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  value={testTimeout}
                  onChange={(e) => setTestTimeout(e.target.value)}
                  disabled={isTestModeActive}
                  placeholder="30000"
                  className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 disabled:opacity-50"
                />
                <button
                  onClick={handleStartTest}
                  disabled={isTestModeActive}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  テスト開始
                </button>
                {isTestModeActive && (
                  <button
                    onClick={handleStopTest}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    テスト停止
                  </button>
                )}
                <button
                  onClick={handleResetToDefault}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  30分にリセット
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">例: 30000 (30秒), 60000 (60秒), 120000 (2分)</p>
            </div>

            {isTestModeActive && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-300">テストモード有効</span>
                  <span className="text-xs text-blue-400">
                    {testTimeout ? formatTime(parseInt(testTimeout, 10)) : "-"}
                  </span>
                </div>

                {timeRemaining !== null && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">残り時間:</span>
                      <span className={`font-bold ${timeRemaining < 10000 ? "text-red-400" : "text-green-400"}`}>
                        {formatTime(timeRemaining)}
                      </span>
                    </div>
                    {lastActivity && (
                      <div className="text-xs text-gray-500">最終操作: {lastActivity.toLocaleTimeString()}</div>
                    )}
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-pink-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (timeRemaining / parseInt(testTimeout || "1", 10)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSimulateActivity}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm"
                >
                  操作をシミュレーション (タイマーリセット)
                </button>

                <div className="text-xs text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                  ⚠️ 変更は即時反映されます。テスト後は必ず30分に戻してください。
                </div>
              </div>
            )}

            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-300">使い方</h3>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>上部でタイムアウト時間を設定（例: 30000 = 30秒）</li>
                <li>「テスト開始」ボタンを押して即時適用</li>
                <li>必要に応じてページをリロードせず、そのまま動作を確認</li>
                <li>テスト終了後は「テスト停止」または「30分にリセット」</li>
              </ol>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-300">推奨テストシナリオ</h3>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>操作せずタイムアウト時間まで待機 → 自動ログアウトを確認</li>
                <li>マウス移動/クリック → タイマーがリセットされるか確認</li>
                <li>キーボード入力 → タイマーがリセットされるか確認</li>
                <li>タブ移動後に戻る → タイムアウト判定が正しく行われるか確認</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

