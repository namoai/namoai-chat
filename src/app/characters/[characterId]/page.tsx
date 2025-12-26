"use client";

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Heart, MoreVertical, ArrowLeft, Send, Edit, Trash2, ShieldBan, Flag, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import HelpModal from '@/components/HelpModal';
import { fetchWithCsrf } from "@/lib/csrf-client";

// --- 型定義 (変更なし) ---
type ManualSession = {
  user?: {
      id?: string | null;
      role?: string | null;
  } | null;
} | null;

type CommentUser = {
  id: number;
  nickname: string;
  image_url: string | null;
};

type Comment = {
  id: number;
  content: string;
  createdAt: string;
  users: CommentUser;
};

// モーダルを管理するための型
type ModalState = {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    confirmText?: string;
    isAlert?: boolean;
};

interface CommentsProps {
  characterId: string | null;
  characterAuthorId: number | null;
  session: ManualSession;
  setModalState: (state: ModalState) => void;
}

// 確認モーダルコンポーネント
const ConfirmationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
    if (!modalState.isOpen) return null;
    
    const handleClose = () => setModalState({ ...modalState, isOpen: false });
    const handleConfirm = () => {
        modalState.onConfirm?.();
        handleClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4 text-white">
                <h2 className="text-xl font-bold mb-4 text-white">{modalState.title}</h2>
                <p className="text-gray-200 mb-6">{modalState.message}</p>
                <div className={`flex ${modalState.isAlert ? 'justify-end' : 'justify-between'} gap-4`}>
                    {!modalState.isAlert && (
                        <button onClick={handleClose} className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg">
                            キャンセル
                        </button>
                    )}
                    <button onClick={handleConfirm} className={`px-4 py-2 text-white ${modalState.confirmText?.includes('削除') ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} rounded-lg`}>
                        {modalState.confirmText || 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
};


function Comments({ characterId, characterAuthorId, session, setModalState }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  useEffect(() => {
    const fetchComments = async () => {
      if (!characterId) {
        console.log('[Comments] characterId is null');
        return;
      }
      try {
        setLoading(true);
        console.log(`[Comments] Fetching comments for character ${characterId}`);
        // ★ キャッシュを無効化 + タイムスタンプでキャッシュバスティング
        const timestamp = Date.now();
        const res = await fetch(`/api/characters/${characterId}/comments?t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        });
        console.log(`[Comments] Response status: ${res.status}`);
        
        if (!res.ok) throw new Error('コメントの読み込みに失敗しました。');
        const data = await res.json();
        console.log('[Comments] Response data:', data);
        
        if (Array.isArray(data)) {
          console.log(`[Comments] Setting ${data.length} comments (array format)`);
          setComments(data);
        } else if (data && Array.isArray(data.comments)) {
          console.log(`[Comments] Setting ${data.comments.length} comments (object format)`);
          setComments(data.comments);
        } else {
          console.log('[Comments] No comments found or invalid format');
          setComments([]);
        }
      } catch (err) {
        console.error('[Comments] Error:', err);
        setError(err instanceof Error ? err.message : '不明なエラー');
        setComments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [characterId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting || !session?.user?.id || !characterId) return;

    setIsSubmitting(true);
    try {
      const res = await fetchWithCsrf(`/api/characters/${characterId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });
      if (!res.ok) throw new Error('コメントの投稿に失敗しました。');
      const createdComment: Comment = await res.json();
      // ★ 新しいコメントを末尾に追加（API は asc 順なので）
      setComments([...comments, createdComment]);
      setNewComment('');
    } catch (err) {
      setModalState({ isOpen: true, title: 'エラー', message: err instanceof Error ? err.message : 'コメント投稿中にエラーが発生しました。', isAlert: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (commentId: number) => {
    if (!characterId) return;
    setModalState({
        isOpen: true,
        title: '削除の確認',
        message: '本当にこのコメントを削除しますか？',
        confirmText: '削除',
        onConfirm: async () => {
            try {
              const res = await fetchWithCsrf(`/api/characters/${characterId}/comments/${commentId}`, {
                method: 'DELETE',
              });
              if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'コメントの削除に失敗しました。');
              }
              setComments(comments.filter((comment) => comment.id !== commentId));
              // 削除成功モーダルを表示
              setModalState({
                isOpen: true,
                title: '削除完了',
                message: 'コメントを削除しました。',
                isAlert: true,
              });
            } catch (err) {
              setModalState({ isOpen: true, title: 'エラー', message: err instanceof Error ? err.message : '削除中にエラーが発生しました。', isAlert: true });
            }
        }
    });
  };

  const handleEditStart = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditedContent(comment.content);
    setActiveMenu(null);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editedContent.trim() || !editingCommentId || !characterId) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetchWithCsrf(`/api/characters/${characterId}/comments/${editingCommentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'コメントの更新に失敗しました。');
      }
      const updatedComment: Comment = await res.json();
      setComments(comments.map((c) => (c.id === editingCommentId ? updatedComment : c)));
      setEditingCommentId(null);
      setEditedContent('');
      // 編集成功モーダルを表示
      setModalState({
        isOpen: true,
        title: '編集完了',
        message: 'コメントを編集しました。',
        isAlert: true,
      });
    } catch (err) { 
      setModalState({ isOpen: true, title: 'エラー', message: err instanceof Error ? err.message : '更新中にエラーが発生しました。', isAlert: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-800 pt-4">
      <h3 className="font-bold mb-4">コメント ({comments.length})</h3>
      {session?.user && (
        <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
          <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="コメントを追加..." className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isSubmitting} />
          <button type="submit" className="bg-blue-600 p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-500" disabled={isSubmitting || !newComment.trim()}><Send size={20} /></button>
        </form>
      )}
      {loading && <p>コメントを読み込み中...</p>}
      {error && <p className="text-red-500">エラー: {error}</p>}
      <div className="space-y-4">
        {comments.map((comment) => {
          const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;
          const currentUserRole = session?.user?.role;
          const isCommentAuthor = comment.users.id === currentUserId;
          const isCharacterAuthor = characterAuthorId === currentUserId;
          const isAdmin = currentUserRole === 'CHAR_MANAGER' || currentUserRole === 'SUPER_ADMIN';
          const canEdit = isCommentAuthor;
          const canDelete = isCommentAuthor || isCharacterAuthor || isAdmin;

          return (
            <div key={comment.id} className="flex gap-3">
              <a href={`/profile/${comment.users.id}`} className="flex-shrink-0">
                <Image src={comment.users.image_url || 'https://placehold.co/40x40/1a1a1a/ffffff?text=?'} alt={comment.users.nickname} width={40} height={40} className="rounded-full mt-1 w-10 h-10 object-cover" />
              </a>
              <div className='flex-1'>
                {editingCommentId === comment.id ? (
                   <form onSubmit={handleUpdate}>
                     <input type="text" value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                     <div className="flex gap-2 mt-2">
                       <button type="submit" disabled={isSubmitting} className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded">保存</button>
                       <button type="button" onClick={() => setEditingCommentId(null)} className="text-xs bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded">キャンセル</button>
                     </div>
                   </form>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <a href={`/profile/${comment.users.id}`} className="font-bold text-sm hover:underline">{comment.users.nickname}</a>
                        <p className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString('ja-JP')}</p>
                      </div>
                      {(canEdit || canDelete) && (
                        <div className="relative">
                          <button onClick={() => setActiveMenu(activeMenu === comment.id ? null : comment.id)} className="p-1 rounded-full hover:bg-gray-700"><MoreVertical size={16}/></button>
                          {activeMenu === comment.id && (
                            <div className="absolute right-0 top-6 bg-gray-800 rounded-md shadow-lg z-10 w-28">
                              {canEdit && <button onClick={() => handleEditStart(comment)} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700 rounded-t-md"><Edit size={14}/> 編集</button>}
                              {canDelete && <button onClick={() => handleDelete(comment.id)} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-b-md"><Trash2 size={14}/> 削除</button>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-300 whitespace-pre-wrap text-sm">{comment.content}</p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


type Author = {
  id: number;
  name: string;
  nickname: string;
  image_url: string | null; 
};

type CharacterImage = {
  imageUrl: string;
};

type CharacterDetail = {
  id: number;
  name: string;
  description: string | null;
  hashtags: string[];
  createdAt: string;
  updatedAt: string;
  characterImages: CharacterImage[];
  author: Author | null;
  _count: {
    favorites: number;
    chat: number;
  };
  isFavorited?: boolean;
};

// ✅ ここから警告解決のための核心修正
export default function CharacterDetailPage({
  // ❗️Next.js(React 19)ではparamsがPromiseなので、型もPromiseで受け取ります。
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const router = useRouter();

  // ❗️React.use()でparamsをアンラップして安全にアクセスします。
  const { characterId: characterIdRaw } = React.use(params);
  const characterId: string | null = characterIdRaw ?? null;

  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ManualSession>(null);
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: ''});
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // モバイル/PC判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
        try {
            const res = await fetch('/api/auth/session');
            const data = await res.json();
            if (res.ok && data?.user) {
                setSession(data);
                setSessionStatus('authenticated');
            } else {
                setSession(null);
                setSessionStatus('unauthenticated');
            }
        } catch {
            setSession(null);
            setSessionStatus('unauthenticated');
        }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    const fetchCharacter = async () => {
      if (!characterId) return;
      try {
        setLoading(true);
        // ★ キャッシュを無効化して常に最新データを取得
        const res = await fetch(`/api/characters/${characterId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (!res.ok) {
          const errorData = await res.json();
          if (res.status === 403) {
             throw new Error(errorData.error || 'このキャラクターへのアクセスは許可されていません。');
          }
          throw new Error(errorData.error || 'キャラクター情報の読み込みに失敗しました。');
        }
        const data = await res.json();
        
        if (!data.hashtags) {
          data.hashtags = [];
        }

        setCharacter(data);
        setCurrentImageIndex(0); // キャラクターデータが読み込まれたら画像インデックスをリセット
      } catch (e) {
        setError(e instanceof Error ? e.message : '不明なエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchCharacter();
  // ❗️依存性もparams.characterId → characterId に置き換え
  }, [characterId]);

  // キーボードで画像を切り替え
  useEffect(() => {
    if (!character || character.characterImages.length <= 1) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => 
          prev === 0 ? character.characterImages.length - 1 : prev - 1
        );
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => 
          prev === character.characterImages.length - 1 ? 0 : prev + 1
        );
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [character]);

  // ▼▼▼【メニュー外クリックで閉じる】▼▼▼
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);
  // ▲▲▲

  // ▼▼▼【制作者かどうか確認】▼▼▼
  const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;
  const isAuthor = character?.author?.id === currentUserId;
  // ▲▲▲

  // ▼▼▼【メニューアクションハンドラー】▼▼▼
  const handleEdit = () => {
    if (!characterId) return;
    router.push(`/characters/edit/${characterId}`);
    setShowMenu(false);
  };

  const handleDelete = () => {
    setShowMenu(false);
    setModalState({
      isOpen: true,
      title: '削除の確認',
      message: '本当にこのキャラクターを削除しますか？この操作は取り消せません。',
      confirmText: '削除',
      onConfirm: async () => {
        try {
          const res = await fetchWithCsrf(`/api/characters/${characterId}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('削除に失敗しました。');
          setModalState({
            isOpen: true,
            title: '削除完了',
            message: 'キャラクターを削除しました。',
            isAlert: true,
            onConfirm: () => router.push('/character-management'),
          });
        } catch (err) {
          setModalState({
            isOpen: true,
            title: 'エラー',
            message: err instanceof Error ? err.message : '削除中にエラーが発生しました。',
            isAlert: true,
          });
        }
      },
    });
  };

  const handleReport = () => {
    setShowMenu(false);
    setShowReportModal(true);
  };

  const handleReportSubmit = () => {
    if (!session?.user?.id) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: 'ログインが必要です。',
        isAlert: true,
      });
      return;
    }
    if (!reportReason.trim()) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '通報理由を選択してください。',
        isAlert: true,
      });
      return;
    }
    setShowReportConfirm(true);
  };

  const handleReportConfirm = async () => {
    if (!characterId || !session?.user?.id) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: 'ログインが必要です。',
        isAlert: true,
      });
      setShowReportConfirm(false);
      return;
    }
    
    try {
      const res = await fetchWithCsrf('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CHARACTER_REPORT',
          characterId: parseInt(characterId, 10),
          reason: reportReason,
          content: reportContent,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '通報受付に失敗しました。');
      }
      setShowReportConfirm(false);
      setShowReportModal(false);
      setReportReason('');
      setReportContent('');
      setModalState({
        isOpen: true,
        title: '通報受付完了',
        message: '通報が受付されました。検討後、対応いたします。',
        isAlert: true,
      });
    } catch (err) {
      setShowReportConfirm(false);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: err instanceof Error ? err.message : '通報受付中にエラーが発生しました。',
        isAlert: true,
      });
    }
  };

  const handleBlockAuthor = () => {
    if (!character?.author?.id || !session?.user?.id) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: 'ログインが必要です。',
        isAlert: true,
      });
      setShowMenu(false);
      return;
    }
    
    const authorId = character.author.id;
    setShowMenu(false);
    setModalState({
      isOpen: true,
      title: '制作者をブロック',
      message: 'この制作者をブロックしてもよろしいですか？相互にプロフィール閲覧・コメント・チャットができなくなります。',
      confirmText: 'ブロック',
      onConfirm: async () => {
        if (!authorId) return;
        try {
          const res = await fetchWithCsrf(`/api/profile/${authorId}/block`, {
            method: 'POST',
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'ブロックに失敗しました。');
          }
          const data = await res.json();
          setModalState({
            isOpen: true,
            title: 'ブロック完了',
            message: data.isBlocked ? '制作者をブロックしました。' : 'ブロックを解除しました。',
            isAlert: true,
            onConfirm: () => router.push('/'),
          });
        } catch (err) {
          setModalState({
            isOpen: true,
            title: 'エラー',
            message: err instanceof Error ? err.message : 'ブロック処理中にエラーが発生しました。',
            isAlert: true,
          });
        }
      },
    });
  };
  // ▲▲▲

  const handleFavorite = async () => {
    if (!character) return;
    
    // ★ 楽観的更新: 即座にUIを更新
    const previousState = character;
      setCharacter((prev) => 
        prev 
        ? { 
            ...prev, 
            isFavorited: !prev.isFavorited, 
            _count: { 
              ...prev._count, 
              favorites: prev.isFavorited 
                ? prev._count.favorites - 1 
                : prev._count.favorites + 1 
            } 
          } 
        : null
      );
    
    try {
      const method = character.isFavorited ? 'DELETE' : 'POST';
      const res = await fetchWithCsrf(`/api/characters/${character.id}/favorite`, { method });
      if (!res.ok) throw new Error('お気に入り登録に失敗しました。');
    } catch (e) {
      // ★ エラーが発生したら元に戻す
      setCharacter(previousState);
      setModalState({ isOpen: true, title: 'エラー', message: e instanceof Error ? e.message : 'お気に入り登録中にエラーが発生しました。', isAlert: true });
    }
  };
  
  const handleNewChat = async () => {
      if (!characterId) return;
      setIsCreatingChat(true);
      try {
          const res = await fetchWithCsrf('/api/chat/new', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ characterId: parseInt(characterId, 10) }),
          });
          if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.error || 'チャットの作成に失敗しました。');
          }
          const { chatId } = await res.json();
          router.push(`/chat/${characterId}?chatId=${chatId}`);
      } catch (err) {
          setModalState({ isOpen: true, title: 'エラー', message: err instanceof Error ? err.message : 'チャットの開始中にエラーが発生しました。', isAlert: true });
      } finally {
          setIsCreatingChat(false);
      }
  };

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    const isBlockedError = error.includes('ブロックされている');
    const isSafetyFilterError = error.includes('セーフティフィルター');
    return (
        <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-4 text-center">
            {(isBlockedError || isSafetyFilterError) && <ShieldBan size={48} className="text-red-500 mb-4" />}
            <h2 className="text-xl font-bold mb-2">
                {isBlockedError ? 'アクセスできません' : isSafetyFilterError ? 'セーフティフィルター' : 'エラー'}
            </h2>
            <p className="text-gray-400 mb-6">{error}</p>
            {isSafetyFilterError && (
              <p className="text-gray-500 text-sm mb-4">
                このキャラクターを表示するには、設定でセーフティフィルターをOFFにする必要があります。
              </p>
            )}
            <button onClick={() => router.back()} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                戻る
            </button>
        </div>
    );
  }

  if (!character) return <div className="min-h-screen bg-black text-white flex justify-center items-center"><p>キャラクターが見つかりません。</p></div>;
  
  const helpContent = (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-blue-400 mb-2">キャラクター詳細ページについて</h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          このページでは、選択したキャラクターの詳細情報を確認し、チャットを開始することができます。
        </p>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-blue-400 mb-2">主な機能</h3>
        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 ml-2">
          <li><strong>お気に入り登録</strong>: ハートアイコンをクリックしてキャラクターをお気に入りに追加できます</li>
          <li><strong>チャット開始</strong>: 「新しいチャットを開始」ボタンで新しい会話を始められます</li>
          <li><strong>続きから会話</strong>: 既存のチャットがある場合は、続きから会話を再開できます</li>
          <li><strong>コメント</strong>: キャラクターについてコメントを投稿・閲覧できます（ログインが必要）</li>
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-blue-400 mb-2">メニュー機能</h3>
        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 ml-2">
          <li><strong>キャラクター制作者</strong>: メニューからキャラクターの編集・削除が可能です</li>
          <li><strong>一般ユーザー</strong>: 不適切なコンテンツを発見した場合は通報できます</li>
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-blue-400 mb-2">通報機能について</h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-2">
          不適切なキャラクターやコンテンツを発見した場合は、メニューから「通報する」を選択して通報してください。
        </p>
        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 ml-2">
          <li>通報理由を選択し、詳細内容を入力してください</li>
          <li>管理者が確認後、適切に対応いたします</li>
          <li>通報内容はお問い合わせページで確認できます</li>
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-blue-400 mb-2">統計情報</h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          お気に入り数やチャット数などの統計情報が表示されます。
          これらは他のユーザーによる利用状況を表しています。
        </p>
      </div>
    </div>
  );

  return (
    <div className="bg-black text-white min-h-screen font-sans">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <ConfirmationModal modalState={modalState} setModalState={setModalState} />
        <HelpModal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          title="キャラクター詳細ページについて"
          content={helpContent}
        />
        
        {/* ▼▼▼【通報確認モーダル】▼▼▼ */}
        {showReportConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-gray-800/95 backdrop-blur-xl rounded-xl p-6 w-full max-w-sm border border-gray-700/50">
              <h2 className="text-xl font-bold mb-4 text-white">通報しますか？</h2>
              <p className="text-gray-200 mb-6">通報内容は管理者に送信されます。</p>
              <div className="flex justify-between gap-4">
                <button onClick={() => setShowReportConfirm(false)} className="px-4 py-2 bg-gray-700 text-white hover:bg-gray-600 rounded-xl transition-colors">
                  キャンセル
                </button>
                <button onClick={handleReportConfirm} className="px-4 py-2 bg-red-600 text-white hover:bg-red-500 rounded-xl transition-colors">
                  通報する
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ▲▲▲ */}

        {/* ▼▼▼【通報モーダル】▼▼▼ */}
        {showReportModal && !showReportConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-gray-800/95 backdrop-blur-xl rounded-xl p-6 w-full max-w-md border border-gray-700/50">
              <h2 className="text-xl font-bold mb-4 text-white">通報する</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">通報理由</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white"
                  >
                    <option value="">選択してください</option>
                    <option value="不適切なコンテンツ">不適切なコンテンツ</option>
                    <option value="性的コンテンツ">性的コンテンツ</option>
                    <option value="暴力的コンテンツ">暴力的コンテンツ</option>
                    <option value="著作権侵害">著作権侵害</option>
                    <option value="スパム">スパム</option>
                    <option value="なりすまし">なりすまし</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">詳細内容</label>
                  <textarea
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    placeholder="通報内容を詳しく入力してください..."
                    className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none text-white placeholder-gray-500"
                    maxLength={1000}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{reportContent.length} / 1000</p>
                </div>
              </div>
              <div className="flex justify-between gap-4 mt-6">
                <button onClick={() => { setShowReportModal(false); setReportReason(''); setReportContent(''); }} className="px-4 py-2 bg-gray-700 text-white hover:bg-gray-600 rounded-xl transition-colors">
                  キャンセル
                </button>
                <button onClick={handleReportSubmit} className="px-4 py-2 bg-red-600 text-white hover:bg-red-500 rounded-xl transition-colors">
                  通報受付
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ▲▲▲ */}

        {/* モバイル版のみ固定ヘッダー */}
        {isMobile && (
          <header className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-xl z-20 flex items-center p-4 border-b border-gray-900/50">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all">
              <ArrowLeft size={24} />
            </button>
          </header>
        )}
        
        {/* PC版: ヘッダーなし、コンテンツのみ */}
        <div className={isMobile ? "pb-28 pt-20" : ""}> 
          {/* PC版: 戻るボタン */}
          {!isMobile && (
            <div className="max-w-4xl mx-auto px-4 md:px-6 mb-4">
              <button 
                onClick={() => router.back()} 
                className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all"
              >
                <ArrowLeft size={24} />
              </button>
            </div>
          )}
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            {character.characterImages && character.characterImages.length > 0 ? (
              <div className="relative w-full max-w-2xl mx-auto aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 mb-6 group">
                <Image 
                  src={character.characterImages[currentImageIndex]?.imageUrl || 'https://placehold.co/640x640/1a1a1a/ffffff?text=?'} 
                  alt={`${character.name} - ${currentImageIndex + 1}`} 
                  fill
                  className="object-contain transition-opacity duration-300"
                  sizes="(max-width: 768px) 100vw, 640px"
                  priority={currentImageIndex === 0}
                />
                
                {/* 画像カウンター */}
                {character.characterImages.length > 1 && (
                  <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-sm font-medium z-10">
                    {currentImageIndex + 1} | {character.characterImages.length}
                  </div>
                )}

                {/* 左矢印 */}
                {character.characterImages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex((prev) => 
                        prev === 0 ? character.characterImages.length - 1 : prev - 1
                      );
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                    aria-label="前の画像"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}

                {/* 右矢印 */}
                {character.characterImages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex((prev) => 
                        prev === character.characterImages.length - 1 ? 0 : prev + 1
                      );
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                    aria-label="次の画像"
                  >
                    <ChevronRight size={24} />
                  </button>
                )}

                {/* 画像インジケーター（ドット） */}
                {character.characterImages.length > 1 && character.characterImages.length <= 10 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {character.characterImages.map((_, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(index);
                        }}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentImageIndex 
                            ? 'bg-blue-500 w-6' 
                            : 'bg-white/40 hover:bg-white/60'
                        }`}
                        aria-label={`画像 ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full max-w-2xl mx-auto aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 mb-6">
                <Image 
                  src="https://placehold.co/640x640/1a1a1a/ffffff?text=?" 
                  alt={character.name} 
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 640px"
                  priority
                />
              </div>
            )}

            <main className="max-w-2xl mx-auto relative z-10">
              <div className="text-center mb-6 relative">
                <div className="absolute right-0 top-0 flex items-center gap-2" ref={menuRef}>
                  <button onClick={() => setIsHelpOpen(true)} className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all">
                    <HelpCircle size={20} />
                  </button>
                  {sessionStatus === 'authenticated' && (
                    <>
                      <button onClick={handleFavorite} className="p-2 rounded-xl hover:bg-white/10 transition-all">
                        <Heart size={20} className={character.isFavorited ? 'text-blue-500 fill-current' : 'text-gray-400'} />
                      </button>
                      <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all">
                        <MoreVertical size={20} />
                      </button>
                      {showMenu && (
                        <div className="absolute right-0 top-12 bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-lg z-30 w-40 border border-gray-700/50 py-2">
                          {isAuthor ? (
                            <>
                              <button onClick={handleEdit} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/10 hover:text-blue-400 transition-colors rounded-t-xl">
                                <Edit size={16} /> 修正
                              </button>
                              <button onClick={handleDelete} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors rounded-b-xl">
                                <Trash2 size={16} /> 削除
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={handleReport} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors rounded-t-xl">
                                <Flag size={16} /> 通報する
                              </button>
                              {character?.author?.id && (
                                <button onClick={handleBlockAuthor} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors rounded-b-xl">
                                  <ShieldBan size={16} /> 制作者をブロック
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {character.name}
                </h1>
                {character.author ? (
                  <a href={`/profile/${character.author.id}`} className="mt-2 inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Image 
                      src={character.author.image_url || 'https://placehold.co/24x24/1a1a1a/ffffff?text=?'} 
                      alt={character.author.nickname || ''}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full object-cover ring-2 ring-blue-500/30"
                    />
                    <span className="text-sm font-semibold text-gray-300 hover:text-blue-400 transition-colors">
                      {character.author.nickname || '不明'}
                    </span>
                  </a>
                ) : (
                  <div className="mt-2 inline-flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-700"></div>
                    <span className="text-sm text-gray-400">不明な作成者</span>
                  </div>
                )}
              </div>
              <div className="flex justify-center items-center gap-8 text-sm my-6">
                <div className="text-center">
                  <div className="font-bold text-2xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {character._count.favorites.toLocaleString()}
                  </div>
                  <div className="text-gray-400">お気に入り</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-2xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {character._count.chat.toLocaleString()}
                  </div>
                  <div className="text-gray-400">チャット</div>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2 my-6">
                {character.hashtags.map((tag: string) => (
                  <span key={tag} className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full border border-blue-500/30">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 mb-6">
                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{character.description}</p>
              </div>
              <div className="text-xs text-gray-500 text-center mb-6">
                <p>作成日: {new Date(character.createdAt).toLocaleDateString()}</p>
                <p>最終更新日: {new Date(character.updatedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <Comments 
                  characterId={characterId} 
                  characterAuthorId={character.author?.id ?? null}
                  session={session}
                  setModalState={setModalState}
                />
              </div>
            </main>
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-gray-900/50 z-20">
          <div className="max-w-2xl mx-auto flex gap-3">
            {sessionStatus === 'authenticated' ? (
              <>
                <a href={`/chat/${characterId}`} className="flex-1 text-center bg-gray-800/50 text-white font-semibold py-3 px-4 rounded-xl hover:bg-gray-700/50 transition-all border border-gray-700/50">
                  続きから会話
                </a>
                <button onClick={handleNewChat} disabled={isCreatingChat} className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isCreatingChat ? '作成中...' : '新しいチャットを開始'}
                </button>
              </>
            ) : (
              <button onClick={() => router.push('/login')} className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/30">
                ログインしてチャットを開始
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}