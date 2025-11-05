// src/types/chat.ts

// ===============================
//  共通型定義（UI 層向け）
// ===============================

export type Role = 'user' | 'model';

export interface CharacterImageInfo {
  // 画像URL
  imageUrl: string;
  // 優先マッチ用キーワード（ユーザー入力に含まれれば優先表示）
  keyword?: string | null;
}

export interface CharacterInfo {
  id: number;
  name?: string;
  // 初回状況説明
  firstSituation?: string;
  // 初回メッセージ
  firstMessage?: string;
  // 画像リスト（先頭はアイコン相当、それ以降は本文内 {img:n} で参照）
  characterImages: CharacterImageInfo[];
}

export interface DbMessage {
  id: number;
  role: Role;
  content: string;
  createdAt: string;     // ISO
  version: number;
  isActive: boolean;
  turnId: number;        // 「ユーザー→モデル」対応のためのターンID
}

export interface Message extends DbMessage {
  // UI 用に付y与する表示時刻
  timestamp: string;
  // ▼ 思考ストリーム（クライアントのみ保持）
  thinkingText?: string;
  // ▼▼▼【修正】AIの応答を待つ間の仮メッセージかどうかを判定するフラグを追加 ▼▼▼
  isProvisional?: boolean;
  // ▼▼▼【効率的な画像出力】キーワードマッチで表示する画像URLリスト ▼▼▼
  imageUrls?: string[];
}

export interface Turn {
  turnId: number;
  userMessage: Message;
  modelMessages: Message[];
  activeModelIndex: number;
}

export interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  isAlert?: boolean;
  onConfirm?: () => void;
  // ▼▼▼【修正】onCancelを追加（ConfirmationModal.tsxで参照されているため）▼▼▼
  onCancel?: () => void;
}

/**
 * AIによる応答生成に関する設定の型定義。
 */
export type GenerationSettings = {
  model: string;
  responseBoostMultiplier: number;
};

/**
 * チャットルームの表示スタイルに関する設定の型定義。
 */
export type ChatStyleSettings = {
  fontSize: number; // フォントサイズ (px)
  userBubbleColor: string; // ユーザーのチャットバブルの色 (Hex)
  userBubbleTextColor: string; // ユーザーのチャットバブルの文字色 (Hex)
};

