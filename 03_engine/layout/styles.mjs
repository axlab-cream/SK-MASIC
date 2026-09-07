// 작은 글씨가 얹히는 면(배지·태그)은 대비 보강값을 쓴다.
// SK Red(#EA1738) + 흰 글씨 = 4.49:1 로 WCAG AA(4.5) 를 간신히 미달한다.
// 큰 글씨(CTA, 45px bold)는 3:1 기준이라 통과하지만, 18px 배지는 통과하지 못한다.
// 가이드가 Red Deep(#D9002B, 5.27:1)을 "작은 글씨 대비 보강"으로 정의해 둔 이유가 이것이다.
export const smallOnRed = c => (c === '#EA1738' ? '#D9002B' : c);

// 배너 스타일 6종 = 컬러 테마 × 타이포 × 허용 패턴 (DECISIONS D-14)
// 값은 SK magic UI Guide 관찰 토큰. 레드 면적 5% 이내 (D-12)
export const STYLES = {
  'neutral-white': {
    name: '뉴트럴 화이트', hint: '어디에 보내도 무난 · 기본값', recommended: true,
    allow: ['S1', 'S2', 'S4', 'C2', 'C3', 'C4', 'C6'],
    bg: '#FFFFFF', bgGradient: null, imgBg: '#F6F6F6',
    ink: '#222222', sub: '#666666', faint: '#8A8A8A', line: '#E5E5E5',
    accent: '#EA1738', ctaBg: '#EA1738', ctaInk: '#FFFFFF',
    priceInk: '#222222', badgeBg: '#EA1738', badgeInk: '#FFFFFF',
    headWeight: 700, headFace: 'kr', band: false, logoPlate: false,
  },
  'benefit-yellow': {
    name: '혜택 강조', hint: '할인·면제를 크게 · 이벤트용',
    allow: ['S2', 'S3', 'C2', 'C3', 'C4', 'C6'],
    bg: '#FFFFFF', bgGradient: null, imgBg: '#F6F6F6',
    ink: '#222222', sub: '#666666', faint: '#8A8A8A', line: '#E5E5E5',
    accent: '#EA1738', ctaBg: '#EA1738', ctaInk: '#FFFFFF',
    priceInk: '#222222', badgeBg: '#EBFF00', badgeInk: '#151515',
    headWeight: 700, headFace: 'kr',
    band: true, bandBg: '#151515', bandInk: '#FFFFFF', bandTag: '#EBFF00', bandTagInk: '#151515',
    chips: true, logoPlate: false,
  },
  'price-focus': {
    name: '가격 강조', hint: '월 얼마인지 먼저 궁금한 고객', noticeStrong: true,
    allow: ['S1', 'S2', 'C2', 'C3', 'C4', 'C6'],
    bg: '#FFFFFF', bgGradient: null, imgBg: '#F6F6F6',
    ink: '#222222', sub: '#666666', faint: '#8A8A8A', line: '#E5E5E5',
    accent: '#EA1738', ctaBg: '#151515', ctaInk: '#FFFFFF',
    priceInk: '#EA1738', priceHero: true, badgeBg: '#151515', badgeInk: '#FFFFFF',
    headWeight: 700, headFace: 'kr', band: false, logoPlate: false,
  },
  'premium-black': {
    name: '프리미엄 블랙', hint: '고가 제품 · 매트리스 · 얼음정수기',
    allow: ['S1', 'S3', 'S4', 'C2', 'C3'],
    bg: '#151515', bgGradient: 'linear-gradient(160deg,#1E1E1E 0%,#151515 55%,#0E0E0E 100%)',
    imgBg: '#242424',
    ink: '#FFFFFF', sub: '#A6A6A6', faint: '#7A7A7A', line: '#333333',
    accent: '#BFEAFF', ctaBg: 'transparent', ctaInk: '#FFFFFF', ctaBorder: '#FFFFFF',
    priceInk: '#FFFFFF', badgeBg: '#BFEAFF', badgeInk: '#151515',
    headWeight: 500, headFace: 'kr', band: false, logoPlate: true, dark: true,
  },
  'ice-campaign': {
    name: '아이스 캠페인', hint: '얼음정수기 대표 제품일 때만', requiresIce: true,
    allow: ['S2', 'S3', 'C2', 'C3'],
    bg: '#FFFFFF', bgGradient: null, imgBg: '#F6F6F6',
    ink: '#222222', sub: '#666666', faint: '#8A8A8A', line: '#E5E5E5',
    accent: '#EA1738', ctaBg: '#EA1738', ctaInk: '#FFFFFF',
    priceInk: '#222222', badgeBg: '#EA1738', badgeInk: '#FFFFFF',
    headWeight: 700, headFace: 'kr',
    band: true, bandBg: '#BFEAFF', bandGradient: 'linear-gradient(135deg,#DCF3FF 0%,#BFEAFF 60%,#A5DEFA 100%)',
    bandInk: '#151515', bandTag: 'transparent', bandTagInk: '#1C5570',
    logoPlate: false,
  },
  'card-list': {
    name: '카드 리스트', hint: '제품 4개 이상 · 스펙까지 보여줄 때',
    allow: ['C12'],
    bg: '#FFFFFF', bgGradient: null, imgBg: '#F6F6F6',
    ink: '#222222', sub: '#666666', faint: '#8A8A8A', line: '#E5E5E5',
    accent: '#EA1738', ctaBg: '#EA1738', ctaInk: '#FFFFFF',
    priceInk: '#222222', badgeBg: '#EA1738', badgeInk: '#FFFFFF',
    headWeight: 700, headFace: 'kr', band: false, rowList: true, logoPlate: false,
  },
};
