// 작은 글씨가 얹히는 면(배지·태그)은 대비 보강값을 쓴다.
// SK Red(#EA1738) + 흰 글씨 = 4.49:1 로 WCAG AA(4.5) 를 간신히 미달한다.
// 큰 글씨(CTA, 45px bold)는 3:1 기준이라 통과하지만, 18px 배지는 통과하지 못한다.
// 가이드가 Red Deep(#D9002B, 5.27:1)을 "작은 글씨 대비 보강"으로 정의해 둔 이유가 이것이다.
export const smallOnRed = c => (c === '#EA1738' ? '#D9002B' : c);

// 리파인 배너 스타일 3종 = 레퍼런스 기반 고정 패턴 테마.
export const STYLES = {
  'refine-basic': {
    name: '리파인 기본형', hint: '레퍼런스 기본 카드 구성 · 단품과 종합 공용', recommended: true,
    allow: ['S2', 'C2', 'C3', 'C4', 'C6', 'C12'],
    bg: '#FFFFFF', bgGradient: null, imgBg: '#F7F7F7',
    ink: '#202020', sub: '#6D6D6D', faint: '#9B9B9B', line: '#DEDEDE',
    accent: '#D94E12', ctaBg: '#D94E12', ctaInk: '#FFFFFF',
    priceInk: '#FF641F', badgeBg: '#B6400B', badgeInk: '#FFFFFF',
    headWeight: 700, headFace: 'kr', band: false, logoPlate: false,
  },
  'refine-price': {
    name: '리파인 가격 강조', hint: '할인 가격을 가장 크게 보여주는 구성',
    allow: ['S2', 'C2', 'C3', 'C4', 'C6', 'C12'],
    bg: '#FFFFFF', bgGradient: null, imgBg: '#F7F7F7',
    ink: '#202020', sub: '#6D6D6D', faint: '#9B9B9B', line: '#DEDEDE',
    accent: '#D94E12', ctaBg: '#D94E12', ctaInk: '#FFFFFF',
    priceInk: '#FF641F', priceHero: true, badgeBg: '#B6400B', badgeInk: '#FFFFFF', noticeStrong: true,
    headWeight: 700, headFace: 'kr', band: false, logoPlate: false,
  },
  'refine-benefit': {
    name: '리파인 혜택 강조', hint: '면제·할인 혜택과 묶음 구성을 함께 보여주는 구성',
    allow: ['S2', 'C2', 'C3', 'C4', 'C6', 'C12'],
    bg: '#FFF8F3', bgGradient: null, imgBg: '#FFFFFF',
    ink: '#202020', sub: '#6D6D6D', faint: '#9B9B9B', line: '#E9DCD2',
    accent: '#D94E12', ctaBg: '#D94E12', ctaInk: '#FFFFFF',
    priceInk: '#FF641F', badgeBg: '#B6400B', badgeInk: '#FFFFFF',
    headWeight: 700, headFace: 'kr', band: false, chips: true, logoPlate: false,
  },
};
