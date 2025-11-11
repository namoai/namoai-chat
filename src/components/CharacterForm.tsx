"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// ▼▼▼【修正】コンパイルエラーを解消するため、next/imageのインポートを削除します ▼▼▼
// import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { X, Plus, Trash2, GripVertical } from "lucide-react";
import { uploadImageToStorage } from "@/lib/supabase-client";

// --- 定数と型定義（共通） ---
const CATEGORIES = [
  "シミュレーション", "ロマンス", "ファンタジー/SF", "ドラマ", "武侠/時代劇", "GL", "BL",
  "ホラー/ミステリー", "アクション", "コメディ/日常", "スポーツ/学園", "その他",
];
const SUGGESTED_HASHTAGS = [
  "コスモス", "女性", "純愛", "ファンタジー", "男性", "堕落", "BL", "支配",
  "策略", "疲弊", "貴族", "獣人", "誘惑", "破滅", "異世界", "メイド", "学校",
  "絶望", "人妻", "幼馴染", "ショタ", "研究員", "ツンデレ", "シミュレーション",
  "巨乳", "年上", "シスコン", "ヤンデレ", "魔王", "アイドル", "チャット",
  "青春", "学園", "日常", "母親", "超能力", "妹",
];

type Lorebook = {
  id?: number;
  content: string;
  keywords: string[];
};

type FormState = {
  name: string;
  description: string;
  systemTemplate: string;
  detailSetting: string;
  firstSituation: string;
  firstMessage: string;
  visibility: "public" | "private" | "link";
  safetyFilter: boolean;
  category: string;
  hashtags: string[];
  firstSituationDate: string;
  firstSituationPlace: string;
  statusWindowPrompt: string;
  statusWindowDescription: string;
};

type DisplayImage = {
  id?: number;
  imageUrl?: string;
  file?: File;
  keyword: string;
};

type ManualSession = {
  user?: {
      id?: string | null;
  } | null;
} | null;

interface CharacterFormProps {
  isEditMode: boolean;
  initialData?: Partial<FormState & {
    id: string;
    characterImages: { id: number; imageUrl: string; keyword: string | null }[],
    lorebooks: Lorebook[]
  }>;
  session: ManualSession;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

type ModalState = {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
};

const NotificationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
    if (!modalState.isOpen) return null;
    const handleConfirm = () => {
        modalState.onConfirm?.();
        setModalState({ isOpen: false, title: '', message: '' });
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
                <h2 className="text-xl font-bold mb-4 text-white">{modalState.title}</h2>
                <p className="text-gray-200 mb-6">{modalState.message}</p>
                <div className="flex justify-end">
                    <Button onClick={handleConfirm} className="bg-pink-600 text-white hover:bg-pink-500">
                        確認
                    </Button>
                </div>
            </div>
        </div>
    );
};

interface HashtagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (hashtags: string[]) => void;
  initialHashtags: string[];
}
const HashtagModal = ({ isOpen, onClose, onComplete, initialHashtags }: HashtagModalProps) => {
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(initialHashtags));
    const [searchTerm, setSearchTerm] = useState("");
    const [customTag, setCustomTag] = useState("");
    const isLimitReached = selectedTags.size >= 5;
  
    useEffect(() => {
        setSelectedTags(new Set(initialHashtags));
    }, [initialHashtags]);

    if (!isOpen) return null;
  
    const filteredHashtags = SUGGESTED_HASHTAGS.filter((tag) =>
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
    const handleToggleTag = (tag: string) => {
      const newTags = new Set(selectedTags);
      if (newTags.has(tag)) {
        newTags.delete(tag);
      } else {
        if (isLimitReached) return;
        newTags.add(tag);
      }
      setSelectedTags(newTags);
    };
  
    const handleAddCustomTag = () => {
      if (isLimitReached) return;
      if (customTag && !selectedTags.has(customTag)) {
        const newTags = new Set(selectedTags);
        newTags.add(customTag);
        setSelectedTags(newTags);
        setCustomTag("");
      }
    };
  
    const handleComplete = () => {
      onComplete(Array.from(selectedTags));
      onClose();
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">ハッシュタグ登録</h2>
            <button onClick={onClose}><X size={24} /></button>
          </div>
          <input
            type="text"
            placeholder="ハッシュタグを検索してください"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <p className="text-sm text-right mb-2 text-gray-400">{selectedTags.size} / 5</p>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto mb-4 pr-2">
            {filteredHashtags.map((tag) => {
              const isSelected = selectedTags.has(tag);
              const isDisabled = !isSelected && isLimitReached;
              return (
                <button
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  disabled={isDisabled}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${isSelected ? "bg-red-500 text-white font-semibold" : "bg-gray-600 hover:bg-gray-500"} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-700 pt-4">
            <p className="text-sm text-gray-400 mb-2">希望のハッシュタグが見つかりませんか？</p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={isLimitReached ? "5個まで選択可能です" : "直接入力"}
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                disabled={isLimitReached}
                className="flex-grow bg-gray-700 border-gray-600 focus:ring-red-500 text-white disabled:opacity-50"
              />
              <Button onClick={handleAddCustomTag} disabled={isLimitReached || !customTag} className="bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
                追加
              </Button>
            </div>
          </div>
          <Button onClick={handleComplete} className="w-full bg-red-500 hover:bg-red-600 rounded-md py-2 mt-6 font-bold">
            完了
          </Button>
        </div>
      </div>
    );
};


export default function CharacterForm({ isEditMode, initialData, session, status }: CharacterFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  
  const [form, setForm] = useState<FormState>({
    name: "", description: "", systemTemplate: "", detailSetting: "",
    firstSituation: "", firstMessage: "", visibility: "public",
    safetyFilter: true, category: "", hashtags: [],
    firstSituationDate: "",
    firstSituationPlace: "",
    statusWindowPrompt: "",
    statusWindowDescription: "",
  });
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  
  const [images, setImages] = useState<DisplayImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<number[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isHashtagModalOpen, setIsHashtagModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });
  // ▼▼▼【画像アップロード進行状況】▼▼▼
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  // ▲▲▲
  // ▼▼▼【自動生成】▼▼▼
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [isGeneratingDetail, setIsGeneratingDetail] = useState(false);
  // ▲▲▲

  // ▼▼▼【修正】initialDataを1回だけ読み込むためのフラグ ▼▼▼
  const [isInitialized, setIsInitialized] = useState(false);
  // ▲▲▲

  useEffect(() => {
    // 初回のみinitialDataからロード（画像を上書きしないように）
    if (isEditMode && initialData && !isInitialized) {
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        systemTemplate: initialData.systemTemplate || "",
        detailSetting: initialData.detailSetting || "",
        firstSituation: initialData.firstSituation || "",
        firstMessage: initialData.firstMessage || "",
        visibility: (initialData.visibility as FormState['visibility']) || "public",
        safetyFilter: initialData.safetyFilter ?? true,
        category: initialData.category || "",
        hashtags: initialData.hashtags || [],
        firstSituationDate: initialData.firstSituationDate ? new Date(initialData.firstSituationDate).toISOString().split('T')[0] : "",
        firstSituationPlace: initialData.firstSituationPlace || "",
        statusWindowPrompt: initialData.statusWindowPrompt || "",
        statusWindowDescription: initialData.statusWindowDescription || "",
      });
      
      // 編集モードの場合のみ既存画像をロード（新規作成時は空のまま）
      if (initialData.characterImages && initialData.characterImages.length > 0) {
        setImages(
          initialData.characterImages.map((img) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            keyword: img.keyword || "",
          }))
        );
      }
      
      setLorebooks(initialData.lorebooks || []);
      setIsInitialized(true);
      console.log('[初期化] initialDataから読み込み完了');
    }
  }, [isEditMode, initialData, isInitialized]);

  // ▼▼▼【ページ離脱防止】作成中のデータがある場合は警告を表示 ▼▼▼
  useEffect(() => {
    const hasUnsavedChanges = 
      form.name.trim() !== "" || 
      form.description.trim() !== "" || 
      images.some(img => img.file) || // 新規アップロード画像がある
      lorebooks.length > 0;

    // ブラウザのタブを閉じる/新規タブへの移動を防止
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isSubmitting) {
        e.preventDefault();
        return (e.returnValue = "作成中のデータが失われます。本当に離れますか？");
      }
    };

    // サイト内リンククリック時の警告
    const handleClick = (e: MouseEvent) => {
      if (hasUnsavedChanges && !isSubmitting) {
        const target = e.target as HTMLElement;
        const link = target.closest("a");
        
        // リンククリックの場合のみ確認
        if (link && link.href && !link.href.startsWith("javascript:")) {
          const confirmLeave = window.confirm(
            "作成中のデータが失われます。本当に離れますか？\n\n添付した画像は保存されません。"
          );
          if (!confirmLeave) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true); // キャプチャフェーズで実行
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [form.name, form.description, images, lorebooks, isSubmitting]);
  // ▲▲▲【ページ離脱防止 終了】▲▲▲

  useEffect(() => {
    if (status === "unauthenticated") {
        setModalState({
            isOpen: true,
            title: 'ログインが必要です',
            message: 'この機能を利用するにはログインが必要です。ログインページに移動します。',
            onConfirm: () => window.location.href = "/login",
        });
    }
  }, [status]);

  const handleChange = (field: keyof FormState, value: string | boolean | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // ▼▼▼【自動生成】プロフィール自動生成 ▼▼▼
  const handleGenerateProfile = async () => {
    setIsGeneratingProfile(true);
    try {
      const response = await fetch('/api/characters/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre: form.category || undefined,
          characterType: undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('プロフィール生成に失敗しました');
      }

      const data = await response.json();
      if (data.success) {
        handleChange('name', data.name || '');
        handleChange('description', data.description || '');
        setModalState({
          isOpen: true,
          title: '成功',
          message: 'プロフィールが自動生成されました。',
        });
      } else {
        throw new Error(data.error || 'プロフィール生成に失敗しました');
      }
    } catch (error) {
      console.error('プロフィール生成エラー:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: error instanceof Error ? error.message : 'プロフィール生成に失敗しました。',
      });
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  // ▼▼▼【自動生成】詳細設定自動生成 ▼▼▼
  const handleGenerateDetail = async () => {
    if (!form.name && !form.description) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '詳細設定を生成するには、名前または作品紹介が必要です。',
      });
      return;
    }

    setIsGeneratingDetail(true);
    try {
      const response = await fetch('/api/characters/generate-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
        }),
      });

      if (!response.ok) {
        throw new Error('詳細設定生成に失敗しました');
      }

      const data = await response.json();
      if (data.success) {
        handleChange('detailSetting', data.detailSetting || '');
        setModalState({
          isOpen: true,
          title: '成功',
          message: '詳細設定が自動生成されました。',
        });
      } else {
        throw new Error(data.error || '詳細設定生成に失敗しました');
      }
    } catch (error) {
      console.error('詳細設定生成エラー:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: error instanceof Error ? error.message : '詳細設定生成に失敗しました。',
      });
    } finally {
      setIsGeneratingDetail(false);
    }
  };
  // ▲▲▲
  
  const handleAddLorebook = () => {
    if (lorebooks.length >= 100) {
      setModalState({ isOpen: true, title: '上限到達', message: 'ロアブックは最大100個まで作成できます。' });
      return;
    }
    setLorebooks(prev => [...prev, { content: "", keywords: [] }]);
  };

  const handleDeleteLorebook = (index: number) => {
    setLorebooks(prev => prev.filter((_, i) => i !== index));
  };

  const handleLorebookContentChange = (index: number, content: string) => {
    setLorebooks(prev => prev.map((lore, i) => i === index ? { ...lore, content } : lore));
  };

  const handleAddKeyword = (index: number, keyword: string) => {
    if (!keyword.trim()) return;
    const newLorebooks = [...lorebooks];
    const currentKeywords = newLorebooks[index].keywords;
    if (currentKeywords.length >= 5) {
      setModalState({ isOpen: true, title: '上限到達', message: 'キーワードは1つの項目に最大5個まで登録できます。'});
      return;
    }
    if (!currentKeywords.includes(keyword.trim())) {
      newLorebooks[index].keywords.push(keyword.trim());
      setLorebooks(newLorebooks);
    }
  };

  const handleDeleteKeyword = (lorebookIndex: number, keywordIndex: number) => {
    const newLorebooks = [...lorebooks];
    newLorebooks[lorebookIndex].keywords.splice(keywordIndex, 1);
    setLorebooks(newLorebooks);
  };
  
  // ▼▼▼【画像圧縮】大きな画像を自動圧縮 ▼▼▼
  const compressImage = async (file: File): Promise<File> => {
    // 1MB以下の画像はそのまま返す
    if (file.size <= 1024 * 1024) {
      return file;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 最大サイズを1920pxに制限
          const maxSize = 1920;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height * maxSize) / width;
              width = maxSize;
            } else {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                console.log(`[画像圧縮] ${file.name}: ${Math.round(file.size / 1024)}KB → ${Math.round(compressedFile.size / 1024)}KB`);
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.85 // 品質85%
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };
  // ▲▲▲【画像圧縮 終了】▲▲▲

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 10) {
      setModalState({ isOpen: true, title: 'アップロード上限', message: '画像は最大10枚までアップロードできます。' });
      return;
    }

    // ▼▼▼【画像圧縮】ファイルを圧縮してから追加 ▼▼▼
    const compressedFiles = await Promise.all(files.map(compressImage));
    const newImages: DisplayImage[] = compressedFiles.map((file) => ({ file, keyword: "" }));
    setImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
    // ▲▲▲
  };

  const handleImageDelete = (indexToDelete: number) => {
    const imageToDelete = images[indexToDelete];
    if (imageToDelete.id) {
      setImagesToDelete((prev) => [...prev, imageToDelete.id!]);
    }
    setImages((prev) => prev.filter((_, index) => index !== indexToDelete));
  };

  const openImageModal = (index: number) => {
    if (index === 0) return;
    setSelectedIndex(index);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedIndex(null);
  };

  const updateKeyword = (value: string) => {
    if (selectedIndex === null) return;
    setImages((prev) =>
      prev.map((img, i) => (i === selectedIndex ? { ...img, keyword: value } : img))
    );
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setModalState({ isOpen: true, title: '入力エラー', message: 'キャラクターの名前は必須項目です。' });
      return;
    }
    if (images.length === 0) {
      setModalState({ isOpen: true, title: '入力エラー', message: 'キャラクターの画像を1枚以上登録してください。' });
      return;
    }
    if (!session?.user?.id) {
        setModalState({ 
            isOpen: true, 
            title: 'セッションエラー', 
            message: 'ログインセッションが見つかりません。再度ログインしてください。', 
            onConfirm: () => window.location.href = "/login" 
        });
        return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // ▼▼▼【直接アップロード】新しい画像をSupabaseに直接アップロード ▼▼▼
      const uploadedImageData: Array<{ imageUrl: string; keyword: string }> = [];
      const newImagesToUpload = images.filter(img => img.file);
      
      if (newImagesToUpload.length > 0) {
        setUploadProgress({ current: 0, total: newImagesToUpload.length });
        
        for (let i = 0; i < newImagesToUpload.length; i++) {
          const img = newImagesToUpload[i];
          try {
            const imageUrl = await uploadImageToStorage(img.file!);
            uploadedImageData.push({ imageUrl, keyword: img.keyword });
            setUploadProgress({ current: i + 1, total: newImagesToUpload.length });
          } catch (uploadError) {
            throw new Error(`画像 ${i + 1} のアップロードに失敗しました: ${uploadError instanceof Error ? uploadError.message : '不明なエラー'}`);
          }
        }
        
        setUploadProgress(null);
      }

      // 既存の画像（編集モード用）
      const existingImages = images
        .filter(img => !img.file && img.imageUrl)
        .map(img => ({ imageUrl: img.imageUrl!, keyword: img.keyword }));
      
      // 全ての画像データをマージ
      const allImages = [...existingImages, ...uploadedImageData];
      // ▲▲▲【直接アップロード 終了】▲▲▲

      // ▼▼▼【JSON送信】FormDataの代わりにJSONで送信 ▼▼▼
      const requestData = {
        ...form,
        userId: session.user.id,
        lorebooks,
        images: allImages, // { imageUrl, keyword }[]
        imagesToDelete: isEditMode ? imagesToDelete : [],
      };

      const url = isEditMode ? `/api/characters/${initialData?.id}` : "/api/characters";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });
      // ▲▲▲【JSON送信 終了】▲▲▲

      if (!response.ok) {
        // ▼▼▼【修正】エラーレスポンスの安全な処理（Response cloneを使用） ▼▼▼
        let errorMessage = "サーバーリクエストに失敗しました。";
        try {
          // responseをcloneして複数回読めるようにする
          const clonedResponse = response.clone();
          const errorData = await clonedResponse.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // JSON解析失敗時は元のresponseからテキストで取得
          try {
            const errorText = await response.text();
            console.error('サーバーエラー (非JSON):', errorText);
            errorMessage = `サーバーエラー (${response.status}): ${errorText.substring(0, 100)}`;
          } catch {
            errorMessage = `サーバーエラー (${response.status})`;
          }
        }
        throw new Error(errorMessage);
        // ▲▲▲
      }

      setModalState({
        isOpen: true,
        title: '成功',
        message: isEditMode ? "キャラクター情報が更新されました。" : "キャラクターが正常に登録されました！",
        onConfirm: () => router.push("/MyPage"),
      });

    } catch (error) {
      console.error(isEditMode ? "キャラクター更新失敗:" : "キャラクター登録失敗:", error);
      setModalState({ isOpen: true, title: 'エラー', message: `エラー: ${error instanceof Error ? error.message : "不明なエラーが発生しました。"}`});
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-black text-white flex justify-center items-center"><p>ローディング中...</p></div>;
  }
  
  const STEPS = ["プロフィール", "画像", "詳細情報", "開始状況", "その他設定", "ステータス", "ロアブック", "登録"];

  return (
    <>
      <NotificationModal modalState={modalState} setModalState={setModalState} />
      
      {/* ▼▼▼【アップロード進行状況表示】▼▼▼ */}
      {uploadProgress && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-8 rounded-lg max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-center">画像をアップロード中...</h3>
            <div className="mb-4">
              <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-pink-500 h-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
            <p className="text-center text-gray-400">
              {uploadProgress.current} / {uploadProgress.total} 枚完了
            </p>
          </div>
        </div>
      )}
      {/* ▲▲▲【アップロード進行状況表示 終了】▲▲▲ */}

      <div className="min-h-screen bg-black text-white px-2 sm:px-4 py-4 sm:py-8 max-w-4xl mx-auto font-sans">
        <button onClick={() => window.history.back()} className="mb-3 sm:mb-4 text-pink-400 hover:underline cursor-pointer text-sm sm:text-base">
          ← 戻る
        </button>
        <h1 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 px-2 sm:px-0">
          {isEditMode ? "キャラクター修正" : "キャラクター作成"}
        </h1>

        {/* モバイル: ドロップダウン, デスクトップ: タブ */}
        <div className="mb-4 sm:mb-8">
          {/* モバイル用ドロップダウン */}
          <div className="sm:hidden mb-4">
            <select
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-pink-500"
            >
              {STEPS.map((label, index) => (
                <option key={label} value={index}>
                  {index + 1}. {label}
                </option>
              ))}
            </select>
          </div>
          
          {/* デスクトップ用タブ */}
          <div className="hidden sm:flex flex-wrap gap-1">
            {STEPS.map((label, index) => (
              <button
                key={label}
                onClick={() => setStep(index)}
                className={`px-2 sm:px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  step === index
                    ? "bg-gray-800 text-pink-400 border-b-2 border-pink-500 shadow-lg"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-900/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: step === 0 ? 'block' : 'none' }} className="min-h-[400px]">
            <div className="space-y-4 sm:space-y-6 bg-gray-900/30 rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                    <label className="block text-sm sm:text-base font-semibold text-gray-200">プロフィール</label>
                    <Button 
                        onClick={handleGenerateProfile} 
                        disabled={isGeneratingProfile}
                        className="bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-all w-full sm:w-auto"
                    >
                        {isGeneratingProfile ? '生成中...' : '自動生成'}
                    </Button>
                </div>
                <div>
                    <Input 
                        placeholder="キャラクターの名前を入力してください" 
                        value={form.name} 
                        maxLength={20} 
                        onChange={(e) => handleChange("name", e.target.value)} 
                        className="rounded-md bg-gray-800 border-gray-700 focus:border-pink-500" 
                    />
                    <p className="text-xs text-right text-gray-500 mt-1">
                        {form.name.length} / 20
                    </p>
                </div>
                <div>
                    <Textarea 
                        placeholder="キャラクター紹介文を入力してください" 
                        value={form.description} 
                        maxLength={250} 
                        onChange={(e) => handleChange("description", e.target.value)} 
                        className="h-24 sm:h-32 rounded-md bg-gray-800 border-gray-700 focus:border-pink-500 text-sm sm:text-base" 
                    />
                    <p className="text-xs text-right text-gray-500 mt-1">
                        {form.description.length} / 250
                    </p>
                </div>
            </div>
        </div>

        <div style={{ display: step === 1 ? 'block' : 'none' }} className="min-h-[400px]">
            <div className="bg-gray-900/30 rounded-lg p-4 sm:p-6">
                <label className="block text-sm sm:text-base font-semibold text-gray-200 mb-3 sm:mb-4">キャラクター画像</label>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-pink-600 file:text-white hover:file:bg-pink-700 file:cursor-pointer cursor-pointer" />
                <p className="text-xs text-gray-500 mt-2">画像ファイルを選択してください（最大10枚まで）。</p>
                <div className="mt-4 sm:mt-6 flex flex-wrap gap-3 sm:gap-4">
                {images.map((img, idx) => (
                    <div key={img.id || `new-${idx}`} className="relative w-20 h-20 sm:w-24 sm:h-24 group">
                        <div onClick={() => openImageModal(idx)} className="w-full h-full border-2 border-gray-700 rounded-lg overflow-hidden cursor-pointer transition-all hover:border-pink-500 hover:shadow-lg">
                            <img src={img.file ? URL.createObjectURL(img.file) : img.imageUrl!} alt={`image-${idx}`} width={96} height={96} className="object-cover w-full h-full" />
                            <div className="absolute bottom-0 bg-black/70 text-xs text-white w-full text-center px-1 py-1 truncate">
                            {idx === 0 ? "基本画像" : img.keyword || "クリックで入力"}
                            </div>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleImageDelete(idx); }} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white shadow-lg transition-transform hover:scale-110 z-10 opacity-0 group-hover:opacity-100" aria-label="画像を削除">
                            <X size={16} />
                        </button>
                    </div>
                ))}
                </div>
            </div>
        </div>
        
        <div style={{ display: step === 2 ? 'block' : 'none' }} className="min-h-[400px]">
            <div className="space-y-4 sm:space-y-6 bg-gray-900/30 rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                    <label className="block text-sm sm:text-base font-semibold text-gray-200">詳細情報</label>
                    <Button 
                        onClick={handleGenerateDetail} 
                        disabled={isGeneratingDetail || (!form.name && !form.description)}
                        className="bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                    >
                        {isGeneratingDetail ? '生成中...' : '自動生成'}
                    </Button>
                </div>
                <div>
                    <Textarea 
                        placeholder="キャラクターの詳細設定（外見・性格・背景など）" 
                        value={form.detailSetting} 
                        className="h-48 sm:h-64 rounded-md bg-gray-800 border-gray-700 focus:border-pink-500 text-sm sm:text-base" 
                        maxLength={5000} 
                        onChange={(e) => handleChange("detailSetting", e.target.value)} 
                    />
                    <p className="text-xs text-gray-400 mt-2">{'`{{char}}` と `{{user}}` を使用して、キャラクター名とユーザー名を動的に挿入できます。'}</p>
                    <p className="text-xs text-right text-gray-500 mt-1">
                        {form.detailSetting.length} / 5000
                    </p>
                </div>
            </div>
        </div>

        <div style={{ display: step === 3 ? 'block' : 'none' }} className="min-h-[400px]">
            <div className="space-y-4 sm:space-y-6 bg-gray-900/30 rounded-lg p-4 sm:p-6">
                <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">最初の状況</label>
                    <Textarea 
                        placeholder="最初の状況を入力してください" 
                        value={form.firstSituation} 
                        maxLength={1000} 
                        className="h-32 sm:h-40 rounded-md bg-gray-800 border-gray-700 focus:border-pink-500 text-sm sm:text-base" 
                        onChange={(e) => handleChange("firstSituation", e.target.value)} 
                    />
                    <p className="text-xs text-right text-gray-500 mt-1">
                        {form.firstSituation.length} / 1000
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">キャラクターの最初のメッセージ</label>
                    <Textarea 
                        placeholder="キャラクターの最初のメッセージを入力してください" 
                        value={form.firstMessage} 
                        maxLength={500} 
                        className="h-24 sm:h-32 rounded-md bg-gray-800 border-gray-700 focus:border-pink-500 text-sm sm:text-base" 
                        onChange={(e) => handleChange("firstMessage", e.target.value)} 
                    />
                    <p className="text-xs text-right text-gray-500 mt-1">
                        {form.firstMessage.length} / 500
                    </p>
                </div>
                <p className="text-xs text-gray-400">{'`{{char}}` と `{{user}}` を使用して、キャラクター名とユーザー名を動的に挿入できます。'}</p>
            </div>
        </div>

        <div style={{ display: step === 4 ? 'block' : 'none' }} className="min-h-[400px]">
            <div className="bg-gray-900/30 rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div>
                    <span className="block text-sm font-medium text-gray-200 mb-2">公開範囲</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <label className="inline-flex items-center"><input type="radio" name="visibility" value="public" checked={form.visibility === "public"} onChange={() => handleChange("visibility", "public")} className="form-radio text-pink-500 bg-gray-700 border-gray-600" /><span className="ml-2">公開</span></label>
                    <label className="inline-flex items-center"><input type="radio" name="visibility" value="private" checked={form.visibility === "private"} onChange={() => handleChange("visibility", "private")} className="form-radio text-pink-500 bg-gray-700 border-gray-600" /><span className="ml-2">非公開</span></label>
                    <label className="inline-flex items-center"><input type="radio" name="visibility" value="link" checked={form.visibility === "link"} onChange={() => handleChange("visibility", "link")} className="form-radio text-pink-500 bg-gray-700 border-gray-600" /><span className="ml-2">リンク限定公開</span></label>
                    </div>
                </div>
                <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-200 mr-4">セーフティフィルター</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.safetyFilter} onChange={() => handleChange("safetyFilter", !form.safetyFilter)} />
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-pink-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    <span className="ml-3 text-sm text-gray-200">{form.safetyFilter ? "On" : "Off"}</span>
                    </label>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-2">カテゴリー</h3>
                    <p className="text-xs text-gray-400 mb-3">キャラクターが活動するテーマを選択してください。</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                    {CATEGORIES.map((category) => (
                        <button 
                            key={category} 
                            type="button" 
                            onClick={() => handleChange("category", category)} 
                            className={`py-3 px-2 rounded-lg transition-all text-center text-sm font-medium ${
                                form.category === category 
                                    ? "bg-pink-600 text-white font-bold shadow-lg scale-105" 
                                    : "bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white"
                            }`}
                        >
                        {category}
                        </button>
                    ))}
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-2">ハッシュタグ</h3>
                    <p className="text-xs text-gray-400 mb-3">最大5個、最小1個以上のタグを選択してください。</p>
                    <div onClick={() => setIsHashtagModalOpen(true)} className="bg-gray-800 border border-gray-700 rounded-md p-3 min-h-[48px] cursor-pointer flex flex-wrap gap-2 items-center">
                    {form.hashtags.length === 0 ? (<span className="text-gray-500">ハッシュタグを登録してください。</span>) : (form.hashtags.map((tag) => (<span key={tag} className="bg-pink-500 text-white text-sm font-semibold px-2 py-1 rounded">#{tag}</span>)))}
                    </div>
                </div>
            </div>
        </div>

        <div style={{ display: step === 5 ? 'block' : 'none' }} className="min-h-[400px]">
            <div className="space-y-4 sm:space-y-6 bg-gray-900/30 rounded-lg p-4 sm:p-6">
                <div className="p-3 sm:p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h3 className="font-bold text-lg">ステータスウィンドウ設定</h3>
                    <p className="text-sm text-gray-400 mt-1">
                        チャット画面で表示されるステータスウィンドウの内容と説明を設定します。<br />
                        <span className="text-pink-400 font-semibold">ステータスウィンドウの内容は、状況に応じて変動する理由が発生した場合のみ変動し、それ以外は設定した形式を維持します。</span>
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        ステータスウィンドウ内容 (500字以内)
                    </label>
                    <Textarea 
                        placeholder="例: 呼び出し度: 50/100, 関係性: 友人, 場所: 教室" 
                        value={form.statusWindowPrompt} 
                        maxLength={500} 
                        onChange={(e) => handleChange("statusWindowPrompt", e.target.value)} 
                        className="h-24 sm:h-32 rounded-md bg-gray-800 border-gray-700 focus:border-pink-500 text-sm sm:text-base"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        AIがステータスウィンドウに表示する内容の形式を設定します。変動する項目（数値など）を指定してください。
                    </p>
                    <p className="text-xs text-right text-gray-500 mt-1">
                        {form.statusWindowPrompt.length} / 500
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        ステータスウィンドウ説明 (1000字以内)
                    </label>
                    <Textarea 
                        placeholder="例: 呼び出し度 0-10: 全く関係がない, 10-20: 少し興味がある, 20-30: 友人関係, 30-50: 親しい友人, 50-70: 恋人候補, 70-90: 恋人, 90-100: 最愛の人" 
                        value={form.statusWindowDescription} 
                        maxLength={1000} 
                        onChange={(e) => handleChange("statusWindowDescription", e.target.value)} 
                        className="h-36 sm:h-48 rounded-md bg-gray-800 border-gray-700 focus:border-pink-500 text-sm sm:text-base"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        ステータス項目の値の範囲ごとの意味を説明します。例: 呼び出し度 0-10は「全く関係がない」、10-20は「少し興味がある」など。
                    </p>
                    <p className="text-xs text-right text-gray-500 mt-1">
                        {form.statusWindowDescription.length} / 1000
                    </p>
                </div>
            </div>
        </div>

        <div style={{ display: step === 6 ? 'block' : 'none' }} className="min-h-[400px]">
            <div className="space-y-4 sm:space-y-6 bg-gray-900/30 rounded-lg p-4 sm:p-6">
                <div className="p-3 sm:p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h3 className="font-bold text-lg">ロアブック</h3>
                    <p className="text-sm text-gray-400 mt-1">
                        世界観、設定、人物情報などをキーワードと紐付けてAIに記憶させます。(最大100件)<br />
                        <span className="text-pink-400 font-semibold">最大5個のロアブックを同時に使用でき、上位のロアブックが優先的に適用されます。</span>
                    </p>
                </div>
                {lorebooks.map((lore, index) => (
                    <LorebookItem 
                        key={index} 
                        lorebook={lore} 
                        index={index} 
                        onContentChange={handleLorebookContentChange} 
                        onAddKeyword={handleAddKeyword} 
                        onDeleteKeyword={handleDeleteKeyword} 
                        onDeleteLorebook={handleDeleteLorebook} />
                ))}
                <Button onClick={handleAddLorebook} disabled={lorebooks.length >= 100} className="w-full border-2 border-dashed border-gray-600 hover:bg-gray-700 text-gray-400">
                    <Plus className="mr-2 h-4 w-4" /> ロアブックを追加
                </Button>
            </div>
        </div>

        <div style={{ display: step === 7 ? 'block' : 'none' }} className="min-h-[400px]">
            <div className="space-y-4 sm:space-y-6 bg-gray-900/30 rounded-lg p-4 sm:p-6">
                <div className="p-3 sm:p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h3 className="font-bold text-lg">キャラクター情報</h3>
                    <p className="text-sm text-gray-400 mt-1">キャラクターの追加情報を入力します。</p>
                </div>
                <div>
                    <label htmlFor="firstSituationDate" className="block text-sm font-medium text-gray-300 mb-2">日付</label>
                    <Input id="firstSituationDate" type="date" value={form.firstSituationDate} onChange={(e) => handleChange("firstSituationDate", e.target.value)} className="bg-gray-800 border-gray-700 focus:border-pink-500" />
                </div>
                <div>
                    <label htmlFor="firstSituationPlace" className="block text-sm font-medium text-gray-300 mb-2">場所</label>
                    <Input id="firstSituationPlace" type="text" placeholder="場所を入力してください" value={form.firstSituationPlace} onChange={(e) => handleChange("firstSituationPlace", e.target.value)} className="bg-gray-800 border-gray-700 focus:border-pink-500" />
                </div>
            </div>
        </div>
        
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-800 px-2 sm:px-0">
            <Button 
                variant="outline" 
                onClick={() => setStep(s => Math.max(0, s - 1))} 
                disabled={step === 0}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm sm:text-base py-2 sm:py-2"
            >
                前の段階へ
            </Button>
            {step < STEPS.length - 1 ? (
              <Button 
                className="bg-pink-600 hover:bg-pink-700 text-white px-4 sm:px-6 py-2 rounded-md transition-all shadow-lg hover:shadow-xl text-sm sm:text-base" 
                onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              >
                次の段階へ
              </Button>
            ) : (
              <Button 
                className="bg-pink-600 hover:bg-pink-700 text-white px-6 sm:px-8 py-2 rounded-md transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base" 
                onClick={handleSubmit} 
                disabled={isSubmitting}
              >
                {isSubmitting ? (isEditMode ? "保存中..." : "登録中...") : (isEditMode ? "保存する" : "登録する")}
              </Button>
            )}
        </div>
      </div>

      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
          <DialogContent className="sm:max-w-[425px] bg-gray-800 text-white border-gray-700">
            <DialogHeader><DialogTitle>キーワード入力</DialogTitle></DialogHeader>
            <div className="py-4">
              {selectedIndex !== null && images[selectedIndex] && (
                <>
                  {/* ▼▼▼【修正】Imageコンポーネントを標準のimgタグに戻します ▼▼▼ */}
                  <img src={images[selectedIndex].file ? URL.createObjectURL(images[selectedIndex].file!) : images[selectedIndex].imageUrl!} alt={`preview-${selectedIndex}`} width={200} height={200} className="object-cover rounded mb-4 mx-auto" />
                  <Input placeholder="感情や状況などを入力..." value={images[selectedIndex].keyword} onChange={(e) => updateKeyword(e.target.value)} className="bg-gray-900 border-gray-600 focus:ring-pink-500" />
                </>
              )}
            </div>
            <DialogFooter><Button onClick={closeImageModal} className="bg-pink-500 hover:bg-pink-600">保存</Button></DialogFooter>
          </DialogContent>
        </Dialog>

      <HashtagModal isOpen={isHashtagModalOpen} onClose={() => setIsHashtagModalOpen(false)} initialHashtags={form.hashtags} onComplete={(newHashtags) => { handleChange("hashtags", newHashtags); }} />
    </>
  );
}

interface LorebookItemProps {
    lorebook: Lorebook;
    index: number;
    onContentChange: (index: number, content: string) => void;
    onAddKeyword: (index: number, keyword: string) => void;
    onDeleteKeyword: (lorebookIndex: number, keywordIndex: number) => void;
    onDeleteLorebook: (index: number) => void;
}

function LorebookItem({ lorebook, index, onContentChange, onAddKeyword, onDeleteKeyword, onDeleteLorebook }: LorebookItemProps) {
    const [currentKeyword, setCurrentKeyword] = useState("");

    const handleAdd = () => {
      onAddKeyword(index, currentKeyword);
      setCurrentKeyword("");
    };

    return (
      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-gray-400"><GripVertical size={16} className="cursor-grab" /><h4 className="font-semibold text-white">ロアブック #{index + 1}</h4></div>
            <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => onDeleteLorebook(index)} className="text-red-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={16} /> <span className="ml-1">削除</span></Button></div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">内容</label>
          <Textarea value={lorebook.content} onChange={(e) => onContentChange(index, e.target.value)} placeholder="キャラクターが思い出すべき設定や情報を入力します。" className="h-20 sm:h-24 bg-gray-800 border-gray-700 focus:border-pink-500 text-sm sm:text-base" maxLength={500} />
          <p className="text-xs text-gray-400 mt-1">{'`{{char}}` と `{{user}}` が使用できます。'}</p>
          <p className="text-xs text-right text-gray-500 mt-1">
            {lorebook.content.length} / 500
          </p>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">キーワード (最大5個)</label>
            <div className="flex gap-2">
                <Input 
                    value={currentKeyword} 
                    onChange={(e) => setCurrentKeyword(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())} 
                    placeholder="キーワードを入力して追加" 
                    disabled={lorebook.keywords.length >= 5}
                    className="bg-gray-800 border-gray-700 focus:border-pink-500"
                />
                <Button 
                    onClick={handleAdd} 
                    disabled={!currentKeyword.trim() || lorebook.keywords.length >= 5}
                    className="bg-pink-600 hover:bg-pink-700"
                >
                    追加
                </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
            {lorebook.keywords.map((kw, kwIndex) => (
                <div key={kwIndex} className="bg-pink-500/20 text-pink-300 text-sm px-2 py-1 rounded-md flex items-center gap-1">
                {kw}
                <button onClick={() => onDeleteKeyword(index, kwIndex)} className="text-pink-300 hover:text-white"><X size={14} /></button>
                </div>
            ))}
            </div>
        </div>
      </div>
    );
}

