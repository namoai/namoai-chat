import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // useRouterをインポート
import Link from 'next/link'; // Linkをインポート
import { X, Settings, ChevronRight, Image as ImageIcon, Film, MessageSquare, BookUser, FileText, Trash2 } from 'lucide-react';

// propsの型定義
type ChatSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
  showChatImage: boolean;
  onShowChatImageChange: (value: boolean) => void;
  isMultiImage: boolean;
  onIsMultiImageChange: (value: boolean) => void;
  onNewChat: () => void;
  onSaveConversationAsTxt: () => void;
  onSaveConversationAsPng: () => void;
  userNote: string;
  onSaveNote: (note: string) => Promise<void>;
  characterId: string | null;
  chatId: number | null;
};

type SettingItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void; // onClickをオプショナルに
  href?: string; // hrefプロパティを追加
  hasSwitch?: boolean;
  switchState?: boolean;
  onSwitchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

// 設定項目コンポーネント
const SettingItem = ({ icon, label, onClick, href, hasSwitch = false, switchState = false, onSwitchChange = () => {} }: SettingItemProps) => {
    const content = (
        <div className="flex items-center justify-between w-full p-3 text-left hover:bg-gray-700 rounded-md transition-colors">
            <div className="flex items-center">
            {icon}
            <span className="ml-3">{label}</span>
            </div>
            {hasSwitch ? (
            <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={switchState} onChange={onSwitchChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
            </label>
            ) : (
            <ChevronRight className="text-gray-500" />
            )}
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }
    return <button onClick={onClick} className="w-full">{content}</button>;
};

// ユーザーノートモーダル（変更なし）
type NoteModalProps = {
  note: string;
  onSave: (note: string) => Promise<void>;
  onClose: () => void;
};
const NoteModal = ({ note, onSave, onClose }: NoteModalProps) => {
    // ... (内容は変更なし)
    const [currentNote, setCurrentNote] = useState(note);
    const [isSaving, setIsSaving] = useState(false);
    const MAX_NOTE_LENGTH = 1000;
    const isOverLimit = currentNote.length > MAX_NOTE_LENGTH;
  
    const handleSave = async () => {
      if (isOverLimit) {
        // alertの代わりにUIフィードバックを検討
        console.warn(`ユーザーノートは${MAX_NOTE_LENGTH}文字以内で入力してください。`);
        return;
      }
      setIsSaving(true);
      await onSave(currentNote);
      setIsSaving(false);
      onClose();
    };
  
    return (
      <div className="absolute inset-0 bg-gray-800 z-10 flex flex-col p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">ユーザーノート</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full"><X size={20} /></button>
        </div>
        <div className="relative flex-1">
          <textarea
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            className="w-full h-full bg-gray-900 border border-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
            placeholder="キャラクターとの対話に影響を与える設定やメモを入力します。"
          />
          <div className={`absolute bottom-2 right-2 text-sm ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
            {currentNote.length} / {MAX_NOTE_LENGTH}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || isOverLimit}
          className="mt-4 w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    );
};
// ... (他のモーダルも変更なし)
type SaveConversationModalProps = {
    onSaveAsTxt: () => void;
    onSaveAsPng: () => void;
    onClose: () => void;
};
const SaveConversationModal = ({ onSaveAsTxt, onSaveAsPng, onClose }: SaveConversationModalProps) => {
    return (
        <div className="absolute inset-0 bg-gray-800 z-10 flex flex-col p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">会話内容を保存</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
                <button
                    onClick={onSaveAsTxt}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                >
                    テキスト (.txt) で保存
                </button>
                <button
                    onClick={onSaveAsPng}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                >
                    画像 (.png) で保存
                </button>
            </div>
        </div>
    );
};


// メインのチャット設定コンポーネント
export default function ChatSettings({ 
  isOpen, 
  onClose,
  showChatImage,
  onShowChatImageChange,
  isMultiImage,
  onIsMultiImageChange,
  onNewChat,
  onSaveConversationAsTxt,
  onSaveConversationAsPng,
  userNote,
  onSaveNote,
  characterId,
  chatId
}: ChatSettingsProps) {
  const router = useRouter();
  const [view, setView] = useState<'main' | 'detail'>('main');
  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setNoteModalOpen(false);
        setIsSaveModalOpen(false);
        setView('main');
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ペルソナページのリンクを生成
  const personaHref = characterId && chatId 
    ? `/persona/list?fromChat=true&characterId=${characterId}&chatId=${chatId}`
    : '/persona/list';

  const renderMainView = () => (
    <>
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold">チャットルーム管理</h2>
      </div>
      <div className="p-2 space-y-1">
        <SettingItem 
          icon={<ImageIcon size={20} />} 
          label="チャットイメージ" 
          onClick={() => {}} 
          hasSwitch={true} 
          switchState={showChatImage} 
          onSwitchChange={() => onShowChatImageChange(!showChatImage)} 
        />
        <SettingItem 
          icon={<Film size={20} />} 
          label="マルチイメージ" 
          onClick={() => {}} 
          hasSwitch={true} 
          switchState={isMultiImage} 
          onSwitchChange={() => onIsMultiImageChange(!isMultiImage)} 
        />
        <SettingItem icon={<MessageSquare size={20} />} label="会話内容を保存" onClick={() => setIsSaveModalOpen(true)} />
        <SettingItem icon={<BookUser size={20} />} label="ユーザーノート" onClick={() => setNoteModalOpen(true)} />
        {/* ▼▼▼【修正点】SettingItemにhrefを渡すように変更 ▼▼▼ */}
        <SettingItem 
          icon={<FileText size={20} />} 
          label="ペルソナ" 
          href={personaHref}
        />
        {/* ▲▲▲【修正完了】▲▲▲ */}
      </div>
      <div className="p-2 mt-auto border-t border-gray-700">
        <button onClick={onNewChat} className="flex items-center w-full p-3 text-left text-red-400 hover:bg-gray-700 rounded-md transition-colors">
          <Trash2 size={20} />
          <span className="ml-3">新しいチャット</span>
        </button>
        <button onClick={() => setView('detail')} className="flex items-center w-full p-3 text-left hover:bg-gray-700 rounded-md transition-colors">
          <Settings size={20} />
          <span className="ml-3">設定</span>
        </button>
      </div>
    </>
  );

  const renderDetailView = () => (
    <>
      <div className="p-4 border-b border-gray-700">
        <button onClick={() => setView('main')} className="text-sm hover:underline mb-2">{'< チャットルーム管理'}</button>
        <h2 className="text-lg font-bold">チャットルーム設定</h2>
      </div>
      <div className="p-2 space-y-1">
        <p className="p-3 text-gray-400">詳細設定項目はここに表示されます。</p>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}>
      <div 
        className="fixed top-0 right-0 h-full w-80 bg-gray-800 text-white shadow-lg z-50 flex flex-col transition-transform duration-300 ease-in-out"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 p-2 hover:bg-gray-700 rounded-full z-20">
          <X size={24} />
        </button>
        {view === 'main' ? renderMainView() : renderDetailView()}
        {isNoteModalOpen && <NoteModal note={userNote} onSave={onSaveNote} onClose={() => setNoteModalOpen(false)} />}
        {isSaveModalOpen && <SaveConversationModal onSaveAsTxt={onSaveConversationAsTxt} onSaveAsPng={onSaveConversationAsPng} onClose={() => setIsSaveModalOpen(false)} />}
      </div>
    </div>
  );
}
