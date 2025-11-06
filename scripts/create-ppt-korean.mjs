import pptxgen from 'pptxgenjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// PPT 생성
const ppt = new pptxgen();

// 기본 설정
ppt.layout = 'LAYOUT_16x9';
ppt.author = 'Namos Chat Team';
ppt.title = '나모스 챗 서비스 설명서';
ppt.subject = 'AI 캐릭터 대화 플랫폼';

// 색상 설정
const colors = {
  primary: '2563EB',
  secondary: '1E40AF',
  accent: '3B82F6',
  light: 'EFF6FF',
  dark: '1E293B',
  white: 'FFFFFF',
  text: '333333'
};

// ===== 슬라이드 1: 표지 =====
let slide = ppt.addSlide();
slide.background = { color: colors.primary };
slide.addText('나모스 챗', {
  x: 0.5, y: 2, w: 9, h: 1,
  fontSize: 60, bold: true, color: colors.white, align: 'center'
});
slide.addText('AI 캐릭터와 대화하는 새로운 경험', {
  x: 0.5, y: 3.2, w: 9, h: 0.6,
  fontSize: 28, color: colors.light, align: 'center'
});
slide.addText('Namos Chat Service Introduction', {
  x: 0.5, y: 4, w: 9, h: 0.4,
  fontSize: 16, color: colors.light, align: 'center', italic: true
});

// ===== 슬라이드 2: 서비스 소개 =====
slide = ppt.addSlide();
slide.addText('서비스 소개', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 36, bold: true, color: colors.primary
});

slide.addText([
  { text: '나모스 챗이란?\n', options: { fontSize: 20, bold: true, color: colors.secondary, breakLine: true } },
  { text: '사용자가 다양한 AI 세계관과 자유롭게 대화하며 스토리를 만들어가는 플랫폼\n\n', options: { fontSize: 16, color: colors.text } },
  { text: '💡 쉬운 비유\n', options: { fontSize: 18, bold: true, color: colors.secondary, breakLine: true } },
  { text: '"유튜브에서 누구나 영상을 올리고 시청하듯,\n', options: { fontSize: 15, color: colors.text } },
  { text: 'ナモスチャットでは 누구나 세계관을 만들고 즐깁니다"', options: { fontSize: 15, color: colors.text } }
], {
  x: 0.5, y: 1, w: 9, h: 4
});

// ===== 슬라이드 3: 서비스의 특별함 =====
slide = ppt.addSlide();
slide.addText('서비스의 특별함', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 36, bold: true, color: colors.primary
});

const features = [
  { icon: '🎨', title: '누구나 창작자', desc: '코딩 없이 AI 세계관 제작' },
  { icon: '🎭', title: '무한한 세계관', desc: '판타지, 현대, SF, 로맨스 등' },
  { icon: '👤', title: '나만의 정체성', desc: '페르소나 시스템으로 맞춤 경험' },
  { icon: '💬', title: '자연스러운 대화', desc: 'Google AI로 실제처럼' },
  { icon: '🌐', title: '창작자 경제', desc: '인기 세계관은 수익 창출' }
];

features.forEach((feature, idx) => {
  const row = Math.floor(idx / 3);
  const col = idx % 3;
  slide.addText([
    { text: feature.icon + '\n', options: { fontSize: 32 } },
    { text: feature.title + '\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
    { text: feature.desc, options: { fontSize: 13, color: colors.text } }
  ], {
    x: 0.5 + col * 3.3, y: 1.2 + row * 2, w: 3, h: 1.5,
    align: 'center', valign: 'middle'
  });
});

// ===== 슬라이드 4: 캐릭터 시스템 =====
slide = ppt.addSlide();
slide.addText('1. 캐릭터 시스템 (세계관 기반)', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addText([
  { text: '⭐ 중요: 사용자가 직접 만듭니다!\n\n', options: { fontSize: 18, bold: true, color: colors.accent } },
  { text: '캐릭터는 단순한 "1명의 AI"가 아닙니다\n', options: { fontSize: 15, color: colors.text } },
  { text: '→ 하나의 완전한 세계관 + 여러 등장인물을 포함\n\n', options: { fontSize: 15, color: colors.text } },
  { text: '🌍 영화 한 편을 만드는 것과 같습니다\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '• 세계관 = 영화의 배경 설정\n', options: { fontSize: 14, color: colors.text } },
  { text: '• 등장인물 = 주인공, 조연들의 성격과 관계\n', options: { fontSize: 14, color: colors.text } },
  { text: '• 사용자 = 세계에 입장해 직접 스토리를 만드는 주인공', options: { fontSize: 14, color: colors.text } }
], {
  x: 0.5, y: 1, w: 9, h: 4
});

// ===== 슬라이드 5: 세계관 예시 =====
slide = ppt.addSlide();
slide.addText('실제 예시: "재벌 학교 로맨스"', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addText([
  { text: '📚 세계관 설정\n', options: { fontSize: 18, bold: true, color: colors.secondary } },
  { text: '• 타이틀: "청운 고등교육기관"\n', options: { fontSize: 14, color: colors.text } },
  { text: '• 배경: 재벌, 정치인, 연예인 자녀들만 다니는 초고급 학교\n', options: { fontSize: 14, color: colors.text } },
  { text: '• 특징: 극심한 신분 차이, 3대 파벌, 장학생 차별\n\n', options: { fontSize: 14, color: colors.text } },
  { text: '👥 등장인물 (모두 AI가 연기)\n', options: { fontSize: 18, bold: true, color: colors.secondary } },
  { text: '• 강서연: 청운그룹 후계자, 차갑고 무뚝뚝한 재벌녀\n', options: { fontSize: 13, color: colors.text } },
  { text: '• 이나경: 금융재벌 딸, 질투 많은 허세녀\n', options: { fontSize: 13, color: colors.text } },
  { text: '• 정윤하: 국무총리 손녀, 최연소 국회의원\n', options: { fontSize: 13, color: colors.text } },
  { text: '• 윤채린: 일반 가정 출신 장학생, 매일 괴롭힘\n', options: { fontSize: 13, color: colors.text } },
  { text: '• 김서진: 동아시아 최대 마피아 조직 후계자', options: { fontSize: 13, color: colors.text } }
], {
  x: 0.5, y: 0.9, w: 9, h: 4.5
});

// ===== 슬라이드 6: 페르소나 시스템 =====
slide = ppt.addSlide();
slide.addText('2. 페르소나 시스템', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addText([
  { text: '페르소나란?\n', options: { fontSize: 18, bold: true, color: colors.secondary } },
  { text: '사용자가 자신의 신분이나 정체성을 설정하는 기능\n\n', options: { fontSize: 15, color: colors.text } },
  { text: '💡 핵심: 사용자 자신의 신분증명서\n', options: { fontSize: 16, bold: true, color: colors.accent } },
  { text: 'AI는 이 정보를 바탕으로 사용자를 인식하고 반응합니다\n\n', options: { fontSize: 14, color: colors.text } },
  { text: '📌 예시 (재벌 학교 세계관)\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '• "나는 특별 장학생이다" → AI가 일반인으로 인식\n', options: { fontSize: 14, color: colors.text } },
  { text: '• "나는 재벌 2세다" → AI가 상류층으로 인식\n', options: { fontSize: 14, color: colors.text } },
  { text: '• "나는 전학생이다" → AI가 신입생으로 인식', options: { fontSize: 14, color: colors.text } }
], {
  x: 0.5, y: 0.9, w: 9, h: 4.5
});

// ===== 슬라이드 7: 채팅 시스템 =====
slide = ppt.addSlide();
slide.addText('3. 채팅 시스템', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 32, bold: true, color: colors.primary
});

const chatFeatures = [
  { icon: '✨', title: '자연스러운 대화', desc: 'Google Gemini AI\n문맥 이해 + 기억' },
  { icon: '🖼️', title: '이미지 시스템', desc: '키워드 기반\n자동 이미지 출력' },
  { icon: '🔄', title: '대화 재생성', desc: '여러 버전 중\n선택 가능' },
  { icon: '📝', title: '유저 노트', desc: '스토리 진행\n직접 기록' },
  { icon: '🧠', title: '메모리 시스템', desc: 'AI 자동 기억\n(추가 예정)' },
  { icon: '📊', title: '상태 시스템', desc: '호감도, 시간대\n실시간 표시' }
];

chatFeatures.forEach((feature, idx) => {
  const row = Math.floor(idx / 3);
  const col = idx % 3;
  slide.addText([
    { text: feature.icon + '\n', options: { fontSize: 28 } },
    { text: feature.title + '\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
    { text: feature.desc, options: { fontSize: 11, color: colors.text } }
  ], {
    x: 0.5 + col * 3.3, y: 1 + row * 2.2, w: 3, h: 2,
    align: 'center', valign: 'middle'
  });
});

// ===== 슬라이드 8: 창작자 여정 =====
slide = ppt.addSlide();
slide.addText('창작자의 여정 (누구나 가능!)', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addText([
  { text: '✅ 필요한 것: 상상력 + 인터넷 브라우저\n', options: { fontSize: 14, bold: true, color: colors.accent } },
  { text: '❌ 불필요: 코딩 지식, 디자인 능력\n\n', options: { fontSize: 14, bold: true, color: colors.accent } },
  { text: '📝 제작 과정\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '1️⃣ 세계관 기본 설정 (타이틀, 장르, 배경)\n', options: { fontSize: 13, color: colors.text } },
  { text: '2️⃣ 등장인물 설정 (이름, 외모, 성격, 관계)\n', options: { fontSize: 13, color: colors.text } },
  { text: '3️⃣ 이미지 업로드 + 키워드 설정\n', options: { fontSize: 13, color: colors.text } },
  { text: '4️⃣ AI 지시 설정 (시스템 프롬프트)\n', options: { fontSize: 13, color: colors.text } },
  { text: '5️⃣ 로어북 작성 (선택)\n', options: { fontSize: 13, color: colors.text } },
  { text: '6️⃣ 테스트 플레이 → 공개\n', options: { fontSize: 13, color: colors.text } },
  { text: '7️⃣ 사용자들이 플레이 → 인기 세계관 성장 💰', options: { fontSize: 13, color: colors.text } }
], {
  x: 0.5, y: 0.9, w: 9, h: 4.5
});

// ===== 슬라이드 9: 수익 모델 =====
slide = ppt.addSlide();
slide.addText('수익 모델', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 36, bold: true, color: colors.primary
});

const revenueModels = [
  { num: '1', title: '포인트 판매', subtitle: '(주 수익원)', desc: '• 더 많은 대화 시 구매\n• 무료/유료 포인트 혼합\n• 무료 포인트 우선 소비' },
  { num: '2', title: '세계관 마켓', subtitle: '(미래 계획)', desc: '• 인기 창작자 유료 판매\n• 플랫폼 수수료 30%\n• 창작자 수익 배분' },
  { num: '3', title: '광고', subtitle: '(보조 수익)', desc: '• 무료 사용자 대상\n• 게임/웹툰 등\n• 관련 콘텐츠 광고' }
];

revenueModels.forEach((model, idx) => {
  slide.addText([
    { text: model.num + '. ', options: { fontSize: 20, bold: true, color: colors.primary } },
    { text: model.title + ' ', options: { fontSize: 18, bold: true, color: colors.secondary } },
    { text: model.subtitle + '\n\n', options: { fontSize: 12, color: colors.accent, italic: true } },
    { text: model.desc, options: { fontSize: 13, color: colors.text } }
  ], {
    x: 0.5 + idx * 3.3, y: 1.2, w: 3, h: 3,
    valign: 'top'
  });
});

// ===== 슬라이드 10: 시장 기회 =====
slide = ppt.addSlide();
slide.addText('시장 기회 - 왜 지금인가?', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addText([
  { text: '1. 🤖 AI 붐\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '• ChatGPT 이후 대중의 관심 폭발\n• AI 챗봇 시장 연평균 30% 성장\n\n', options: { fontSize: 13, color: colors.text } },
  { text: '2. 🎨 창작자 경제 폭발\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '• 유튜브, 틱톡 등 "누구나 크리에이터" 시대\n• 코딩 없이 AI 콘텐츠 제작 가능\n• 웹툰/웹소설 시장과 시너지\n\n', options: { fontSize: 13, color: colors.text } },
  { text: '3. 🎮 UGC 트렌드\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '• 로블록스, 마인크래프트처럼 사용자가 콘텐츠 제작\n• 플랫폼은 도구만 제공, 자동 확장 생태계', options: { fontSize: 13, color: colors.text } }
], {
  x: 0.5, y: 0.9, w: 9, h: 4.5
});

// ===== 슬라이드 11: 성장 전략 =====
slide = ppt.addSlide();
slide.addText('4단계 성장 로드맵', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 32, bold: true, color: colors.primary
});

const roadmap = [
  { phase: '1단계', period: '현재~3개월', goal: '1,000명', key: '기반 구축 (일본)' },
  { phase: '2단계', period: '6개월', goal: '1만 명', key: 'PMF 달성 (일본)' },
  { phase: '3단계', period: '1년', goal: '10만 명', key: '성장 가속 (일본)' },
  { phase: '4단계', period: '2년', goal: '50~100만', key: '글로벌 확장' }
];

roadmap.forEach((stage, idx) => {
  const y = 1 + idx * 1;
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5, y: y, w: 9, h: 0.8,
    fill: { color: idx === 0 ? colors.accent : colors.light },
    line: { color: colors.primary, width: 1 }
  });
  
  slide.addText([
    { text: stage.phase + ' ', options: { fontSize: 16, bold: true, color: idx === 0 ? colors.white : colors.primary } },
    { text: '(' + stage.period + ') ', options: { fontSize: 13, color: idx === 0 ? colors.white : colors.text, italic: true } },
    { text: '🎯 ' + stage.goal + ' ', options: { fontSize: 14, bold: true, color: idx === 0 ? colors.white : colors.accent } },
    { text: '| ' + stage.key, options: { fontSize: 13, color: idx === 0 ? colors.white : colors.text } }
  ], {
    x: 0.7, y: y + 0.15, w: 8.6, h: 0.5
  });
});

// ===== 슬라이드 12: 투자 포인트 =====
slide = ppt.addSlide();
slide.addText('💼 투자자 여러분께', {
  x: 0.5, y: 0.3, w: 9, h: 0.5,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addText([
  { text: '📈 성장하는 시장\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: 'AI 챗봇 시장 연평균 30% 성장 예상\n\n', options: { fontSize: 13, color: colors.text } },
  { text: '🎯 명확한 수익 모델\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '포인트 판매 + 마켓플레이스\n\n', options: { fontSize: 13, color: colors.text } },
  { text: '🚀 확장성\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: 'UGC 모델로 무한한 콘텐츠 자동 생산\n\n', options: { fontSize: 13, color: colors.text } },
  { text: '💡 현실적 목표\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '일본 1,000명 → 1만 → 10만 → 글로벌\n\n', options: { fontSize: 13, color: colors.text } },
  { text: '🌏 시장 전략\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '일본 → 한국 → 동남아 순차 진출', options: { fontSize: 13, color: colors.text } }
], {
  x: 0.5, y: 0.9, w: 4.2, h: 4.5
});

slide.addText([
  { text: '👥 경험 있는 팀\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '최신 기술 스택과\nAI 전문성\n\n', options: { fontSize: 13, color: colors.text } },
  { text: '🎨 UGC 모델\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '사용자가 무한 콘텐츠\n생산하는 생태계\n\n', options: { fontSize: 13, color: colors.text } },
  { text: '🔧 기술적 강점\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '• Google Gemini AI\n• 벡터 DB 메모리\n• 확장 가능한 구조', options: { fontSize: 12, color: colors.text } }
], {
  x: 5.2, y: 0.9, w: 4.3, h: 4.5
});

// ===== 슬라이드 13: 마무리 =====
slide = ppt.addSlide();
slide.background = { color: colors.primary };
slide.addText('나모스 챗의 비전', {
  x: 0.5, y: 1.5, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.white, align: 'center'
});
slide.addText('"모든 사람이 자신만의 AI 친구와\n대화하는 세상"', {
  x: 0.5, y: 2.5, w: 9, h: 1,
  fontSize: 28, color: colors.light, align: 'center', italic: true
});
slide.addText('새로운 형태의 디지털 관계와 창작 경제를\n만들어가고 있습니다', {
  x: 0.5, y: 3.8, w: 9, h: 0.6,
  fontSize: 18, color: colors.light, align: 'center'
});

// PPT 저장
const outputPath = join(projectRoot, '나모스챗_서비스설명서_한국어.pptx');
await ppt.writeFile({ fileName: outputPath });

console.log('✅ 한국어 PPT 생성 완료!');
console.log(`📄 파일 위치: ${outputPath}`);







