// src/components/chat/ChatMessageList.tsx
import React, { useEffect, useRef } from 'react';
import { Edit3, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import ChatMessageParser from '@/components/ChatMessageParser';
// ▼▼▼【バグ修正】 `Turn`型を再度インポートします。▼▼▼
import type { Turn, Message, CharacterInfo } from '@/types/chat';
// ▼▼▼【修正】CharacterImageInfoは未使用のため削除
// import type { CharacterImageInfo } from '@/types/chat';
// ▲▲▲

interface ChatMessageListProps {
  characterInfo: CharacterInfo;
  rawMessages: Message[];
  // turns: Turn[]; // ★★★【Stale State修正】`turns` propを削除します。
  isLoading: boolean;
  regeneratingTurnId: number | null; // 再生成中のターンIDを追加
  editingMessageId: number | null;
  editingUserContent: string;
  editingModelContent: string;
  setEditingUserContent: (content: string) => void;
  setEditingModelContent: (content: string) => void;
  handleEditStart: (message: Message) => void;
  handleEditCancel: () => void;
  handleEditSave: () => void;
  handleDelete: (messageId: number) => void;
  // ▼▼▼【Stale State修正】`Turn`オブジェクトの代わりに`turnId` (number)を受け取るように修正します。▼▼▼
  handleRegenerate: (turnId: number) => void;
  switchModelMessage: (turnId: number, direction: 'next' | 'prev') => void;
  // ▼▼▼【修正】prioritizeImagesByKeyword propは削除（元の画像順序を維持）
  // prioritizeImagesByKeyword: (userText: string, allImages: CharacterImageInfo[]) => CharacterImageInfo[];
  // ▲▲▲
  showChatImage: boolean;
  isMultiImage: boolean;
  setLightboxImage: (url: string | null) => void;
  userNickname?: string; // {{user}}置換用
}

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

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  characterInfo, rawMessages, isLoading, regeneratingTurnId, editingMessageId,
  editingUserContent, editingModelContent, setEditingUserContent, setEditingModelContent,
  handleEditStart, handleEditCancel, handleEditSave, handleDelete, handleRegenerate, switchModelMessage,
  // ▼▼▼【修正】prioritizeImagesByKeyword propは削除
  // prioritizeImagesByKeyword,
  // ▲▲▲
  showChatImage, isMultiImage, setLightboxImage, userNickname,
  // turns, // ★★★【Stale State修正】`turns` propを受け取りません。
}) => {
  
  // ▼▼▼【Stale State修正】`rawMessages`のみに依存するように`useMemo`を修正します。▼▼▼
  const processedTurns = React.useMemo(() => {
    const userMessages = rawMessages.filter(m => m.role === 'user');
    const modelMessages = rawMessages.filter(m => m.role === 'model');

    // `rawMessages`を基にターンを再構成します。
    return userMessages.map(userMsg => {
      const correspondingModels = modelMessages
        .filter(modelMsg => modelMsg.turnId === userMsg.turnId)
        .sort((a, b) => a.version - b.version);
      
      const activeModel = correspondingModels.find(m => m.isActive) || correspondingModels[correspondingModels.length - 1];
      
      return {
        turnId: userMsg.turnId as number,
        userMessage: userMsg,
        modelMessages: correspondingModels,
        activeModelIndex: activeModel ? correspondingModels.indexOf(activeModel) : -1,
      } as Turn; // `Turn`型にキャスト
    }).filter(turn => turn.userMessage);
  }, [rawMessages]); // ★★★【Stale State修正】`turns`依存性を削除します。
  // ▲▲▲ 修正ここまで ▲▲▲

  return (
    <div>
      {/* 初期状況と初期メッセージを常に表示（チャット形式で統一） */}
      {(characterInfo.firstSituation || characterInfo.firstMessage) && (
        <div className="space-y-4">
          {/* 初期状況（ナレーション風） */}
          {characterInfo.firstSituation && (
            <div className="flex justify-center">
              <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3 max-w-xs md:max-w-md lg:max-w-2xl">
                <div className="text-gray-400 text-sm text-left">
                  <ChatMessageParser
                    content={characterInfo.firstSituation}
                    characterImages={characterInfo.characterImages}
                    showImage={showChatImage}
                    isMultiImage={isMultiImage}
                    onImageClick={setLightboxImage}
                    userNickname={userNickname}
                  />
                </div>
              </div>
            </div>
          )}
          {/* 初期メッセージ（AIの最初の挨拶） */}
          {characterInfo.firstMessage && (
            <div className="flex flex-col items-start">
              <div className="bg-gray-800 px-4 py-2 rounded-xl max-w-xs md:max-w-md lg:max-w-2xl">
                <ChatMessageParser
                  content={characterInfo.firstMessage}
                  characterImages={characterInfo.characterImages}
                  showImage={showChatImage}
                  isMultiImage={isMultiImage}
                  onImageClick={setLightboxImage}
                  userNickname={userNickname}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {processedTurns.map((turn, turnIndex) => {
        const userMsg = turn.userMessage;
        const isEditingUser = editingMessageId === userMsg.id;
        // ▼▼▼【修正】{img:n} タグのパースのために元の順序を維持 (prioritizeImagesByKeywordはインデックス解釈に使用しない)
        // prioritizedImagesは画像表示優先順位決定用だが、{img:n} タグは元の順序基準でパースする必要がある
        // ▲▲▲

        return (
          <div key={turn.turnId || turnIndex} className="space-y-4">
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
                    <ChatMessageParser
                      content={userMsg.content}
                      characterImages={characterInfo.characterImages}
                      showImage={showChatImage}
                      isMultiImage={isMultiImage}
                      onImageClick={setLightboxImage}
                      userNickname={userNickname}
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

            {turn.modelMessages.length > 0 && (() => {
              const activeModelMessage = turn.modelMessages[turn.activeModelIndex];
              if (!activeModelMessage) return null;
              const isEditingModel = editingMessageId === activeModelMessage.id;
              const isRegenerating = regeneratingTurnId === turn.turnId; // このターンが再生成中かどうか
              return (
                <div className="flex flex-col items-start group">
                  <div className="bg-gray-800 px-4 py-2 rounded-xl max-w-xs md:max-w-md lg:max-w-2xl">
                    {isRegenerating ? (
                      <div className="flex items-center gap-2 text-gray-400">
                        <RefreshCw size={16} className="animate-spin" />
                        <span>再生成中...</span>
                      </div>
                    ) : isEditingModel ? (
                      <EditableTextarea
                        value={editingModelContent}
                        onChange={setEditingModelContent}
                        onSave={handleEditSave}
                        onCancel={handleEditCancel}
                      />
                    ) : (
                      <ChatMessageParser
                        content={activeModelMessage.content}
                        characterImages={characterInfo.characterImages}
                        showImage={showChatImage}
                        isMultiImage={isMultiImage}
                        onImageClick={setLightboxImage}
                        userNickname={userNickname}
                      />
                    )}
                  </div>
                  {!isEditingModel && (
                    <div className="flex items-center justify-between w-full max-w-xs md:max-w-md lg:max-w-2xl mt-1 h-6 text-gray-400">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditStart(activeModelMessage)} className="p-1 hover:text-pink-400"><Edit3 size={14} /></button>
                        <button onClick={() => handleDelete(activeModelMessage.id)} className="p-1 hover:text-red-500"><Trash2 size={14} /></button>
                        {/* 全てのターンで再生成ボタンを表示 - ローディング中は回転アニメーション */}
                        <button 
                          onClick={() => handleRegenerate(turn.turnId)} 
                          className={`p-1 hover:text-green-400 ${regeneratingTurnId === turn.turnId ? 'text-green-400' : ''}`}
                          disabled={regeneratingTurnId === turn.turnId}
                        >
                          <RefreshCw size={14} className={regeneratingTurnId === turn.turnId ? 'animate-spin' : ''} />
                        </button>
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

      {isLoading && (() => {
        // 最後のユーザーメッセージに対応するモデルメッセージが完了しているか確認
        const userMessages = rawMessages.filter(m => m.role === 'user');
        const modelMessages = rawMessages.filter(m => m.role === 'model');
        
        if (userMessages.length === 0) return false;
        
        const lastUserMessage = userMessages[userMessages.length - 1];
        const hasCorrespondingModelMessage = modelMessages.some(
          m => m.turnId === lastUserMessage.turnId
        );
        
        // 最後のユーザーメッセージに対応するモデルメッセージがまだない場合、ローディングアイコンを表示
        return !hasCorrespondingModelMessage;
      })() && (
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
    </div>
  );
};

export default ChatMessageList;
