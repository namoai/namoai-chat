import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAdminEmail() {
  try {
    console.log('이메일 변경 시작...');
    
    // admin@admin.co.jp 이메일을 가진 사용자 찾기
    const user = await prisma.users.findUnique({
      where: { email: 'admin@admin.co.jp' }
    });

    if (!user) {
      console.log('admin@admin.co.jp 이메일을 가진 사용자를 찾을 수 없습니다.');
      return;
    }

    console.log(`사용자 ID: ${user.id}, 현재 이메일: ${user.email}`);

    // 이메일 변경
    const updated = await prisma.users.update({
      where: { id: user.id },
      data: { email: 'sc9985@naver.com' }
    });

    console.log(`이메일 변경 완료: ${updated.email}`);
    console.log(`사용자 ID: ${updated.id}, 이름: ${updated.name}, 닉네임: ${updated.nickname}`);
  } catch (error) {
    console.error('에러 발생:', error);
    if (error.code === 'P2002') {
      console.error('sc9985@naver.com 이메일이 이미 존재합니다.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminEmail();


