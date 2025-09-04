import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, ChevronRight, Image as ImageIcon, Film, MessageSquare, BookUser, FileText, Trash2, Cpu, Zap, Palette, Type } from 'lucide-react';

/**
 * AIによる応答生成に関する設定の型定義。
 */
export type GenerationSettings = {
  model: string;
  responseBoostMultiplier: number;
};

/**
 * チャットルームの表示スタイルに関する設定の型定義。
 */
export type ChatStyleSettings = {
  fontSize: number; // フォントサイズ (px)
  userBubbleColor: string; // ユーザーのチャットバブルの色 (Hex)
  userBubbleTextColor: string; // ユーザーのチャットバブルの文字色 (Hex)
};

/**
 * このコンポーネントが受け取るプロパティの型定義。
 */
type ChatSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
  showChatImage: boolean;
  onShowChatImageChange: (value: boolean) => void;
  isMultiImage: boolean;
  onIsMultiImageChange: (value: boolean) => void;
  onNewChat: () => void;
  onSaveConversationAsTxt: () => void;
  userNote: string;
  onSaveNote: (note: string) => Promise<void>;
  characterId: string | null;
  chatId: number | null;
  generationSettings: GenerationSettings;
  onGenerationSettingsChange: (settings: GenerationSettings) => void;
  chatStyleSettings: ChatStyleSettings; // ◀◀◀【追加】表示設定
  onChatStyleSettingsChange: (settings: ChatStyleSettings) => void; // ◀◀◀【追加】表示設定ハンドラ
  userPoints: number;
};

// ... (SettingItem, NoteModal, SaveConversationModal, ResponseBoostModal は変更なし)
type SettingItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  hasSwitch?: boolean;
  switchState?: boolean;
  onSwitchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

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
    if (href) return <Link href={href}>{content}</Link>;
    return <button onClick={onClick} className="w-full">{content}</button>;
};

const NoteModal = ({ note, onSave, onClose }: { note: string; onSave: (note: string) => Promise<void>; onClose: () => void; }) => {
    const [currentNote, setCurrentNote] = useState(note);
    const [isSaving, setIsSaving] = useState(false);
    const handleSave = async () => {
      if (currentNote.length > 1000) return;
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
          <textarea value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} className="w-full h-full bg-gray-900 border border-gray-700 rounded-md p-2 resize-none" placeholder="キャラクターとの対話に影響を与える設定やメモを入力します。" />
          <div className={`absolute bottom-2 right-2 text-sm ${currentNote.length > 1000 ? 'text-red-500' : 'text-gray-400'}`}>{currentNote.length} / 1000</div>
        </div>
        <button onClick={handleSave} disabled={isSaving || currentNote.length > 1000} className="mt-4 w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-md">
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    );
};

const SaveConversationModal = ({ onSaveAsTxt, onClose }: { onSaveAsTxt: () => void; onClose: () => void; }) => {
    return (
        <div className="absolute inset-0 bg-gray-800 z-10 flex flex-col p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">会話内容を保存</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
                <button onClick={onSaveAsTxt} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md">
                    テキスト (.txt) で保存
                </button>
            </div>
        </div>
    );
};

const ResponseBoostModal = ({ settings, userPoints, onSave, onClose }: { settings: GenerationSettings; userPoints: number; onSave: (newSettings: GenerationSettings) => void; onClose: () => void; }) => {
    const [localMultiplier, setLocalMultiplier] = useState(settings.responseBoostMultiplier);
    const BOOST_OPTIONS = [ { multiplier: 1.0, cost: 0, label: "基本" }, { multiplier: 1.5, cost: 1, label: "1.5倍" }, { multiplier: 3.0, cost: 2, label: "3倍" }, { multiplier: 5.0, cost: 4, label: "5倍" }, ];
    const selectedOption = BOOST_OPTIONS.find(opt => opt.multiplier === localMultiplier) || BOOST_OPTIONS[0];
    const requiredPoints = 1 + selectedOption.cost;
    const handleSave = () => { if (requiredPoints > userPoints) return; onSave({ ...settings, responseBoostMultiplier: localMultiplier }); };
    return (
        <div className="absolute inset-0 bg-gray-800 z-20 flex flex-col p-4">
            <div className="flex justify-between items-center mb-4"> <h3 className="text-lg font-bold">応答ブースト設定</h3> <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full"><X size={20} /></button> </div>
            <p className="text-sm text-gray-400 mb-6">ポイントを消費して、次のAIの応答をより長く、詳細にすることができます。1回の送信にのみ適用されます。</p>
            <div className="flex-1 overflow-y-auto space-y-4">
                <div className="bg-gray-900 p-4 rounded-lg">
                    <h4 className="font-bold flex items-center mb-4"><Zap size={16} className="text-pink-500 mr-2" />Gemini 2.5 Pro</h4>
                    <div className="grid grid-cols-4 gap-2">
                        {BOOST_OPTIONS.map(opt => (
                            <button key={opt.multiplier} onClick={() => setLocalMultiplier(opt.multiplier)} disabled={ (1 + opt.cost) > userPoints && opt.cost > 0 } className={`p-2 border rounded-md text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${localMultiplier === opt.multiplier ? 'bg-pink-600 border-pink-500' : 'bg-gray-700 border-gray-600 hover:border-pink-500'}`}>
                                <p className="font-bold text-sm">{opt.label}</p>
                                <p className="text-xs text-gray-400">{opt.cost > 0 ? `+${opt.cost} P` : '無料'}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-auto pt-4 border-t border-gray-700">
                <div className="text-sm text-center mb-3"><span className="text-gray-400">保有ポイント: {userPoints} P</span><span className={`ml-2 ${requiredPoints > userPoints ? 'text-red-500' : 'text-pink-500'}`}>{`(-${requiredPoints} P)`}</span></div>
                <button onClick={handleSave} disabled={requiredPoints > userPoints} className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-colors">設定を保存</button>
            </div>
        </div>
    );
};

// ▼▼▼【新規追加】チャット表示設定モーダル ▼▼▼
const StyleSettingsModal = ({ settings, onSave, onClose }: { settings: ChatStyleSettings; onSave: (newSettings: ChatStyleSettings) => void; onClose: () => void; }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    const COLOR_OPTIONS = [
        { name: 'Pink', bubbleColor: '#db2777', textColor: '#ffffff' },
        { name: 'Blue', bubbleColor: '#2563eb', textColor: '#ffffff' },
        { name: 'Green', bubbleColor: '#16a34a', textColor: '#ffffff' },
        { name: 'Purple', bubbleColor: '#9333ea', textColor: '#ffffff' },
    ];

    const handleSave = () => {
        onSave(localSettings);
    };

    return (
        <div className="absolute inset-0 bg-gray-800 z-20 flex flex-col p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">チャット表示設定</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
                {/* フォントサイズ設定 */}
                <div>
                    <h4 className="font-semibold mb-3 flex items-center"><Type size={16} className="mr-2"/>フォントサイズ</h4>
                    <div className="flex items-center gap-4">
                        <input type="range" min="12" max="18" step="1" value={localSettings.fontSize} onChange={(e) => setLocalSettings(prev => ({...prev, fontSize: parseInt(e.target.value)}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"/>
                        <span className="font-bold text-pink-400 w-12 text-center">{localSettings.fontSize}px</span>
                    </div>
                </div>

                {/* ユーザーのチャットバブル色設定 */}
                <div>
                    <h4 className="font-semibold mb-3 flex items-center"><Palette size={16} className="mr-2"/>自分の吹き出し色</h4>
                    <div className="grid grid-cols-4 gap-3">
                        {COLOR_OPTIONS.map(color => (
                            <button key={color.name} onClick={() => setLocalSettings(prev => ({...prev, userBubbleColor: color.bubbleColor, userBubbleTextColor: color.textColor}))} className={`w-full h-10 rounded-md transition-all ${localSettings.userBubbleColor === color.bubbleColor ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-white' : ''}`} style={{ backgroundColor: color.bubbleColor }} aria-label={color.name} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-gray-700">
                <button onClick={handleSave} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-md transition-colors">設定を保存</button>
            </div>
        </div>
    );
};
// ▲▲▲【新規追加完了】▲▲▲


export default function ChatSettings({ 
  isOpen, onClose, showChatImage, onShowChatImageChange, isMultiImage, onIsMultiImageChange,
  onNewChat, onSaveConversationAsTxt, userNote, onSaveNote, characterId, chatId, 
  generationSettings, onGenerationSettingsChange,
  chatStyleSettings, onChatStyleSettingsChange, // ◀◀◀【追加】
  userPoints
}: ChatSettingsProps) {
  
  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isAiSettingsModalOpen, setIsAiSettingsModalOpen] = useState(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false); // ◀◀◀【追加】

  useEffect(() => { if (!isOpen) { setTimeout(() => { setNoteModalOpen(false); setIsSaveModalOpen(false); setIsAiSettingsModalOpen(false); setIsStyleModalOpen(false); }, 300); } }, [isOpen]);
  if (!isOpen) return null;

  const personaHref = characterId && chatId ? `/persona/list?fromChat=true&characterId=${characterId}&chatId=${chatId}` : '/persona/list';
  
  const handleSaveAiSettings = (newSettings: GenerationSettings) => { onGenerationSettingsChange(newSettings); setIsAiSettingsModalOpen(false); };
  const handleSaveStyleSettings = (newSettings: ChatStyleSettings) => { onChatStyleSettingsChange(newSettings); setIsStyleModalOpen(false); }; // ◀◀◀【追加】

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}>
      <div className="fixed top-0 right-0 h-full w-80 bg-gray-800 text-white shadow-lg z-50 flex flex-col transition-transform duration-300 ease-in-out" style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-2 hover:bg-gray-700 rounded-full z-30"><X size={24} /></button>
        <>
            <div className="p-4 border-b border-gray-700 flex justify-between items-center"><h2 className="text-lg font-bold">チャットルーム管理</h2><div className="text-sm text-yellow-400 font-semibold">保有: {userPoints} P</div></div>
            <div className="p-2 space-y-1">
                <SettingItem icon={<ImageIcon size={20} />} label="チャットイメージ" hasSwitch={true} switchState={showChatImage} onSwitchChange={() => onShowChatImageChange(!showChatImage)} />
                <SettingItem icon={<Film size={20} />} label="マルチイメージ" hasSwitch={true} switchState={isMultiImage} onSwitchChange={() => onIsMultiImageChange(!isMultiImage)} />
                <SettingItem icon={<Cpu size={20} />} label="AI応答設定" onClick={() => setIsAiSettingsModalOpen(true)} />
                <SettingItem icon={<Palette size={20} />} label="チャット表示設定" onClick={() => setIsStyleModalOpen(true)} /> {/* ◀◀◀【追加】 */}
                <SettingItem icon={<MessageSquare size={20} />} label="会話内容を保存" onClick={() => setIsSaveModalOpen(true)} />
                <SettingItem icon={<BookUser size={20} />} label="ユーザーノート" onClick={() => setNoteModalOpen(true)} />
                <SettingItem icon={<FileText size={20} />} label="ペルソナ" href={personaHref} />
            </div>
            <div className="p-2 mt-auto border-t border-gray-700">
                <button onClick={onNewChat} className="flex items-center w-full p-3 text-left text-red-400 hover:bg-gray-700 rounded-md"><Trash2 size={20} /><span className="ml-3">新しいチャット</span></button>
            </div>
        </>
        {isNoteModalOpen && <NoteModal note={userNote} onSave={onSaveNote} onClose={() => setNoteModalOpen(false)} />}
        {isSaveModalOpen && <SaveConversationModal onSaveAsTxt={onSaveConversationAsTxt} onClose={() => setIsSaveModalOpen(false)} />}
        {isAiSettingsModalOpen && <ResponseBoostModal settings={generationSettings} userPoints={userPoints} onSave={handleSaveAiSettings} onClose={() => setIsAiSettingsModalOpen(false)} />}
        {isStyleModalOpen && <StyleSettingsModal settings={chatStyleSettings} onSave={handleSaveStyleSettings} onClose={() => setIsStyleModalOpen(false)} />} {/* ◀◀◀【追加】 */}
      </div>
    </div>
  );
}

