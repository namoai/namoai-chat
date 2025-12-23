"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, User, Phone, Smile, ArrowLeft, ChevronRight, Eye, EyeOff } from "lucide-react"; // ✅ ボタンアイコンを追加
import { fetchWithCsrf } from "@/lib/csrf-client";
import { validatePassword } from "@/lib/password-policy";

export default function SignUpPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    phone: "",
    nickname: "",
    birthdate: "",
  });
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // パスワード表示/非表示
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false); // パスワード確認表示/非表示

  const [agreed, setAgreed] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedAge13, setAgreedAge13] = useState(false);
  const [agreedParental, setAgreedParental] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [agreedNightReceipt, setAgreedNightReceipt] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationProof, setEmailVerificationProof] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  // 生年月日フォーマット変換ヘルパー関数
  const formatBirthdate = (birthdate: string): string => {
    if (!birthdate) return '';
    const parts = birthdate.split('-');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return birthdate;
  };

  // 生年月日からDateオブジェクトを生成するヘルパー関数
  const parseBirthdate = (birthdate: string): Date | null => {
    if (!birthdate) return null;
    const formatted = formatBirthdate(birthdate);
    const parsed = Date.parse(formatted);
    if (isNaN(parsed)) return null;
    return new Date(parsed);
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // メールアドレスが変更されたら認証状態をリセット
    if (field === "email") {
      setEmailVerified(false);
      setShowVerificationInput(false);
      setVerificationCode("");
      setEmailVerificationProof(null);
    }
    // ニックネームが変更されたら重複確認状態をリセット
    if (field === "nickname") {
      setNicknameChecked(false);
      setNicknameAvailable(null);
    }
  };

  const handleCheckNickname = async () => {
    if (!form.nickname || form.nickname.trim().length < 2 || form.nickname.trim().length > 12) {
      alert("ニックネームは2〜12文字で入力してください。");
      return;
    }

    setCheckingNickname(true);
    try {
      const response = await fetchWithCsrf("/api/users/check-nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: form.nickname }),
      });

      const data = await response.json();
      setNicknameChecked(true);
      
      if (data.available) {
        setNicknameAvailable(true);
        alert(data.message || "このニックネームは使用可能です。");
      } else {
        setNicknameAvailable(false);
        alert(data.message || "このニックネームは既に使用されています。");
      }
    } catch (error) {
      console.error("ニックネーム重複確認エラー:", error);
      alert("サーバーエラーが発生しました。");
    } finally {
      setCheckingNickname(false);
    }
  };

  const handleSendVerificationCode = async () => {
    if (!form.email || !form.email.includes("@")) {
      alert("正しいメールアドレスを入力してください。");
      return;
    }

    setSendingCode(true);
    try {
      const response = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data?.error || "認証コードの送信に失敗しました。");
        return;
      }

      alert(data?.message || "認証コードを送信しました。");
      setShowVerificationInput(true);
    } catch (error) {
      console.error("認証コード送信エラー:", error);
      alert("サーバーエラーが発生しました。");
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || !/^\d{6}$/.test(verificationCode)) {
      alert("6桁の認証コードを入力してください。");
      return;
    }

    setVerifyingCode(true);
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data?.error || "認証コードの検証に失敗しました。");
        return;
      }

      alert(data?.message || "メールアドレスの認証が完了しました。");
      setEmailVerified(true);
      setShowVerificationInput(false);
      setEmailVerificationProof(data?.proof ?? null);
    } catch (error) {
      console.error("認証コード検証エラー:", error);
      alert("サーバーエラーが発生しました。");
    } finally {
      setVerifyingCode(false);
    }
  };

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nameRegex = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー\s]+$/u;
    // 電話番号検証: 数字、ハイフン、括弧、プラス記号、スペースのみ許可（英字やその他の文字は不可）
    // 例: 070-1234-5678, 03-1234-5678, +81-90-1234-5678, (03)1234-5678, 09012345678 など
    const phoneRegex = /^[\d\s\-+()]+$/;
    // 数字が少なくとも1つは含まれていることを確認
    const phoneHasDigits = /\d/.test(form.phone);
    const nicknameRegex = /^.{2,12}$/;

    if (!emailRegex.test(form.email)) {
      alert("正しいメールアドレスを入力してください。");
      return false;
    }
    
    // パスワード検証（サーバー側のポリシーと一致）
    if (form.password.length < 8) {
      alert("パスワードは8文字以上である必要があります。");
      return false;
    }
    if (form.password.length > 128) {
      alert("パスワードは128文字以下である必要があります。");
      return false;
    }
    const hasLowercase = /[a-z]/.test(form.password);
    const hasNumber = /[0-9]/.test(form.password);
    const hasSpecialChar = /[^a-zA-Z0-9]/.test(form.password);
    
    if (!hasLowercase) {
      alert("パスワードには小文字（a-z）が含まれる必要があります。");
      return false;
    }
    if (!hasNumber) {
      alert("パスワードには数字（0-9）が含まれる必要があります。");
      return false;
    }
    if (!hasSpecialChar) {
      alert("パスワードには特殊文字（!@#$%^&*など）が含まれる必要があります。");
      return false;
    }
    // パスワード確認検証
    if (form.password !== form.passwordConfirm) {
      alert("パスワードが一致しません。");
      return false;
    }
    if (!nameRegex.test(form.name)) {
      alert("氏名はひらがな・カタカナ・漢字のみ使用できます。");
      return false;
    }
    // 電話番号の最小長をチェック（5文字以上、30文字以下）
    if (form.phone.length < 5) {
      alert("電話番号は5文字以上で入力してください。");
      return false;
    }
    if (form.phone.length > 30) {
      alert("電話番号は30文字以下で入力してください。");
      return false;
    }
    // 数字、ハイフン、括弧、プラス記号、スペース以外の文字が含まれていないかチェック
    if (!phoneRegex.test(form.phone)) {
      alert("電話番号は数字、ハイフン(-)、括弧()、プラス記号(+)、スペースのみ使用できます。英字やその他の文字は使用できません。");
      return false;
    }
    // 数字が少なくとも1つは含まれていることを確認
    if (!phoneHasDigits) {
      alert("電話番号には少なくとも1つの数字が必要です。");
      return false;
    }
    if (!nicknameRegex.test(form.nickname)) {
      alert("ニックネームは2〜12文字で入力してください。");
      return false;
    }
    // ニックネーム重複確認チェック
    if (!nicknameChecked || !nicknameAvailable) {
      alert("ニックネームの重複確認を完了してください。");
      return false;
    }
    // 生年月日が入力されている場合のみ検証
    if (form.birthdate) {
      const birth = parseBirthdate(form.birthdate);
      if (!birth) {
        alert("生年月日が不正です。");
        return false;
      }
      const today = new Date();
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        calculatedAge -= 1;
      }
      if (calculatedAge < 0 || calculatedAge > 120) {
        alert("生年月日が不正です。");
        return false;
      }
    }

    // 約款同意はモーダルで確認するため、ここではチェックしない
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    // メールアドレス認証チェック
    if (!emailVerified) {
      alert("メールアドレスの認証を完了してください。");
      return;
    }

    // 約款同意モーダルを表示
    setShowTermsModal(true);
  };

  const handleAgreeAll = () => {
    setAgreed(true);
    setAgreedPrivacy(true);
    setAgreedAge13(true);
    // 生年月日が入力されていて18歳未満の場合のみ保護者同意を自動チェック
    if (form.birthdate) {
      const birth = parseBirthdate(form.birthdate);
      if (birth) {
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        if (age < 18) {
          setAgreedParental(true);
        }
      }
    }
  };

  const handleCompleteRegistration = async () => {
    // ニックネーム重複確認再確認（規約同意後にも再チェック）
    if (!nicknameChecked || !nicknameAvailable) {
      alert("ニックネームの重複確認を完了してください。");
      return;
    }

    // 必須項目チェック
    if (!agreed) {
      alert("利用規約に同意してください。");
      return;
    }
    if (!agreedPrivacy) {
      alert("プライバシーポリシーに同意してください。");
      return;
    }
    if (!agreedAge13) {
      alert("13歳以上であることを確認してください。");
      return;
    }
    // 生年月日が入力されていて18歳未満の場合のみ保護者同意をチェック
    if (form.birthdate) {
      const birth = parseBirthdate(form.birthdate);
      if (birth) {
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        if (age < 18 && !agreedParental) {
          alert("18歳未満の場合、保護者または法定代理人の同意が必要です。");
          return;
        }
      }
    }

    setShowTermsModal(false);

    try {
      // 生年月日フォーマット変換（YYYY-MM-DD形式に）
      const birthdateFormatted = formatBirthdate(form.birthdate);

      const response = await fetchWithCsrf("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, birthdate: birthdateFormatted, emailVerificationProof }),
      });

      const contentType = response.headers.get("content-type");

      let data: { error?: string; message?: string };
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("⚠ JSON ではない応答:", text);
        alert("サーバーから不明な応答が返されました。");
        return;
      }

      if (!response.ok) {
        alert(data?.error || "登録に失敗しました。");
        return;
      }

      // 登録成功メッセージ（メール認証の案内を含む）
      const message = data?.message || "登録成功！ログイン画面へ移動します。";
      alert(message);
      // 登録成功後はreplaceを使用して履歴を残さない
      router.replace("/login");
    } catch (error) {
      console.error("通信エラー:", error);
      alert("サーバーエラーが発生しました。");
    }
  };


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
          <header className="w-full max-w-md flex items-center justify-center mb-8 relative">
            <button
              onClick={() => router.back()}
              className="absolute left-0 p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              会員登録
            </h1>
          </header>
        )}

        <div className="w-full max-w-md bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 p-6 md:p-8 space-y-6">
          <p className="text-gray-300 text-center">
            以下の情報を入力して会員登録を完了してください。
          </p>

          <div className="space-y-4">
            {[{
              icon: <Mail size={18} className="text-blue-400" />,
              label: "メールアドレス",
              field: "email",
              placeholder: "例: user@example.com",
              showVerification: true,
            },
            {
              icon: <Lock size={18} className="text-blue-400" />,
              label: "パスワード",
              field: "password",
              placeholder: "8文字以上（小文字・数字・特殊文字必須）",
              type: "password",
            },
            {
              icon: <Lock size={18} className="text-blue-400" />,
              label: "パスワード確認",
              field: "passwordConfirm",
              placeholder: "パスワードを再度入力",
              type: "password",
            },
            {
              icon: <User size={18} className="text-blue-400" />,
              label: "氏名",
              field: "name",
              placeholder: "例: 山田太郎",
            },
            {
              icon: <Phone size={18} className="text-blue-400" />,
              label: "電話番号",
              field: "phone",
              placeholder: "例: 070-1234-5678",
            },
            {
              icon: <Smile size={18} className="text-blue-400" />,
              label: "ニックネーム",
              field: "nickname",
              placeholder: "2〜12文字のニックネーム",
              showNicknameCheck: true,
            },
          ].map(({ icon, label, field, placeholder, type = "text", showVerification = false, showNicknameCheck = false }) => (
              <div className="space-y-2" key={field}>
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  {icon}
                  {label}
                  {showVerification && emailVerified && (
                    <span className="text-green-400 text-xs">✓ 認証済み</span>
                  )}
                  {showNicknameCheck && nicknameChecked && nicknameAvailable && (
                    <span className="text-green-400 text-xs">✓ 使用可能</span>
                  )}
                  {showNicknameCheck && nicknameChecked && !nicknameAvailable && (
                    <span className="text-red-400 text-xs">✗ 使用不可</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={type === "password" ? (field === "password" ? (showPassword ? "text" : "password") : (showPasswordConfirm ? "text" : "password")) : type}
                      placeholder={placeholder}
                      className={`bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all w-full ${type === "password" ? "pr-12" : ""}`}
                      value={form[field as keyof typeof form]}
                      onChange={(e) => handleChange(field, e.target.value)}
                      disabled={showVerification && emailVerified}
                    />
                    {type === "password" && (
                      <button
                        type="button"
                        onClick={() => field === "password" ? setShowPassword(!showPassword) : setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        {(field === "password" ? showPassword : showPasswordConfirm) ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    )}
                  </div>
                  {showVerification && !emailVerified && (
                    <Button
                      type="button"
                      onClick={handleSendVerificationCode}
                      disabled={sendingCode || !form.email || !form.email.includes("@")}
                      className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {sendingCode ? "送信中..." : showVerificationInput ? "再送信" : "認証する"}
                    </Button>
                  )}
                  {showNicknameCheck && (
                    <Button
                      type="button"
                      onClick={handleCheckNickname}
                      disabled={checkingNickname || !form.nickname || form.nickname.trim().length < 2 || form.nickname.trim().length > 12}
                      className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {checkingNickname ? "確認中..." : nicknameChecked && nicknameAvailable ? "✓ 使用可能" : "重複確認"}
                    </Button>
                  )}
                </div>
                {/* パスワードリアルタイム検証 */}
                {field === "password" && form.password && (
                  <div className="mt-2 space-y-1">
                    {(() => {
                      const validation = validatePassword(form.password);
                      return (
                        <>
                          <div className="text-xs text-gray-400 mb-2">
                            <p className="font-semibold mb-1">パスワード要件:</p>
                            <ul className="list-disc list-inside space-y-0.5 ml-2">
                              <li className={form.password.length >= 8 ? "text-green-400" : "text-gray-500"}>
                                {form.password.length >= 8 ? "✓" : "✗"} 8文字以上
                              </li>
                              <li className={/[a-z]/.test(form.password) ? "text-green-400" : "text-gray-500"}>
                                {/[a-z]/.test(form.password) ? "✓" : "✗"} 小文字（a-z）を含む
                              </li>
                              <li className={/[0-9]/.test(form.password) ? "text-green-400" : "text-gray-500"}>
                                {/[0-9]/.test(form.password) ? "✓" : "✗"} 数字（0-9）を含む
                              </li>
                              <li className={/[^a-zA-Z0-9]/.test(form.password) ? "text-green-400" : "text-gray-500"}>
                                {/[^a-zA-Z0-9]/.test(form.password) ? "✓" : "✗"} 特殊文字（!@#$%^&*など）を含む
                              </li>
                            </ul>
                          </div>
                          {validation.errors.length > 0 && (
                            <div className="space-y-0.5">
                              {validation.errors.map((error, idx) => (
                                <p key={idx} className="text-red-400 text-xs flex items-center gap-1">
                                  <span>✗</span> {error}
                                </p>
                              ))}
                            </div>
                          )}
                          {validation.warnings.length > 0 && validation.errors.length === 0 && (
                            <div className="space-y-0.5">
                              {validation.warnings.map((warning, idx) => (
                                <p key={idx} className="text-yellow-400 text-xs flex items-center gap-1">
                                  <span>⚠</span> {warning}
                                </p>
                              ))}
                            </div>
                          )}
                          {validation.isValid && (
                            <p className="text-green-400 text-xs flex items-center gap-1">
                              <span>✓</span> パスワード要件を満たしています
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                {/* パスワード確認リアルタイム表示 */}
                {field === "passwordConfirm" && form.password && form.passwordConfirm && (
                  <div className="mt-2">
                    {form.password === form.passwordConfirm ? (
                      <p className="text-green-400 text-xs flex items-center gap-1">
                        <span>✓</span> パスワードが一致しています
                      </p>
                    ) : (
                      <p className="text-red-400 text-xs flex items-center gap-1">
                        <span>✗</span> パスワードが一致しません
                      </p>
                    )}
                  </div>
                )}
                {showVerification && showVerificationInput && !emailVerified && (
                  <div className="space-y-2 mt-2">
                    <label className="text-sm font-medium text-gray-300">
                      認証コード（6桁）
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="123456"
                        maxLength={6}
                        className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all flex-1"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={verifyingCode || verificationCode.length !== 6}
                        className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {verifyingCode ? "確認中..." : "確認"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )            )}

            {/* 生年月日入力（別フィールド） */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Smile size={18} className="text-blue-400" />
                生年月日（任意）
              </label>
              <div className="flex gap-2 items-center">
                <Input
                  type="text"
                  placeholder="YYYY"
                  maxLength={4}
                  className="w-20 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-center"
                  value={(() => {
                    if (!form.birthdate) return '';
                    const parts = form.birthdate.split('-');
                    return parts[0] || '';
                  })()}
                  onChange={(e) => {
                    const year = e.target.value.replace(/\D/g, '').slice(0, 4);
                    const currentDate = form.birthdate ? form.birthdate.split('-') : ['', '', ''];
                    const newDate = year.length === 4 
                      ? `${year}-${currentDate[1] || ''}-${currentDate[2] || ''}`.replace(/^-+/, '')
                      : year;
                    setForm((prev) => ({ ...prev, birthdate: newDate }));
                    // 4桁入力時に月フィールドへフォーカス移動
                    if (year.length === 4) {
                      setTimeout(() => {
                        const monthInput = document.getElementById('birth-month');
                        if (monthInput) (monthInput as HTMLInputElement).focus();
                      }, 0);
                    }
                  }}
                />
                <span className="text-gray-400">年</span>
                <Input
                  id="birth-month"
                  type="text"
                  placeholder="MM"
                  maxLength={2}
                  className="w-16 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-center"
                  value={(() => {
                    if (!form.birthdate) return '';
                    const parts = form.birthdate.split('-');
                    return parts[1] || '';
                  })()}
                  onChange={(e) => {
                    const month = e.target.value.replace(/\D/g, '').slice(0, 2);
                    const currentDate = form.birthdate ? form.birthdate.split('-') : ['', '', ''];
                    const monthNum = parseInt(month);
                    if (month && (monthNum < 1 || monthNum > 12)) {
                      return; // 無効な月は入力不可
                    }
                    // 入力中はpadStartしない（編集可能にするため）
                    const newDate = `${currentDate[0] || ''}-${month}-${currentDate[2] || ''}`.replace(/^-+/, '');
                    setForm((prev) => ({ ...prev, birthdate: newDate }));
                    // 2桁入力時に日フィールドへフォーカス移動
                    if (month.length === 2) {
                      setTimeout(() => {
                        const dayInput = document.getElementById('birth-day');
                        if (dayInput) (dayInput as HTMLInputElement).focus();
                      }, 0);
                    }
                  }}
                  onBlur={(e) => {
                    // フォーカスが外れたときにのみ2桁にフォーマット
                    const month = e.target.value.replace(/\D/g, '').slice(0, 2);
                    if (month && month.length === 1) {
                      const currentDate = form.birthdate ? form.birthdate.split('-') : ['', '', ''];
                      const monthFormatted = month.padStart(2, '0');
                      const newDate = `${currentDate[0] || ''}-${monthFormatted}-${currentDate[2] || ''}`.replace(/^-+/, '');
                      setForm((prev) => ({ ...prev, birthdate: newDate }));
                    }
                  }}
                />
                <span className="text-gray-400">月</span>
                <Input
                  id="birth-day"
                  type="text"
                  placeholder="DD"
                  maxLength={2}
                  className="w-16 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-center"
                  value={(() => {
                    if (!form.birthdate) return '';
                    const parts = form.birthdate.split('-');
                    return parts[2] || '';
                  })()}
                  onChange={(e) => {
                    const day = e.target.value.replace(/\D/g, '').slice(0, 2);
                    const currentDate = form.birthdate ? form.birthdate.split('-') : ['', '', ''];
                    const dayNum = parseInt(day);
                    if (day && (dayNum < 1 || dayNum > 31)) {
                      return; // 無効な日は入力不可
                    }
                    // 入力中はpadStartしない（編集可能にするため）
                    const newDate = `${currentDate[0] || ''}-${currentDate[1] || ''}-${day}`.replace(/^-+/, '');
                    setForm((prev) => ({ ...prev, birthdate: newDate }));
                  }}
                  onBlur={(e) => {
                    // フォーカスが外れたときにのみ2桁にフォーマット
                    const day = e.target.value.replace(/\D/g, '').slice(0, 2);
                    if (day && day.length === 1) {
                      const currentDate = form.birthdate ? form.birthdate.split('-') : ['', '', ''];
                      const dayFormatted = day.padStart(2, '0');
                      const newDate = `${currentDate[0] || ''}-${currentDate[1] || ''}-${dayFormatted}`.replace(/^-+/, '');
                      setForm((prev) => ({ ...prev, birthdate: newDate }));
                    }
                  }}
                />
                <span className="text-gray-400">日</span>
              </div>
            </div>

            <Button
              disabled={!emailVerified}
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              会員登録
            </Button>
            {!emailVerified && (
              <p className="text-xs text-red-400 text-center">
                ※ メールアドレスの認証を完了してください。
              </p>
            )}
            {(!nicknameChecked || !nicknameAvailable) && (
              <p className="text-xs text-red-400 text-center">
                ※ ニックネームの重複確認を完了してください。
              </p>
            )}
          </div>
        </div>

        {/* 約款同意モーダル */}
        {showTermsModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-gray-800/50 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  利用規約
                </h2>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* すべての規約に同意する */}
                <div className="flex items-start space-x-3 pb-3 border-b border-gray-700/50">
                  <Checkbox
                    id="agreeAll"
                    checked={agreed && agreedPrivacy && agreedAge13 && (form.birthdate ? (() => {
                      const birth = parseBirthdate(form.birthdate);
                      if (!birth) return true;
                      const today = new Date();
                      let age = today.getFullYear() - birth.getFullYear();
                      const monthDiff = today.getMonth() - birth.getMonth();
                      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                        age--;
                      }
                      return age < 18 ? agreedParental : true;
                    })() : true)}
                    onCheckedChange={(v) => {
                      if (v) {
                        handleAgreeAll();
                      } else {
                        setAgreed(false);
                        setAgreedPrivacy(false);
                        setAgreedAge13(false);
                        setAgreedParental(false);
                      }
                    }}
                    className="mt-1"
                  />
                  <label htmlFor="agreeAll" className="text-sm font-medium text-gray-300 leading-relaxed cursor-pointer">
                    すべての規約に同意する。
                  </label>
                </div>

                {/* 利用規約 */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-start space-x-3 flex-1">
                    <Checkbox
                      id="terms"
                      checked={agreed}
                      onCheckedChange={(v) => setAgreed(!!v)}
                      className="mt-1"
                    />
                    <label htmlFor="terms" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                      利用規約 <span className="text-red-400">(必須)</span>
                    </label>
                  </div>
                  <button
                    onClick={() => setShowTerms(true)}
                    className="text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* プライバシーポリシー */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-start space-x-3 flex-1">
                    <Checkbox
                      id="privacy"
                      checked={agreedPrivacy}
                      onCheckedChange={(v) => setAgreedPrivacy(!!v)}
                      className="mt-1"
                    />
                    <label htmlFor="privacy" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                      プライバシーポリシー <span className="text-red-400">(必須)</span>
                    </label>
                  </div>
                  <button
                    onClick={() => setShowPrivacy(true)}
                    className="text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* 13歳以上 */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-start space-x-3 flex-1">
                    <Checkbox
                      id="age13"
                      checked={agreedAge13}
                      onCheckedChange={(v) => setAgreedAge13(!!v)}
                      className="mt-1"
                    />
                    <label htmlFor="age13" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                      13歳以上です。<span className="text-red-400">(必須)</span>
                    </label>
                  </div>
                </div>

                {/* 18歳未満の場合、保護者同意 */}
                {form.birthdate && (() => {
                  const birth = parseBirthdate(form.birthdate);
                  if (!birth) return false;
                  const today = new Date();
                  let age = today.getFullYear() - birth.getFullYear();
                  const monthDiff = today.getMonth() - birth.getMonth();
                  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                    age--;
                  }
                  return age < 18;
                })() && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-start space-x-3 flex-1">
                      <Checkbox
                        id="parental"
                        checked={agreedParental}
                        onCheckedChange={(v) => setAgreedParental(!!v)}
                        className="mt-1"
                      />
                      <label htmlFor="parental" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                        保護者または法定代理人の同意を得ています。<span className="text-red-400">(必須)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* マーケティング情報の受信に同意 (任意) */}
                <div className="flex items-start space-x-3 py-2 border-t border-gray-700/50 pt-4">
                  <Checkbox
                    id="marketing"
                    checked={agreedMarketing}
                    onCheckedChange={(v) => setAgreedMarketing(!!v)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="marketing" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                      マーケティング情報の受信に同意 <span className="text-gray-500">(任意)</span>
                    </label>
                    {agreedMarketing && (
                      <div className="mt-2 pl-6 space-y-2">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="nightReceipt"
                            checked={agreedNightReceipt}
                            onCheckedChange={(v) => setAgreedNightReceipt(!!v)}
                            className="mt-1"
                          />
                          <label htmlFor="nightReceipt" className="text-xs text-gray-400 leading-relaxed cursor-pointer">
                            夜間受信に同意 <span className="text-gray-500">(任意)</span>
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 pl-6">
                          午後9時から午前8時(JST)でも、重要なイベントやお得な情報を受け取れます。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleCompleteRegistration}
                  disabled={!agreed || !agreedPrivacy || !agreedAge13 || (form.birthdate ? (() => {
                    const birth = parseBirthdate(form.birthdate);
                    if (!birth) return false;
                    const today = new Date();
                    let age = today.getFullYear() - birth.getFullYear();
                    const monthDiff = today.getMonth() - birth.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                      age--;
                    }
                    return age < 18 && !agreedParental;
                  })() : false)}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  登録完了
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 利用規約詳細モーダル */}
        {showTerms && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-gray-800/50 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  利用規約
                </h2>
                <button
                  onClick={() => setShowTerms(false)}
                  className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
                >
                  ✕
                </button>
              </div>
              <div className="text-sm text-gray-300 leading-relaxed space-y-2">
                <p>
                  本サービスを利用する前に、以下の規約をよくお読みください。利用することで、全ての条項に同意したことになります。
                </p>
                <p>1. 利用者は...</p>
                <p>2. 禁止事項...</p>
                <p>...</p>
              </div>
            </div>
          </div>
        )}

        {/* プライバシーポリシー詳細モーダル */}
        {showPrivacy && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl w-full max-w-md border border-gray-800/50 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  プライバシーポリシー
                </h2>
                <button
                  onClick={() => setShowPrivacy(false)}
                  className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
                >
                  ✕
                </button>
              </div>
              <div className="text-sm text-gray-300 leading-relaxed space-y-2">
                <p>
                  本サービスは、お客様の個人情報を適切に保護するため、以下の方針に従って取り扱います。
                </p>
                <p>1. 個人情報の収集...</p>
                <p>2. 個人情報の利用目的...</p>
                <p>3. 個人情報の管理...</p>
                <p>...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
