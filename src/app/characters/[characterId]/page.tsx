"use client";

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MoreVertical, ArrowLeft, Send, Edit, Trash2, ShieldBan, Flag } from 'lucide-react';

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
                    <button onClick={handleConfirm} className={`px-4 py-2 text-white ${modalState.confirmText?.includes('削除') ? 'bg-red-600 hover:bg-red-500' : 'bg-pink-600 hover:bg-pink-500'} rounded-lg`}>
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
      if (!characterId) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/characters/${characterId}/comments`);
        if (!res.ok) throw new Error('コメントの読み込みに失敗しました。');
        const data = await res.json();
        
        if (Array.isArray(data)) {
          setComments(data);
        } else if (data && Array.isArray(data.comments)) {
          setComments(data.comments);
        } else {
          setComments([]);
        }
      } catch (err) {
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
      const res = await fetch(`/api/characters/${characterId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });
      if (!res.ok) throw new Error('コメントの投稿に失敗しました。');
      const createdComment: Comment = await res.json();
      setComments([createdComment, ...comments]);
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
              const res = await fetch(`/api/characters/${characterId}/comments/${commentId}`, {
                method: 'DELETE',
              });
              if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'コメントの削除に失敗しました。');
              }
              setComments(comments.filter((comment) => comment.id !== commentId));
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
      const res = await fetch(`/api/characters/${characterId}/comments/${editingCommentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent }),
      });
      if (!res.ok) throw new Error('コメントの更新に失敗しました。');
      const updatedComment: Comment = await res.json();
      setComments(comments.map((c) => (c.id === editingCommentId ? updatedComment : c)));
      setEditingCommentId(null);
      setEditedContent('');
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
          <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="コメントを追加..." className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500" disabled={isSubmitting} />
          <button type="submit" className="bg-pink-600 p-3 rounded-lg hover:bg-pink-700 disabled:bg-gray-500" disabled={isSubmitting || !newComment.trim()}><Send size={20} /></button>
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
                <img src={comment.users.image_url || 'https://placehold.co/40x40/1a1a1a/ffffff?text=?'} alt={comment.users.nickname} width={40} height={40} className="rounded-full mt-1 w-10 h-10 object-cover" />
              </a>
              <div className='flex-1'>
                {editingCommentId === comment.id ? (
                   <form onSubmit={handleUpdate}>
                     <input type="text" value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-500" autoFocus />
                     <div className="flex gap-2 mt-2">
                       <button type="submit" disabled={isSubmitting} className="text-xs bg-pink-600 hover:bg-pink-700 px-3 py-1 rounded">保存</button>
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
  const menuRef = useRef<HTMLDivElement>(null);

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
        const res = await fetch(`/api/characters/${characterId}`);
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
      } catch (e) {
        setError(e instanceof Error ? e.message : '不明なエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchCharacter();
  // ❗️依存性もparams.characterId → characterId に置き換え
  }, [characterId]);

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

  // ▼▼▼【제작자 여부 확인】▼▼▼
  const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;
  const isAuthor = character?.author?.id === currentUserId;
  // ▲▲▲

  // ▼▼▼【메뉴 액션 핸들러】▼▼▼
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
          const res = await fetch(`/api/characters/${characterId}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('削除に失敗しました。');
          router.push('/character-management');
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
    setShowReportConfirm(false);
    if (!characterId || !session?.user?.id) return;
    
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CHARACTER_REPORT',
          characterId: parseInt(characterId, 10),
          reason: reportReason,
          content: reportContent,
        }),
      });
      if (!res.ok) throw new Error('通報受付に失敗しました。');
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
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: err instanceof Error ? err.message : '通報受付中にエラーが発生しました。',
        isAlert: true,
      });
    }
  };
  // ▲▲▲

  const handleFavorite = async () => {
    if (!character) return;
    try {
      const method = character.isFavorited ? 'DELETE' : 'POST';
      const res = await fetch(`/api/characters/${character.id}/favorite`, { method });
      if (!res.ok) throw new Error('お気に入り登録に失敗しました。');
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
    } catch (e) {
      setModalState({ isOpen: true, title: 'エラー', message: e instanceof Error ? e.message : 'お気に入り登録中にエラーが発生しました。', isAlert: true });
    }
  };
  
  const handleNewChat = async () => {
      if (!characterId) return;
      setIsCreatingChat(true);
      try {
          const res = await fetch('/api/chat/new', {
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

  if (loading || sessionStatus === 'loading') return <div className="min-h-screen bg-black text-white flex justify-center items-center"><p>読み込み中...</p></div>;
  
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
  
  return (
    <div className="bg-black text-white min-h-screen font-sans">
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />
      
      {/* ▼▼▼【通報確認モーダル】▼▼▼ */}
      {showReportConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4 text-white">
            <h2 className="text-xl font-bold mb-4">通報しますか？</h2>
            <p className="text-gray-200 mb-6">通報内容は管理者に送信されます。</p>
            <div className="flex justify-between gap-4">
              <button onClick={() => setShowReportConfirm(false)} className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg">
                キャンセル
              </button>
              <button onClick={handleReportConfirm} className="px-4 py-2 bg-red-600 text-white hover:bg-red-500 rounded-lg">
                通報する
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ▲▲▲ */}

      {/* ▼▼▼【通報モーダル】▼▼▼ */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md m-4 text-white">
            <h2 className="text-xl font-bold mb-4">通報する</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">通報理由</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
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
                <label className="block text-sm font-medium mb-2">詳細内容</label>
                <textarea
                  value={reportContent}
                  onChange={(e) => setReportContent(e.target.value)}
                  placeholder="通報内容を詳しく入力してください..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                  maxLength={1000}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{reportContent.length} / 1000</p>
              </div>
            </div>
            <div className="flex justify-between gap-4 mt-6">
              <button onClick={() => { setShowReportModal(false); setReportReason(''); setReportContent(''); }} className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg">
                キャンセル
              </button>
              <button onClick={handleReportSubmit} className="px-4 py-2 bg-red-600 text-white hover:bg-red-500 rounded-lg">
                通報受付
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ▲▲▲ */}

      <header className="fixed top-0 left-0 right-0 bg-black bg-opacity-80 backdrop-blur-sm z-20 flex items-center justify-between p-4">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-800"><ArrowLeft size={24} /></button>
          <div className="flex items-center gap-2 relative" ref={menuRef}>
            <button onClick={handleFavorite} className="p-2 rounded-full hover:bg-gray-800"><Heart size={24} className={character.isFavorited ? 'text-pink-500 fill-current' : ''} /></button>
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-800"><MoreVertical size={24} /></button>
            {showMenu && (
              <div className="absolute right-0 top-12 bg-gray-800 rounded-md shadow-lg z-30 w-40">
                {isAuthor ? (
                  <>
                    <button onClick={handleEdit} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-700 rounded-t-md">
                      <Edit size={16} /> 修正
                    </button>
                    <button onClick={handleDelete} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-b-md">
                      <Trash2 size={16} /> 削除
                    </button>
                  </>
                ) : (
                  <button onClick={handleReport} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-md">
                    <Flag size={16} /> 通報する
                  </button>
                )}
              </div>
            )}
          </div>
      </header>
      
      <div className="pb-28 pt-16"> 
        <div className="relative w-full max-w-2xl mx-auto aspect-square rounded-xl overflow-hidden">
            <img 
              src={character.characterImages[0]?.imageUrl || 'https://placehold.co/640x640/1a1a1a/ffffff?text=?'} 
              alt={character.name} 
              className="w-full h-full object-cover"
            />
        </div>

        <main className="max-w-2xl mx-auto px-4 relative z-10">
          <div className="text-center mb-6 mt-4">
            <h1 className="text-2xl font-bold text-white">{character.name}</h1>
            {character.author ? (
              <a href={`/profile/${character.author.id}`} className="mt-2 inline-flex items-center gap-2">
                <img 
                  src={character.author.image_url || 'https://placehold.co/24x24/1a1a1a/ffffff?text=?'} 
                  alt={character.author.nickname || ''}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover"
                />
                <span className="text-sm font-semibold text-gray-300 hover:underline">
                  {character.author.nickname || '不明'}
                </span>
              </a>
            ) : (
              <div className="mt-2 inline-flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-700"></div>
                <span className="text-sm text-gray-400">&apos;不明な作成者&apos;</span>
              </div>
            )}
          </div>
          <div className="flex justify-center items-center gap-6 text-sm text-gray-400 my-4">
              <div className="text-center"><div className="font-bold text-white">{character._count.favorites.toLocaleString()}</div><div>お気に入り</div></div>
              <div className="text-center"><div className="font-bold text-white">{character._count.chat.toLocaleString()}</div><div>チャット</div></div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 my-4">
              {character.hashtags.map((tag: string) => <span key={tag} className="bg-gray-800 text-pink-400 text-xs font-semibold px-3 py-1 rounded-full">#{tag}</span>)}
          </div>
          <p className="text-gray-300 my-6 whitespace-pre-wrap text-center">{character.description}</p>
          <div className="text-xs text-gray-500 text-center">
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black border-t border-gray-800 z-20">
        <div className="mx-auto max-w-2xl flex gap-4">
          {sessionStatus === 'authenticated' ? (
            <>
              <a href={`/chat/${characterId}`} className="flex-1 text-center bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors">
                続きから会話
              </a>
              <button onClick={handleNewChat} disabled={isCreatingChat} className="flex-1 bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 transition-colors disabled:bg-pink-800 disabled:cursor-not-allowed">
                {isCreatingChat ? '作成中...' : '新しいチャットを開始'}
              </button>
            </>
          ) : (
            <button onClick={() => router.push('/login')} className="w-full bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 transition-colors">
              ログインしてチャットを開始
            </button>
          )}
        </div>
      </div>
    </div>
  );
}