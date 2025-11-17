import React, { useState } from 'react';
import { X, Search, MoreVertical, Clock } from 'lucide-react';

type DetailedMemory = {
  id: number;
  content: string;
  keywords: string[];
  createdAt: string;
  lastApplied?: string;
  index: number; // 1-3のインデックス
  messageRange?: { start: number; end: number } | null; // メッセージ範囲情報
};

type DetailedMemoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  chatId: number;
  memories: DetailedMemory[];
  onSave: (memory: Omit<DetailedMemory, 'id' | 'createdAt' | 'lastApplied'>) => Promise<void>;
  onUpdate: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAutoSummarize: (index: number) => Promise<void>;
};

export default function DetailedMemoryModal({
  isOpen,
  onClose,
  memories,
  onUpdate,
  onDelete,
  onAutoSummarize,
}: DetailedMemoryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showMenuId, setShowMenuId] = useState<number | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 現在適用中のメモリを取得（最大3つ、lastAppliedが最新のもの）
  const currentlyApplied = memories
    .filter(m => m.lastApplied)
    .sort((a, b) => new Date(b.lastApplied || 0).getTime() - new Date(a.lastApplied || 0).getTime())
    .slice(0, 3); // 最大3つまで

  // フィルタリングとソート
  const filteredMemories = memories
    .filter(m => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        m.content.toLowerCase().includes(query) ||
        m.keywords.some(k => k.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const handleEditStart = (memory: DetailedMemory) => {
    setEditingId(memory.id);
    setEditingContent(memory.content);
  };

  const handleEditSave = async () => {
    if (editingId === null || editingContent.length > 2000) return;
    setIsSaving(true);
    try {
      await onUpdate(editingId, editingContent);
      setEditingId(null);
      setEditingContent('');
    } catch (error) {
      console.error('更新エラー:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この詳細記憶を削除しますか？')) return;
    try {
      await onDelete(id);
      setShowMenuId(null);
    } catch (error) {
      console.error('削除エラー:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-gray-800 text-white rounded-lg w-full max-w-[95vw] sm:max-w-[90vw] lg:max-w-[85vw] xl:max-w-[80vw] h-[90vh] flex flex-col shadow-2xl mx-auto" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div className="flex-1">
            <h2 className="text-2xl font-bold">詳細記憶</h2>
            <p className="text-sm text-gray-400 mt-1">無制限に保存できます。関連キーワードで自動的に適用され、適用時は最大3つまでです。</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors flex-shrink-0 ml-4">
            <X size={24} />
          </button>
        </div>

        {/* 説明セクション */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/30 overflow-y-auto max-h-[300px]">
          <details className="cursor-pointer" open>
            <summary className="text-sm font-semibold text-gray-300 hover:text-white mb-2">
              🧠 詳細記憶とは？（クリックで折りたたむ）
            </summary>
            <div className="mt-2 p-3 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50">
              <p className="text-xs text-gray-400 leading-relaxed mb-2">
                会話の特定の場面を個別に記録する機能です。メモリブックとは異なり、複数の記憶を保存でき、キーワードで自動適用されます（最大3つまで同時適用）。
              </p>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong className="text-gray-300">無制限保存:</strong> 記憶を無制限に保存可能</p>
                <p><strong className="text-gray-300">自動適用:</strong> キーワードやベクトル検索で関連記憶を自動適用</p>
                <p><strong className="text-gray-300">手動作成・編集:</strong> 記憶を手動で作成・編集・削除可能</p>
              </div>
              {/* ▼▼▼【追加】詳細記憶の動作方式の詳細説明 */}
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <details className="cursor-pointer">
                  <summary className="text-xs text-gray-300 mb-1 font-semibold hover:text-white">
                    📝 詳細な規則について（クリックで展開）
                  </summary>
                <div className="mt-3 space-y-3 text-xs text-gray-400">
                  <div>
                    <p className="font-semibold text-gray-300 mb-1">📊 自動要約の規則:</p>
                    <ul className="space-y-1 list-disc list-inside ml-2">
                      <li><strong>メッセージ2-10個:</strong> メッセージが追加されるたびに自動要約が実行されます（2, 3, 4, 5, 6, 7, 8, 9, 10番目のメッセージ時）</li>
                      <li><strong>メッセージ11個以上:</strong> 5個単位で自動要約が実行されます（15, 20, 25, 30...番目のメッセージ時）</li>
                      <li><strong>要約範囲:</strong> メッセージは5個ずつグループ化されます（1-5, 6-10, 11-15, 16-20...）</li>
                      <li><strong>重複防止:</strong> ベクトル類似度0.85以上の既存要約がある場合はスキップされます</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-gray-300 mb-1">🎯 自動適用の規則:</p>
                    <ul className="space-y-1 list-disc list-inside ml-2">
                      <li><strong>記憶数1-3個:</strong> 全ての記憶が自動的に適用されます</li>
                      <li><strong>記憶数4個以上:</strong> キーワードマッチング + ベクトル検索で最大3個が選択されます</li>
                      <li><strong>キーワードマッチング:</strong> 会話内容と一致するキーワードがある記憶が優先されます</li>
                      <li><strong>ベクトル検索:</strong> 会話内容と意味的に類似した記憶も検出されます</li>
                      <li><strong>適用順:</strong> 最後に適用された時刻（lastApplied）が最新の3個が表示されます</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-gray-300 mb-1">💡 メッセージ範囲の表示:</p>
                    <ul className="space-y-1 list-disc list-inside ml-2">
                      <li>各記憶には「X-Y」の形式でメッセージ範囲が表示されます</li>
                      <li>例: 「1-5」はメッセージ1番から5番までの範囲を要約したことを示します</li>
                      <li>「6-10」はメッセージ6番から10番までの範囲を要約したことを示します</li>
                      <li>範囲がない場合は「-」が表示されます（手動作成の場合など）</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-gray-300 mb-1">🔄 再要約機能:</p>
                    <ul className="space-y-1 list-disc list-inside ml-2">
                      <li>「再要約」ボタンをクリックすると、全ての記憶が削除され、最初から再生成されます</li>
                      <li>全メッセージを5個ずつグループ化して要約します</li>
                      <li>既存の記憶は全て削除されるため、注意してください</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="font-semibold text-gray-300 mb-1">📝 手動作成・編集:</p>
                    <ul className="space-y-1 list-disc list-inside ml-2">
                      <li>手動で記憶を作成・編集できます（最大2000文字）</li>
                      <li>内容が変更されていない場合は、更新をスキップして効率化されます</li>
                      <li>キーワードは自動抽出されるか、手動で設定できます</li>
                    </ul>
                  </div>
                </div>
              </details>
              </div>
              {/* ▲▲▲ */}
            </div>
          </details>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* 現在適用中の記憶（最大3つ） */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">適用中</span>
              現在適用中の記憶（最大3つ）
            </h3>
            {currentlyApplied.length > 0 ? (
              <div className="space-y-3">
                {currentlyApplied.map((memory, idx) => (
                  <div key={memory.id} className="bg-green-900/30 border-2 border-green-600 rounded-lg p-4 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                          #{idx + 1}
                        </span>
                        <span className="text-green-300 text-xs">
                          最終適用: {memory.lastApplied ? new Date(memory.lastApplied).toLocaleString('ja-JP') : '不明'}
                        </span>
                      </div>
                      {memory.keywords && memory.keywords.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {memory.keywords.slice(0, 5).map((keyword, kIdx) => (
                            <span key={kIdx} className="bg-green-800/50 text-green-200 px-2 py-0.5 rounded text-xs border border-green-600">
                              {keyword}
                            </span>
                          ))}
                          {memory.keywords.length > 5 && (
                            <span className="text-green-400 text-xs">+{memory.keywords.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-100 whitespace-pre-wrap leading-relaxed">{memory.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm">現在適用中の記憶はありません。会話中に関連キーワードが検出されると自動的に適用されます。</p>
              </div>
            )}
          </div>

          {/* 全体記憶 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">全体記憶</h3>
              <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  console.log('再要約ボタンクリック');
                  setIsSummarizing(true);
                  try {
                    console.log('再要約開始 - onAutoSummarize呼び出し');
                    // onAutoSummarizeはメモリが追加されるまで待機する
                    await onAutoSummarize(1);
                    console.log('再要約完了');
                  } catch (error) {
                    console.error('再要約エラー:', error);
                    alert(error instanceof Error ? error.message : '再要約に失敗しました');
                  } finally {
                    setIsSummarizing(false);
                  }
                }}
                disabled={isSummarizing}
                className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 rounded-md text-sm transition-colors"
              >
                <Clock size={16} className={isSummarizing ? 'animate-spin' : ''} />
                <span>{isSummarizing ? '要約中...' : '再要約'}</span>
              </button>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                  className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1 text-sm"
                >
                  <option value="newest">最新順</option>
                  <option value="oldest">古い順</option>
                </select>
              </div>
            </div>

            {/* 検索バー */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="キーワードを入力してください"
                className="w-full bg-gray-700 border border-gray-600 rounded-md pl-10 pr-4 py-2 text-white placeholder-gray-400"
              />
            </div>

            {/* 記憶リスト */}
            <div className="space-y-3">
              {filteredMemories.map((memory) => (
                <div key={memory.id} className="bg-gray-700 rounded-lg p-4 relative">
                  {editingId === memory.id ? (
                    <div>
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full h-32 bg-gray-900 border border-gray-600 rounded-md p-3 resize-none text-white mb-2"
                        maxLength={2000}
                      />
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${editingContent.length > 2000 ? 'text-red-500' : 'text-gray-400'}`}>
                          {editingContent.length} / 2000
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={handleEditCancel}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-md text-sm"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={handleEditSave}
                            disabled={isSaving || editingContent.length > 2000}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-500 rounded-md text-sm"
                          >
                            {isSaving ? '保存中...' : '保存'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {memory.messageRange ? (
                            <span className="text-purple-400 font-semibold">
                              {memory.messageRange.start}-{memory.messageRange.end}
                            </span>
                          ) : (
                            <span className="text-gray-500 font-semibold">-</span>
                          )}
                          <span className="text-gray-400 text-sm">#{memory.index}</span>
                          <span className="text-gray-500 text-xs">
                            {new Date(memory.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setShowMenuId(showMenuId === memory.id ? null : memory.id)}
                            className="p-1 hover:bg-gray-600 rounded-full"
                          >
                            <MoreVertical size={20} />
                          </button>
                          {showMenuId === memory.id && (
                            <div className="absolute right-0 top-8 bg-gray-800 border border-gray-600 rounded-md shadow-lg z-10 min-w-[120px]">
                              <button
                                onClick={() => {
                                  handleEditStart(memory);
                                  setShowMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete(memory.id)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-red-400"
                              >
                                削除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* ▼▼▼【追加】キーワード表示 */}
                      {memory.keywords && memory.keywords.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-2">
                          {memory.keywords.slice(0, 8).map((keyword, kIdx) => (
                            <span key={kIdx} className="bg-gray-600/50 text-gray-300 px-2 py-0.5 rounded text-xs border border-gray-500">
                              {keyword}
                            </span>
                          ))}
                          {memory.keywords.length > 8 && (
                            <span className="text-gray-400 text-xs">+{memory.keywords.length - 8}</span>
                          )}
                        </div>
                      )}
                      {/* ▲▲▲ */}
                      <p className="text-gray-300 line-clamp-3">{memory.content}</p>
                    </>
                  )}
                </div>
              ))}
            </div>

            {filteredMemories.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                {searchQuery ? '検索結果が見つかりませんでした' : '記憶がありません'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

