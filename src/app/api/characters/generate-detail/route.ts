export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from 'next/server';
import { VertexAI, HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// VertexAIクライアントの初期化（遅延初期化）
function getVertexAI(): VertexAI {
  if (!process.env.GOOGLE_PROJECT_ID) {
    throw new Error('GOOGLE_PROJECT_ID is not set');
  }
  return new VertexAI({
    project: process.env.GOOGLE_PROJECT_ID,
    location: "asia-northeast1",
  });
}

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const { name, description } = await request.json();

    if (!name && !description) {
      return NextResponse.json(
        { success: false, error: '名前または作品紹介が必要です' },
        { status: 400 }
      );
    }

    const vertex_ai = getVertexAI();
    const model = vertex_ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
    });

    const prompt = `あなたはキャラクターチャット用の詳細設定作成アシスタントです。
以下のキャラクター情報を基に、詳細なキャラクター設定を日本語で作成してください。

キャラクター名: ${name || '未設定'}
作品紹介: ${description || '未設定'}

以下の形式で、キャラクターの詳細設定を作成してください。すべて日本語で記述してください。

### 基本情報

- 名前: {キャラクター名}
- 説明: {キャラクターの簡潔な説明、性格や特徴を要約}
- 年齢/性別: {年齢や性別の情報}
- 国籍/民族: {該当する場合}
- 外見: 
    - {詳細な外見の説明、身長、体型、髪の色、目の色、特徴的な部分など}
    - {服装やスタイルの説明}
- 背景ストーリー: 
    - {キャラクターの過去や生い立ち}
    - {重要な出来事や経験}
    - {現在の状況や目標}
- 職業: {職業や役割}
- 居住地: {住んでいる場所や環境}

### 核心的なアイデンティティ

- 性格キーワード: {性格を表すキーワードを3-5個}
- 信念・価値観: 
    - {キャラクターの信念や価値観}
    - {行動原理}
- 世界観: 
    - {キャラクターが持つ世界観や見方}
    - {人間や社会に対する考え}
- 目標・動機: 
    - 短期: {短期的な目標}
    - 長期: {長期的な目標}
    - 動機: {行動の動機}
- 核心的な葛藤: 
    - 外的葛藤: {外部との対立や問題}
    - 内的葛藤: {内面的な悩みや矛盾}
- 不安: {キャラクターが抱える不安や恐れ}

### 行動パターン

- 意思決定: {どのように意思決定をするか}
- 社会的相互作用
    - 一般的なコミュニケーションスタイル: {話し方や態度}
    - 親密な関係: {親しい人との接し方}
    - 葛藤解決: {問題解決の方法}
- 感情反応
    - 感情管理: {感情のコントロール方法}
    - ストレス反応: {ストレス時の行動}
- 習慣的行動
    - ルーティン: {日常的な習慣}
    - 癖: {特徴的な癖や行動}
    - 問題解決: {問題への対処方法}

### 興味・好み

- 趣味: {趣味や興味のあること}
- 好きなもの: 
    - 味: {好きな食べ物や飲み物}
    - 環境: {好きな場所や雰囲気}
    - 人物タイプ: {好む人物のタイプ}
- 嫌いなもの: 
    - 味: {嫌いな食べ物}
    - 環境: {嫌いな場所}
    - 人物タイプ: {嫌う人物のタイプ}

### 技術・所持品

- 技術・専門性: {得意なことや能力}
- 弱点: {弱点や苦手なこと}
- 所持品・所有物: {重要なアイテムや所有物}

上記の形式に従って、提供された情報を基に詳細なキャラクター設定を作成してください。
キャラクターが一貫性を持ち、チャットで自然に会話できるような詳細な設定にしてください。
すべて日本語で記述し、{{char}}と{{user}}のプレースホルダーは使用しないでください。`;

    const result = await model.generateContent(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return NextResponse.json(
        { success: false, error: '詳細設定生成に失敗しました。応答が空でした。' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      detailSetting: text.trim(),
    });
  } catch (error) {
    console.error('詳細設定生成エラー:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 }
    );
  }
}

