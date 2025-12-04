"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from 'next/image'; // 画像最適化のため追加
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Heart,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Upload,
  Loader2, // ローディングアイコンを追加
  HelpCircle,
} from "lucide-react";
import HelpModal from "@/components/HelpModal";
import { fetchWithCsrf } from "@/lib/csrf-client";

// Buttonの仮コンポーネント
const Button = ({ children, onClick, className, disabled }: { children: React.ReactNode, onClick: () => void, className?: string, disabled?: boolean }) => (
    <button onClick={onClick} className={className} disabled={disabled}>
        {children}
    </button>
);

// APIから受け取るキャラクターリストの型
type CharacterSummary = {
  id: number;
  name: string;
  visibility: string | null;
  safetyFilter: boolean | null;
  characterImages: { imageUrl: string }[];
  _count: {
    chat: number;
    favorites: number;
  };
};

// ▼▼▼【追加】Lorebookの型を定義します ▼▼▼
type Lorebook = {
  content: string;
  keywords: string[];
};
// ▲▲▲【追加】ここまで ▲▲▲

// コピー機能で使用する、より詳細なキャラクターの型
type CharacterDetail = Omit<CharacterSummary, "_count"> & {
  characterImages: {
    imageUrl: string;
    keyword: string | null;
    isMain: boolean;
    displayOrder: number;
  }[];
  description: string | null;
  systemTemplate: string | null;
  firstSituation: string | null;
  firstMessage: string | null;
  safetyFilter: boolean | null;
  category: string | null;
  hashtags: string[];
  detailSetting: string | null;
  // ▼▼▼【修正】`any[]`を上記で定義した`Lorebook[]`型に変更します ▼▼▼
  lorebooks: Lorebook[];
  // ▲▲▲【修正】ここまで ▲▲▲
};

// 確認モーダルのコンポーネント
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "確認",
  cancelText = "キャンセル",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-gray-900/95 backdrop-blur-xl text-white rounded-2xl p-6 w-full max-w-sm mx-4 border border-gray-700/50 shadow-2xl">
        <h2 className="text-xl font-bold mb-4 text-white bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="text-sm text-gray-300 mb-6 whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <Button
            onClick={onClose}
            className="border border-gray-600 text-white hover:bg-gray-700/50 py-2 px-4 rounded-xl transition-all"
          >
            {cancelText}
          </Button>
          <Button onClick={onConfirm} className="bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 py-2 px-4 rounded-xl transition-all shadow-lg shadow-red-500/30">
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

// アラートモーダルのコンポーネント
const AlertModal = ({
  isOpen,
  onClose,
  title,
  message,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-gray-900/95 backdrop-blur-xl text-white rounded-2xl p-6 w-full max-w-sm mx-4 border border-gray-700/50 shadow-2xl">
        <h2 className="text-xl font-bold mb-4 text-white bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="text-sm text-gray-300 mb-6 whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} className="bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700 py-2 px-4 rounded-xl transition-all shadow-lg shadow-pink-500/30">
            確認
          </Button>
        </div>
      </div>
    </div>
  );
};

// ケバブメニュー（...）のコンポーネント
const KebabMenu = ({
  character,
  onAction,
}: {
  character: CharacterSummary;
  onAction: (action: string, char: CharacterSummary) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const MENU_WIDTH = 160;

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.right + window.scrollX - MENU_WIDTH,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current?.contains(event.target as Node) ||
        menuRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      updateMenuPosition();
      window.addEventListener("scroll", updateMenuPosition, true);
      window.addEventListener("resize", updateMenuPosition);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [isOpen, updateMenuPosition]);

  const menuItems = [
    { label: "修正", icon: Edit, action: "edit" },
    { label: "削除", icon: Trash2, action: "delete" },
    { label: "コピー", icon: Copy, action: "copy" },
    { label: "インポート", icon: Upload, action: "import" },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
      >
        <MoreVertical size={20} />
      </button>
      {isOpen &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="absolute w-40 bg-gray-800/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl z-[9999] text-sm py-2"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <ul>
              {menuItems.map((item) => (
                <li key={item.action}>
                  <button
                    onClick={() => {
                      onAction(item.action, character);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-left !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:text-pink-300 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 group"
                  >
                    <item.icon size={16} className="mr-3 group-hover:scale-110 group-hover:text-pink-400 transition-all duration-300" />
                    <span className="group-hover:translate-x-1 transition-transform duration-300">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
};

export default function CharacterManagementPage() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false); // ▼▼▼【追加】インポート処理中の状態管理 ▼▼▼
  const [activeTab, setActiveTab] = useState("全体");
  const [userSafetyFilter, setUserSafetyFilter] = useState<boolean | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [copiedCharacterData, setCopiedCharacterData] =
    useState<CharacterDetail | null>(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onClose: () => {},
  });
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const showNotification = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 5000);
    },
    []
  );

  const fetchCharacters = useCallback(async () => {
    try {
      setLoading(true);
      // 自分が作成したキャラクターのみを取得
      const response = await fetch("/api/characters?mode=my");
      if (!response.ok)
        throw new Error("キャラクターの読み込みに失敗しました。");
      const data = await response.json();
      setCharacters(data);
    } catch (error) {
      console.error(error);
      showNotification(
        "エラー: キャラクターの読み込みに失敗しました。",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  useEffect(() => {
    // ユーザーのセーフティフィルター設定を取得
    const fetchSafetyFilter = async () => {
      try {
        const response = await fetch('/api/users/safety-filter', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          setUserSafetyFilter(data.safetyFilter ?? true);
        }
      } catch (error) {
        console.error('セーフティフィルター取得エラー:', error);
        setUserSafetyFilter(true); // デフォルトはON
      }
    };
    fetchSafetyFilter();
  }, []);

  const handleMenuAction = async (action: string, char: CharacterSummary) => {
    switch (action) {
      case "edit":
        window.location.href = `/characters/edit/${char.id}`;
        break;
      case "delete":
        setConfirmModal({
          isOpen: true,
          title: "キャラクター削除",
          message: `「${char.name}」を本当に削除しますか？\nこの操作は元に戻せません。`,
          onConfirm: async () => {
            try {
              const response = await fetchWithCsrf(`/api/characters/${char.id}`, {
                method: "DELETE",
              });
              if (!response.ok) throw new Error("削除に失敗しました。");
              showNotification("キャラクターを削除しました。", "success");
              fetchCharacters();
            } catch (error) {
              console.error(error);
              showNotification("エラー: 削除に失敗しました。", "error");
            }
            setConfirmModal({ ...confirmModal, isOpen: false });
          },
        });
        break;
      case "copy":
        try {
          const response = await fetch(`/api/characters/${char.id}`);
          if (!response.ok) throw new Error("コピーに失敗しました。");
          const data = await response.json();
          setCopiedCharacterData(data);
          showNotification(`「${data.name}」をコピーしました。`, "success");
        } catch (error)
          {
          console.error(error);
          showNotification("エラー: コピーに失敗しました。", "error");
        }
        break;
      // ▼▼▼【修正】インポート処理を同期的（ブロッキング）に変更します ▼▼▼
      case "import":
        if (!copiedCharacterData) {
          setAlertModal({
            isOpen: true,
            title: "エラー",
            message: "先に他のキャラクターを「コピー」してください。",
            onClose: () => setAlertModal({ ...alertModal, isOpen: false }),
          });
          return;
        }
        setConfirmModal({
          isOpen: true,
          title: "キャラクターのインポート",
          message: `「${char.name}」にコピーした「${copiedCharacterData.name}」の情報を上書きしますか？`,
          onConfirm: async () => {
            setConfirmModal({ ...confirmModal, isOpen: false });
            setIsImporting(true); // ローディング開始
            try {
              const response = await fetchWithCsrf(
                `/api/characters/${char.id}/import`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(copiedCharacterData),
                }
              );

              if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || "インポートに失敗しました。");
              }
              
              // ▼▼▼【追加】インポート後に該当キャラクターの一時保存データを削除 ▼▼▼
              try {
                if (typeof window !== "undefined") {
                  const draftKey = `character_draft_${char.id}`;
                  localStorage.removeItem(draftKey);
                  console.log("[CharacterManagement] インポート後に一時保存データを削除:", draftKey);
                }
              } catch (e) {
                console.warn("[CharacterManagement] 一時保存データ削除に失敗:", e);
              }
              // ▲▲▲【追加ここまで】▲▲▲

              setAlertModal({
                  isOpen: true,
                  title: "成功",
                  message: "インポートが完了しました！",
                  onClose: () => window.location.reload(), // 確認後リロード
              });

            } catch (error) {
              console.error(error);
              const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました。";
              setAlertModal({
                  isOpen: true,
                  title: "エラー",
                  message: `インポートに失敗しました。\n${errorMessage}`,
                  onClose: () => setAlertModal({ ...alertModal, isOpen: false }),
              });
            } finally {
              setIsImporting(false); // ローディング終了
            }
          },
        });
        break;
      // ▲▲▲【修正】ここまで ▲▲▲
      default:
        break;
    }
  };

  const getVisibilityText = (visibility: string | null) => {
    switch (visibility) {
      case "public":
        return "公開";
      case "private":
        return "非公開";
      case "link":
        return "リンク限定公開";
      default:
        return "非公開";
    }
  };

  const filteredCharacters = useMemo(() => {
    let filtered = characters;
    
    // セーフティフィルターがONの場合、OFFのキャラクターを除外
    if (userSafetyFilter === true) {
      filtered = filtered.filter(char => char.safetyFilter !== false);
    }
    
    if (activeTab === "全体") return filtered;
    const visibilityMap: { [key: string]: string | undefined } = {
      公開: "public",
      非公開: "private",
      リンク限定公開: "link",
    };
    const targetVisibility = visibilityMap[activeTab];
    return filtered.filter((char) => char.visibility === targetVisibility);
  }, [characters, activeTab, userSafetyFilter]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans max-w-4xl mx-auto" style={{ overflow: 'visible' }}>
      {/* ▼▼▼【追加】インポート処理中のローディング画面 ▼▼▼ */}
      {isImporting && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col justify-center items-center z-50">
              <Loader2 className="animate-spin text-pink-500 h-12 w-12 mb-4" />
              <p className="text-white text-lg font-semibold">インポート処理中...</p>
              <p className="text-gray-400">画像の枚数によって時間がかかる場合があります。</p>
          </div>
      )}
      {/* ▲▲▲【追加】ここまで ▲▲▲ */}

      {notification && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 ${
            notification.type === "success" 
              ? "bg-gradient-to-r from-green-500 to-emerald-600" 
              : "bg-gradient-to-r from-red-500 to-rose-600"
          } text-white px-6 py-3 rounded-xl shadow-2xl z-50 whitespace-pre-wrap backdrop-blur-sm border ${
            notification.type === "success" 
              ? "border-green-400/30" 
              : "border-red-400/30"
          }`}
        >
          {notification.message}
        </div>
      )}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={alertModal.onClose}
        title={alertModal.title}
        message={alertModal.message}
      />
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="キャラクター管理の使い方"
        content={
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">概要</h3>
              <p className="text-gray-300">
                作成したキャラクターを管理するページです。キャラクターの編集、削除、コピー、インポートなどの操作が可能です。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">タブ機能</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                <li><strong>全体</strong>: すべてのキャラクターを表示</li>
                <li><strong>公開</strong>: 公開設定のキャラクターのみ表示</li>
                <li><strong>非公開</strong>: 非公開設定のキャラクターのみ表示</li>
                <li><strong>リンク限定公開</strong>: リンク限定公開のキャラクターのみ表示</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">メニュー機能（...ボタン）</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                <li><strong>修正</strong>: キャラクターの設定を編集</li>
                <li><strong>削除</strong>: キャラクターを削除（元に戻せません）</li>
                <li><strong>コピー</strong>: キャラクターの情報をコピー（インポート用）</li>
                <li><strong>インポート</strong>: コピーしたキャラクター情報を別のキャラクターに適用</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">その他</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                <li><strong>チャット</strong>ボタン: キャラクターとチャットを開始</li>
                <li><strong>+</strong>ボタン: 新しいキャラクターを作成</li>
              </ul>
            </div>
          </div>
        }
      />

      <header className="flex items-center justify-between py-6 mb-6">
        <button
          onClick={() => window.history.back()}
          className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          キャラクター管理
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
            aria-label="ヘルプ"
          >
            <HelpCircle size={24} />
          </button>
          <button
            onClick={() => window.location.href = "/characters/create"}
            className="p-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white transition-all shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/50"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      <nav className="flex space-x-2 mb-6 overflow-x-auto pb-2">
        {["全体", "公開", "非公開", "リンク限定公開"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab
                ? "bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-pink-500/20 text-pink-300 border border-pink-500/30 shadow-lg shadow-pink-500/20"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="space-y-4" style={{ overflow: 'visible' }}>
        {filteredCharacters.length > 0 ? (
          filteredCharacters.map((char) => (
            <div
              key={char.id}
              className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-gray-800/50 hover:border-pink-500/30 transition-all relative group"
              style={{ overflow: 'visible' }}
            >
              <div className="flex items-center gap-4">
                <a href={`/characters/${char.id}`} className="flex-grow flex items-center gap-4 min-w-0">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl overflow-hidden ring-2 ring-pink-500/20 group-hover:ring-pink-500/40 transition-all">
                    <Image
                      src={
                        char.characterImages[0]?.imageUrl ||
                        "https://placehold.co/80x80/1C1C1E/FFFFFF?text=..."
                      }
                      alt={char.name}
                      width={80}
                      height={80}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h2 className="font-bold text-lg text-white truncate group-hover:text-pink-300 transition-colors">
                      {char.name}
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-2">
                      <span className="px-2 py-1 rounded-lg bg-gray-800/50 text-xs font-medium">
                        {getVisibilityText(char.visibility)}
                      </span>
                      <div className="flex items-center gap-1">
                        <MessageSquare size={14} className="text-pink-400/70" />
                        <span>{char._count?.chat || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart size={14} className="text-pink-400/70" />
                        <span>{char._count?.favorites || 0}</span>
                      </div>
                    </div>
                  </div>
                </a>
                
                <button 
                  onClick={() => window.location.href = `/chat/${char.id}`}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/50 flex-shrink-0"
                >
                  チャット
                </button>

                <div className="flex-shrink-0">
                  <KebabMenu character={char} onAction={handleMenuAction} />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-12 border border-gray-800/50 text-center">
            <p className="text-gray-400 mb-2 text-lg">作成したキャラクターがいません。</p>
            <p className="text-gray-500 text-sm">「+」ボタンを押して新しいキャラクターを作成しましょう！</p>
          </div>
        )}
      </div>
    </div>
  );
}
