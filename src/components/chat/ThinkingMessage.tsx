// src/components/chat/ThinkingMessage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface ThinkingMessageProps {
  content: string;
  /** ストリーミング中は自動的に開いて内容を見せるためのフラグ */
  forceOpen?: boolean;
}

/**
 * AIの思考プロセスを折りたたみ表示するコンポーネント
 * - ストリーム中(forceOpen=true)は常に展開
 * - ストリーム終了時(forceOpen=false)は自動で閉じる（内容は保持）
 * - ユーザー手動の開閉も可能（ただしストリーム中はロック）
 */
const ThinkingMessage: React.FC<ThinkingMessageProps> = ({ content, forceOpen = false }) => {
  // ※ 既定は props に追従
  const [isOpen, setIsOpen] = useState<boolean>(!!forceOpen);

  // ストリーム状態のロック（open を固定）
  const lockedByStreaming = !!forceOpen;

  // 初回以降、forceOpen の変化に同期（true→開く / false→閉じる）
  useEffect(() => {
    setIsOpen(!!forceOpen);
  }, [forceOpen]);

  // <details> の open 制御を安定させるための key（閉じるタイミングで再マウントし確実に閉じる）
  // - ネイティブの <details> は一度 open になると属性だけでは閉じが反映されないケースがあるため、key を使って再マウントを強制する
  const detailsKey = useMemo(() => (isOpen ? 'open' : 'closed'), [isOpen]);

  // ▼▼▼【修正】親コンポーネントが表示を制御するため、'...' のフォールバックは不要 ▼▼▼
  const displayText = content;

  // details の onToggle ハンドラ
  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    // ストリーミング中はユーザーの操作を無効化して必ず開いたままにする
    if (lockedByStreaming) {
      // ネイティブ toggle を元に戻すため、即時に open=true を強制
      (e.currentTarget as HTMLDetailsElement).open = true;
      setIsOpen(true);
      return;
    }
    setIsOpen((e.currentTarget as HTMLDetailsElement).open);
  };

  // summary クリック時のロック制御（UX向上）
  const onSummaryClick: React.MouseEventHandler<HTMLElement> = (e) => {
    if (lockedByStreaming) {
      e.preventDefault(); // ストリーム中は閉じられない
    }
  };

  return (
    <div className="flex items-start">
      <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded-xl max-w-xs md:max-w-md lg:max-w-2xl w-full">
        <details key={detailsKey} className="text-sm text-gray-400 group" open={isOpen} onToggle={onToggle}>
          <summary className="p-3 flex items-center cursor-pointer list-none select-none" onClick={onSummaryClick}>
            <ChevronRight
              size={16}
              className="mr-2 transition-transform duration-200 group-open:rotate-90"
            />
            {/* ストリーム中は分かりやすく「思考中…」を表示。終了後は通常のラベルに戻す */}
            <span className="font-semibold">
              {lockedByStreaming ? '思考中…（クリックで隠せません）' : (isOpen ? '思考を隠す' : '思考プロセスを表示')}
            </span>
          </summary>

          <div className="px-4 pb-3 pt-1 border-t border-gray-700/50">
            {/* アクセシビリティ: 進行中は読み上げを抑制、完了後は既存のテキストとして扱う */}
            <div className="whitespace-pre-wrap opacity-80 break-words" aria-live={lockedByStreaming ? 'off' : 'polite'}>
              {displayText}
              {/* ▼▼▼【修正】ローディングインジケーターは外部 (ChatMessageList) に移動したため、ここでのパルスアニメーションは削除 ▼▼▼ */}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default ThinkingMessage;

