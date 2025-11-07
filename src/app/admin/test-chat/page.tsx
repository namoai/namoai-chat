'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface TestResult {
  index: number;
  message: string;
  success: boolean;
  duration?: number;
  responseLength?: number;
  error?: string;
  timestamp: string;
}

interface TestSummary {
  total: number;
  success: number;
  failed: number;
  avgDuration: number;
  characterId: number;
  characterName: string;
  chatId: number;
}

export default function TestChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [characterId, setCharacterId] = useState<string>('');
  const [chatCount, setChatCount] = useState<number>(20);
  const [customMessages, setCustomMessages] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);

  if (status === 'loading') {
    return <div className="min-h-screen bg-black text-white flex justify-center items-center">読み込み中...</div>;
  }

  if (!session || session.user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">権限がありません</h1>
          <p className="text-gray-400">このページは管理者専用です。</p>
        </div>
      </div>
    );
  }

  const handleStartTest = async () => {
    if (!characterId) {
      alert('キャラクターIDを入力してください。');
      return;
    }

    setIsRunning(true);
    setResults([]);
    setSummary(null);

    try {
      const messages = customMessages
        ? customMessages.split('\n').filter(m => m.trim())
        : undefined;

      const response = await fetch('/api/admin/test-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: parseInt(characterId),
          chatCount,
          messages,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.results || []);
        setSummary(data.summary || null);
      } else {
        alert(`エラー: ${data.error || 'テストに失敗しました。'}`);
      }
    } catch (error) {
      console.error('테스트 에러:', error);
      alert('テスト実行中にエラーが発生しました。');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">채팅 자동 테스트</h1>

        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                キャラクターID
              </label>
              <input
                type="number"
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2"
                placeholder="例: 1"
                disabled={isRunning}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                テスト回数
              </label>
              <input
                type="number"
                value={chatCount}
                onChange={(e) => setChatCount(parseInt(e.target.value) || 20)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2"
                min="1"
                max="100"
                disabled={isRunning}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                カスタムメッセージ (改行区切り、空白の場合はデフォルトメッセージを使用)
              </label>
              <textarea
                value={customMessages}
                onChange={(e) => setCustomMessages(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 h-32"
                placeholder="メッセージ1&#10;メッセージ2&#10;メッセージ3"
                disabled={isRunning}
              />
            </div>

            <button
              onClick={handleStartTest}
              disabled={isRunning || !characterId}
              className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded transition-colors"
            >
              {isRunning ? 'テスト実行中...' : 'テスト開始'}
            </button>
          </div>
        </div>

        {summary && (
          <div className="bg-gray-900 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">テスト結果サマリー</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-400">総数</div>
                <div className="text-2xl font-bold">{summary.total}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">成功</div>
                <div className="text-2xl font-bold text-green-500">{summary.success}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">失敗</div>
                <div className="text-2xl font-bold text-red-500">{summary.failed}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">平均応答時間</div>
                <div className="text-2xl font-bold">{summary.avgDuration}ms</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-400">
              <div>キャラクター: {summary.characterName} (ID: {summary.characterId})</div>
              <div>チャットID: {summary.chatId}</div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">詳細結果</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">メッセージ</th>
                    <th className="text-left p-2">ステータス</th>
                    <th className="text-left p-2">応答時間</th>
                    <th className="text-left p-2">応答長</th>
                    <th className="text-left p-2">エラー</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="border-b border-gray-800">
                      <td className="p-2">{result.index}</td>
                      <td className="p-2">{result.message}</td>
                      <td className="p-2">
                        {result.success ? (
                          <span className="text-green-500">✓ 成功</span>
                        ) : (
                          <span className="text-red-500">✗ 失敗</span>
                        )}
                      </td>
                      <td className="p-2">{result.duration ? `${result.duration}ms` : '-'}</td>
                      <td className="p-2">{result.responseLength ? `${result.responseLength}文字` : '-'}</td>
                      <td className="p-2 text-red-400">{result.error || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
