"use client";

import { useState, useEffect, FormEvent } from 'react';
import { Send, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Session } from 'next-auth'; // Session型をインポート

// 型定義
type User = {
  id: number;
  nickname: string;
  image_url: string | null;
};

type Comment = {
  id: number;
  content: string;
  createdAt: string;
  users: User;
};

interface CommentsProps {
  characterId: string;
  characterAuthorId: number | null;
  session: Session | null;
}

export default function Comments({ characterId, characterAuthorId, session }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // ▼▼▼【追加】編集関連のstate ▼▼▼
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
        const data: Comment[] = await res.json();
        setComments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラー');
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [characterId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting || session?.user?.id == null) return;

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
      alert(err instanceof Error ? err.message : 'コメント投稿中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ▼▼▼【追加】コメント削除ハンドラ ▼▼▼
  const handleDelete = async (commentId: number) => {
    if (!window.confirm('本当にこのコメントを削除しますか？')) return;
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
      alert(err instanceof Error ? err.message : '削除中にエラーが発生しました。');
    }
  };
  
  // ▼▼▼【追加】編集開始ハンドラ ▼▼▼
  const handleEditStart = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditedContent(comment.content);
    setActiveMenu(null);
  };

  // ▼▼▼【追加】コメント更新ハンドラ ▼▼▼
  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editedContent.trim() || !editingCommentId) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/characters/${characterId}/comments/${editingCommentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent }),
      });
      if (!res.ok) throw new Error('コメントの更新に失敗しました。');
      const updatedComment: Comment = await res.json();
      setComments(
        comments.map((c) => (c.id === editingCommentId ? updatedComment : c))
      );
      setEditingCommentId(null);
      setEditedContent('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新中にエラーが発生しました。');
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
              <img src={comment.users.image_url || 'https://placehold.co/40x40/1a1a1a/ffffff?text=?'} alt={comment.users.nickname} width={40} height={40} className="rounded-full mt-1 w-10 h-10 object-cover" />
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
                        <p className="font-bold text-sm">{comment.users.nickname}</p>
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
          )
        })}
      </div>
    </div>
  );
}

