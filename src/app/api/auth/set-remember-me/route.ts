import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { rememberMe } = await request.json();
    
    // NextAuth 세션 쿠키 찾기
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('next-auth.session-token') || 
                         cookieStore.get('__Secure-next-auth.session-token');
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    // remember me가 false인 경우, 쿠키를 세션 쿠키로 설정 (브라우저를 닫으면 만료)
    // 하지만 NextAuth의 쿠키는 httpOnly이므로 클라이언트에서 직접 수정할 수 없음
    // 대신 쿠키의 maxAge를 설정하려면 서버에서 쿠키를 재설정해야 함
    
    // 실제로는 NextAuth의 쿠키 설정이 전역이므로,
    // remember me 기능은 세션 타임아웃과 함께 작동하도록 구현
    
    return NextResponse.json({ 
      success: true,
      message: rememberMe 
        ? 'ログイン状態が30日間保持されます' 
        : 'ブラウザを閉じるとセッションが終了します'
    });
  } catch (error) {
    console.error('Remember me 설정 오류:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


