// 규격 · 세이프존 · 글자수 상한 — 01_spec/banner-spec.json 과 동일 값
export const SIZES = {
  W0800: { id: '0800', w: 800,  h: 600,  label: '카톡 채널 와이드',
           limits: { headline: 18, subline: 34, cta: 10, label: 14 }, maxProducts: 3 },
  S1080: { id: '1080', w: 1080, h: 1080, label: '정사각',
           limits: { headline: 20, subline: 40, cta: 10, label: 14 }, maxProducts: 4 },
  C1350: { id: '1350', w: 1080, h: 1350, label: '카톡 채팅방 세로',
           limits: { headline: 22, subline: 44, cta: 12, label: 16 }, maxProducts: 6 },
  L1920: { id: '1920', w: 1080, h: 1920, label: '긴 세로 상세',
           limits: { headline: 24, subline: 50, cta: 12, label: 16 }, maxProducts: 12 },
};

export const QA = {
  iouTextProduct: 0.02,   // 텍스트 ∩ 제품 허용 상한
  iouTextText: 0,         // 텍스트끼리는 0
  contrast: 4.5,          // WCAG AA 본문
  pngMaxKB: 500,
  contrastLarge: 3.0,     // WCAG AA 큰 글씨 (>=24px 또는 >=18.66px bold)
  largePx: 24,            // 이 크기 이상이면 큰 글씨로 본다
  exclusionPadRatio: 0.02, // 배타영역 padding = 짧은 변 × 2%
  collisionIouTrigger: 0.05,
  maxCollisionPasses: 5,
};

// 읽어야 하는 텍스트의 하한: 짧은 변의 3%, 최소 18px
// (카톡은 이미지를 압축·축소해 보여주므로 이 값보다 작으면 실기기에서 판독 불가)
export const fmin = (w, h) => Math.max(18, Math.round(Math.min(w, h) * 0.03));

// 법정 고지문 전용 하한 — 고지문은 세이프존과 최소폰트 두 규칙의 유일한 예외지만
// 자체 하한을 둬서 무한정 작아지지 않게 막는다.
export const noticeMin = (w, h) => Math.max(14, Math.round(Math.min(w, h) * 0.014));

// 세이프존: 좌우상 6%, 하단은 고지문 높이 + 8
export function safeZone(w, h, noticeH) {
  const m = Math.round(Math.min(w, h) * 0.06);
  return { top: m, left: m, right: m, bottom: m + noticeH + 8 };
}

// 정규화(0~1, 세이프 영역 기준) → 픽셀
export function toPx(rect, w, h, sz) {
  const iw = w - sz.left - sz.right;
  const ih = h - sz.top - sz.bottom;
  return {
    x: Math.round(sz.left + rect[0] * iw),
    y: Math.round(sz.top + rect[1] * ih),
    w: Math.round(rect[2] * iw),
    h: Math.round(rect[3] * ih),
  };
}
