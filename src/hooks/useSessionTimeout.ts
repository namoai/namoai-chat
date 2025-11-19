"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// 타임아웃 시간 설정
// 개발 환경에서는 NEXT_PUBLIC_SESSION_TIMEOUT_MS 환경 변수로 테스트 가능 (밀리초)
// 예: NEXT_PUBLIC_SESSION_TIMEOUT_MS=30000 (30초)
const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30분 (프로덕션 기본값)

// 환경 변수 및 localStorage에서 타임아웃 시간 계산
const readEnvTimeout = (): number | null => {
  if (typeof window === 'undefined') return null;
  const envTimeout = process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MS;
  if (!envTimeout) return null;
  const parsed = parseInt(envTimeout, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
};

const readLocalTimeout = (): number | null => {
  if (typeof window === 'undefined') return null;
  try {
    const testMode = localStorage.getItem('sessionTimeoutTestMode');
    if (!testMode) return null;
    const parsed = parseInt(testMode, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const getCurrentTimeout = (): number => {
  const envValue = readEnvTimeout();
  if (envValue) {
    console.log(`[세션 타임아웃] 환경 변수 기반: ${envValue / 1000}초`);
    return envValue;
  }
  const localValue = readLocalTimeout();
  if (localValue) {
    console.log(`[세션 타임아웃] 테스트 모드(localStorage): ${localValue / 1000}초`);
    return localValue;
  }
  return DEFAULT_TIMEOUT;
};

const getWarningTime = (timeout: number): number => {
  return Math.max(Math.min(timeout * 0.1, 1 * 60 * 1000), 5 * 1000);
};

export function useSessionTimeout() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const hiddenTimeRef = useRef<number | null>(null); // 탭이 숨겨진 시점 추적

  // 활동 감지 핸들러
  const resetTimer = useCallback(() => {
    if (status !== 'authenticated' || !session) {
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    hiddenTimeRef.current = null; // 활동이 있으면 숨겨진 시간 초기화
    const currentTimeout = getCurrentTimeout();
    const warningTime = getWarningTime(currentTimeout);
    // 테스트 모드일 경우 localStorage의 마지막 활동 시간도 갱신
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem('sessionTimeoutTestMode')) {
          localStorage.setItem('sessionTimeoutLastActivity', now.toString());
        }
      } catch {
        // localStorage 접근 실패 시 무시
      }
    }

    // 기존 타이머 클리어
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // 경고 타이머 설정
    if (currentTimeout > warningTime) {
      warningTimeoutRef.current = setTimeout(() => {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        const timeLeft = currentTimeout - timeSinceLastActivity;
        if (timeLeft > 0 && document.visibilityState === 'visible') {
          // 경고 메시지 표시
          const secondsLeft = Math.ceil(timeLeft / 1000);
          console.log(`[세션 타임아웃] ⚠️ 세션이 곧 만료됩니다. ${secondsLeft}초 후 자동 로그아웃됩니다.`);
          
          // 테스트 모드에서는 브라우저 알림도 표시 (선택사항)
          if (currentTimeout < 5 * 60 * 1000) { // 5분 미만이면 테스트 모드로 간주
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('세션 타임아웃 경고', {
                body: `${secondsLeft}초 후 자동 로그아웃됩니다.`,
                icon: '/favicon.ico'
              });
            }
          }
        }
      }, currentTimeout - warningTime);
    }

    // 타임아웃 타이머 설정
    timeoutRef.current = setTimeout(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= currentTimeout && document.visibilityState === 'visible') {
        // 세션 타임아웃 처리
        const timeoutMinutes = Math.round(currentTimeout / 60000);
        console.log(`[세션 타임아웃] ⏱️ ${timeoutMinutes}분 비활성으로 세션이 만료되었습니다. 자동 로그아웃합니다.`);
        signOut({ 
          redirect: false,
          callbackUrl: '/login?timeout=true'
        }).then(() => {
          router.push('/login?timeout=true');
        });
      }
    }, currentTimeout);
  }, [session, status, router]);

  // 활동 이벤트 리스너 설정
  useEffect(() => {
    if (status !== 'authenticated' || !session) {
      // 세션이 없으면 타이머 클리어
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      return;
    }

    // 초기 타이머 설정
    resetTimer();

    // 사용자 활동 이벤트 리스너
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown'
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // 이벤트 리스너 등록
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // 페이지 가시성 변경 감지 (탭 전환, 사이트 이탈 등)
    const handleVisibilityChange = () => {
      const currentTimeout = getCurrentTimeout();
      if (document.visibilityState === 'visible') {
        // 탭이 다시 보이면 (다른 탭에서 돌아오거나 사이트 재방문)
        if (hiddenTimeRef.current !== null) {
          // 탭이 숨겨진 시간 동안 경과한 시간 계산
          const hiddenDuration = Date.now() - hiddenTimeRef.current;
          const timeSinceLastActivity = Date.now() - lastActivityRef.current;
          
          // 숨겨진 시간도 포함해서 타임아웃 체크
          if (timeSinceLastActivity >= currentTimeout) {
            // 이미 타임아웃되었으면 로그아웃
            console.log('탭 전환/사이트 재방문 시 세션이 만료되었습니다.');
            signOut({ 
              redirect: false,
              callbackUrl: '/login?timeout=true'
            }).then(() => {
              router.push('/login?timeout=true');
            });
            return;
          }
          
          // 숨겨진 시간이 있었지만 아직 타임아웃 전이면 타이머 재설정
          hiddenTimeRef.current = null;
          resetTimer();
        } else {
          // 숨겨진 적이 없으면 (일반적인 탭 전환) 타이머만 재설정
          resetTimer();
        }
      } else {
        // 탭이 숨겨지거나 사이트를 나갈 때
        hiddenTimeRef.current = Date.now();
        // 탭이 숨겨진 동안에도 타이머는 계속 실행되지만,
        // 실제 로그아웃은 탭이 다시 보일 때 체크됩니다
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const refreshHandler = () => resetTimer();
    window.addEventListener('session-timeout-refresh', refreshHandler);

    // 클린업
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      window.removeEventListener('session-timeout-refresh', refreshHandler);
    };
  }, [session, status, resetTimer, router]);
}

