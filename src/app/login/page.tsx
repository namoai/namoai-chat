"use client";

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link'; // Linkコンポーネントをインポート
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        <h2 className="text-xl font-bold mb-4">{modalState.title}</h2>
        <p className="text-gray-300 mb-6">{modalState.message}</p>
        <div className="flex justify-end gap-4">
          <button 
            onClick={handleConfirm} 
            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg transition-colors"
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
        // 認証失敗の場合
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
        // 認証成功の場合、マイページへリダイレクト
        router.push("/MyPage");
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
      <Card className="w-full max-w-md bg-[#1a1a1a]">
        <CardContent className="p-6 space-y-4">
          <p className="text-sm">
            サービスを利用するためにはログインが必要です。
          </p>

          <Button
            className="w-full flex items-center justify-start gap-2 cursor-pointer bg-white text-black hover:bg-pink-600 hover:text-white transition-colors"
            onClick={() => signIn("google", { callbackUrl: "/MyPage" })}
          >
            <FcGoogle size={20} /> Googleアカウントで始まる。
          </Button>

          <div className="border-t border-gray-700 my-4"></div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-white" />
              <Input
                type="email"
                placeholder="メール"
                className="bg-[#333] text-white placeholder-gray-400 border border-gray-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <div className="flex items-center gap-2">
              <Lock size={16} className="text-white" />
              <Input
                type="password"
                placeholder="パスワード"
                className="bg-[#333] text-white placeholder-gray-400 border border-gray-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <div className="text-right text-sm text-pink-400 cursor-pointer hover:underline">
              パスワード再設定
            </div>

            <Button
              className="w-full bg-pink-500 hover:bg-pink-600 cursor-pointer"
              onClick={handleLogin}
            >
              ログイン
            </Button>
          </div>

          {/* ▼▼▼【修正点】onClickを持つspanをLinkコンポーネントに変更 ▼▼▼ */}
          <p className="text-center text-sm mt-4">
            <Link href="/register" className="text-pink-400 cursor-pointer hover:underline">
              アカウントがない方
            </Link>
          </p>
          {/* ▲▲▲【修正完了】▲▲▲ */}
        </CardContent>
      </Card>
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-8">
      <header className="w-full max-w-md flex items-center justify-between mb-6">
        <button 
          onClick={() => router.back()} 
          className="p-2 rounded-full hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-semibold absolute left-1/2 -translate-x-1/2">ログイン/会員登録</h1>
        <div className="w-10 h-10"></div>
      </header>
      
      <Suspense fallback={<div className="text-white">読み込み中...</div>}>
        <LoginComponent />
      </Suspense>
    </div>
  );
}
