"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, MoreVertical, Heart, MessageSquare, KeyRound, Mail, X, User } from 'lucide-react';
import { useSession } from 'next-auth/react';

// API応答の型定義
type ProfileData = {
  id: number;
  name: string;
  nickname: string;
  email: string;
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
};

type PasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

// DefaultAvatarIconコンポーネント
const DefaultAvatarIcon = ({ size = 80 }: { size?: number }) => (
  <div
    className="rounded-full bg-gray-700 flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <User size={size * 0.6} className="text-gray-400" />
  </div>
);

// 汎用モーダルコンポーネント
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  isAlert?: boolean;
};

const CustomModal = ({ isOpen, onClose, title, message, isAlert }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg transition-colors">
            {isAlert ? 'OK' : '閉じる'}
          </button>
        </div>
      </div>
    </div>
  );
};


export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const userId = params.userId as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<Omit<ModalProps, 'onClose'>>({ isOpen: false, title: '', message: '' });
  
  // ▼▼▼【修正点】useEffectの呼び出しを条件分岐の外に移動しました ▼▼▼
  useEffect(() => {
    // userIdが存在する場合のみデータを取得します
    if (userId) {
      const fetchProfile = async () => {
        try {
          const response = await fetch(`/api/profile/${userId}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'プロファイルの読み込みに失敗しました。');
          }
          const data = await response.json();
          setProfile(data);
        } catch (error) {
          console.error(error);
          setModalState({ isOpen: true, title: 'エラー', message: (error as Error).message, isAlert: true });
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    } else {
      // userIdがない場合はローディングを停止します
      setLoading(false);
    }
  }, [userId]);
  // ▲▲▲【修正完了】▲▲▲
  
  const closeModal = () => setModalState({ ...modalState, isOpen: false });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex justify-center items-center">ローディング中...</div>;
  }
  
  if (!profile) {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center">
            <p className="text-red-500 mb-4">ユーザーが見つかりません。</p>
            <button onClick={() => router.back()} className="text-pink-400 hover:underline">
                戻る
            </button>
        </div>
    );
  }

  const isMyProfile = session?.user?.id === userId;

  return (
    <>
      <CustomModal {...modalState} isOpen={modalState.isOpen} onClose={closeModal} />
      <div className="bg-black min-h-screen text-white">
        <div className="mx-auto max-w-4xl">
          <header className="flex items-center justify-between p-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
              <ArrowLeft />
            </button>
            <h1 className="font-bold text-lg">{profile.nickname}</h1>
            <div className="w-10">
                {isMyProfile && (
                    <button onClick={() => router.push('/profile-edit')} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                        <MoreVertical />
                    </button>
                )}
            </div>
          </header>

          <main className="p-4">
            <section className="text-center">
                <div className="relative inline-block">
                    {profile.image_url ? (
                        <Image src={profile.image_url} alt={profile.nickname} width={80} height={80} className="rounded-full object-cover" />
                    ) : (
                        <DefaultAvatarIcon size={80} />
                    )}
                </div>
              <h2 className="text-xl font-bold mt-3">{profile.nickname}</h2>
              <p className="text-sm text-gray-400">@{profile.name}</p>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <span><span className="font-bold">{formatNumber(profile._count.following)}</span> フォロー中</span>
                <span><span className="font-bold">{formatNumber(profile._count.followers)}</span> フォロワー</span>
              </div>
              <p className="mt-4 text-base max-w-xl mx-auto">{profile.bio || "自己紹介がありません。"}</p>
              {isMyProfile && (
                <button onClick={() => router.push('/profile-edit')} className="mt-4 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                  プロフィール編集
                </button>
              )}
            </section>

            <section className="mt-8">
               <div className="flex justify-between items-end mb-4">
                 <h3 className="text-lg font-bold">{profile.characters.length}個のキャラクター | 会話量 {formatNumber(profile.totalMessageCount)}</h3>
                 <span className="text-sm text-gray-400">会話量順</span>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 {profile.characters.map(char => (
                   <Link href={`/characters/${char.id}`} key={char.id} className="block group">
                     <div className="bg-[#1C1C1E] rounded-lg overflow-hidden transition-transform group-hover:scale-105">
                       <div className="relative aspect-[3/4]">
                         <Image src={char.characterImages[0]?.imageUrl || 'https://placehold.co/300x400/1a1a1a/ffffff?text=?'} alt={char.name} fill className="object-cover" />
                       </div>
                       <div className="p-3">
                         <h4 className="font-semibold truncate text-white">{char.name}</h4>
                         <div className="flex justify-between text-xs text-gray-400 mt-1">
                           <div className="flex items-center gap-1"><Heart size={12}/> {char._count.favorites}</div>
                           <div className="flex items-center gap-1"><MessageSquare size={12}/> {char._count.chat}</div>
                         </div>
                       </div>
                     </div>
                   </Link>
                 ))}
               </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}