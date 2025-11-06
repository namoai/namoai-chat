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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 text-white rounded-lg w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold">メモリブック</h2>
            <p className="text-sm text-gray-400 mt-1">
              会話履歴が自動的に要約され、キャラクターがより長く記憶できるようになります。
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* 自動要約セクション */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between bg-gray-750">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-300">会話内容を自動的に要約します</p>
            <p className="text-xs text-gray-500 mt-1">メッセージが20件、40件、60件...になるたびに自動要約されます</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoSummarize}
              onChange={(e) => setAutoSummarize(e.target.checked)}
              disabled={isEditing}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-disabled:opacity-50"></div>
          </label>
        </div>

        {/* 内容エリア */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-medium">
              内容 <span className="text-red-500">*</span>
            </label>
            {!isEditing && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
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
            <div className="w-full h-[500px] bg-gray-900 border border-gray-700 rounded-md p-4 overflow-y-auto">
              <p className="text-white whitespace-pre-wrap text-sm leading-relaxed">
                {content || <span className="text-gray-500">内容がありません。自動要約ボタンを押すか、編集ボタンで入力してください。</span>}
              </p>
            </div>
          )}
        </div>

        {/* ボタン */}
        <div className="p-6 border-t border-gray-700 flex gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-md transition-colors"
              >
                <XCircle size={20} />
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || editContent.length > 3000}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-md transition-colors"
              >
                <Save size={20} />
                {isSaving ? '保存中...' : '保存'}
              </button>
            </>
          ) : (
            <button
              onClick={handleAutoSummarize}
              disabled={isSummarizing}
              className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-md transition-colors"
            >
              {isSummarizing ? '要約中...' : '今すぐ自動要約を実行'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

