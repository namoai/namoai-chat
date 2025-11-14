"use client";

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link'; // Linkコンポーネントをインポート
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { signIn } from "next-auth/react";

// ▼▼▼【新規追加】汎用モーダルコンポーネント ▼▼▼
type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
  isAlert?: boolean;
};

const ConfirmationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
  if (!modalState.isOpen) return null;

  const handleConfirm = () => {
    modalState.onConfirm?.();
    setModalState({ ...modalState, isOpen: false });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
        <h2 className="text-xl font-bold mb-4 text-white">{modalState.title}</h2>
        <p className="text-gray-200 mb-6">{modalState.message}</p>
        <div className="flex justify-end gap-4">
          <button 
            onClick={handleConfirm} 
            className="px-4 py-2 bg-pink-600 text-white hover:bg-pink-500 rounded-lg transition-colors"
          >
            {modalState.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
// ▲▲▲【追加完了】▲▲▲

function LoginComponent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' }); // モーダル用のstateを追加
  const router = useRouter();
  const searchParams = useSearchParams();

  // URLパラメータのエラーを監視してモーダル表示
  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      let errorMessage = "ログインに失敗しました。後でもう一度お試しください。";
      
      // エラーの種類に応じてメッセージを変更
      if (error === "CredentialsSignin") {
        errorMessage = "メールアドレスまたはパスワードが正しくありません。入力内容をご確認ください。";
      } else if (error === "OAuthAccountNotLinked") {
        errorMessage = "このメールアドレスは別のログイン方法で登録されています。";
      } else if (error === "OAuthCallback") {
        errorMessage = "外部サービスとの連携でエラーが発生しました。";
      } else if (error === "SessionRequired") {
        errorMessage = "セッションが無効です。再度ログインしてください。";
      }
      
      setModalState({
        isOpen: true,
        title: "ログインエラー",
        message: errorMessage,
        isAlert: true,
        confirmText: "OK",
        onConfirm: () => {
          // URLからエラーパラメータを削除
          router.replace('/login', { scroll: false });
        }
      });
    }
  }, [searchParams, router]);

  const handleLogin = async () => {
    // 入力値の検証
    if (!email || !password) {
      setModalState({
        isOpen: true,
        title: "入力エラー",
        message: "メールアドレスとパスワードを入力してください。",
        isAlert: true,
        confirmText: "OK",
        onConfirm: () => {
          setModalState({ ...modalState, isOpen: false });
        }
      });
      return;
    }

    try {
      // ログイン処理を実行
      const result = await signIn("credentials", {
        redirect: false, // 手動でリダイレクトを制御
        email,
        password,
      });

      if (result?.error) {
        // ▼▼▼【新機能】停止エラーの処理 ▼▼▼
        if (result.error.startsWith('SUSPENDED:')) {
          const parts = result.error.split(':');
          const reason = parts[1] || '不明な理由';
          const until = parts[2] ? new Date(parts[2]).toLocaleString('ja-JP') : '不明';
          
          setModalState({
            isOpen: true,
            title: "アカウント停止中",
            message: `あなたのアカウントは停止されています。\n\n停止理由: ${reason}\n停止期限: ${until}\n\nサポートにお問い合わせください。`,
            isAlert: true,
            confirmText: "OK",
            onConfirm: () => {
              setModalState({ ...modalState, isOpen: false });
            }
          });
          return;
        }
        // ▲▲▲ 停止エラー処理完了 ▲▲▲
        
        // 通常の認証失敗の場合
        setModalState({
          isOpen: true,
          title: "ログイン失敗",
          message: "メールアドレスまたはパスワードが正しくありません。\n登録されていない場合は、新規会員登録をお願いします。",
          isAlert: true,
          confirmText: "OK",
          onConfirm: () => {
            setModalState({ ...modalState, isOpen: false });
          }
        });
      } else if (result?.ok) {
        // 認証成功の場合、マイページへリダイレクト（replaceで履歴を残さない）
        router.replace("/MyPage");
      }
    } catch (error) {
      console.error('ログインエラー:', error);
      setModalState({
        isOpen: true,
        title: "エラー",
        message: "ログイン処理中にエラーが発生しました。しばらくしてから再度お試しください。",
        isAlert: true,
        confirmText: "OK",
        onConfirm: () => {
          setModalState({ ...modalState, isOpen: false });
        }
      });
    }
  };

  return (
    <>
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />
      <div className="w-full max-w-md bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 p-6 md:p-8 space-y-6">
        <p className="text-gray-300 text-center">
          サービスを利用するためにはログインが必要です。
        </p>

        <Button
          className="w-full flex items-center justify-center gap-3 bg-white text-black hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-200 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl cursor-pointer"
          onClick={() => signIn("google", { callbackUrl: "/MyPage" })}
        >
          <FcGoogle size={24} /> Googleアカウントで始まる
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700/50"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-900/50 text-gray-400">または</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Mail size={16} />
              メールアドレス
            </label>
            <Input
              type="email"
              placeholder="メールアドレスを入力"
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Lock size={16} />
              パスワード
            </label>
            <Input
              type="password"
              placeholder="パスワードを入力"
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div className="text-right">
            <button className="text-sm text-pink-400 hover:text-pink-300 transition-colors">
              パスワード再設定
            </button>
          </div>

          <Button
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-pink-500/30"
            onClick={handleLogin}
          >
            ログイン
          </Button>
        </div>

        <p className="text-center text-sm mt-6">
          <Link href="/register" className="text-pink-400 hover:text-pink-300 transition-colors underline">
            アカウントがない方
          </Link>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 py-8 min-h-screen">
        <header className="w-full max-w-md flex items-center justify-between mb-8">
          <button 
            onClick={() => router.back()} 
            className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent absolute left-1/2 -translate-x-1/2">
            ログイン/会員登録
          </h1>
          <div className="w-10 h-10"></div>
        </header>
        
        <Suspense fallback={
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
            <p className="text-gray-400">読み込み中...</p>
          </div>
        }>
          <LoginComponent />
        </Suspense>
      </div>
    </div>
  );
}
