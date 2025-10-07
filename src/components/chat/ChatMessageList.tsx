// src/components/chat/ChatMessageList.tsx
import React from 'react';
import { Edit3, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Turn, CharacterInfo } from '@/types/chat';

// ▼▼▼【修正】ファイル内で使用される型定義を追加 ▼▼▼
type CharacterImageInfo = {
  imageUrl: string;
  keyword?: string | null;
};

// =========================================================
//  コンポーネントのインポート（プレビュー環境でのエラー回避のため内部に定義）
// =========================================================

// --- ChatMessageParser.tsx から ---
// 注意：プレビュー環境では 'next/image' が使えないため、標準の <img> タグに置き換えています。
// 実際のプロジェクトでは 'next/image' を使用してください。
// ▼▼▼【修正】ChatMessageParser のプロップスに型を明示的に指定 ▼▼▼
type InlinedChatMessageParserProps = {
  content: string;
  characterImages: CharacterImageInfo[];
  showImage: boolean;
  isMultiImage: boolean;
  onImageClick?: (url: string) => void;
};

const ChatMessageParser: React.FC<InlinedChatMessageParserProps> = ({ content, characterImages, showImage, isMultiImage, onImageClick }) => {
  const regex = /(\*.*?\*)|(「.*?」)|(!\[.*?\]\(.*?\))|(\{img:\d+\})/g;
  const parts = content.split(regex).filter(Boolean);
  let imageRendered = false;

  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part: string, index: number) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          return <span key={`narration-${index}`} className="text-gray-400 italic">{part.substring(1, part.length - 1)}</span>;
        }
        if (part.startsWith('「') && part.endsWith('」')) {
          return <span key={`dialogue-${index}`} className="font-semibold text-white">{part}</span>;
        }
        const externalImageMatch = part.match(/!\[.*?\]\((.*?)\)/);
        if (externalImageMatch) {
          const imageUrl = externalImageMatch[1];
          return (
            <div key={`ext-img-${index}`} className="relative my-2 w-full max-w-md rounded-lg overflow-hidden shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="外部画像" className="object-contain cursor-zoom-in" onClick={() => onImageClick?.(imageUrl)} />
            </div>
          );
        }
        const internalImageMatch = part.match(/\{img:(\d+)\}/);
        if (showImage && internalImageMatch) {
          if (!isMultiImage && imageRendered) return null;
          const n = parseInt(internalImageMatch[1], 10);
          const image = characterImages[n - 1];
          if (image) {
            imageRendered = true;
            return (
              <div key={`int-img-${index}`} className="relative my-2 w-full max-w-xs rounded-lg overflow-hidden shadow-lg">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.imageUrl} alt={image.keyword || `キャラクター画像 ${n}`} className="object-contain cursor-zoom-in" onClick={() => onImageClick?.(image.imageUrl)} />
              </div>
            );
          }
        }
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </div>
  );
};

// --- ThinkingMessage.tsx から ---
const ThinkingMessage: React.FC<any> = ({ content, forceOpen = false }) => {
  const [isOpen, setIsOpen] = React.useState<boolean>(!!forceOpen);
  const lockedByStreaming = !!forceOpen;

  React.useEffect(() => { setIsOpen(!!forceOpen); }, [forceOpen]);

  const detailsKey = React.useMemo(() => (isOpen ? 'open' : 'closed'), [isOpen]);
  const displayText = content;

  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (lockedByStreaming) {
      (e.currentTarget as HTMLDetailsElement).open = true;
      setIsOpen(true);
      return;
    }
    setIsOpen((e.currentTarget as HTMLDetailsElement).open);
  };

  const onSummaryClick: React.MouseEventHandler<HTMLElement> = (e) => {
    if (lockedByStreaming) e.preventDefault();
  };

  return (
    <div className="flex items-start">
      <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded-xl max-w-xs md:max-w-md lg:max-w-2xl w-full">
        <details key={detailsKey} className="text-sm text-gray-400 group" open={isOpen} onToggle={onToggle}>
          <summary className="p-3 flex items-center cursor-pointer list-none select-none" onClick={onSummaryClick}>
            <ChevronRight size={16} className="mr-2 transition-transform duration-200 group-open:rotate-90" />
            <span className="font-semibold">{lockedByStreaming ? '思考中…' : (isOpen ? '思考を隠す' : '思考プロセスを表示')}</span>
          </summary>
          <div className="px-4 pb-3 pt-1 border-t border-gray-700/50">
            <div className="whitespace-pre-wrap opacity-80 break-words min-h-[2rem] flex items-center" aria-live={lockedByStreaming ? 'off' : 'polite'}>
              {displayText ? (
                displayText
              ) : (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '-0.3s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '-0.15s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

// =========================================================
//  props とメインコンポーネントの定義
// =========================================================

type ChatMessageListProps = {
  isNewChatSession: boolean;
  characterInfo: CharacterInfo;
  turns: Turn[];
  isLoading: boolean;
  editingMessageId: number | null;
  editingUserContent: string;
  editingModelContent: string;
  setEditingUserContent: (v: string) => void;
  setEditingModelContent: (v: string) => void;
  handleEditStart: (msg: any) => void;
  handleEditCancel: () => void;
  handleEditSave: () => void;
  handleDelete: (messageId: number) => void;
  handleRegenerate: (turn: Turn) => void;
  switchModelMessage: (turnId: number, dir: 'prev' | 'next') => void;
  prioritizeImagesByKeyword: (text: string, images: CharacterInfo['characterImages']) => CharacterInfo['characterImages'];
  showChatImage: boolean;
  isMultiImage: boolean;
  setLightboxImage: (url: string) => void;
};

type FallbackEditableProps = {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

const EditableTextarea: React.FC<FallbackEditableProps> = ({ value, onChange, onSave, onCancel }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        className="w-full bg-gray-700 text-white rounded-lg p-2 outline-none resize-none overflow-hidden"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={1}
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-sm">キャンセル</button>
        <button onClick={onSave} className="px-3 py-1 rounded bg-pink-600 hover:bg-pink-500 text-sm">保存</button>
      </div>
    </div>
  );
};

const THINK_TAGS = ['thinking', 'reasoning', 'thought', 'scratchpad'];

function splitContentForRender(raw: string): { visible: string; thinking: string } {
  if (!raw) return { visible: '', thinking: '' };
  let visible = raw;
  let thinkingCollected = '';

  for (const tag of THINK_TAGS) {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    visible = visible.replace(re, (_m, inner: string) => { thinkingCollected += inner; return ''; });
  }
  for (const tag of THINK_TAGS) {
    const reOpenOnly = new RegExp(`<${tag}>([\\s\\S]*)$`, 'i');
    const match = visible.match(reOpenOnly);
    if (match) { thinkingCollected += match[1]; visible = visible.replace(reOpenOnly, ''); }
  }
  for (const tag of THINK_TAGS) {
    const reOpen = new RegExp(`<${tag}>`, 'gi');
    const reClose = new RegExp(`</${tag}>`, 'gi');
    visible = visible.replace(reOpen, '').replace(reClose, '');
  }
  return { visible: visible.trim(), thinking: thinkingCollected.trim() };
}

function getFirstSituationText(ci: CharacterInfo): string {
  const anyCI: any = ci as any;
  return (anyCI.firstSituation || anyCI.first_situation || anyCI.initialSituation || anyCI.initial_situation || anyCI.scenario || anyCI.description || anyCI.intro || '');
}
function getFirstDialogueText(ci: CharacterInfo): string {
  const anyCI: any = ci as any;
  return (anyCI.firstDialogue || anyCI.first_dialogue || anyCI.firstMessage || anyCI.first_message || anyCI.greeting || anyCI.openingLine || anyCI.opening_line || anyCI.initialMessage || anyCI.initial_message || anyCI.firstReply || anyCI.first_reply || '');
}
function toAllBold(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.startsWith('**') && trimmed.endsWith('**') ? trimmed : `**${trimmed}**`;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  isNewChatSession,
  characterInfo,
  turns,
  isLoading,
  editingMessageId,
  editingUserContent,
  editingModelContent,
  setEditingUserContent,
  setEditingModelContent,
  handleEditStart,
  handleEditCancel,
  handleEditSave,
  handleDelete,
  handleRegenerate,
  switchModelMessage,
  prioritizeImagesByKeyword,
  showChatImage,
  isMultiImage,
  setLightboxImage,
}) => {
  const isFirstScreen = isNewChatSession && turns.length === 0;
  const firstSituation = getFirstSituationText(characterInfo);
  const firstDialogue  = getFirstDialogueText(characterInfo);
  const showFirstImages = false;

  return (
    <div className="flex flex-col gap-6">
      {isFirstScreen && (
        <div className="flex flex-col items-start gap-3">
          {firstSituation && (
            <div className="bg-gray-900 px-4 py-3 rounded-2xl max-w-[80%] first-situation-bubble text-gray-400">
              <ChatMessageParser content={toAllBold(firstSituation)} characterImages={[]} showImage={false} isMultiImage={false} />
            </div>
          )}
          {firstDialogue && (
            <div className="bg-gray-800 px-4 py-3 rounded-2xl max-w-[80%]">
              <ChatMessageParser content={firstDialogue} characterImages={[]} showImage={false} isMultiImage={false} />
            </div>
          )}
          {showFirstImages && showChatImage && (characterInfo.characterImages?.length ?? 0) > 0 && (
            <div className={`grid ${isMultiImage ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'} gap-3`}>
              {/* ▼▼▼【修正】'img' パラメータに CharacterImageInfo 型を明示的に指定 ▼▼▼ */}
              {(characterInfo.characterImages ?? []).slice(0, isMultiImage ? 3 : 1).map((img: CharacterImageInfo, i: number) => (
                <div key={`first-img-${i}`} className="overflow-hidden rounded-lg">
                  <img src={img.imageUrl} alt={`image-${i}`} className="w-40 h-40 object-cover cursor-pointer" onClick={() => setLightboxImage(img.imageUrl)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {turns.map((turn, turnIndex) => {
        const userMsg = turn.userMessage;
        const activeModelMessage = turn.modelMessages.find((m) => m.isActive);
        const isLastTurn = turnIndex === turns.length - 1;
        const prioritizedImages = prioritizeImagesByKeyword(userMsg.content, characterInfo.characterImages);

        return (
          <div key={turn.turnId} className="space-y-3">
            <div className="flex justify-end">
              <div className="px-4 py-2 rounded-2xl max-w-[80%] user-bubble" style={{ backgroundColor: 'var(--user-bubble-color)', color: 'var(--user-bubble-text-color)' }}>
                {editingMessageId === userMsg.id ? (
                  <EditableTextarea value={editingUserContent} onChange={setEditingUserContent} onSave={handleEditSave} onCancel={handleEditCancel} />
                ) : (
                  <ChatMessageParser content={userMsg.content} characterImages={[]} showImage={false} isMultiImage={false} />
                )}
                {userMsg.timestamp && (<div className="text-[11px] opacity-80 mt-1 text-right">{userMsg.timestamp}</div>)}
              </div>
            </div>

            {activeModelMessage && (() => {
              const { visible, thinking } = splitContentForRender(activeModelMessage.content || '');
              const thinkingToShow = (activeModelMessage.thinkingText && activeModelMessage.thinkingText.length > 0) ? activeModelMessage.thinkingText : thinking;
              const hasThinkingText = thinkingToShow && thinkingToShow.length > 0;
              const showThinkingBox = (isLastTurn && isLoading) || hasThinkingText;
              const shouldRenderBody = (visible && visible.length > 0) || (showChatImage && (prioritizedImages?.length ?? 0) > 0) || (editingMessageId === activeModelMessage.id);

              return (
                <>
                  {showThinkingBox && (
                    <div className="flex justify-start">
                      <ThinkingMessage content={thinkingToShow} forceOpen={isLastTurn && isLoading} />
                    </div>
                  )}
                  {shouldRenderBody && (
                    <div className="flex flex-col items-start group w-full">
                      <div className="bg-gray-800 px-4 py-2 rounded-2xl max-w-[80%]">
                        {editingMessageId === activeModelMessage.id ? (
                          <EditableTextarea value={editingModelContent} onChange={setEditingModelContent} onSave={handleEditSave} onCancel={handleEditCancel} />
                        ) : (
                          <ChatMessageParser content={visible} characterImages={prioritizedImages} showImage={showChatImage} isMultiImage={isMultiImage} onImageClick={setLightboxImage} />
                        )}
                        {activeModelMessage.timestamp && (<div className="text-[11px] text-gray-400 mt-1">{activeModelMessage.timestamp}</div>)}
                      </div>
                      {editingMessageId !== activeModelMessage.id && (
                        <div className="flex items-center justify-between w-full max-w-[80%] mt-1 h-6 text-gray-400">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditStart(activeModelMessage)} className="p-1 hover:text-pink-400" title="編集"><Edit3 size={14} /></button>
                            <button onClick={() => handleDelete(activeModelMessage.id)} className="p-1 hover:text-red-500" title="削除"><Trash2 size={14} /></button>
                            {isLastTurn && (<button onClick={() => handleRegenerate(turn)} className="p-1 hover:text-green-400" title="再生成"><RefreshCw size={14} /></button>)}
                          </div>
                          {turn.modelMessages.length > 1 && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => switchModelMessage(turn.turnId, 'prev')} className="p-1 rounded-full hover:bg-gray-700"><ChevronLeft size={16} /></button>
                              <span className="text-xs font-mono">{turn.activeModelIndex + 1} / {turn.modelMessages.length}</span>
                              <button onClick={() => switchModelMessage(turn.turnId, 'next')} className="p-1 rounded-full hover:bg-gray-700"><ChevronRight size={16} /></button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        );
      })}

      <style jsx>{`
        .user-bubble :global(strong),
        .user-bubble :global(b) {
          color: rgba(156, 163, 175, 1);
          font-weight: 700;
        }
        .first-situation-bubble :global(strong),
        .first-situation-bubble :global(b) {
          color: rgba(156, 163, 175, 1);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
};

export default ChatMessageList;

