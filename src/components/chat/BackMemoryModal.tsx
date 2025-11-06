import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setAutoSummarize(initialAutoSummarize);
    }
  }, [isOpen, initialContent, initialAutoSummarize]);

  const handleSave = async () => {
    if (content.length > 3000) return;
    setIsSaving(true);
    try {
      await onSave(content, autoSummarize);
      onClose();
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
      setContent(data.summary || '');
    } catch (error) {
      console.error('自動要約エラー:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-800 text-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col m-4" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">メモリブック</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full">
            <X size={24} />
          </button>
        </div>

        {/* 説明 */}
        <div className="p-4 border-b border-gray-700">
          <p className="text-sm text-gray-300">
            会話履歴が自動的に要約され、キャラクターがより長く記憶できるようになります。
          </p>
          <a href="#" className="text-sm text-blue-400 hover:underline mt-1 inline-block">
            もっと知る &gt;
          </a>
        </div>

        {/* 自動要約セクション */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-300">会話内容を自動的に要約します</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoSummarize}
              onChange={(e) => setAutoSummarize(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>

        {/* 内容エリア */}
        <div className="flex-1 p-4 overflow-y-auto">
          <label className="block text-sm font-medium mb-2">
            内容 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="メモリブックの内容を入力してください。"
              className="w-full h-64 bg-gray-900 border border-gray-700 rounded-md p-3 resize-none text-white placeholder-gray-500"
              maxLength={3000}
            />
            <div className={`absolute bottom-2 right-2 text-sm ${content.length > 3000 ? 'text-red-500' : 'text-gray-400'}`}>
              {content.length} / 3000
            </div>
          </div>
        </div>

        {/* ボタン */}
        <div className="p-4 border-t border-gray-700 flex gap-2">
          <button
            onClick={handleAutoSummarize}
            disabled={isSummarizing}
            className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            {isSummarizing ? '要約中...' : '自動要約'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || content.length > 3000}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

