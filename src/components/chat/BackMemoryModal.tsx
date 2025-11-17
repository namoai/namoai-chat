import React, { useState, useEffect } from 'react';
import { X, Edit2, Save, XCircle } from 'lucide-react';

type BackMemoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  chatId: number;
  initialContent?: string;
  autoSummarize?: boolean;
  onSave: (content: string, autoSummarize: boolean) => Promise<void>;
};

export default function BackMemoryModal({
  isOpen,
  onClose,
  chatId,
  initialContent = '',
  autoSummarize: initialAutoSummarize = true,
  onSave,
}: BackMemoryModalProps) {
  const [content, setContent] = useState(initialContent);
  const [autoSummarize, setAutoSummarize] = useState(initialAutoSummarize);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [editContent, setEditContent] = useState(initialContent);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setAutoSummarize(initialAutoSummarize);
      setEditContent(initialContent);
      setIsEditing(false);
    }
  }, [isOpen, initialContent, initialAutoSummarize]);

  const handleEdit = () => {
    setEditContent(content);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (editContent.length > 3000) return;
    setIsSaving(true);
    try {
      await onSave(editContent, autoSummarize);
      setContent(editContent);
      setIsEditing(false);
    } catch (error) {
      console.error('保存エラー:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoSummarize = async () => {
    setIsSummarizing(true);
    try {
      const response = await fetch(`/api/chat/${chatId}/back-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('自動要約に失敗しました');
      const data = await response.json();
      const newContent = data.summary || '';
      setContent(newContent);
      setEditContent(newContent);
      await onSave(newContent, autoSummarize);
    } catch (error) {
      console.error('自動要約エラー:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-gray-800 text-white rounded-lg w-full max-w-[95vw] sm:max-w-[90vw] lg:max-w-[85vw] xl:max-w-[80vw] h-[90vh] flex flex-col shadow-2xl mx-auto" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div className="flex-1">
            <h2 className="text-2xl font-bold">メモリブック</h2>
            <p className="text-sm text-gray-400 mt-1">
              会話履歴が自動的に要約され、キャラクターがより長く記憶できるようになります。
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* 説明セクション */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/30 overflow-y-auto max-h-[200px]">
          <details className="cursor-pointer" open>
            <summary className="text-sm font-semibold text-gray-300 hover:text-white mb-2">
              📚 メモリブックとは？（クリックで折りたたむ）
            </summary>
            <div className="mt-2 p-3 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50">
              <p className="text-xs text-gray-400 leading-relaxed mb-2">
                会話の重要な内容を要約して保存する機能です。長い会話でも、キャラクターが過去の重要な出来事や情報を覚えていられます。
              </p>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong className="text-gray-300">自動要約:</strong> 最初の10メッセージは毎回、その後は5メッセージごとに自動要約</p>
                <p><strong className="text-gray-300">手動編集:</strong> 要約内容を手動で編集・追加可能</p>
                <p><strong className="text-gray-300">常時適用:</strong> 保存された内容は今後の会話で常に参照されます</p>
              </div>
            </div>
          </details>
        </div>

        {/* 自動要約セクション */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/20">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-200">自動要約機能</p>
                <span className="text-xs bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full">推奨</span>
              </div>
              <p className="text-xs text-gray-400">
                会話内容を自動的に要約して保存します（最初の10メッセージは毎回、その後は5メッセージごと）
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
              <input
                type="checkbox"
                checked={autoSummarize}
                onChange={(e) => setAutoSummarize(e.target.checked)}
                disabled={isEditing}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-pink-500 peer-checked:to-purple-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>

        {/* 内容エリア */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-semibold text-gray-200">
              メモリブックの内容 <span className="text-red-500">*</span>
            </label>
            {!isEditing && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-blue-500/30 flex-shrink-0 ml-4"
              >
                <Edit2 size={16} />
                編集
              </button>
            )}
          </div>
          
          {isEditing ? (
            <div className="relative">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="メモリブックの内容を入力してください。"
                className="w-full h-[500px] bg-gray-900 border border-gray-700 rounded-md p-4 resize-none text-white placeholder-gray-500 text-sm"
                maxLength={3000}
              />
              <div className={`absolute bottom-4 right-4 text-sm ${editContent.length > 3000 ? 'text-red-500' : 'text-gray-400'}`}>
                {editContent.length} / 3000
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="w-full h-[400px] sm:h-[500px] bg-gray-900 border border-gray-700 rounded-md p-4 overflow-y-auto">
                <p className="text-white whitespace-pre-wrap text-sm leading-relaxed">
                  {content || <span className="text-gray-500">内容がありません。自動要約ボタンを押すか、編集ボタンで入力してください。</span>}
                </p>
              </div>
              {content && (
                <div className="absolute bottom-4 right-4 text-sm text-gray-400">
                  {content.length} / 3000
                </div>
              )}
            </div>
          )}
        </div>

        {/* ボタン */}
        <div className="p-4 border-t border-gray-700 flex flex-col gap-3">
          {isEditing ? (
            <>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-700/50 hover:bg-gray-600/50 disabled:bg-gray-500/50 text-white font-semibold py-3 px-4 rounded-lg transition-all border border-gray-600/50"
                >
                  <XCircle size={20} />
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || editContent.length > 3000}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/50"
                >
                  <Save size={20} />
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleAutoSummarize}
              disabled={isSummarizing}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/50"
            >
              {isSummarizing ? '要約中...' : '今すぐ自動要約を実行'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

