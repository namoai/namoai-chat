// src/types/chat.ts

/**
 * キャラクターの画像情報
 */
export type CharacterImageInfo = {
  imageUrl: string;
  keyword?: string | null;
};

/**
 * キャラクターの基本情報
 */
export type CharacterInfo = {
  name: string;
  firstSituation: string | null;
  firstMessage: string | null;
  characterImages: CharacterImageInfo[];
};

/**
 * データベースから取得するメッセージの型
 */
export type DbMessage = {
  id: number;
  role: "user" | "model";
  content: string;
  createdAt: string;
  turnId: number | null;
  version: number;
  isActive: boolean;
};

/**
 * 画面表示用のメッセージの型
 */
export type Message = DbMessage & { timestamp: string };

/**
 * ユーザーとAIの対話の1単位「ターン」
 */
export type Turn = {
  turnId: number;
  userMessage: Message;
  modelMessages: Message[];
  activeModelIndex: number;
};

/**
 * モーダルダイアログの状態
 */
export type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  isAlert?: boolean;
};
