"use client";

// Next.jsのナビゲーション機能を利用するためにuseRouterとLinkをインポートします
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // <a>タグの代わりに使用するLinkコンポーネント
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Menu, Send, Quote, Asterisk, X } from 'lucide-react';
import ChatMessageParser from '@/components/ChatMessageParser';
import ChatSettings from '@/components/ChatSettings';

// 型定義
type CharacterImageInfo = { imageUrl: string; keyword?: string | null; };
type CharacterInfo = {
  name: string;
  firstSituation: string | null;
  firstMessage: string | null;
  characterImages: CharacterImageInfo[];
};
type Message = {
  id: string;
  role: "user" | "model" | "system" | "first_situation";
  content: string;
  timestamp?: string;
};
type DbMessage = { role: string; content: string; createdAt: string; };

// ▼▼▼【新規追加】汎用モーダルコンポーネント ▼▼▼
type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  isAlert?: boolean;
};

const ConfirmationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
  if (!modalState.isOpen) return null;

  const handleClose = () => {
    modalState.onCancel?.();
    setModalState({ ...modalState, isOpen: false });
  };
  const handleConfirm = () => {
    modalState.onConfirm?.();
    setModalState({ ...modalState, isOpen: false });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
        <h2 className="text-xl font-bold mb-4">{modalState.title}</h2>
        <p className="text-gray-300 mb-6">{modalState.message}</p>
        <div className={`flex ${modalState.isAlert ? 'justify-end' : 'justify-between'} gap-4`}>
          {!modalState.isAlert && (
            <button onClick={handleClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors">
              キャンセル
            </button>
          )}
          <button 
            onClick={handleConfirm} 
            className={`px-4 py-2 ${modalState.confirmText?.includes('開始') ? 'bg-red-600 hover:bg-red-500' : 'bg-pink-600 hover:bg-pink-500'} rounded-lg transition-colors`}
          >
            {modalState.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
// ▲▲▲【追加完了】▲▲▲

export default function ChatPage() {
  const router = useRouter();
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showChatImage, setShowChatImage] = useState(true);
  const [isMultiImage, setIsMultiImage] = useState(true);
  const [userNote, setUserNote] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pathSegments = window.location.pathname.split('/');
    const id = pathSegments[pathSegments.indexOf('chat') + 1];
    setCharacterId(id);

    const params = new URLSearchParams(window.location.search);
    const chatIdFromQuery = params.get('chatId');
    if (chatIdFromQuery) {
      setChatId(parseInt(chatIdFromQuery, 10));
    }
  }, []);

  useEffect(() => {
    if (characterId) {
      const initializeChat = async () => {
        setIsInitialLoading(true);
        try {
          const charResponse = await fetch(`/api/characters/${characterId}`, { cache: 'no-store' });
          if (!charResponse.ok) throw new Error('キャラクター情報の取得に失敗しました。');
          const charData: CharacterInfo = await charResponse.json();
          setCharacterInfo(charData);

          const chatSessionResponse = await fetch('/api/chats/find-or-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId, chatId }),
            cache: 'no-store',
          });
          if (!chatSessionResponse.ok) throw new Error('チャットセッションの取得に失敗しました。');
          const chatSessionData = await chatSessionResponse.json();
          
          setChatId(chatSessionData.id);
          setUserNote(chatSessionData.userNote || '');
          
          if (chatSessionData.chat_message.length === 0 && charData) {
            const initialMessages: Message[] = [];
            if (charData.firstSituation) {
              initialMessages.push({ id: `init-situation-${Date.now()}`, role: 'first_situation', content: charData.firstSituation });
            }
            if (charData.firstMessage) {
              initialMessages.push({ id: `init-message-${Date.now()}`, role: 'model', content: charData.firstMessage, timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) });
            }
            setMessages(initialMessages);
          } else {
            const formattedMessages = chatSessionData.chat_message.map((msg: DbMessage, index: number) => ({
              id: `db-msg-${chatSessionData.id}-${index}`,
              role: msg.role as "user" | "model",
              content: msg.content,
              timestamp: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
            }));
            setMessages(formattedMessages);
          }
        } catch (error) {
          console.error(error);
          setModalState({ isOpen: true, title: 'エラー', message: 'チャットの読み込みに失敗しました。', isAlert: true, onConfirm: () => router.back() });
        } finally {
          setIsInitialLoading(false);
        }
      };
      initializeChat();
    }
  }, [characterId, router]); // chatIdを依存配列から削除

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatId) return;
    const userMessage: Message = { 
      id: `user-msg-${Date.now()}`,
      role: "user", 
      content: input,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
    };
    setIsLoading(true);
    setMessages(prev => [...prev, userMessage]);
    const messageToSend = input;
    setInput('');
    try {
      const response = await fetch(`/api/chat/${chatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend }),
      });
      if (!response.ok) throw new Error('APIからの応答エラー');
      const data = await response.json();
      setMessages(prev => [...prev, { 
        id: `model-msg-${Date.now()}`,
        role: 'model', 
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } catch (error) {
      console.error("チャットエラー:", error);
      setMessages(prev => [...prev, {
        id: `error-msg-${Date.now()}`,
        role: 'model',
        content: 'エラーが発生しました。もう一度お試しください。',
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // ▼▼▼【修正点】confirmをモーダルに、window.location.hrefをrouter.pushに置き換え ▼▼▼
  const handleNewChat = () => {
    if (!characterId) return;
    setModalState({
      isOpen: true,
      title: '確認',
      message: '現在のチャットを終了し、新しいチャットを開始しますか？',
      confirmText: '開始する',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/chats/find-or-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId, forceNew: true }),
          });
          if (!response.ok) throw new Error('新しいチャットの作成に失敗しました。');
          const newChat = await response.json();
          router.push(`/chat/${characterId}?chatId=${newChat.id}`);
          // ページ遷移後にリロードして状態を完全にリセット
          router.refresh(); 
        } catch (error) {
          console.error(error);
          setModalState({ isOpen: true, title: 'エラー', message: '新しいチャットの作成に失敗しました。', isAlert: true });
        }
      }
    });
  };
  // ▲▲▲【修正完了】▲▲▲

  // ▼▼▼【修正点】alertをモーダルに置き換え ▼▼▼
  const handleSaveConversationAsTxt = () => {
    if (!characterInfo || messages.length === 0) {
      setModalState({ isOpen: true, title: '情報', message: '保存する会話内容がありません。', isAlert: true });
      return;
    }
    const header = `キャラクター: ${characterInfo.name}\n保存日時: ${new Date().toLocaleString('ja-JP')}\n---\n\n`;
    const formattedContent = messages
      .map(msg => {
        if (msg.role === 'user') return `ユーザー: ${msg.content}`;
        if (msg.role === 'model') return `${characterInfo.name}: ${msg.content.replace(/\{img:\d+\}/g, '').trim()}`;
        if (msg.role === 'first_situation') return `状況: ${msg.content}`;
        return '';
      })
      .filter(line => line.length > 0)
      .join('\n\n');
    const blob = new Blob([header + formattedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_with_${characterInfo.name}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsSettingsOpen(false);
  };
  
  const handleSaveConversationAsPng = async () => {
    setModalState({ isOpen: true, title: '情報', message: 'この機能は現在開発中です。', isAlert: true });
  };
  
  const handleSaveNote = async (note: string) => {
    if (chatId === null) return;
    try {
      const response = await fetch(`/api/chat/${chatId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNote: note }),
      });
      if (!response.ok) throw new Error('ノートの保存に失敗しました。');
      const data = await response.json();
      setUserNote(data.userNote);
      setModalState({ isOpen: true, title: '成功', message: 'ノートを保存しました。', isAlert: true });
    } catch (error) {
      console.error(error);
      setModalState({ isOpen: true, title: 'エラー', message: (error as Error).message, isAlert: true });
    }
  };
  // ▲▲▲【修正完了】▲▲▲
  
  const handleInsertMarkdown = (type: 'narration' | 'dialogue') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const currentInputValue = input;
    const trimmedInput = currentInputValue.trimEnd();
    const prefix = trimmedInput.length > 0 ? '\n' : '';
    let markdown;
    if (type === 'narration') markdown = `**`;
    else markdown = `「」`;
    const newValue = currentInputValue + prefix + markdown;
    const newCursorPosition = newValue.length - 1;
    setInput(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  const handleGoBack = () => {
    router.back();
  };

  if (isInitialLoading || !characterInfo) {
    return <div className="min-h-screen bg-black text-white flex justify-center items-center">チャットを準備中...</div>;
  }
  
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />
      {/* ヘッダー */}
      <header className="flex items-center justify-between p-3 border-b border-gray-700 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <button onClick={handleGoBack} className="p-2 hover:bg-gray-700 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <Link href={`/characters/${characterId}`} className="flex flex-col items-center hover:opacity-80 transition-opacity">
          <img src={characterInfo.characterImages[0]?.imageUrl || '/default-avatar.png'} alt={characterInfo.name} width={40} height={40} className="rounded-full object-cover" />
          <span className="text-sm font-semibold mt-1">{characterInfo.name}</span>
        </Link>
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-gray-700 rounded-full"><Menu size={24} /></button>
      </header>
      
      {/* メインのチャット表示エリア */}
      <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {messages.map((msg) => {
          if (msg.role === 'first_situation') return (<div key={msg.id} className="text-gray-400 italic">{msg.content}</div>);
          if (msg.role === 'system') return (<div key={msg.id} className="text-center my-4"><p className="text-sm text-gray-400 bg-gray-800/50 rounded-lg px-4 py-2 inline-block italic whitespace-pre-wrap">{msg.content}</p></div>);
          return (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-xl ${msg.role === 'user' ? 'bg-pink-600 text-white' : 'bg-gray-800 text-white'}`}>
                <ChatMessageParser content={msg.content} characterImages={msg.role === 'model' ? characterInfo.characterImages.slice(1) : []} showImage={showChatImage} isMultiImage={isMultiImage} onImageClick={(url: string) => setLightboxImage(url)} />
              </div>
              {msg.timestamp && (<span className="text-xs text-gray-400 mt-1 px-1">{msg.timestamp}</span>)}
            </div>
          );
        })}
        {isLoading && ( <div className="flex items-start"><div className="bg-gray-800 px-4 py-3 rounded-xl"><div className="flex items-center space-x-2"><div className="w-2 h-2 bg-white rounded-full animate-pulse [animation-delay:-0.3s]"></div><div className="w-2 h-2 bg-white rounded-full animate-pulse [animation-delay:-0.15s]"></div><div className="w-2 h-2 bg-white rounded-full animate-pulse"></div></div></div></div> )}
        <div ref={messagesEndRef} />
      </main>

      {/* フッター（入力欄） */}
      <footer className="p-3 border-t border-gray-700 bg-black/50 backdrop-blur-sm sticky bottom-0">
        <div className="flex gap-2 mb-2">
            <button onClick={() => handleInsertMarkdown('narration')} className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-md text-white"><Asterisk size={14} /> 地文</button>
            <button onClick={() => handleInsertMarkdown('dialogue')} className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-md text-white"><Quote size={14} /> セリフ</button>
        </div>
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="メッセージを入力" disabled={isLoading} className="flex-1 bg-gray-800 border-none rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50 resize-none" rows={1} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} />
          <button type="submit" disabled={isLoading || !input.trim()} className="bg-pink-600 hover:bg-pink-700 rounded-full p-2 disabled:opacity-50 disabled:cursor-not-allowed"><Send size={24} className="text-white"/></button>
        </form>
      </footer>

      {/* 設定パネル */}
      <ChatSettings 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)} 
        showChatImage={showChatImage}
        onShowChatImageChange={setShowChatImage}
        isMultiImage={isMultiImage}
        onIsMultiImageChange={setIsMultiImage}
        onNewChat={handleNewChat}
        onSaveConversationAsTxt={handleSaveConversationAsTxt}
        onSaveConversationAsPng={handleSaveConversationAsPng}
        userNote={userNote}
        onSaveNote={handleSaveNote}
        characterId={characterId}
        chatId={chatId}
      />
      
      {/* 画像ライトボックス */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={lightboxImage} alt="Full screen image" className="object-contain w-full h-full" onContextMenu={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()} />
          </div>
          <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"><X size={24} /></button>
        </div>
      )}
    </div>
  );
}
