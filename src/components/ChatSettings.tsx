import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, ChevronRight, Image as ImageIcon, Film, MessageSquare, BookUser, FileText, Trash2, Palette, Type, BookOpen, Brain } from 'lucide-react';
import BackMemoryModal from '@/components/chat/BackMemoryModal';
import DetailedMemoryModal from '@/components/chat/DetailedMemoryModal';
import { fetchWithCsrf } from "@/lib/csrf-client";

/**
 * AIによる応答生成に関する設定の型定義。
 * ▼▼▼【修正】responseBoostMultiplier を削除 ▼▼▼
 */
export type GenerationSettings = {
  model: string;
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
 * ▼▼▼【修正】generationSettings 関連の props を削除 ▼▼▼
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
  chatStyleSettings: ChatStyleSettings;
  onChatStyleSettingsChange: (settings: ChatStyleSettings) => void;
  userPoints: number;
};

// ... (SettingItem, NoteModal, SaveConversationModal は変更なし)
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
        <div className="flex items-center justify-between w-full p-4 text-left hover:bg-pink-500/10 rounded-xl transition-all duration-200 group">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 group-hover:from-pink-500/30 group-hover:to-purple-500/30 transition-all">
                    {icon}
                </div>
                <span className="text-base group-hover:text-pink-300 transition-colors">{label}</span>
            </div>
            {hasSwitch ? (
            <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={switchState} onChange={onSwitchChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-pink-500 peer-checked:to-purple-600"></div>
            </label>
            ) : (
            <ChevronRight className="text-gray-400 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
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
      <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-xl z-10 flex flex-col p-6 border-l border-gray-800/50">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">ユーザーノート</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"><X size={20} /></button>
        </div>
        <div className="relative flex-1 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
          <textarea 
            value={currentNote} 
            onChange={(e) => setCurrentNote(e.target.value)} 
            className="w-full h-full bg-transparent border-none rounded-md p-2 resize-none text-white placeholder-gray-500 focus:outline-none" 
            placeholder="キャラクターとの対話に影響を与える設定やメモを入力します。" 
          />
          <div className={`absolute bottom-4 right-4 text-sm font-medium ${currentNote.length > 1000 ? 'text-red-400' : 'text-gray-400'}`}>{currentNote.length} / 1000</div>
        </div>
        <button onClick={handleSave} disabled={isSaving || currentNote.length > 1000} className="mt-6 w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/50 disabled:shadow-none">
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    );
};

const SaveConversationModal = ({ onSaveAsTxt, onClose }: { onSaveAsTxt: () => void; onClose: () => void; }) => {
    return (
        <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-xl z-10 flex flex-col p-6 border-l border-gray-800/50">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">会話内容を保存</h3>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
                <button onClick={onSaveAsTxt} className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50">
                    テキスト (.txt) で保存
                </button>
            </div>
        </div>
    );
};

// ▼▼▼【修正】ResponseBoostModal 全体を削除 ▼▼▼

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
        <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-xl z-20 flex flex-col p-6 border-l border-gray-800/50">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">チャット表示設定</h3>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
                {/* フォントサイズ設定 */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
                    <h4 className="font-semibold mb-4 flex items-center text-gray-200"><Type size={18} className="mr-2 text-pink-400"/>フォントサイズ</h4>
                    <div className="flex items-center gap-4">
                        <input type="range" min="12" max="18" step="1" value={localSettings.fontSize} onChange={(e) => setLocalSettings(prev => ({...prev, fontSize: parseInt(e.target.value)}))} className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"/>
                        <span className="font-bold text-pink-400 w-12 text-center bg-gray-800/50 px-2 py-1 rounded-lg">{localSettings.fontSize}px</span>
                    </div>
                </div>

                {/* ユーザーのチャットバブル色設定 */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
                    <h4 className="font-semibold mb-4 flex items-center text-gray-200"><Palette size={18} className="mr-2 text-pink-400"/>自分の吹き出し色</h4>
                    <div className="grid grid-cols-4 gap-3">
                        {COLOR_OPTIONS.map(color => (
                            <button 
                                key={color.name} 
                                onClick={() => setLocalSettings(prev => ({...prev, userBubbleColor: color.bubbleColor, userBubbleTextColor: color.textColor}))} 
                                className={`w-full h-12 rounded-xl transition-all shadow-lg hover:scale-105 ${localSettings.userBubbleColor === color.bubbleColor ? 'ring-2 ring-pink-400 ring-offset-2 ring-offset-gray-900' : 'hover:ring-2 hover:ring-gray-600'}`} 
                                style={{ backgroundColor: color.bubbleColor }} 
                                aria-label={color.name} 
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-800/50">
                <button onClick={handleSave} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/50">設定を保存</button>
            </div>
        </div>
    );
};
// ▲▲▲【新規追加完了】▲▲▲


export default function ChatSettings({ 
  isOpen, onClose, showChatImage, onShowChatImageChange, isMultiImage, onIsMultiImageChange,
  onNewChat, onSaveConversationAsTxt, userNote, onSaveNote, characterId, chatId, 
  // ▼▼▼【修正】generationSettings, onGenerationSettingsChange を削除 ▼▼▼
  chatStyleSettings, onChatStyleSettingsChange,
  userPoints
}: ChatSettingsProps) {
  
  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [isBackMemoryModalOpen, setIsBackMemoryModalOpen] = useState(false);
  const [isDetailedMemoryModalOpen, setIsDetailedMemoryModalOpen] = useState(false);
  const [backMemory, setBackMemory] = useState({ content: '', autoSummarize: true });
  const [detailedMemories, setDetailedMemories] = useState<Array<{ id: number; content: string; keywords: string[]; createdAt: string; index: number }>>([]);
  // ▼▼▼【安全対策】同時再要約防止用のstate
  const [isSummarizing, setIsSummarizing] = useState(false);
  // ▲▲▲

  const fetchBackMemory = async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`/api/chat/${chatId}/back-memory`);
      if (res.ok) {
        const data = await res.json();
        setBackMemory({ content: data.backMemory || '', autoSummarize: data.autoSummarize ?? true });
      }
    } catch (error) {
      console.error('バックメモリ取得エラー:', error);
    }
  };

  const fetchDetailedMemories = async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`/api/chat/${chatId}/detailed-memories`);
      if (res.ok) {
        const data = await res.json();
        setDetailedMemories(data.memories || []);
      }
    } catch (error) {
      console.error('詳細記憶取得エラー:', error);
    }
  };

  // バックメモリと詳細記憶を読み込む
  useEffect(() => {
    if (isOpen && chatId) {
      fetchBackMemory();
      fetchDetailedMemories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chatId]);

  const handleSaveBackMemory = async (content: string, autoSummarize: boolean) => {
    if (!chatId) return;
    try {
      const res = await fetch(`/api/chat/${chatId}/back-memory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, autoSummarize }),
      });
      if (res.ok) {
        setBackMemory({ content, autoSummarize });
      }
    } catch (error) {
      console.error('バックメモリ保存エラー:', error);
      throw error;
    }
  };

  const handleSaveDetailedMemory = async (memory: { content: string; keywords: string[] }) => {
    if (!chatId) return;
    try {
      const res = await fetch(`/api/chat/${chatId}/detailed-memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: memory.content, keywords: memory.keywords || [], autoSummarize: false }),
      });
      if (res.ok) {
        await fetchDetailedMemories();
      }
    } catch (error) {
      console.error('詳細記憶保存エラー:', error);
      throw error;
    }
  };

  const handleUpdateDetailedMemory = async (id: number, content: string) => {
    if (!chatId) return;
    try {
      const res = await fetchWithCsrf(`/api/chat/${chatId}/detailed-memories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryId: id, content }),
      });
      if (res.ok) {
        await fetchDetailedMemories();
      }
    } catch (error) {
      console.error('詳細記憶更新エラー:', error);
      throw error;
    }
  };

  const handleDeleteDetailedMemory = async (id: number) => {
    if (!chatId) return;
    try {
      const res = await fetchWithCsrf(`/api/chat/${chatId}/detailed-memories?memoryId=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchDetailedMemories();
      }
    } catch (error) {
      console.error('詳細記憶削除エラー:', error);
      throw error;
    }
  };

  const handleAutoSummarizeDetailedMemory = async () => {
    console.log('handleAutoSummarizeDetailedMemory 開始, chatId:', chatId);
    if (!chatId) {
      console.error('chatIdがありません');
      return;
    }
    
    // ▼▼▼【安全対策】同時再要約防止チェック
    if (isSummarizing) {
      alert('再要約が既に実行中です（メモリブックまたは詳細記憶）。完了するまでお待ちください。');
      return;
    }
    setIsSummarizing(true);
    // ▲▲▲
    
    try {
      console.log('API呼び出し開始:', `/api/chat/${chatId}/detailed-memories`);
      const res = await fetchWithCsrf(`/api/chat/${chatId}/detailed-memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSummarize: true }),
      });
      console.log('APIレスポンス status:', res.status, res.ok);
      
      // ▼▼▼【安全対策】エラーハンドリング強化
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('APIエラー:', errorData);
        
        // 409 Conflict: 既に処理中
        if (res.status === 409) {
          alert('再要約が既に実行中です。完了するまでお待ちください。');
          return;
        }
        
        // 400 Bad Request: メッセージ数が多い場合の確認（現在は削除、処理は継続）
        
        throw new Error(errorData.error || `HTTP ${res.status}: 自動要約に失敗しました`);
      }
      // ▲▲▲
      
      const result = await res.json();
      console.log('API成功, 結果:', result);
      
      // 再要約開始メッセージ
      alert('再要約を開始しました。\n処理が完了するまでお待ちください。');
      
      // ▼▼▼【修正】再要約はバックグラウンドで実行されるため、完了までポーリング
      // タイムアウト時間を短く設定（メッセージ数が少ない場合は即座に完了可能）
      const maxWaitTime = 15000; // 15秒でタイムアウト（短縮）
      const pollInterval = 500; // 0.5秒ごと（より頻繁にチェック）
      const startTime = Date.now();
      // ▼▼▼【修正】再要約前のメモリIDセットを保存（再要約後、メモリが再作成されたかを判定）
      const initialMemoryIds = new Set(detailedMemories.map(m => m.id));
      // ▲▲▲
      
      // ポーリングを開始（メモリが再作成されたら完了）
      const pollForMemories = async () => {
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 3; // 連続エラー許容回数（短縮）
        
        while (Date.now() - startTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
          // メモリを再取得
          try {
            const res = await fetch(`/api/chat/${chatId}/detailed-memories`);
            if (res.ok) {
              const data = await res.json();
              const currentMemories = data.memories || [];
              const currentCount = currentMemories.length;
              
              // ▼▼▼【修正】完了条件: メモリが存在し、かつ再要約後のメモリであることを確認
              // 再要約では既存メモリが全て削除されてから再作成されるため、
              // 新しいメモリIDが存在するか、またはメモリが存在する場合に完了と判断
              if (currentCount > 0) {
                // メモリが存在する場合、新しいメモリか確認
                const hasNewMemories = currentMemories.some((m: { id: number }) => !initialMemoryIds.has(m.id));
                
                // 新しいメモリが存在するか、または初期メモリがなかった（初回要約）場合は完了
                if (hasNewMemories || initialMemoryIds.size === 0) {
                  console.log(`再要約: 完了 - メモリ${currentCount}件作成済み`);
                  await fetchDetailedMemories();
                  alert('再要約が完了しました。');
                  return; // 完了
                }
              }
              // ▲▲▲
              
              consecutiveErrors = 0; // エラーカウントリセット
            } else {
              consecutiveErrors++;
              console.error(`再要約ポーリングエラー: HTTP ${res.status}`);
              
              if (consecutiveErrors >= maxConsecutiveErrors) {
                throw new Error(`再要約の進行状況を確認できませんでした (HTTP ${res.status})。`);
              }
            }
          } catch (error) {
            consecutiveErrors++;
            console.error(`再要約ポーリングエラー (${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
            
            // ▼▼▼【安全対策】連続エラーが多すぎる場合は処理を中断
            if (consecutiveErrors >= maxConsecutiveErrors) {
              console.error('再要約: 連続エラーが多すぎるため、ポーリングを中断します');
              await fetchDetailedMemories(); // 最後にメモリを更新
              throw new Error('再要約の進行状況を確認できませんでした。ページをリロードして結果を確認してください。');
            }
            // ▲▲▲
          }
        }
        
        // ▼▼▼【修正】タイムアウト後、メモリ状態を確認
        await fetchDetailedMemories();
        const finalRes = await fetch(`/api/chat/${chatId}/detailed-memories`).catch(() => null);
        const finalData = finalRes && finalRes.ok ? await finalRes.json().catch(() => ({})) : {};
        const finalMemories = finalData.memories || [];
        const finalCount = finalMemories.length;
        
        if (finalCount > 0) {
          // メモリが作成されている場合 → 完了として扱う
          console.log(`再要約: タイムアウト - メモリ${finalCount}件が作成されました。完了とみなします。`);
          alert('再要約が完了しました。');
        } else {
          // メモリが作成されていない場合
          console.warn('再要約: タイムアウト - メモリが作成されませんでした');
          alert('再要約がタイムアウトしました。\n\n処理が完了しなかった可能性があります。\nしばらく待ってからページをリロードして結果を確認してください。');
        }
        // ▲▲▲
      };
      
      // ポーリングを実行し、完了を待つ
      await pollForMemories();
      // ▲▲▲
    } catch (error) {
      console.error('自動要約エラー:', error);
      alert(error instanceof Error ? error.message : '自動要約に失敗しました');
      throw error;
    } finally {
      // ▼▼▼【安全対策】処理完了後にフラグを解除
      setIsSummarizing(false);
      // ▲▲▲
    }
  };

  useEffect(() => { 
    if (!isOpen) { 
      setTimeout(() => { 
        setNoteModalOpen(false); 
        setIsSaveModalOpen(false); 
        setIsStyleModalOpen(false);
        setIsBackMemoryModalOpen(false);
        setIsDetailedMemoryModalOpen(false);
      }, 300); 
    } 
  }, [isOpen]);
  if (!isOpen) return null;

  const personaHref = characterId && chatId ? `/persona/list?fromChat=true&characterId=${characterId}&chatId=${chatId}` : '/persona/list';
  
  // ▼▼▼【修正】handleSaveAiSettings を削除 ▼▼▼
  const handleSaveStyleSettings = (newSettings: ChatStyleSettings) => { onChatStyleSettingsChange(newSettings); setIsStyleModalOpen(false); };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose}>
      <div className="fixed top-0 right-0 h-full w-80 bg-gray-900/95 backdrop-blur-xl text-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out border-l border-gray-800/50" style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all z-30"><X size={24} /></button>
        <>
            <div className="p-6 border-b border-gray-800/50">
                <h2 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">チャットルーム管理</h2>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">保有ポイント:</span>
                    <span className="text-yellow-400 font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">{userPoints} P</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <SettingItem icon={<ImageIcon size={20} className="text-pink-400" />} label="チャットイメージ" hasSwitch={true} switchState={showChatImage} onSwitchChange={() => onShowChatImageChange(!showChatImage)} />
                <SettingItem icon={<Film size={20} className="text-pink-400" />} label="マルチイメージ" hasSwitch={true} switchState={isMultiImage} onSwitchChange={() => onIsMultiImageChange(!isMultiImage)} />
                <SettingItem icon={<Palette size={20} className="text-pink-400" />} label="チャット表示設定" onClick={() => setIsStyleModalOpen(true)} />
                <SettingItem icon={<MessageSquare size={20} className="text-pink-400" />} label="会話内容を保存" onClick={() => setIsSaveModalOpen(true)} />
                <SettingItem icon={<BookUser size={20} className="text-pink-400" />} label="ユーザーノート" onClick={() => setNoteModalOpen(true)} />
                <SettingItem icon={<FileText size={20} className="text-pink-400" />} label="ペルソナ" href={personaHref} />
                <div className="p-3 bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 mb-2">
                    <SettingItem icon={<BookOpen size={20} className="text-pink-400" />} label="メモリブック" onClick={() => setIsBackMemoryModalOpen(true)} />
                    <p className="text-xs text-gray-400 mt-2 ml-12">会話の重要な内容を要約して保存。長い会話でもキャラクターが記憶を保持できます。</p>
                </div>
                <div className="p-3 bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 mb-2">
                    <SettingItem icon={<Brain size={20} className="text-pink-400" />} label="詳細記憶" onClick={() => setIsDetailedMemoryModalOpen(true)} />
                    <p className="text-xs text-gray-400 mt-2 ml-12">会話の特定の場面を個別に記録。キーワードで自動適用され、最大3つまで同時に適用されます。</p>
                </div>
            </div>
            <div className="p-4 mt-auto border-t border-gray-800/50">
                <button onClick={onNewChat} className="flex items-center w-full p-4 text-left text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 group">
                    <div className="p-2 rounded-lg bg-red-500/20 group-hover:bg-red-500/30 transition-all">
                        <Trash2 size={20} className="text-red-400" />
                    </div>
                    <span className="ml-3 group-hover:text-red-300 transition-colors">新しいチャット</span>
                </button>
            </div>
        </>
        {isNoteModalOpen && <NoteModal note={userNote} onSave={onSaveNote} onClose={() => setNoteModalOpen(false)} />}
        {isSaveModalOpen && <SaveConversationModal onSaveAsTxt={onSaveConversationAsTxt} onClose={() => setIsSaveModalOpen(false)} />}
        {isStyleModalOpen && <StyleSettingsModal settings={chatStyleSettings} onSave={handleSaveStyleSettings} onClose={() => setIsStyleModalOpen(false)} />}
      </div>
      {/* モーダルはChatSettingsの外に配置してz-indexの問題を回避 */}
      {isBackMemoryModalOpen && chatId && (
        <BackMemoryModal
          isOpen={isBackMemoryModalOpen}
          onClose={() => setIsBackMemoryModalOpen(false)}
          chatId={chatId}
          initialContent={backMemory.content}
          autoSummarize={backMemory.autoSummarize}
          onSave={handleSaveBackMemory}
          isSummarizing={isSummarizing}
          onSummarizeStart={() => setIsSummarizing(true)}
          onSummarizeEnd={() => setIsSummarizing(false)}
        />
      )}
      {isDetailedMemoryModalOpen && chatId && (
        <DetailedMemoryModal
          isOpen={isDetailedMemoryModalOpen}
          onClose={() => setIsDetailedMemoryModalOpen(false)}
          chatId={chatId}
          memories={detailedMemories}
          onSave={handleSaveDetailedMemory}
          onUpdate={handleUpdateDetailedMemory}
          onDelete={handleDeleteDetailedMemory}
          onAutoSummarize={handleAutoSummarizeDetailedMemory}
        />
      )}
    </div>
  );
}

