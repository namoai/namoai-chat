"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
import { X } from "lucide-react";

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
  "青春", "学園", "일상", "母親", "超能力", "妹",
];

// フォームデータ型
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
};

// 画像データ型（既存・新規画像の両方を処理）
type DisplayImage = {
  id?: number; // 既存の画像ID
  imageUrl?: string; // 既存の画像URL
  file?: File; // 新規追加ファイル
  keyword: string;
};

// コンポーネントのProps型
interface CharacterFormProps {
  isEditMode: boolean;
  initialData?: Partial<FormState & { id: string; characterImages: { id: number; imageUrl: string; keyword: string | null }[] }>;
}

// --- HashtagModal（変更なし、そのまま使用） ---
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
              <Button onClick={handleAddCustomTag} disabled={isLimitReached} className="bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
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


// --- メインフォームコンポーネント ---
export default function CharacterForm({ isEditMode, initialData }: CharacterFormProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    name: "", description: "", systemTemplate: "", detailSetting: "",
    firstSituation: "", firstMessage: "", visibility: "public",
    safetyFilter: true, category: "", hashtags: [],
  });
  const [images, setImages] = useState<DisplayImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<number[]>([]);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isHashtagModalOpen, setIsHashtagModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 編集モードの場合、初期データを設定
  useEffect(() => {
    if (isEditMode && initialData) {
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
      });
      setImages(
        initialData.characterImages?.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          keyword: img.keyword || "",
        })) || []
      );
    }
  }, [isEditMode, initialData]);

  // 未ログインユーザーのリダイレクト
  useEffect(() => {
    if (status === "unauthenticated") {
      alert("ログインが必要です。");
      router.push("/login");
    }
  }, [status, router]);

  const handleChange = (field: keyof FormState, value: string | boolean | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 10) {
      alert("画像は最大10枚までアップロードできます。");
      return;
    }
    const newImages: DisplayImage[] = files.map((file) => ({ file, keyword: "" }));
    setImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
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
    // ▼▼▼ 変更点: 유효성 검사 로직 추가 ▼▼▼
    if (!form.name.trim()) {
      alert("キャラクターの名前は必須項目です。");
      return;
    }
    if (images.length === 0) {
      alert("キャラクターの画像を1枚以上登録してください。");
      return;
    }
    // ▲▲▲ 여기까지 ▲▲▲

    if (!session?.user?.id) {
      alert("ログインセッションが見つかりません。再度ログインしてください。");
      router.push('/login');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    const formData = new FormData();

    // テキストデータを追加
    Object.entries(form).forEach(([key, value]) => {
        formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
    });

    if (isEditMode) {
      // 編集モードのロジック
      formData.append('imagesToDelete', JSON.stringify(imagesToDelete));
      
      let newImageIndex = 0;
      images.forEach((img) => {
        if (img.file) { // 新規追加されたファイルのみを送信
          formData.append(`new_image_${newImageIndex}`, img.file);
          formData.append(`new_keyword_${newImageIndex}`, img.keyword);
          newImageIndex++;
        }
      });
      formData.append('newImageCount', String(newImageIndex));

    } else {
      // 作成モードのロジック
      formData.append("userId", session.user.id);
      formData.append("imageCount", String(images.length));
      images.forEach((imageMeta, index) => {
        if(imageMeta.file){
            formData.append(`image_${index}`, imageMeta.file);
            formData.append(`keyword_${index}`, imageMeta.keyword);
        }
      });
    }

    const url = isEditMode ? `/api/characters/${initialData?.id}` : "/api/characters";
    const method = isEditMode ? "PUT" : "POST";

    try {
      const response = await fetch(url, { method, body: formData });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "サーバーリクエストに失敗しました。");
      }

      const result = await response.json();
      console.log("サーバー応答:", result);
      alert(isEditMode ? "キャラクター情報が更新されました。" : "キャラクターが正常に登録されました！");
      router.push("/MyPage"); 
    } catch (error) {
      console.error(isEditMode ? "キャラクター更新失敗:" : "キャラクター登録失敗:", error);
      alert(`エラー: ${error instanceof Error ? error.message : "不明なエラーが発生しました。"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        <p>ローディング中...</p>
      </div>
    );
  }

  // JSXレンダリング
  return (
    <>
      <div className="min-h-screen bg-black text-white px-4 py-8 max-w-4xl mx-auto font-sans">
        <button onClick={() => router.back()} className="mb-4 text-pink-400 hover:underline cursor-pointer">
          ← 戻る
        </button>
        <h1 className="text-xl font-bold mb-4">
          {isEditMode ? "キャラクター修正" : "キャラクター作成"}
        </h1>

        {/* --- ステップナビゲーション（共通UI） --- */}
        <div className="flex space-x-2 border-b border-gray-700 mb-6 text-sm overflow-x-auto">
          {["プロフィール", "キャラクター画像", "詳細情報", "開始状況", "その他設定", "ロアブック", "修正および登録"].map((label, index) => (
            <div key={label} className={`pb-2 px-2 cursor-pointer whitespace-nowrap transition-all ${step === index ? "border-b-2 border-pink-500 font-semibold" : "text-gray-400"}`} onClick={() => setStep(index)}>
              {label}
            </div>
          ))}
        </div>

        {/* --- フォームセクション（共通UI） --- */}
        {step === 0 && ( /* プロフィール */
            <div className="space-y-4">
                <Input placeholder="キャラクターの名前を入力してください" value={form.name} maxLength={20} onChange={(e) => handleChange("name", e.target.value)} className="rounded-md" />
                <Textarea placeholder="キャラクター紹介文を入力してください" value={form.description} maxLength={250} onChange={(e) => handleChange("description", e.target.value)} className="h-32 rounded-md" />
            </div>
        )}

        {step === 1 && ( /* キャラクター画像 */
            <div className="p-4">
                <label className="block text-sm font-medium text-gray-200">キャラクター画像</label>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="mt-2 block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                <p className="text-xs text-gray-500 mt-1">画像ファイルを選択してください（最大10枚まで）。</p>
                <div className="mt-4 flex flex-wrap gap-4">
                {images.map((img, idx) => (
                    <div key={img.id || `new-${idx}`} className="relative w-24 h-24">
                        <div onClick={() => openImageModal(idx)} className="w-full h-full border rounded overflow-hidden cursor-pointer">
                            <Image src={img.file ? URL.createObjectURL(img.file) : img.imageUrl!} alt={`image-${idx}`} width={96} height={96} className="object-cover w-full h-full" />
                            <div className="absolute bottom-0 bg-black bg-opacity-60 text-xs text-white w-full text-center px-1 py-0.5 truncate">
                            {idx === 0 ? "基本画像" : img.keyword || "クリックで入力"}
                            </div>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleImageDelete(idx); }} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 text-white shadow-lg transition-transform hover:scale-110 z-10" aria-label="画像を削除">
                            <X size={16} />
                        </button>
                    </div>
                ))}
                </div>
            </div>
        )}

        {/* --- 残りのステップ（2, 3, 4）も上記と同様にvalueとonChangeをform stateに接続します --- */}
        {step === 2 && ( /* 詳細情報 */
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-200">システムテンプレート</label>
                <select className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black" value={form.systemTemplate} onChange={(e) => handleChange("systemTemplate", e.target.value)}>
                    <option value="">テンプレートを選択...</option>
                    <option value="template1">テンプレート1</option>
                    <option value="template2">テンプレート2</option>
                </select>
                <Textarea placeholder="キャラクターの詳細設定（外見・性格・背景など）" value={form.detailSetting} className="h-48 rounded-md" maxLength={5000} onChange={(e) => handleChange("detailSetting", e.target.value)} />
            </div>
        )}

        {step === 3 && ( /* 開始状況 */
            <div className="space-y-4">
                <Textarea placeholder="最初の状況を入力してください" value={form.firstSituation} maxLength={1000} className="h-40 rounded-md" onChange={(e) => handleChange("firstSituation", e.target.value)} />
                <Textarea placeholder="キャラクターの最初のメッセージを入力してください" value={form.firstMessage} maxLength={500} className="h-32 rounded-md" onChange={(e) => handleChange("firstMessage", e.target.value)} />
            </div>
        )}

        {step === 4 && ( /* その他設定 */
            <div className="p-4 space-y-6">
                <div>
                    <span className="block text-sm font-medium text-gray-200 mb-2">公開範囲</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <label className="inline-flex items-center"><input type="radio" name="visibility" value="public" checked={form.visibility === "public"} onChange={() => handleChange("visibility", "public")} className="form-radio text-pink-500" /><span className="ml-2">公開</span></label>
                    <label className="inline-flex items-center"><input type="radio" name="visibility" value="private" checked={form.visibility === "private"} onChange={() => handleChange("visibility", "private")} className="form-radio text-pink-500" /><span className="ml-2">非公開</span></label>
                    <label className="inline-flex items-center"><input type="radio" name="visibility" value="link" checked={form.visibility === "link"} onChange={() => handleChange("visibility", "link")} className="form-radio text-pink-500" /><span className="ml-2">リンク限定公開</span></label>
                    </div>
                </div>
                <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-200 mr-4">セーフティフィルター</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.safetyFilter} onChange={() => handleChange("safetyFilter", !form.safetyFilter)} />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:bg-red-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    <span className="ml-3 text-sm text-gray-200">{form.safetyFilter ? "On" : "Off"}</span>
                    </label>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-2">カテゴリー</h3>
                    <p className="text-xs text-gray-400 mb-3">キャラクターが活動するテーマを選択してください。</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {CATEGORIES.map((category) => (
                        <button key={category} onClick={() => handleChange("category", category)} className={`py-3 px-2 rounded-md transition-colors text-center text-sm ${form.category === category ? "bg-red-500 font-bold" : "bg-gray-700 hover:bg-gray-600"}`}>
                        {category}
                        </button>
                    ))}
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-base mb-2">ハッシュタグ</h3>
                    <p className="text-xs text-gray-400 mb-3">最大5個、最小1個以上のタグを選択してください。</p>
                    <div onClick={() => setIsHashtagModalOpen(true)} className="bg-gray-800 border border-gray-700 rounded-md p-3 min-h-[48px] cursor-pointer flex flex-wrap gap-2 items-center">
                    {form.hashtags.length === 0 ? (<span className="text-gray-500">ハッシュタグを登録してください。</span>) : (form.hashtags.map((tag) => (<span key={tag} className="bg-red-500 text-white text-sm font-semibold px-2 py-1 rounded">#{tag}</span>)))}
                    </div>
                </div>
            </div>
        )}

        <div className="mt-6 flex justify-end">
            {step < 6 ? (
              <Button className="bg-pink-500 hover:bg-pink-600 cursor-pointer" onClick={() => setStep(step + 1)}>次の段階へ</Button>
            ) : (
              <Button className="bg-pink-500 hover:bg-pink-600 cursor-pointer disabled:opacity-50" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (isEditMode ? "保存中..." : "登録中...") : (isEditMode ? "保存" : "登録")}
              </Button>
            )}
        </div>
      </div>

      {/* --- モーダル（共通UI） --- */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
          <DialogContent className="sm:max-w-[425px] bg-gray-800 text-white border-gray-700">
            <DialogHeader><DialogTitle>キーワード入力</DialogTitle></DialogHeader>
            <div className="py-4">
              {selectedIndex !== null && images[selectedIndex] && (
                <>
                  <Image src={images[selectedIndex].file ? URL.createObjectURL(images[selectedIndex].file) : images[selectedIndex].imageUrl!} alt={`preview-${selectedIndex}`} width={200} height={200} className="object-cover rounded mb-4 mx-auto" />
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
