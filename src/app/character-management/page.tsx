"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
} from "lucide-react";

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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4 text-white">{title}</h2>
        <p className="text-sm text-gray-200 mb-6 whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex justify-end gap-4">
          <Button
            onClick={onClose}
            className="border border-gray-600 text-white hover:bg-gray-700 py-2 px-4 rounded-lg transition-colors"
          >
            {cancelText}
          </Button>
          <Button onClick={onConfirm} className="bg-red-600 text-white hover:bg-red-700 py-2 px-4 rounded-lg transition-colors">
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4 text-white">{title}</h2>
        <p className="text-sm text-gray-200 mb-6 whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex justify-end gap-4">
          <Button onClick={onClose} className="bg-pink-500 text-white hover:bg-pink-600 py-2 px-4 rounded-lg transition-colors">
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuItems = [
    { label: "修正", icon: Edit, action: "edit" },
    { label: "削除", icon: Trash2, action: "delete" },
    { label: "コピー", icon: Copy, action: "copy" },
    { label: "インポート", icon: Upload, action: "import" },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-700"
      >
        <MoreVertical size={20} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-[#2C2C2E] border border-gray-700 rounded-lg shadow-lg z-10">
          <ul>
            {menuItems.map((item) => (
              <li key={item.action}>
                <button
                  onClick={() => {
                    onAction(item.action, character);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-left text-white hover:bg-gray-700"
                >
                  <item.icon size={16} className="mr-3" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
              const response = await fetch(`/api/characters/${char.id}`, {
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
              const response = await fetch(
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
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        ローディング中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans max-w-4xl mx-auto">
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
            notification.type === "success" ? "bg-green-500" : "bg-red-500"
          } text-white px-4 py-2 rounded-lg shadow-lg z-50 whitespace-pre-wrap`}
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

      <header className="flex items-center justify-between py-4">
        <button
          onClick={() => window.history.back()}
          className="p-2 rounded-full hover:bg-gray-800"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">キャラクター管理</h1>
        <button
          onClick={() => window.location.href = "/characters/create"}
          className="p-2 rounded-full text-pink-500 hover:bg-gray-800"
        >
          <Plus size={24} />
        </button>
      </header>

      <nav className="flex space-x-4 border-b border-gray-700 mb-6">
        {["全体", "公開", "非公開", "リンク限定公開"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 px-1 text-sm transition-colors ${
              activeTab === tab
                ? "border-b-2 border-pink-500 text-white font-semibold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="space-y-3">
        {filteredCharacters.length > 0 ? (
          filteredCharacters.map((char) => (
            <div
              key={char.id}
              className="bg-[#1C1C1E] p-3 rounded-lg flex items-center gap-4"
            >
              <a href={`/chat/${char.id}`} className="flex-grow flex items-center gap-4 min-w-0">
                <Image
                  src={
                    char.characterImages[0]?.imageUrl ||
                    "https://placehold.co/64x64/1C1C1E/FFFFFF?text=..."
                  }
                  alt={char.name}
                  width={64}
                  height={64}
                  className="rounded-md object-cover w-16 h-16 flex-shrink-0"
                />
                <div className="flex-grow min-w-0">
                  <h2 className="font-semibold truncate">{char.name}</h2>
                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                    <span>{getVisibilityText(char.visibility)}</span>
                    <div className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      <span>{char._count?.chat || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart size={12} />
                      <span>{char._count?.favorites || 0}</span>
                    </div>
                  </div>
                </div>
              </a>
              
              <button 
                onClick={() => window.location.href = `/chat/${char.id}`}
                className="bg-pink-500 hover:bg-pink-600 transition-colors cursor-pointer text-white text-sm font-bold py-2 px-4 rounded-lg flex-shrink-0"
              >
                チャット
              </button>

              <div className="flex-shrink-0">
                <KebabMenu character={char} onAction={handleMenuAction} />
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-16">
            <p className="mb-2">作成したキャラクターがいません。</p>
            <p>「+」ボタンを押して新しいキャラクターを作成しましょう！</p>
          </div>
        )}
      </div>
    </div>
  );
}
