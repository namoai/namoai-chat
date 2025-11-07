export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * 관리자용 채팅 자동 테스트 API
 * 지정된 캐릭터와 채팅을 여러 번 자동으로 수행합니다.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  // SUPER_ADMIN만 접근 가능
  if (session?.user?.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const { characterId, chatCount = 20, messages } = await request.json();

    if (!characterId) {
      return NextResponse.json({ error: 'キャラクターIDが必要です。' }, { status: 400 });
    }

    const userId = parseInt(String(session.user.id), 10);
    
    // 캐릭터 확인
    const character = await prisma.characters.findUnique({
      where: { id: characterId },
      include: {
        characterImages: true,
      },
    });

    if (!character) {
      return NextResponse.json({ error: 'キャラクターが見つかりません。' }, { status: 404 });
    }

    // 채팅 세션 찾기 또는 생성
    let chat = await prisma.chat.findFirst({
      where: {
        user_id: userId,
        character_id: characterId,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          user_id: userId,
          character_id: characterId,
        },
      });
    }

    const chatId = chat.id;
    const results = [];
    const testMessages = messages || [
      'こんにちは',
      '元気？',
      '何してる？',
      '今日はいい天気だね',
      '最近どう？',
      'お腹すいた',
      '眠い',
      '一緒に遊ぼう',
      'ありがとう',
      'さようなら',
    ];

    // 각 메시지를 순차적으로 전송
    for (let i = 0; i < chatCount; i++) {
      const messageIndex = i % testMessages.length;
      const message = testMessages[messageIndex];
      
      try {
        const startTime = Date.now();
        
        // 채팅 API 호출 - 내부 로직을 직접 호출하는 것이 좋지만, 현재는 API를 통해 호출
        // 실제 환경에서는 내부 함수를 직접 호출하는 것이 더 효율적입니다.
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000';
        
        // 쿠키를 전달하기 위해 Request 객체를 재생성
        const cookieHeader = request.headers.get('cookie') || '';
        
        const response = await fetch(`${baseUrl}/api/chat/${chatId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
            // 호스트 헤더도 필요할 수 있음
            ...(process.env.VERCEL_URL ? { 'Host': process.env.VERCEL_URL } : {}),
          },
          body: JSON.stringify({
            message: message,
            settings: { model: 'gemini-2.5-flash' },
            activeVersions: {},
          }),
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        if (response.ok) {
          // 스트림 응답 처리
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let fullResponse = '';
          
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.substring(6);
                  if (data.trim()) {
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.responseChunk) {
                        fullResponse += parsed.responseChunk;
                      }
                    } catch (e) {
                      // JSON 파싱 실패는 무시
                    }
                  }
                }
              }
            }
          }

          results.push({
            index: i + 1,
            message,
            success: true,
            duration,
            responseLength: fullResponse.length,
            timestamp: new Date().toISOString(),
          });
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          results.push({
            index: i + 1,
            message,
            success: false,
            error: errorData.error || `HTTP ${response.status}`,
            duration,
            timestamp: new Date().toISOString(),
          });
        }

        // 다음 요청 전에 약간의 대기 시간 (서버 부하 방지)
        if (i < chatCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        }

      } catch (error) {
        results.push({
          index: i + 1,
          message,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 결과 요약
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const avgDuration = results
      .filter(r => r.duration)
      .reduce((sum, r) => sum + (r.duration || 0), 0) / successCount || 0;

    return NextResponse.json({
      success: true,
      summary: {
        total: chatCount,
        success: successCount,
        failed: failCount,
        avgDuration: Math.round(avgDuration),
        characterId,
        characterName: character.name,
        chatId,
      },
      results,
    });

  } catch (error) {
    console.error('채팅 테스트 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'サーバーエラー' },
      { status: 500 }
    );
  }
}
