// 배너 패턴은 사용자가 제공한 `03_종합배너3종_콘텐츠보강` 시안만 기준으로 한다.
// 종합형은 제품 수에 따라 같은 시안의 카드/목록 영역만 확장한다.

const S2 = () => ({
  headline: [0, 0, 1, 0.19], subline: [0, 0.20, 1, 0.09],
  products: [[0.14, 0.31, 0.72, 0.44]], cta: [0, 0.78, 0.70, 0.11],
  brand: [0.73, 0.78, 0.27, 0.11],
});

const composite = (variant, name) => ({
  kind: 'refine-composite', n: [2, 12], variant, name,
  // 종합형은 픽셀 슬롯 조합이 아닌 레퍼런스 카드 구조로 렌더한다.
  build: () => ({}),
});

export const PATTERNS = {
  S2: { kind: 'single', n: [1, 1], build: S2, name: '리파인 단품 기본형' },
  RCB: composite('basic', '콘텐츠보강 기본형'),
  RCPA: composite('price-a', '콘텐츠보강 가격 강조 A'),
  RCPB: composite('price-b', '콘텐츠보강 가격 강조 B'),
  RCHA: composite('benefit-a', '콘텐츠보강 혜택 강조 A'),
  RCHB: composite('benefit-b', '콘텐츠보강 혜택 강조 B'),
  RCPR: composite('premium', '콘텐츠보강 프리미엄형'),
  RCI: composite('ice', '콘텐츠보강 아이스 캠페인형'),
};
