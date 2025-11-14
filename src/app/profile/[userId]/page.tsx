"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, MoreVertical, Heart, MessageSquare, User, Share2, ShieldBan, ShieldCheck, Edit, KeyRound, X, UserMinus, Trash2, HelpCircle } from 'lucide-react';
// ▼▼▼【修正】Next.jsのImageコンポーネントをインポートします ▼▼▼
import Image from 'next/image';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import HelpModal from '@/components/HelpModal';

// 型定義
type FollowUser = {
  id: number;
  nickname: string;
  image_url: string | null;
};

type BlockedUser = {
    id: number;
    nickname: string;
    image_url: string | null;
};

type ProfileData = {
  id: number;
  name: string;
  nickname: string;
  image_url: string | null;
  bio: string | null;
  hasPassword: boolean; // パスワードが設定されているか
  totalMessageCount: number;
  characters: {
    id: number;
    name: string;
    characterImages: { imageUrl: string }[];
    _count: { favorites: number; chat: number };
  }[];
  _count: {
    followers: number;
    following: number;
  };
  isFollowing: boolean;
  isBlocked: boolean;
};

type SessionData = {
  user?: { id?: string; }
};

// コンポーネント
const DefaultAvatarIcon = ({ size = 80, className = '' }: { size?: number, className?: string }) => (
  <div className={`rounded-full bg-gray-700 flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
    <User size={size * 0.6} className="text-gray-400" />
  </div>
);

const UserListModal = ({ title, users, onClose, isLoading, onUnblock, showUnblockButton = false }: { 
    title: string, 
    users: (FollowUser | BlockedUser)[], 
    onClose: () => void, 
    isLoading: boolean,
    onUnblock?: (userId: number) => void,
    showUnblockButton?: boolean
}) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
        <div className="bg-gray-800 rounded-lg w-full max-w-sm mx-4 max-h-[80vh] flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="font-bold text-lg text-white">{title}</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700"><X size={20} className="text-gray-400" /></button>
            </header>
            <div className="overflow-y-auto p-4 space-y-2">
                {isLoading ? (
                    <p className="text-gray-400 text-center py-4">読み込み中...</p>
                ) : users.length > 0 ? (
                    users.map(user => (
                        <div key={user.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-700 transition-colors">
                            <a href={`/profile/${user.id}`} className="flex items-center gap-3 flex-grow">
                                {user.image_url ? (
                                    // ▼▼▼【修正】imgタグをNext.jsのImageコンポーネントに変更 ▼▼▼
                                    <Image src={user.image_url} alt={user.nickname} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <DefaultAvatarIcon size={40} />
                                )}
                                <span className="font-semibold text-white">{user.nickname}</span>
                            </a>
                            {showUnblockButton && onUnblock && (
                                <button 
                                    onClick={() => onUnblock(user.id)} 
                                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded-full transition-colors"
                                >
                                    ブロック解除
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <p className="text-gray-400 text-center py-4">ユーザーがいません。</p>
                )}
            </div>
        </div>
    </div>
);

export default function UserProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionStatus, setSessionStatus] = useState('loading');
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuButtonRef.current?.contains(event.target as Node) ||
        menuRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setShowMenu(false);
    };
    if (showMenu && menuButtonRef.current) {
      document.addEventListener("mousedown", handleClickOutside);
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 224, // メニュー幅224px
      });
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);
  
  const [modalState, setModalState] = useState<{type: 'followers' | 'following' | 'blocked', users: (FollowUser | BlockedUser)[]} | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  
  // 会員退会用の確認モーダル状態
  const [deleteAccountModal, setDeleteAccountModal] = useState<{
    isOpen: boolean;
    stage: 'first' | 'second' | 'success' | 'error';
    message: string;
  }>({ isOpen: false, stage: 'first', message: '' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const id = pathParts[pathParts.length - 1];
      setUserId(id);
    }
  }, []);
  
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        setSession(res.ok ? await res.json() : null);
      } finally {
        setSessionStatus('authenticated');
      }
    };
    fetchSession();
  }, []);
  
  useEffect(() => {
    if (userId) {
      const fetchProfile = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/profile/${userId}`);
          if (!response.ok) throw new Error((await response.json()).error || 'プロファイルの読み込みに失敗しました。');
          setProfile(await response.json());
        } catch (err) {
          setError(err instanceof Error ? err.message : "不明なエラー");
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    }
  }, [userId]);

  const handleFollow = async () => {
    if (sessionStatus !== 'authenticated' || !profile) {
      window.location.href = '/login';
      return;
    }
    const originalFollowingState = profile.isFollowing;
    const originalFollowerCount = profile._count.followers;
    
    setProfile(prev => prev ? { ...prev, isFollowing: !originalFollowingState, _count: { ...prev._count, followers: originalFollowingState ? originalFollowerCount - 1 : originalFollowerCount + 1 } } : null);

    try {
      const response = await fetch(`/api/profile/${userId}/follow`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'フォロー状態の更新に失敗しました。');
      setProfile(prev => prev ? { ...prev, isFollowing: data.isFollowing, _count: { ...prev._count, followers: data.newFollowerCount } } : null);
    } catch (error) {
      setProfile(prev => prev ? { ...prev, isFollowing: originalFollowingState, _count: { ...prev._count, followers: originalFollowerCount } } : null);
      alert(error instanceof Error ? error.message : 'エラーが発生しました。');
    }
  };
  
  const handleBlock = async (targetUserId: number) => {
    if (sessionStatus !== 'authenticated') {
      window.location.href = '/login';
      return;
    }
    
    if (profile && targetUserId === profile.id) {
        const originalBlockedState = profile.isBlocked;
        setProfile(prev => prev ? { ...prev, isBlocked: !originalBlockedState } : null);
        try {
          const response = await fetch(`/api/profile/${targetUserId}/block`, { method: 'POST' });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'ブロック状態の更新に失敗しました。');
          setProfile(prev => prev ? { ...prev, isBlocked: data.isBlocked } : null);
        } catch (error) {
          setProfile(prev => prev ? { ...prev, isBlocked: originalBlockedState } : null);
          alert(error instanceof Error ? error.message : 'エラーが発生しました。');
        } finally {
          setShowMenu(false);
        }
    } 
    else {
        try {
            const response = await fetch(`/api/profile/${targetUserId}/block`, { method: 'POST' });
            if (!response.ok) throw new Error((await response.json()).error || 'ブロック解除に失敗しました。');
            setModalState(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    users: prev.users.filter(u => u.id !== targetUserId)
                };
            });
        } catch (err) {
            alert(err instanceof Error ? err.message : 'エラー');
        }
    }
  };
  
  const handleShowList = async (type: 'followers' | 'following' | 'blocked') => {
      if (!userId) return;
      setModalState({ type, users: [] });
      setIsModalLoading(true);
      setShowMenu(false);
      try {
          const endpoint = type === 'blocked' 
              ? `/api/profile/${userId}/blocked-users` 
              : `/api/profile/${userId}/${type}`;
          const response = await fetch(endpoint);
          if (!response.ok) throw new Error('リストの読み込みに失敗しました。');
          
          // ▼▼▼【修正】APIレスポンスの構造に合わせてデータを正しく抽出します ▼▼▼
          const data = await response.json();
          const userList = data.followers || data.following || data.blockedUsers || [];
          
          setModalState({ type, users: userList });
      } catch (err) {
          alert(err instanceof Error ? err.message : 'エラー');
          setModalState(null);
      } finally {
          setIsModalLoading(false);
      }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
  };

  // 会員退会処理
  const handleAccountDelete = async () => {
    try {
      const response = await fetch('/api/users/account', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'アカウント削除に失敗しました。');
      }

      // 削除成功メッセージを表示
      setDeleteAccountModal({
        isOpen: true,
        stage: 'success',
        message: '会員退会が完了しました。またお会いできる日を楽しみにしています。\nご利用ありがとうございました。',
      });
    } catch (error) {
      console.error('アカウント削除エラー:', error);
      setDeleteAccountModal({
        isOpen: true,
        stage: 'error',
        message: error instanceof Error ? error.message : 'アカウント削除中にエラーが発生しました。',
      });
    }
  };

  // 会員退会の最終確認（2段階目）
  const handleAccountDeleteFinalConfirm = () => {
    setDeleteAccountModal({
      isOpen: true,
      stage: 'second',
      message: '本当に会員退会を進めますか？\n退会すると、すべてのデータが削除され、元に戻すことはできません。',
    });
  };

  // 会員退会の初回確認（1段階目）
  const handleAccountDeleteConfirm = () => {
    setShowMenu(false);
    setDeleteAccountModal({
      isOpen: true,
      stage: 'first',
      message: '会員退会を進めますか？',
    });
  };

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }
  if (error) return <div className="min-h-screen bg-black text-white flex justify-center items-center"><p className="text-red-500">{error}</p></div>;
  if (!profile) return <div className="min-h-screen bg-black text-white flex justify-center items-center">ユーザーが見つかりません。</div>;
  
  // プロフィールが本人のものかどうかを確認（文字列と数値の両方を考慮）
  const isMyProfile = session?.user?.id ? 
    (String(session.user.id) === String(userId) || Number(session.user.id) === Number(userId)) : 
    false;
  
  // デバッグ用ログ（本番環境では削除推奨）
  console.log('プロフィール確認:', { 
    sessionUserId: session?.user?.id, 
    urlUserId: userId, 
    isMyProfile,
    profileId: profile.id 
  });

  if (profile.isBlocked && !isMyProfile) {
      return (
          <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-4 text-center">
              <ShieldBan size={48} className="text-red-500 mb-4" />
              <h2 className="text-xl font-bold mb-2">この製作者はブロックされています。</h2>
              <p className="text-gray-400 mb-6">ブロックを解除すると、プロフィールとキャラクターが表示されます。</p>
              <button onClick={() => handleBlock(profile.id)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">ブロック解除</button>
          </div>
      );
  }

  return (
    <>
      {modalState && (
          <UserListModal
              title={modalState.type === 'followers' ? 'フォロワー' : modalState.type === 'following' ? 'フォロー中' : 'ブロックリスト'}
              users={modalState.users}
              onClose={() => setModalState(null)}
              isLoading={isModalLoading}
              showUnblockButton={modalState.type === 'blocked'}
              onUnblock={(id) => handleBlock(id)}
          />
      )}
      
      {/* 会員退会確認モーダル */}
      {deleteAccountModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-white">
              {deleteAccountModal.stage === 'first' && '会員退会'}
              {deleteAccountModal.stage === 'second' && '⚠️ 最終確認'}
              {deleteAccountModal.stage === 'success' && '✅ 会員退会完了'}
              {deleteAccountModal.stage === 'error' && '❌ エラー'}
            </h2>
            <p className="text-gray-200 mb-6 whitespace-pre-line leading-relaxed">
              {deleteAccountModal.message}
            </p>
            <div className="flex justify-end gap-3">
              {deleteAccountModal.stage === 'first' && (
                <>
                  <button 
                    onClick={() => setDeleteAccountModal({ ...deleteAccountModal, isOpen: false })} 
                    className="px-5 py-2.5 border border-gray-600 text-gray-200 hover:bg-gray-800 hover:border-gray-500 rounded-lg transition-all duration-200 font-medium"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={() => {
                      setDeleteAccountModal({ ...deleteAccountModal, isOpen: false });
                      setTimeout(() => handleAccountDeleteFinalConfirm(), 300);
                    }}
                    className="px-5 py-2.5 bg-pink-600 text-white hover:bg-pink-500 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-pink-500/50"
                  >
                    次へ
                  </button>
                </>
              )}
              {deleteAccountModal.stage === 'second' && (
                <>
                  <button 
                    onClick={() => setDeleteAccountModal({ ...deleteAccountModal, isOpen: false })} 
                    className="px-5 py-2.5 border border-gray-600 text-gray-200 hover:bg-gray-800 hover:border-gray-500 rounded-lg transition-all duration-200 font-medium"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={() => {
                      setDeleteAccountModal({ ...deleteAccountModal, isOpen: false });
                      handleAccountDelete();
                    }}
                    className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-500 rounded-lg transition-all duration-200 font-bold shadow-lg hover:shadow-red-500/50"
                  >
                    退会する
                  </button>
                </>
              )}
              {(deleteAccountModal.stage === 'success' || deleteAccountModal.stage === 'error') && (
                <button 
                  onClick={() => {
                    setDeleteAccountModal({ ...deleteAccountModal, isOpen: false });
                    if (deleteAccountModal.stage === 'success') {
                      signOut({ callbackUrl: '/' });
                    }
                  }}
                  className={`px-6 py-2.5 rounded-lg transition-all duration-200 font-medium shadow-lg ${
                    deleteAccountModal.stage === 'success' 
                      ? 'bg-pink-600 text-white hover:bg-pink-500 hover:shadow-pink-500/50' 
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="bg-black min-h-screen text-white" style={{ overflow: 'visible' }}>
        {/* 背景装飾 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10" style={{ overflow: 'visible' }}>
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24" style={{ overflow: 'visible' }}>
            <header className="flex items-center justify-between mb-6 sticky top-0 bg-black/80 backdrop-blur-xl z-10 py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-900/50" style={{ overflow: 'visible' }}>
              <button onClick={() => window.history.back()} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                製作者プロフィール
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
                  aria-label="ヘルプ"
                >
                  <HelpCircle size={24} />
                </button>
                <div className="relative" style={{ overflow: 'visible' }}>
                  <button 
                    ref={menuButtonRef}
                    onClick={() => setShowMenu(!showMenu)} 
                    className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
                  >
                    <MoreVertical size={24} />
                  </button>
                </div>
              </div>
                {showMenu &&
                  typeof window !== "undefined" &&
                  createPortal(
                    <div
                      ref={menuRef}
                      className="fixed w-56 bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-2xl z-[9999] py-2 border border-gray-700/50"
                      style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                      }}
                    >
                      {isMyProfile ? (
                        <>
                          <button onClick={() => { window.location.href = '/profile-edit'; setShowMenu(false); }} className="w-full text-left px-4 py-2 !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:text-pink-300 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 flex items-center gap-2 group">
                            <Edit size={16} className="text-white group-hover:scale-110 group-hover:text-pink-400 transition-all duration-300" /> 
                            <span className="group-hover:translate-x-1 transition-transform duration-300">プロフィール編集</span>
                          </button>
                          {profile.hasPassword && (
                            <button onClick={() => { window.location.href = '/change-password'; setShowMenu(false); }} className="w-full text-left px-4 py-2 !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:text-pink-300 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 flex items-center gap-2 group">
                              <KeyRound size={16} className="text-white group-hover:scale-110 group-hover:text-pink-400 transition-all duration-300" /> 
                              <span className="group-hover:translate-x-1 transition-transform duration-300">パスワード変更</span>
                            </button>
                          )}
                          <button onClick={() => { handleShowList('blocked'); setShowMenu(false); }} className="w-full text-left px-4 py-2 !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:text-pink-300 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 flex items-center gap-2 group">
                            <UserMinus size={16} className="text-white group-hover:scale-110 group-hover:text-pink-400 transition-all duration-300" /> 
                            <span className="group-hover:translate-x-1 transition-transform duration-300">ブロックリスト</span>
                          </button>
                          <div className="border-t border-gray-700/50 my-1"></div>
                          <button onClick={() => { handleAccountDeleteConfirm(); setShowMenu(false); }} className="w-full text-left px-4 py-2 !text-red-400 hover:bg-gradient-to-r hover:from-red-500/20 hover:via-pink-500/20 hover:to-red-500/20 hover:text-red-300 hover:shadow-lg hover:shadow-red-500/30 transition-all duration-300 flex items-center gap-2 group">
                            <Trash2 size={16} className="text-red-400 group-hover:scale-110 group-hover:text-red-300 transition-all duration-300" /> 
                            <span className="group-hover:translate-x-1 transition-transform duration-300">会員退会</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="w-full text-left px-4 py-2 !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:text-pink-300 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 flex items-center gap-2 group">
                            <Share2 size={16} className="text-white group-hover:scale-110 group-hover:text-pink-400 transition-all duration-300" /> 
                            <span className="group-hover:translate-x-1 transition-transform duration-300">共有する</span>
                          </button>
                          <button onClick={() => { handleBlock(profile.id); setShowMenu(false); }} className={`w-full text-left px-4 py-2 !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 flex items-center gap-2 group ${profile.isBlocked ? 'hover:text-green-300' : 'hover:text-red-300'}`}>
                            {profile.isBlocked ? <ShieldCheck size={16} className="text-white group-hover:scale-110 group-hover:text-green-400 transition-all duration-300"/> : <ShieldBan size={16} className="text-white group-hover:scale-110 group-hover:text-red-400 transition-all duration-300"/>}
                            <span className="group-hover:translate-x-1 transition-transform duration-300">{profile.isBlocked ? 'ブロック解除' : '製作者をブロック'}</span>
                          </button>
                        </>
                      )}
                    </div>,
                    document.body
                  )}
            </header>

            <main className="space-y-8">
              <section className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                  {profile.image_url ? (
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-2 ring-pink-500/30 flex-shrink-0">
                      <Image src={profile.image_url} alt={profile.nickname} fill className="object-cover" sizes="128px" />
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center ring-2 ring-pink-500/30 flex-shrink-0">
                      <User size={48} className="text-pink-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                      {profile.nickname}
                    </h2>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-3">
                      <button onClick={() => handleShowList('followers')} className="hover:text-pink-400 transition-colors">
                        フォロワー <span className="font-semibold text-white">{formatNumber(profile._count.followers)}</span>
                      </button>
                      <button onClick={() => handleShowList('following')} className="hover:text-pink-400 transition-colors">
                        フォロー中 <span className="font-semibold text-white">{formatNumber(profile._count.following)}</span>
                      </button>
                    </div>
                    <p className="text-base text-gray-300 leading-relaxed">{profile.bio || "自己紹介がありません。"}</p>
                  </div>
                </div>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  {isMyProfile && (
                    <button onClick={() => window.location.href = '/profile-edit'} className="w-full sm:w-auto bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg shadow-pink-500/30">
                      プロフィール編集
                    </button>
                  )}
                  {!isMyProfile && sessionStatus === 'authenticated' && (
                    <button onClick={handleFollow} className={`w-full font-bold py-3 px-6 rounded-xl transition-all ${
                        profile.isFollowing 
                          ? 'bg-gray-800/50 text-white hover:bg-gray-700/50 border border-gray-700/50' 
                          : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg shadow-pink-500/30'
                      }`}>
                        {profile.isFollowing ? 'フォロー中' : 'フォロー'}
                      </button>
                  )}
                </div>
              </section>

              <section>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-2">
                  <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    {profile.characters.length}個のキャラクター | 会話量 {formatNumber(profile.totalMessageCount)}
                  </h3>
                  <span className="text-sm text-gray-400">会話量順</span>
                </div>
                
                {profile.characters.length === 0 ? (
                  // ★ キャラクターが0件の場合の表示
                  <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-sm border border-gray-800/50">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                      <User className="w-10 h-10 text-pink-400/50" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-300 mb-2">製作したキャラクターがありません</h3>
                    <p className="text-gray-500 text-center max-w-md mb-4">
                      {isMyProfile 
                        ? "まだキャラクターを作成していません。\n最初のキャラクターを作成してみましょう！" 
                        : `${profile.nickname}さんはまだキャラクターを作成していません。`}
                    </p>
                    {isMyProfile && (
                      <Link
                        href="/characters/create"
                        className="mt-4 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-pink-500/30 inline-block"
                      >
                        キャラクターを作成
                      </Link>
                    )}
                  </div>
                ) : (
                  // ★ キャラクターがある場合の表示
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {profile.characters.map(char => (
                    <a href={`/characters/${char.id}`} key={char.id} className="block group">
                      <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800/50 hover:border-pink-500/30 transition-all group-hover:scale-105">
                        <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
                          <Image 
                            src={char.characterImages[0]?.imageUrl || 'https://placehold.co/300x400/1a1a1a/ffffff?text=?'} 
                            alt={char.name} 
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                          />
                          {/* ホバー時のピンク-パープルグラデーションオーバーレイ（黒いオーバーレイを削除） */}
                          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-pink-500/30 group-hover:via-purple-500/20 group-hover:to-pink-500/30 transition-all duration-500" />
                        </div>
                        <div className="p-3">
                          <h4 className="font-semibold truncate text-white mb-1 group-hover:text-pink-400 transition-colors">{char.name}</h4>
                          <p className="text-xs text-gray-400 truncate mb-2">@{profile.nickname}</p>
                          <div className="flex justify-between text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Heart size={12}/> {formatNumber(char._count.favorites)}
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageSquare size={12}/> {formatNumber(char._count.chat)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
                )}
              </section>
            </main>
          </div>
        </div>
      </div>
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="プロフィールページの使い方"
        content={
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">概要</h3>
              <p className="text-gray-300">
                ユーザーのプロフィールページです。作成したキャラクター、フォロワー、フォロー中のユーザーを確認できます。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">主要機能</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-2">
                <li><strong>フォロー/フォロー解除</strong>: ユーザーをフォローして更新情報を受け取る</li>
                <li><strong>ブロック/ブロック解除</strong>: 不適切なユーザーをブロック</li>
                <li><strong>キャラクター一覧</strong>: このユーザーが作成したキャラクターを表示</li>
                <li><strong>フォロワー/フォロー中</strong>: フォロー関係を確認</li>
                <li><strong>チャット数/いいね数</strong>: キャラクターの人気度を確認</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-pink-400 mb-2">メニュー機能（...ボタン）</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                <li>自分のプロフィールの場合: プロフィール編集、パスワード変更、会員退会</li>
                <li>他人のプロフィールの場合: フォロー、ブロック、共有</li>
              </ul>
            </div>
          </div>
        }
      />
    </>
  );
}
