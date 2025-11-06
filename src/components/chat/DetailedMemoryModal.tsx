import React, { useState } from 'react';
import { X, Search, MoreVertical, Clock } from 'lucide-react';

type DetailedMemory = {
  id: number;
  content: string;
  keywords: string[];
  createdAt: string;
  lastApplied?: string;
  index: number; // 1-3のインデックス
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

  // 最近適用されたメモリを取得
  const recentlyApplied = memories
    .filter(m => m.lastApplied)
    .sort((a, b) => new Date(b.lastApplied || 0).getTime() - new Date(a.lastApplied || 0).getTime())[0];

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-gray-800 text-white rounded-lg w-full max-w-4xl sm:max-w-5xl lg:max-w-7xl xl:max-w-[90vw] h-[85vh] sm:h-[90vh] flex flex-col shadow-2xl mx-auto" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold">詳細記憶</h2>
            <p className="text-sm text-gray-400 mt-1">無制限に保存できます。関連キーワードで自動的に適用され、適用時は最大3つまでです。</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* 最近適用された記憶 */}
          {recentlyApplied && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">最近適用された記憶</h3>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-purple-400 font-semibold">{recentlyApplied.index}-10</span>
                  <span className="text-white">{recentlyApplied.index}</span>
                </div>
                <p className="text-gray-300 line-clamp-2">{recentlyApplied.content}</p>
              </div>
            </div>
          )}

          {/* 全体記憶 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">全体記憶</h3>
              <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setIsSummarizing(true);
                  try {
                    await onAutoSummarize(1);
                  } catch (error) {
                    console.error('再要約エラー:', error);
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
                          <span className="text-purple-400 font-semibold">{memory.index}-10</span>
                          <span className="text-white">{memory.index}</span>
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

