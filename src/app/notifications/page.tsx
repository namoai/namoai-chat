"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bell, Check, Trash2, Filter, ArrowLeft, HelpCircle } from "lucide-react";
import HelpModal from "@/components/HelpModal";
import { fetchWithCsrf } from "@/lib/csrf-client";

type Notification = {
  id: number;
  type: string;
  title: string;
  content: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: number;
    nickname: string;
    image_url: string | null;
  } | null;
};

const typeLabels: Record<string, { label: string; color: string; icon: string }> = {
  FOLLOWER_CHARACTER: { label: "新キャラクター", color: "bg-blue-500", icon: "🎭" },
  LIKE: { label: "いいね", color: "bg-pink-500", icon: "❤️" },
  COMMENT: { label: "コメント", color: "bg-purple-500", icon: "💬" },
  INQUIRY_RESPONSE: { label: "お問い合わせ", color: "bg-green-500", icon: "📧" },
  FOLLOW: { label: "フォロー", color: "bg-yellow-500", icon: "👥" },
};

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const fetchNotifications = useCallback(async (isInitialLoad = false) => {
    try {
      // ★ 初回ロードのみローディング表示（自動更新時は表示しない）
      if (isInitialLoad) {
        setLoading(true);
      }
      const url =
        filter === "unread"
          ? "/api/notifications?isRead=false"
          : "/api/notifications";
      const res = await fetch(url);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      console.log(`[Notifications] Updated: ${data.unreadCount || 0} unread`);
    } catch (error) {
      console.error("通知取得エラー:", error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }, [filter]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      // ★ 初回は isInitialLoad = true
      fetchNotifications(true);
      
      // ★ 5秒ごとに自動更新（リアルタイム通知）- isInitialLoad = false
      const interval = setInterval(() => fetchNotifications(false), 5000);

      // ページがアクティブになったときに即座に更新
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          fetchNotifications(false);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [status, filter, router, fetchNotifications]);

  const markAsRead = async (notificationIds: number[]) => {
    try {
      await fetchWithCsrf("/api/notifications/read", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });
      fetchNotifications();
    } catch (error) {
      console.error("既読処理エラー:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetchWithCsrf("/api/notifications/read", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllAsRead: true }),
      });
      fetchNotifications();
    } catch (error) {
      console.error("全既読処理エラー:", error);
    }
  };

  const deleteNotification = async (notificationIds: number[]) => {
    try {
      await fetch("/api/notifications/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });
      fetchNotifications();
    } catch (error) {
      console.error("通知削除エラー:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead([notification.id]);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return date.toLocaleDateString("ja-JP");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  const helpContent = (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-pink-400 mb-3">通知について</h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          このページでは、あなたに関する様々な通知を確認できます。
          通知をクリックすると、関連するページに移動できます。
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-pink-400 mb-3">通知の種類</h3>
        <div className="space-y-3">
          <div className="bg-black/30 border border-gray-800/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎭</span>
              <span className="text-xs px-2 py-1 rounded bg-blue-500 text-white font-medium">新キャラクター</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              フォローしている制作者が新しいキャラクターを作成したときに通知されます。
            </p>
          </div>

          <div className="bg-black/30 border border-gray-800/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">❤️</span>
              <span className="text-xs px-2 py-1 rounded bg-pink-500 text-white font-medium">いいね</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              あなたが作成したキャラクターがお気に入りに追加されたときに通知されます。
            </p>
          </div>

          <div className="bg-black/30 border border-gray-800/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💬</span>
              <span className="text-xs px-2 py-1 rounded bg-purple-500 text-white font-medium">コメント</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              あなたが作成したキャラクターにコメントが投稿されたときに通知されます。
            </p>
          </div>

          <div className="bg-black/30 border border-gray-800/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">👥</span>
              <span className="text-xs px-2 py-1 rounded bg-yellow-500 text-white font-medium">フォロー</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              誰かがあなたをフォローしたときに通知されます。
            </p>
          </div>

          <div className="bg-black/30 border border-gray-800/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📧</span>
              <span className="text-xs px-2 py-1 rounded bg-green-500 text-white font-medium">お問い合わせ</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              お問い合わせへの回答があったときに通知されます。
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-pink-400 mb-3">機能</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-0.5">•</span>
            <span><strong>全て既読にする</strong>: すべての通知を一度に既読にします</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-0.5">•</span>
            <span><strong>フィルター</strong>: 「全て」または「未読」のみを表示できます</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-0.5">•</span>
            <span><strong>通知をクリック</strong>: 通知をクリックすると関連ページに移動し、自動で既読になります</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-0.5">•</span>
            <span><strong>削除</strong>: 不要な通知は削除できます</span>
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="通知について"
        content={helpContent}
      />
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all -ml-2"
              >
                <ArrowLeft size={24} />
              </button>
              <Bell className="text-pink-400" size={28} />
              <h1 className="text-2xl font-bold">通知</h1>
              <button
                onClick={() => setIsHelpOpen(true)}
                className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
              >
                <HelpCircle size={20} />
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/50 text-sm font-semibold"
              >
                <Check size={16} />
                全て既読にする
              </button>
            )}
          </div>

          {/* フィルター */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                filter === "all"
                  ? "bg-pink-500/20 text-pink-400"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              <Filter size={16} />
              全て
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                filter === "unread"
                  ? "bg-pink-500/20 text-pink-400"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              <Bell size={16} />
              未読 {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>
        </div>
      </div>

      {/* 通知リスト */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="mx-auto mb-4 text-gray-600" size={64} />
            <p className="text-gray-400 text-lg">
              {filter === "unread" ? "未読の通知はありません" : "通知はありません"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const typeInfo = typeLabels[notification.type] || {
                label: "通知",
                color: "bg-gray-500",
                icon: "📢",
              };

              return (
                <div
                  key={notification.id}
                  className={`relative group rounded-lg border transition-all cursor-pointer ${
                    notification.isRead
                      ? "bg-gray-900/50 border-gray-800 hover:bg-gray-900"
                      : "bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-500/30 hover:border-pink-500/50"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* 未読インジケーター */}
                  {!notification.isRead && (
                    <div className="absolute top-4 left-4 w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
                  )}

                  <div className="p-4 pl-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* タイプバッジ */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{typeInfo.icon}</span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${typeInfo.color} text-white font-medium`}
                          >
                            {typeInfo.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(notification.createdAt)}
                          </span>
                        </div>

                        {/* タイトル */}
                        <h3 className="font-semibold mb-1 text-white">
                          {notification.title}
                        </h3>

                        {/* 内容 */}
                        <p className="text-sm text-gray-400">
                          {notification.content}
                        </p>

                        {/* アクター情報 */}
                        {notification.actor && (
                          <div className="flex items-center gap-2 mt-2">
                            {notification.actor.image_url ? (
                              <Image
                                src={notification.actor.image_url}
                                alt={notification.actor.nickname}
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                                👤
                              </div>
                            )}
                            <span className="text-xs text-gray-500">
                              {notification.actor.nickname}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* アクションボタン */}
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead([notification.id]);
                            }}
                            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                            title="既読にする"
                          >
                            <Check size={16} className="text-green-400" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification([notification.id]);
                          }}
                          className="p-2 bg-gray-800 hover:bg-red-900/50 rounded-lg transition-colors"
                          title="削除"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

