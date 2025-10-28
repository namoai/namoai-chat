"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/* =============================================================================
 *  フォーム用の型定義
 * ========================================================================== */
type PersonaData = {
  nickname: string;
  age: number | null;
  gender: '女性' | '男性' | null;
  description: string;
};

/* =============================================================================
 *  モーダル（props は機能変更なし）
 * ========================================================================== */
type ModalProps = {
  isOpen: boolean;
  onConfirm: () => void;
  title: string;
  message: string;
};

const CustomModal = ({ isOpen, onConfirm, title, message }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        <p className="text-sm text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end">
          <button onClick={onConfirm} className="bg-pink-600 hover:bg-pink-700 py-2 px-4 rounded-lg">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

/* =============================================================================
 *  安全な JSON パース（空文字/不正 JSON を許容）
 * ========================================================================== */
const safeParse = <T,>(text: string, fallback: T): T => {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

export default function PersonaFormPage() {
  const router = useRouter();
  const params = useParams();

  /* -------------------------------------------------------------------------
   *  ルートパラメータの安全な正規化
   *  - /persona/[personaId] で string / string[] 両方に耐性を持たせる
   * ----------------------------------------------------------------------- */
  const rawId = (params as Record<string, unknown>)?.personaId as string | string[] | undefined;
  const personaId = Array.isArray(rawId) ? rawId[0] : rawId;
  const isEditMode = !!personaId;

  const [formData, setFormData] = useState<PersonaData>({
    nickname: '',
    age: null,
    gender: null,
    description: '',
  });
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<Omit<ModalProps, 'onConfirm'>>({
    isOpen: false, title: '', message: ''
  });

  useEffect(() => {
    if (!isEditMode) return;

    const fetchPersona = async () => {
      try {
        // ビルド時の収集や中間キャッシュの影響を避ける
        const response = await fetch(`/api/persona/${personaId}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('ペルソナ情報の読み込みに失敗しました。');

        // ここで直接 json() を呼ばず、テキスト→安全パースにする
        const text = await response.text();
        const data = safeParse<Record<string, unknown>>(text, {});

        // 必須フィールドがない場合でも落ちないようデフォルトを与える
        setFormData({
          nickname: typeof data.nickname === 'string' ? data.nickname : '',
          age: typeof data.age === 'number'
            ? data.age
            : (typeof data.age === 'string' && data.age.trim() !== '' ? Number(data.age) : null),
          gender: data.gender === '女性' || data.gender === '男性' ? data.gender : null,
          description: typeof data.description === 'string' ? data.description : '',
        });
      } catch (error) {
        console.error(error);
        setModalState({
          isOpen: true,
          title: '読み込みエラー',
          message: (error as Error).message,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersona();
  }, [isEditMode, personaId]);

  const closeModal = () => setModalState(prev => ({ ...prev, isOpen: false }));

  const handleChange = (field: keyof PersonaData, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value as unknown as never }));
  };

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, age: value === '' ? null : Number(value) }));
  };

  const handleSave = async () => {
    if (isSubmitting || !formData.nickname || !formData.description) return;
    setIsSubmitting(true);

    const url = isEditMode ? `/api/persona/${personaId}` : '/api/persona';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // age は number | null に正規化
          age: formData.age ?? null,
        }),
      });

      if (!response.ok) {
        // ここも text→安全パース（HTML エラーページでも落ちない）
        const errorText = await response.text();
        const errorData = safeParse<{ error?: string }>(errorText, {});
        throw new Error(errorData.error || '保存に失敗しました。');
      }

      setModalState({
        isOpen: true,
        title: '成功',
        message: isEditMode ? 'ペルソナが更新されました。' : 'ペルソナが作成されました。',
      });
    } catch (error) {
      console.error(error);
      setModalState({
        isOpen: true,
        title: '保存エラー',
        message: (error as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalConfirm = () => {
    closeModal();
    if (modalState.title === '成功') {
      // ペルソナリストから戻るボタンを押したときに、再度フォームページに戻らないようにreplaceを使用
      router.replace('/persona/list');
      router.refresh();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        ローディング中...
      </div>
    );
  }

  return (
    <>
      <CustomModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        onConfirm={handleModalConfirm}
      />
      <div className="bg-black min-h-screen text-white p-4">
        <header className="flex justify-between items-center py-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">{isEditMode ? 'ペルソナ修正' : 'ペルソナ追加'}</h1>
          <button
            onClick={handleSave}
            className={`font-bold py-2 px-3 rounded-lg transition-colors disabled:cursor-not-allowed ${
              formData.nickname && formData.description
                ? 'text-white hover:bg-gray-800 cursor-pointer'
                : 'text-gray-600'
            }`}
            disabled={!formData.nickname || !formData.description || isSubmitting}
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </header>
        <main className="mt-8 space-y-8">
          <div>
            <label className="text-sm font-bold text白">ニックネーム <span className="text-red-500">*</span></label>
            <div className="relative mt-2">
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => handleChange('nickname', e.target.value)}
                maxLength={20}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                {formData.nickname.length}/20
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text白">年齢</label>
            <input
              type="number"
              value={formData.age ?? ''}
              onChange={handleAgeChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 mt-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="text-sm font-bold text白">性別</label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <button
                onClick={() => handleChange('gender', '女性')}
                className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  formData.gender === '女性'
                    ? 'bg-pink-500/20 border-pink-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                女性
              </button>
              <button
                onClick={() => handleChange('gender', '男性')}
                className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  formData.gender === '男性'
                    ? 'bg-pink-500/20 border-pink-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                男性
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text白">詳細情報 <span className="text-red-500">*</span></label>
            <div className="relative mt-2">
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                maxLength={1000}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 h-40 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <span className="absolute right-3 bottom-3 text-sm text-gray-400">
                {formData.description.length}/1000
              </span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
