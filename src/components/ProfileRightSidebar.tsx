"use client";

interface ProfileRightSidebarProps {
  bio: string | null;
  createdAt?: string;
  totalMessageCount?: number;
  followers?: number;
  following?: number;
  characterCount?: number;
}

export default function ProfileRightSidebar({
  bio,
  createdAt,
  totalMessageCount,
  followers,
  following,
  characterCount,
}: ProfileRightSidebarProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "不明";
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  return (
    <aside className="w-80 flex-shrink-0 bg-black/80 backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto">
      <div className="mb-6">
        <h3 className="font-semibold mb-4 text-gray-300">ユーザー情報</h3>
        {bio && (
          <div className="bg-white/5 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-300 leading-relaxed">{bio}</p>
          </div>
        )}
        <div className="space-y-3">
          {createdAt && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-sm text-gray-400">登録日</span>
              <span className="text-sm text-white font-semibold">
                {formatDate(createdAt)}
              </span>
            </div>
          )}
          {totalMessageCount !== undefined && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-sm text-gray-400">総チャット数</span>
              <span className="text-sm text-white font-semibold">
                {totalMessageCount.toLocaleString()}
              </span>
            </div>
          )}
          {followers !== undefined && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-sm text-gray-400">フォロワー</span>
              <span className="text-sm text-white font-semibold">
                {formatNumber(followers)}
              </span>
            </div>
          )}
          {following !== undefined && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-sm text-gray-400">フォロー中</span>
              <span className="text-sm text-white font-semibold">
                {formatNumber(following)}
              </span>
            </div>
          )}
          {characterCount !== undefined && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <span className="text-sm text-gray-400">作成キャラ</span>
              <span className="text-sm text-white font-semibold">
                {formatNumber(characterCount)}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

