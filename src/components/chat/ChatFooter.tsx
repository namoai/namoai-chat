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
    <footer className="p-4 border-t border-gray-800/50 bg-gray-900/50 backdrop-blur-xl sticky bottom-0">
      {/* メッセージ入力フォーム */}
      <form onSubmit={handleSendMessage} className="flex items-end gap-3">
        <div className="flex-1 relative">
          <div className="mb-2 flex items-center gap-2">
            <button 
              type="button" 
              onClick={() => wrapSelection("「", "」")} 
              className="px-3 py-1.5 rounded-lg bg-gray-800/50 hover:bg-blue-500/10 hover:text-blue-400 text-gray-400 text-sm font-medium transition-all border border-gray-700/50 hover:border-blue-500/30" 
              title="セリフ"
            >
              「」
            </button>
          </div>
          <textarea
            ref={ref}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={isLoading}
            className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 resize-none text-white placeholder-gray-500 transition-all"
            rows={3}
            style={{ minHeight: '3rem', maxHeight: '10rem' }}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
        </div>
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()} 
          className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 rounded-xl p-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50"
        >
          <Send size={24} className="text-white" />
        </button>
      </form>
    </footer>
  );
});

ChatFooter.displayName = 'ChatFooter';
export default ChatFooter;
