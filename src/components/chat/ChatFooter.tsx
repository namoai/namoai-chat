// src/components/chat/ChatFooter.tsx
import React, { forwardRef } from 'react';
import { Send } from 'lucide-react';

interface ChatFooterProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  handleSendMessage: (e: React.FormEvent) => void;
  wrapSelection: (left: string, right: string) => void;
}

/**
 * チャット画面のフッター（入力欄）コンポーネント
 */
const ChatFooter = forwardRef<HTMLTextAreaElement, ChatFooterProps>(({
  input, setInput, isLoading, handleSendMessage, wrapSelection
}, ref) => {
  return (
    <footer className="p-3 border-t border-gray-700 bg-black/50 backdrop-blur-sm sticky bottom-0">
      {/* 入力補助ツールバー */}
      <div className="mb-2 flex items-center gap-2 text-sm">
        <button type="button" onClick={() => wrapSelection("「", "」")} className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700" title="セリフ">
          「」
        </button>
        <button type="button" onClick={() => wrapSelection("```\n", "\n```")} className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700" title="状態窓">
          ```
        </button>
      </div>

      {/* メッセージ入力フォーム */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <textarea
          ref={ref}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力"
          disabled={isLoading}
          className="flex-1 bg-gray-800 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-pink-500 disabled:opacity-50 resize-none"
          rows={3}
          style={{ minHeight: '3rem', maxHeight: '10rem' }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
        />
        <button type="submit" disabled={isLoading || !input.trim()} className="bg-pink-600 hover:bg-pink-700 rounded-full p-2 disabled:opacity-50">
          <Send size={24} className="text-white" />
        </button>
      </form>
    </footer>
  );
});

ChatFooter.displayName = 'ChatFooter';
export default ChatFooter;
