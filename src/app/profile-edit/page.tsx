"use client";

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { ArrowLeft, Camera, User } from 'lucide-react';

// 汎用モーダルコンポーネント
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
};

const CustomModal = ({ isOpen, onClose, title, message }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        <p className="text-sm text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end">
          <button onClick={onClose} className="bg-pink-600 hover:bg-pink-700 py-2 px-4 rounded-lg">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// デフォルトアバター
const DefaultAvatarIcon = ({ size = 96 }: { size?: number }) => (
  <div
    className="rounded-full bg-gray-700 flex items-center justify-center"
    style={{ width: size, height: size }}
  >
    <User size={size * 0.6} className="text-gray-400" />
  </div>
);

export default function ProfileEditPage() {
  const router = useRouter();
  const { data: session, update } = useSession();

  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, title: '', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/users/profile');
        if (!response.ok) throw new Error('プロファイル読み込み失敗');
        const data = await response.json();
        setNickname(data.nickname || '');
        setBio(data.bio || '');
        setImagePreview(data.image_url || null);
      } catch (error) {
        console.error(error);
        setModalState({ isOpen: true, title: 'エラー', message: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);
  
  const closeModal = () => setModalState({ isOpen: false, title: '', message: '' });

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('nickname', nickname);
    formData.append('bio', bio);
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'プロファイル更新失敗');
      }
      
      const updatedProfile = await response.json();

      await update({
        name: updatedProfile.nickname,
        image: updatedProfile.image_url,
      });
      
      setModalState({ 
          isOpen: true, 
          title: '成功', 
          message: 'プロフィールを更新しました！',
      });
      
      // モーダルが閉じた後にページ遷移
      setTimeout(() => {
        router.push(`/profile/${session?.user?.id}`);
      }, 1500);

    } catch (error) {
      console.error(error);
      setModalState({ isOpen: true, title: 'エラー', message: (error as Error).message });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">ローディング中...</div>;
  }

  return (
    <>
      <CustomModal {...modalState} onClose={closeModal} />
      <div className="bg-black min-h-screen text-white">
        <div className="mx-auto max-w-2xl">
          <header className="flex items-center justify-between p-4 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer"><ArrowLeft /></button>
            <h1 className="font-bold text-lg">プロフィール編集</h1>
            <div className="w-10 h-10"></div>
          </header>

          <form onSubmit={handleSubmit} className="p-4 space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-2">
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Profile Preview"
                    width={96}
                    height={96}
                    className="rounded-full object-cover w-24 h-24"
                  />
                ) : (
                  <DefaultAvatarIcon size={96} />
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-gray-700 p-2 rounded-full hover:bg-gray-600 transition-colors cursor-pointer"
                >
                  <Camera size={16} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-400 mb-1">ニックネーム</label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-gray-800 border-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-400 mb-1">自己紹介</label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full bg-gray-800 border-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 disabled:bg-pink-800 transition-colors cursor-pointer"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
