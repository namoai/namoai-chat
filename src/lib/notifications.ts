import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "FOLLOWER_CHARACTER" // フォロワーがキャラクターを作成
  | "LIKE" // いいね
  | "COMMENT" // コメント
  | "INQUIRY_RESPONSE" // お問い合わせ回答
  | "FOLLOW"; // フォロー

interface CreateNotificationParams {
  userId: number; // 通知を受け取るユーザー
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
  actorId?: number; // アクションを実行したユーザー
  characterId?: number;
  commentId?: number;
  reportId?: number;
}

/**
 * 通知を作成する
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    // 自分自身への通知は作成しない
    if (params.userId === params.actorId) {
      return null;
    }

    const notification = await prisma.notifications.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        link: params.link,
        actorId: params.actorId,
        characterId: params.characterId,
        commentId: params.commentId,
        reportId: params.reportId,
      },
    });

    return notification;
  } catch (error) {
    console.error("通知作成エラー:", error);
    return null;
  }
}

/**
 * フォロワーがキャラクターを作成したときの通知
 */
export async function notifyFollowersOnCharacterCreation(
  authorId: number,
  characterId: number,
  characterName: string
) {
  try {
    // キャラクター作成者の情報を取得
    const author = await prisma.users.findUnique({
      where: { id: authorId },
      select: { nickname: true },
    });

    const authorName = author?.nickname || "ユーザー";

    // このユーザーをフォローしている全てのユーザーを取得
    const followers = await prisma.follows.findMany({
      where: { followingId: authorId },
      select: { followerId: true },
    });

    // 各フォロワーに通知を作成
    const notifications = await Promise.all(
      followers.map((follower) =>
        createNotification({
          userId: follower.followerId,
          type: "FOLLOWER_CHARACTER",
          title: "新しいキャラクターが作成されました",
          content: `${authorName}さんが「${characterName}」を作成しました`,
          link: `/characters/${characterId}`,
          actorId: authorId,
          characterId: characterId,
        })
      )
    );

    return notifications.filter((n) => n !== null);
  } catch (error) {
    console.error("フォロワー通知エラー:", error);
    return [];
  }
}

/**
 * いいね（お気に入り）の通知
 */
export async function notifyOnFavorite(
  characterId: number,
  likedByUserId: number
) {
  try {
    // キャラクターの作成者を取得
    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      select: { name: true, author_id: true },
    });

    if (!character || !character.author_id) {
      return null;
    }

    // いいねしたユーザーの情報を取得
    const likedByUser = await prisma.users.findUnique({
      where: { id: likedByUserId },
      select: { nickname: true },
    });

    const actorName = likedByUser?.nickname || "ユーザー";

    return createNotification({
      userId: character.author_id,
      type: "LIKE",
      title: "キャラクターがお気に入りに追加されました",
      content: `${actorName}さんが「${character.name}」をお気に入りに追加しました`,
      link: `/characters/${characterId}`,
      actorId: likedByUserId,
      characterId: characterId,
    });
  } catch (error) {
    console.error("いいね通知エラー:", error);
    return null;
  }
}

/**
 * コメントの通知
 */
export async function notifyOnComment(
  characterId: number,
  commentId: number,
  commentedByUserId: number
) {
  try {
    // キャラクターの作成者を取得
    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      select: { name: true, author_id: true },
    });

    if (!character || !character.author_id) {
      return null;
    }

    // コメントしたユーザーの情報を取得
    const commentedByUser = await prisma.users.findUnique({
      where: { id: commentedByUserId },
      select: { nickname: true },
    });

    const actorName = commentedByUser?.nickname || "ユーザー";

    return createNotification({
      userId: character.author_id,
      type: "COMMENT",
      title: "新しいコメントが投稿されました",
      content: `${actorName}さんが「${character.name}」にコメントしました`,
      link: `/characters/${characterId}#comment-${commentId}`,
      actorId: commentedByUserId,
      characterId: characterId,
      commentId: commentId,
    });
  } catch (error) {
    console.error("コメント通知エラー:", error);
    return null;
  }
}

/**
 * お問い合わせ回答の通知
 */
export async function notifyOnInquiryResponse(
  reportId: number,
  reporterUserId: number
) {
  try {
    return createNotification({
      userId: reporterUserId,
      type: "INQUIRY_RESPONSE",
      title: "お問い合わせに回答がありました",
      content: "管理者からお問い合わせへの回答がありました",
      link: `/MyPage?tab=inquiries&reportId=${reportId}`,
      reportId: reportId,
    });
  } catch (error) {
    console.error("お問い合わせ回答通知エラー:", error);
    return null;
  }
}

/**
 * フォローの通知
 */
export async function notifyOnFollow(
  followedUserId: number,
  followerUserId: number
) {
  try {
    // フォローしたユーザーの情報を取得
    const followerUser = await prisma.users.findUnique({
      where: { id: followerUserId },
      select: { nickname: true },
    });

    const actorName = followerUser?.nickname || "ユーザー";

    return createNotification({
      userId: followedUserId,
      type: "FOLLOW",
      title: "新しいフォロワー",
      content: `${actorName}さんがあなたをフォローしました`,
      link: `/profile/${followerUserId}`,
      actorId: followerUserId,
    });
  } catch (error) {
    console.error("フォロー通知エラー:", error);
    return null;
  }
}

