"use client";
import { SessionProvider } from "next-auth/react";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";

// 세션 타임아웃 기능을 포함한 내부 컴포넌트
function SessionTimeoutHandler() {
  useSessionTimeout();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionTimeoutHandler />
      {children}
    </SessionProvider>
  );
}