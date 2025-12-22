"use client";

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link'; // Linkコンポーネントをインポート
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { Mail, Lock, ArrowLeft, Info, Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";

// ▼▼▼【新規追加】汎用モーダルコンポーネント ▼▼▼
type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
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
        <p className="text-gray-200 mb-6 whitespace-pre-line">{modalState.message}</p>
        <div className="flex justify-end gap-4">
          {!modalState.isAlert && modalState.onCancel && (
            <button 
              onClick={() => {
                modalState.onCancel?.();
                setModalState({ ...modalState, isOpen: false });
              }}
              className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg transition-colors"
            >
              {modalState.cancelText || 'キャンセル'}
            </button>
          )}
          <button 
            onClick={handleConfirm} 
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-lg transition-colors"
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
  const [showPassword, setShowPassword] = useState(false); // パスワード表示/非表示
  const [rememberMe, setRememberMe] = useState(false); // ログイン状態保持チェックボックス
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' }); // モーダル用のstateを追加
  const [show2FAInput, setShow2FAInput] = useState(false); // 2FAコード入力画面表示有無
  const [twoFactorCode, setTwoFactorCode] = useState(""); // 2FAコード
  const [sending2FACode, setSending2FACode] = useState(false); // 2FAコード送信中
  const [verifying2FACode, setVerifying2FACode] = useState(false); // 2FAコード検証中
  const router = useRouter();
  const searchParams = useSearchParams();

  // URLパラメータのエラーとタイムアウトを監視してモーダル表示
  useEffect(() => {
    const error = searchParams.get("error");
    const timeout = searchParams.get("timeout");
    const verified = searchParams.get("verified");
    
    // メール認証完了の処理
    if (verified === "true") {
      setModalState({
        isOpen: true,
        title: "メール認証完了",
        message: "メールアドレスの認証が完了しました。\nログインしてサービスをご利用ください。",
        isAlert: true,
        confirmText: "OK",
        onConfirm: () => {
          // URLからverifiedパラメータを削除
          router.replace('/login', { scroll: false });
        }
      });
      return;
    }
    
    // セッションタイムアウトの処理
    if (timeout === "true") {
      setModalState({
        isOpen: true,
        title: "セッションタイムアウト",
        message: "30分間の非活動によりセッションがタイムアウトしました。\nセキュリティのため、再度ログインしてください。",
        isAlert: true,
        confirmText: "OK",
        onConfirm: () => {
          // URLからタイムアウトパラメータを削除
          router.replace('/login', { scroll: false });
        }
      });
      return;
    }
    
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

  // 2FAコード送信
  const handleSend2FACode = async (userEmail: string) => {
    setSending2FACode(true);
    try {
      const response = await fetch('/api/auth/2fa/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await response.json();
      if (!response.ok) {
        setModalState({
          isOpen: true,
          title: 'エラー',
          message: data.error || '認証コードの送信に失敗しました。',
          isAlert: true,
          confirmText: 'OK',
          onConfirm: () => {
            setModalState({ ...modalState, isOpen: false });
            setShow2FAInput(false);
          },
        });
        return;
      }

      setModalState({
        isOpen: true,
        title: '認証コードを送信しました',
        message: 'メールアドレスに認証コードを送信しました。\nコードを入力してください。',
        isAlert: true,
        confirmText: 'OK',
        onConfirm: () => {
          setModalState({ ...modalState, isOpen: false });
        },
      });
    } catch (error) {
      console.error('2FA code send error:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '認証コードの送信に失敗しました。',
        isAlert: true,
        confirmText: 'OK',
        onConfirm: () => {
          setModalState({ ...modalState, isOpen: false });
          setShow2FAInput(false);
        },
      });
    } finally {
      setSending2FACode(false);
    }
  };

  // 2FAコード検証後ログイン完了
  const handleVerify2FACode = async () => {
    if (!twoFactorCode || !/^\d{6}$/.test(twoFactorCode)) {
      setModalState({
        isOpen: true,
        title: '入力エラー',
        message: '6桁の認証コードを入力してください。',
        isAlert: true,
        confirmText: 'OK',
        onConfirm: () => {
          setModalState({ ...modalState, isOpen: false });
        },
      });
      return;
    }

    setVerifying2FACode(true);
    try {
      // 2FAコード検証
      const verifyResponse = await fetch('/api/auth/2fa/email/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: twoFactorCode }),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) {
        setModalState({
          isOpen: true,
          title: '認証エラー',
          message: verifyData.error || '認証コードが正しくありません。',
          isAlert: true,
          confirmText: 'OK',
          onConfirm: () => {
            setModalState({ ...modalState, isOpen: false });
          },
        });
        return;
      }

      // 2FA検証成功 - skip2FAフラグを使用して再度ログイン試行
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        skip2FA: true, // 2FA検証完了フラグ
        callbackUrl: "/MyPage",
      });

      if (result?.error) {
        setModalState({
          isOpen: true,
          title: 'ログインエラー',
          message: result.error === 'CredentialsSignin' ? 'メールアドレスまたはパスワードが正しくありません。' : result.error,
          isAlert: true,
          confirmText: 'OK',
          onConfirm: () => {
            setModalState({ ...modalState, isOpen: false });
            setShow2FAInput(false);
            setTwoFactorCode('');
          },
        });
        return;
      }

      // ログイン成功
      if (result?.ok) {
        // ログイン状態保持の設定をlocalStorageに保存
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberMe');
        }
        router.replace("/MyPage");
      }
    } catch (error) {
      console.error('2FA verify error:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '認証コードの検証に失敗しました。',
        isAlert: true,
        confirmText: 'OK',
        onConfirm: () => {
          setModalState({ ...modalState, isOpen: false });
        },
      });
    } finally {
      setVerifying2FACode(false);
    }
  };

  const handleLogin = async () => {
    // 2FA入力画面が表示されている場合はコード検証として処理
    if (show2FAInput) {
      await handleVerify2FACode();
      return;
    }

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
        callbackUrl: "/MyPage",
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

        // ▼▼▼【新機能】アカウントロックエラーの処理 ▼▼▼
        if (result.error.startsWith('LOCKED:')) {
          const message = result.error.replace('LOCKED:', '');
          setModalState({
            isOpen: true,
            title: "アカウントがロックされました",
            message: `${message}\n\nセキュリティのため、ログインに複数回失敗した場合、一時的にアカウントがロックされます。`,
            isAlert: true,
            confirmText: "OK",
            onConfirm: () => {
              setModalState({ ...modalState, isOpen: false });
            }
          });
          return;
        }
        // ▲▲▲ ロックエラー処理完了 ▲▲▲

        // ▼▼▼【2FA】メールベース2FA必要処理 ▼▼▼
        if (result.error.startsWith('2FA_REQUIRED:')) {
          const userEmail = result.error.replace('2FA_REQUIRED:', '');
          // 2FAコード入力画面表示
          setShow2FAInput(true);
          // 2FAコード送信
          handleSend2FACode(userEmail);
          return;
        }
        // ▲▲▲ 2FA処理完了 ▲▲▲

        // ▼▼▼【新機能】メール認証エラーの処理（再送信機能付き）▼▼▼
        if (result.error.startsWith('EMAIL_NOT_VERIFIED:')) {
          const message = result.error.replace('EMAIL_NOT_VERIFIED:', '');
          setModalState({
            isOpen: true,
            title: "メールアドレス認証が必要です",
            message: `${message}\n\n認証メールが届いていない場合は、再送信をお試しください。`,
            isAlert: false,
            confirmText: "再送信",
            cancelText: "閉じる",
            onConfirm: async () => {
              // 認証メール再送信
              try {
                const resendResponse = await fetch('/api/auth/verify-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email }),
                });
                const resendData = await resendResponse.json();
                if (resendResponse.ok) {
                  setModalState({
                    isOpen: true,
                    title: "認証メールを再送信しました",
                    message: "メールボックスを確認してください。",
                    isAlert: true,
                    confirmText: "OK",
                    onConfirm: () => setModalState({ ...modalState, isOpen: false }),
                  });
                } else {
                  setModalState({
                    isOpen: true,
                    title: "エラー",
                    message: resendData.error || "認証メールの再送信に失敗しました。",
                    isAlert: true,
                    confirmText: "OK",
                    onConfirm: () => setModalState({ ...modalState, isOpen: false }),
                  });
                }
              } catch (error) {
                console.error('再送信エラー:', error);
                setModalState({
                  isOpen: true,
                  title: "エラー",
                  message: "認証メールの再送信に失敗しました。",
                  isAlert: true,
                  confirmText: "OK",
                  onConfirm: () => setModalState({ ...modalState, isOpen: false }),
                });
              }
            },
            onCancel: () => {
              setModalState({ ...modalState, isOpen: false });
            }
          });
          return;
        }
        // ▲▲▲ メール認証エラー処理完了 ▲▲▲
        
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
        // ログイン状態保持の設定をlocalStorageに保存
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberMe');
        }
        
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
          {!show2FAInput ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Mail size={16} />
                  メールアドレス
                </label>
                <Input
                  type="email"
                  placeholder="メールアドレスを入力"
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
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
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="パスワードを入力"
                    className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Mail size={16} />
                  認証コード
                </label>
                <Input
                  type="text"
                  placeholder="6桁の認証コードを入力"
                  maxLength={6}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-center text-2xl tracking-widest"
                  value={twoFactorCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, ''); // 数字のみ
                    setTwoFactorCode(value);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <p className="text-xs text-gray-400 text-center">
                  メールアドレス ({email}) に送信された6桁の認証コードを入力してください
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => {
                    setShow2FAInput(false);
                    setTwoFactorCode('');
                    handleSend2FACode(email);
                  }}
                  disabled={sending2FACode}
                >
                  {sending2FACode ? '送信中...' : '再送信'}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => {
                    setShow2FAInput(false);
                    setTwoFactorCode('');
                  }}
                >
                  戻る
                </Button>
              </div>
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
                  ログイン状態を保持する
                </span>
              </label>
              <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                パスワード再設定
              </button>
            </div>
            {rememberMe && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-300/90 leading-relaxed">
                  <p className="font-medium mb-1">ログイン状態が30日間保持されます</p>
                  <p className="text-blue-400/80 mb-1">
                    ブラウザを閉じてもログイン状態が維持されます。共有のコンピューターでは使用しないでください。
                  </p>
                  <p className="text-yellow-400/80 text-[11px] mt-1">
                    ⚠️ セキュリティのため、30分間の非活動により自動的にログアウトされます。
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30"
            onClick={handleLogin}
            disabled={show2FAInput ? verifying2FACode : false}
          >
            {show2FAInput ? (verifying2FACode ? '確認中...' : '認証コードを確認') : 'ログイン'}
          </Button>
        </div>

        <p className="text-center text-sm mt-6">
          <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors underline">
            アカウントがない方
          </Link>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 py-8 min-h-screen">
        {isMobile && (
          <header className="w-full max-w-md flex items-center justify-between mb-8">
            <button 
              onClick={() => router.back()} 
              className="p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent absolute left-1/2 -translate-x-1/2">
              ログイン
            </h1>
            <div className="w-10 h-10"></div>
          </header>
        )}
        
        <Suspense fallback={
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-400">読み込み中...</p>
          </div>
        }>
          <LoginComponent />
        </Suspense>
      </div>
    </div>
  );
}
