"use client";

import { Suspense } from 'react'; // Suspense를 import합니다.
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FcGoogle } from "react-icons/fc";
import { Mail, Lock } from "lucide-react";
import { signIn } from "next-auth/react";

// useSearchParams를 사용하는 로직을 별도의 컴포넌트로 분리합니다.
function LoginComponent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      switch (error) {
        case "CredentialsSignin":
          alert("メールアドレスまたはパスワードが正しくありません。");
          break;
        default:
          alert("ログインに失敗しました。後でもう一度お試しください。");
          break;
      }
      // 에러 메시지를 표시한 후 URL에서 에러 쿼리를 제거하여 새로고침 시 다시 표시되지 않도록 합니다.
      router.replace('/login', { scroll: false });
    }
  }, [searchParams, router]);

  const handleLogin = async () => {
    await signIn("credentials", {
      redirect: true,
      callbackUrl: "/MyPage",
      email,
      password,
    });
  };

  return (
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

        <p className="text-center text-sm mt-4">
          <span
            className="text-pink-400 cursor-pointer hover:underline"
            onClick={() => router.push("/register")}
          >
            アカウントがない方
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">ログイン/会員登録</h1>
      <Suspense fallback={<div className="text-white">読み込み中...</div>}>
        <LoginComponent />
      </Suspense>
    </div>
  );
}
