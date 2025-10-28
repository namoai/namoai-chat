"use client";

import React, { useState, useEffect } from 'react';
import { ArrowLeft, MoreVertical, Heart, MessageSquare, User, Share2, ShieldBan, ShieldCheck, Edit, KeyRound, X, UserMinus, Trash2 } from 'lucide-react';
// ▼▼▼【修正】Next.jsのImageコンポーネントをインポートします ▼▼▼
import Image from 'next/image';
import { signOut } from 'next-auth/react';

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

  if (loading || sessionStatus === 'loading') return <div className="min-h-screen bg-black text-white flex justify-center items-center">ローディング中...</div>;
  if (error) return <div className="min-h-screen bg-black text-white flex justify-center items-center"><p className="text-red-500">{error}</p></div>;
  if (!profile) return <div className="min-h-screen bg-black text-white flex justify-center items-center">ユーザーが見つかりません。</div>;
  
  const isMyProfile = session?.user?.id === userId;

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
      <div className="bg-black min-h-screen text-white">
        <div className="mx-auto max-w-4xl">
          <header className="flex items-center justify-between p-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
            <button onClick={() => window.history.back()} className="p-2 rounded-full hover:bg-gray-700 transition-colors"><ArrowLeft /></button>
            <h1 className="font-bold text-lg">製作者プロフィール</h1>
            <div className="relative">
               <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-700 transition-colors"><MoreVertical /></button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-lg z-20 py-1">
                  {isMyProfile ? (
                    <>
                      <button onClick={() => window.location.href = '/profile-edit'} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"><Edit size={16} /> プロフィール編集</button>
                      <button onClick={() => window.location.href = '/change-password'} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"><KeyRound size={16} /> パスワード変更</button>
                      <button onClick={() => handleShowList('blocked')} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"><UserMinus size={16} /> ブロックリスト</button>
                      <div className="border-t border-gray-700 my-1"></div>
                      <button onClick={handleAccountDeleteConfirm} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2 text-red-400"><Trash2 size={16} /> 会員退会</button>
                    </>
                  ) : (
                    <>
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2"><Share2 size={16} /> 共有する</button>
                      <button onClick={() => handleBlock(profile.id)} className={`w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2 ${profile.isBlocked ? 'text-green-400' : 'text-red-500'}`}>
                         {profile.isBlocked ? <ShieldCheck size={16}/> : <ShieldBan size={16}/>}
                         {profile.isBlocked ? 'ブロック解除' : '製作者をブロック'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </header>

          <main className="p-4">
            <section>
              <div className="flex items-start gap-4">
                 {/* ▼▼▼【修正】imgタグをImageコンポーネントに、widthとheightを追加 ▼▼▼ */}
                {profile.image_url ? ( <Image src={profile.image_url} alt={profile.nickname} width={80} height={80} className="rounded-full object-cover w-20 h-20" /> ) : ( <DefaultAvatarIcon size={80} /> )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{profile.nickname}</h2>
                  <div className="flex gap-4 text-sm text-gray-400 mt-1">
                    <button onClick={() => handleShowList('followers')} className="hover:underline">フォロワー {formatNumber(profile._count.followers)}</button>
                    <button onClick={() => handleShowList('following')} className="hover:underline">フォロー中 {formatNumber(profile._count.following)}</button>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-base">{profile.bio || "自己紹介がありません。"}</p>
               {isMyProfile && ( <button onClick={() => window.location.href = '/profile-edit'} className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">プロフィール編集</button> )}
               {!isMyProfile && sessionStatus === 'authenticated' && (
                <div className="flex gap-2 mt-4">
                  <button onClick={handleFollow} className={`flex-1 font-bold py-2 px-4 rounded-lg transition-colors ${profile.isFollowing ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-pink-600 text-white hover:bg-pink-500'}`}>
                    {profile.isFollowing ? 'フォロー中' : 'フォロー'}
                  </button>
                  <button className="border border-pink-600 text-pink-500 hover:bg-pink-600 hover:text-white font-bold py-2 px-4 rounded-lg transition-colors">応援する</button>
                </div>
              )}
            </section>

            <section className="mt-8">
               <div className="flex justify-between items-end mb-4">
                 <h3 className="text-lg font-bold">{profile.characters.length}個のキャラクター | 会話量 {formatNumber(profile.totalMessageCount)}</h3>
                 <span className="text-sm text-gray-400">会話量順</span>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {profile.characters.map(char => (
                   <a href={`/characters/${char.id}`} key={char.id} className="block group">
                     <div className="bg-[#1C1C1E] rounded-lg overflow-hidden transition-transform group-hover:scale-105">
                       <div className="relative aspect-[3/4]">
                         {/* ▼▼▼【修正】imgタグをImageコンポーネントに、fillとstyleを追加し、プレースホルダーURLを安全なものに変更 ▼▼▼ */}
                         <Image 
                            src={char.characterImages[0]?.imageUrl || 'https://via.placeholder.com/300x400'} 
                            alt={char.name} 
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="(max-width: 768px) 50vw, 33vw"
                         />
                       </div>
                       <div className="p-3">
                         <h4 className="font-semibold truncate text-white">{char.name}</h4>
                         <p className="text-xs text-gray-400 truncate">@{profile.nickname}</p>
                         <div className="flex justify-between text-xs text-gray-400 mt-1">
                           <div className="flex items-center gap-1"><Heart size={12}/> {formatNumber(char._count.favorites)}</div>
                           <div className="flex items-center gap-1"><MessageSquare size={12}/> {formatNumber(char._count.chat)}</div>
                         </div>
                       </div>
                     </div>
                   </a>
                 ))}
               </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
