"use client";

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { ArrowLeft, Camera, User } from 'lucide-react'; // User アイコンをインポート

// MyPageで使われているDefaultAvatarIconコンポーネントをここでも定義
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
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
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

      if (!response.ok) throw new Error('プロファイル更新失敗');
      
      const updatedProfile = await response.json();

      await update({
        name: updatedProfile.nickname,
        image: updatedProfile.image_url,
      });

      alert('プロフィールを更新しました！');
      router.push(`/profile/${session?.user?.id}`);
    } catch (error) {
      console.error(error);
      alert('プロファイルの更新に失敗しました。');
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">ローディング中...</div>;
  }

  return (
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
              {/* ▼▼▼ 変更点: MyPageと同様のロジックで基本画像を表示 ▼▼▼ */}
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
            className="w-full bg-pink-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-700 transition-colors cursor-pointer"
          >
            保存
          </button>
        </form>
      </div>
    </div>
  );
}
