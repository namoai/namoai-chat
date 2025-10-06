// src/components/chat/ChatMessageList.tsx
import React, { useEffect, useRef } from 'react';
import { Edit3, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import ChatMessageParser from '@/components/ChatMessageParser';
import type { Turn, Message, CharacterInfo, CharacterImageInfo } from '@/types/chat';

interface ChatMessageListProps {
  isNewChatSession: boolean;
  characterInfo: CharacterInfo;
  turns: Turn[];
  isLoading: boolean;
  editingMessageId: number | null;
  editingUserContent: string;
  editingModelContent: string;
  setEditingUserContent: (content: string) => void;
  setEditingModelContent: (content: string) => void;
  handleEditStart: (message: Message) => void;
  handleEditCancel: () => void;
  handleEditSave: () => void;
  handleDelete: (messageId: number) => void;
  handleRegenerate: (turn: Turn) => void;
  switchModelMessage: (turnId: number, direction: 'next' | 'prev') => void;
  prioritizeImagesByKeyword: (userText: string, allImages: CharacterImageInfo[]) => CharacterImageInfo[];
  showChatImage: boolean;
  isMultiImage: boolean;
  setLightboxImage: (url: string | null) => void;
}

/**
 * メッセージ編集用のテキストエリアコンポーネント
 * @param value - テキストエリアの値
 * @param onChange - 値が変更されたときのコールバック
 * @param onSave - 保存ボタンがクリックされたときのコールバック
 * @param onCancel - キャンセルボタンがクリックされたときのコールバック
 */
const EditableTextarea: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ value, onChange, onSave, onCancel }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-none focus:ring-0 resize-none p-0"
        rows={1}
      />
      <div className="flex justify-end items-center gap-2 mt-2">
        <button onClick={onCancel} className="text-xs text-gray-400 hover:underline">
          キャンセル
        </button>
        <button onClick={onSave} className="text-xs text-pink-400 hover:underline">
          保存
        </button>
      </div>
    </div>
  );
};

/**
 * チャットの会話履歴を表示するコンポーネント
 */
const ChatMessageList: React.FC<ChatMessageListProps> = ({
  isNewChatSession, characterInfo, turns, isLoading, editingMessageId,
  editingUserContent, editingModelContent, setEditingUserContent, setEditingModelContent,
  handleEditStart, handleEditCancel, handleEditSave, handleDelete, handleRegenerate, switchModelMessage,
  prioritizeImagesByKeyword, showChatImage, isMultiImage, setLightboxImage,
}) => {
  return (
    <>
      {/* --- イントロダクション --- */}
      {isNewChatSession && (characterInfo.firstSituation || characterInfo.firstMessage) && (
        <div className="space-y-3">
          {characterInfo.firstSituation && (
            <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3">
              <p className="text-gray-400 whitespace-pre-wrap">{characterInfo.firstSituation}</p>
            </div>
          )}
          {characterInfo.firstMessage && (
            <div className="bg-gray-800 rounded-xl p-3">
              <ChatMessageParser
                content={characterInfo.firstMessage}
                characterImages={characterInfo.characterImages.slice(1)}
                showImage={showChatImage}
                isMultiImage={isMultiImage}
                onImageClick={setLightboxImage}
              />
            </div>
          )}
        </div>
      )}

      {/* --- 会話ターン --- */}
      {turns.map((turn, turnIndex) => {
        const userMsg = turn.userMessage;
        const isEditingUser = editingMessageId === userMsg.id;
        const prioritizedImages = prioritizeImagesByKeyword(userMsg.content, characterInfo.characterImages);

        return (
          <div key={turn.turnId} className="space-y-4">
            {/* ユーザーメッセージ */}
            <div className="flex flex-col items-end group">
              <div className="flex items-center gap-2">
                {!isEditingUser && (
                  <div className="flex items-center self-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(userMsg.id)} className="p-1 hover:text-red-500"><Trash2 size={16} /></button>
                    <button onClick={() => handleEditStart(userMsg)} className="p-1 hover:text-pink-400"><Edit3 size={16} /></button>
                  </div>
                )}
                <div style={{ backgroundColor: "var(--user-bubble-color)", color: "var(--user-bubble-text-color)" }} className="max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-xl">
                  {isEditingUser ? (
                    <EditableTextarea
                      value={editingUserContent}
                      onChange={setEditingUserContent}
                      onSave={handleEditSave}
                      onCancel={handleEditCancel}
                    />
                  ) : (
                    // ▼▼▼【修正】ユーザーメッセージにもChatMessageParserを適用 ▼▼▼
                    <ChatMessageParser
                      content={userMsg.content}
                      characterImages={[]} // ユーザーメッセージは画像を持たない
                      showImage={false}
                      isMultiImage={false}
                      onImageClick={() => {}}
                    />
                  )}
                </div>
              </div>
              {!isEditingUser && (
                <div className="flex items-center gap-2 mt-1 px-1 self-end">
                  <span className="text-xs text-gray-400">{userMsg.timestamp}</span>
                </div>
              )}
            </div>

            {/* AIメッセージ */}
            {turn.modelMessages.length > 0 && (() => {
              const activeModelMessage = turn.modelMessages[turn.activeModelIndex];
              const isEditingModel = editingMessageId === activeModelMessage.id;
              return (
                <div className="flex flex-col items-start group">
                  <div className="bg-gray-800 px-4 py-2 rounded-xl max-w-xs md:max-w-md lg:max-w-2xl">
                    {isEditingModel ? (
                      <EditableTextarea
                        value={editingModelContent}
                        onChange={setEditingModelContent}
                        onSave={handleEditSave}
                        onCancel={handleEditCancel}
                      />
                    ) : (
                      <ChatMessageParser
                        content={activeModelMessage.content}
                        characterImages={prioritizedImages}
                        showImage={showChatImage}
                        isMultiImage={isMultiImage}
                        onImageClick={setLightboxImage}
                      />
                    )}
                  </div>
                  {!isEditingModel && (
                    <div className="flex items-center justify-between w-full max-w-xs md:max-w-md lg:max-w-2xl mt-1 h-6 text-gray-400">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditStart(activeModelMessage)} className="p-1 hover:text-pink-400"><Edit3 size={14} /></button>
                        <button onClick={() => handleDelete(activeModelMessage.id)} className="p-1 hover:text-red-500"><Trash2 size={14} /></button>
                        {turnIndex === turns.length - 1 && (
                          <button onClick={() => handleRegenerate(turn)} className="p-1 hover:text-green-400"><RefreshCw size={14} /></button>
                        )}
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
              );
            })()}
          </div>
        );
      })}

      {/* --- ローディング表示 --- */}
      {isLoading && (
        <div className="flex items-start">
          <div className="bg-gray-800 px-4 py-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatMessageList;

