// 사용자가 등록한 디자인 리파인 시안만 렌더한다. 기존 S*/C* 패턴은 사용하지 않는다.
const pattern = (kind, variant, name, n) => ({ kind, variant, name, n, build: () => ({}) });

export const PATTERNS = {
  RSB:  pattern('refine-single', 'basic',     '단품 콘텐츠보강 기본형', [1, 1]),
  RSPA: pattern('refine-single', 'price-a',   '단품 콘텐츠보강 가격 강조 A', [1, 1]),
  RSPB: pattern('refine-single', 'price-b',   '단품 콘텐츠보강 가격 강조 B', [1, 1]),
  RSHA: pattern('refine-single', 'benefit-a', '단품 콘텐츠보강 혜택 강조 A', [1, 1]),
  RSHB: pattern('refine-single', 'benefit-b', '단품 콘텐츠보강 혜택 강조 B', [1, 1]),
  RSPR: pattern('refine-single', 'premium',   '단품 콘텐츠보강 프리미엄형', [1, 1]),
  RSI:  pattern('refine-single', 'ice',       '단품 콘텐츠보강 아이스 캠페인형', [1, 1]),
  RCB:  pattern('refine-composite', 'basic',     '종합 콘텐츠보강 기본형', [2, 12]),
  RCPA: pattern('refine-composite', 'price-a',   '종합 콘텐츠보강 가격 강조 A', [2, 12]),
  RCPB: pattern('refine-composite', 'price-b',   '종합 콘텐츠보강 가격 강조 B', [2, 12]),
  RCHA: pattern('refine-composite', 'benefit-a', '종합 콘텐츠보강 혜택 강조 A', [2, 12]),
  RCHB: pattern('refine-composite', 'benefit-b', '종합 콘텐츠보강 혜택 강조 B', [2, 12]),
  RCPR: pattern('refine-composite', 'premium',   '종합 콘텐츠보강 프리미엄형', [2, 12]),
  RCI:  pattern('refine-composite', 'ice',       '종합 콘텐츠보강 아이스 캠페인형', [2, 12]),
};
