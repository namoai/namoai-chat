"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import HelpModal from '@/components/HelpModal';
import { fetchWithCsrf } from "@/lib/csrf-client";

/* =============================================================================
 *  フォーム用の型定義
 * ========================================================================== */
type PersonaData = {
  nickname: string;
  age: number | null;
  gender: '女性' | '男性' | null;
  description: string;
};

const HELP_PERSONA_TEMPLATE: PersonaData = {
  nickname: 'ヘルプペルソナ',
  age: 25,
  gender: '女性',
  description: [
    'キャラクター目的: 新規ユーザーに入力方法を案内するサポート役。',
    '口調/スタイル: 丁寧で段階的に説明し、要点を短くまとめる。',
    '詳細要素:',
    '- 性格: 落ち着いていて励ましてくれる',
    '- 会話テーマ: ユーザー入力を読み取り、具体的な作成ヒントを提案',
    '- 必須情報: 背景(1文)、口調、主な関心、避けるべき要素',
    '',
    '作成ヒント:',
    '1) このペルソナが解決したい課題を最初に1文で宣言する。',
    '2) 性格/口調/NG事項を箇条書きにすると混乱を防げる。',
    '3) 実際の返答例を1〜2行入れるとモデルがトーンを揃えやすい。',
  ].join('\n'),
};

const personaGuides: Array<{ title: string; body: string }> = [
  {
    title: 'ゴールから書き始める',
    body: 'このペルソナが解決したいユーザー課題や期待する対話像を1文で宣言すると、その後の項目が決めやすくなります。',
  },
  {
    title: '性格・口調・NGを分ける',
    body: '性格（例: クール、陽気）、口調（例: 丁寧語、くだけた口調）、禁止事項を別々に箇条書きにすると誤解が減ります。',
  },
  {
    title: '最初の返答例を1〜2行',
    body: '実際にユーザーへ返す1通目の文章を短く書くと、トーン・長さ・フォーマットが一気に揃います。',
  },
  {
    title: 'メモ形式が読みやすい',
    body: '長文よりも「背景 → 性格 → 口調 → 好き/NG → 例文」の順で箇条書きにすると可読性・保守性が上がります。',
  },
];

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
          <button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-lg">
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const applyHelpPersonaTemplate = () => setFormData(HELP_PERSONA_TEMPLATE);

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
      const response = await fetchWithCsrf(url, {
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
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  const helpContent = (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-blue-400 mb-3">ペルソナの書き方</h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          ペルソナの書き方に迷ったら、まずこの流れで整理してみましょう。
          ゴール → 性格/口調 → 例文 の順で書くとモデルがトーンをつかみやすくなります。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {personaGuides.map(({ title, body }) => (
          <div key={title} className="bg-black/30 border border-gray-800/80 rounded-xl p-4">
            <h3 className="text-base font-semibold text-blue-300 mb-2">{title}</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h3 className="text-base font-semibold text-blue-400 mb-2">ヘルプペルソナを読み込む</h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-3">
          「ヘルプペルソナを読み込む」ボタンをクリックすると、書き方の例としてヘルプペルソナの内容がフォームに自動入力されます。
          これを参考にして、自分だけのペルソナを作成してみてください。
        </p>
      </div>
    </div>
  );

  return (
    <>
      <CustomModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        onConfirm={handleModalConfirm}
      />
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="ペルソナの書き方ガイド"
        content={helpContent}
      />
      <div className="bg-gray-950 min-h-screen text-white">
        {/* 背景装飾 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 pb-24">
            <header className="flex justify-between items-center mb-8 sticky top-0 bg-black/80 backdrop-blur-xl z-10 py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-900/50">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all"
              >
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-white bg-clip-text text-transparent">
                {isEditMode ? 'ペルソナ修正' : 'ペルソナ追加'}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all"
                >
                  <HelpCircle size={20} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.nickname || !formData.description || isSubmitting}
                  className={`font-semibold py-2 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    formData.nickname && formData.description
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-800/50 text-gray-600 border border-gray-700/50'
                  }`}
                >
                  {isSubmitting ? '保存中...' : '保存'}
                </button>
              </div>
            </header>
            <main className="space-y-6">
              <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <p className="text-sm text-gray-300">ペルソナの書き方に迷ったら、右上の<strong className="text-blue-400">?</strong>ボタンからガイドを確認できます。</p>
                  <button
                    onClick={applyHelpPersonaTemplate}
                    className="w-full md:w-auto bg-gray-800/70 border border-blue-400/40 text-blue-300 font-semibold px-4 py-2 rounded-xl hover:bg-white/10 transition-all"
                  >
                    ヘルプペルソナを読み込む
                  </button>
                </div>
              </div>
              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  ニックネーム <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => handleChange('nickname', e.target.value)}
                    maxLength={20}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-gray-500"
                    placeholder="ニックネームを入力"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {formData.nickname.length}/20
                  </span>
                </div>
              </div>

              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                <label className="text-sm font-medium text-gray-300 mb-2 block">年齢</label>
                <input
                  type="number"
                  value={formData.age ?? ''}
                  onChange={handleAgeChange}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-gray-500"
                  placeholder="年齢を入力（任意）"
                />
              </div>

              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                <label className="text-sm font-medium text-gray-300 mb-3 block">性別</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleChange('gender', '女性')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.gender === '女性'
                        ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-gray-800/50 border-gray-700/50 hover:border-blue-500/30 text-gray-300'
                    }`}
                  >
                    女性
                  </button>
                  <button
                    onClick={() => handleChange('gender', '男性')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.gender === '男性'
                        ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-gray-800/50 border-gray-700/50 hover:border-blue-500/30 text-gray-300'
                    }`}
                  >
                    男性
                  </button>
                </div>
              </div>

              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  詳細情報 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    maxLength={1000}
                    rows={8}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none placeholder-gray-500"
                    placeholder="詳細情報を入力"
                  />
                  <span className="absolute right-3 bottom-3 text-sm text-gray-400">
                    {formData.description.length}/1000
                  </span>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
