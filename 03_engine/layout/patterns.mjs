// 슬롯 좌표는 세이프 영역 기준 0~1 정규화로 "한 번만" 정의한다.
// 같은 정의가 4규격 전부에 쓰인다. (DECISIONS D-03)
// rect = [x, y, w, h]

const grid = (n, cols, x, y, w, h, gap = 0.03) => {
  const rows = Math.ceil(n / cols);
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (h - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    return [x + c * (cw + gap), y + r * (ch + gap), cw, ch];
  });
};

/* ── 단품 S1~S4 ─────────────────────────────────────────── */
const S1 = () => ({                       // hero-right / text-left
  headline: [0, 0, 0.52, 0.30],
  subline:  [0, 0.32, 0.52, 0.12],
  cta:      [0, 0.70, 0.52, 0.14],
  brand:    [0, 0.86, 0.52, 0.12],
  products: [[0.56, 0.02, 0.44, 0.84]],
});
const S4 = () => {                        // S1 미러
  const s = S1();
  const mir = r => [1 - r[0] - r[2], r[1], r[2], r[3]];
  return { headline: mir(s.headline), subline: mir(s.subline), cta: mir(s.cta),
           brand: mir(s.brand), products: s.products.map(mir) };
};
const S2 = () => ({                       // text-top / hero-bottom
  headline: [0, 0, 1, 0.19],
  subline:  [0, 0.20, 1, 0.09],
  products: [[0.14, 0.31, 0.72, 0.44]],
  cta:      [0, 0.78, 0.70, 0.11],
  brand:    [0.73, 0.78, 0.27, 0.11],
});
const S3 = () => ({                       // hero-center / band-overlay
  products: [[0.05, 0.16, 0.90, 0.50]],
  headline: [0, 0, 1, 0.14], band: 'headline',
  subline:  [0, 0.69, 1, 0.08],
  cta:      [0, 0.78, 0.60, 0.12],
  brand:    [0.63, 0.78, 0.37, 0.12],
});

/* ── 종합 C2~C12 ────────────────────────────────────────── */
const C2 = () => ({
  headline: [0, 0, 1, 0.17],
  products: [[0, 0.20, 0.485, 0.50], [0.515, 0.20, 0.485, 0.50]],
  subline:  [0, 0.72, 1, 0.07],
  cta:      [0, 0.80, 0.60, 0.12],
  brand:    [0.63, 0.80, 0.37, 0.12],
});
const C3 = () => ({                       // hero + 2 스택
  headline: [0, 0, 1, 0.17],
  products: [[0, 0.20, 0.60, 0.50], [0.63, 0.20, 0.37, 0.235], [0.63, 0.465, 0.37, 0.235]],
  subline:  [0, 0.72, 1, 0.07],
  cta:      [0, 0.80, 0.60, 0.12],
  brand:    [0.63, 0.80, 0.37, 0.12],
});
const C4 = () => ({
  headline: [0, 0, 1, 0.15],
  products: grid(4, 2, 0, 0.18, 1, 0.54),
  subline:  [0, 0.74, 1, 0.07],
  cta:      [0, 0.83, 1, 0.11],
});
const C6 = n => ({
  headline: [0, 0, 1, 0.13],
  products: [[0, 0.15, 1, 0.26], ...grid(n - 1, 3, 0, 0.43, 1, 0.30)],
  subline:  [0, 0.75, 1, 0.06],
  cta:      [0, 0.83, 1, 0.11],
});
const C12 = n => ({                       // 행 단위 리스트 — 겹침이 원리적으로 불가
  headline: [0, 0, 1, 0.11],
  rows: Array.from({ length: n }, (_, i) => {
    const rh = 0.62 / n, y = 0.14 + i * rh;
    return { thumb: [0, y, 0.16, rh * 0.86], text: [0.19, y, 0.52, rh * 0.86], price: [0.73, y, 0.27, rh * 0.86] };
  }),
  total: [0, 0.78, 1, 0.07],
  cta:   [0, 0.87, 1, 0.11],
});

export const PATTERNS = {
  S1: { kind: 'single', n: [1, 1], build: S1,  name: 'hero-right / text-left' },
  S2: { kind: 'single', n: [1, 1], build: S2,  name: 'text-top / hero-bottom' },
  S3: { kind: 'single', n: [1, 1], build: S3,  name: 'hero-center / band-overlay' },
  S4: { kind: 'single', n: [1, 1], build: S4,  name: 'hero-left / text-right' },
  C2: { kind: 'composite', n: [2, 2],  build: C2,  name: 'duo-split' },
  C3: { kind: 'composite', n: [3, 3],  build: C3,  name: 'hero + 2' },
  C4: { kind: 'composite', n: [4, 4],  build: C4,  name: 'grid 2x2' },
  C6: { kind: 'composite', n: [5, 6],  build: C6,  name: 'hero + grid' },
  C12:{ kind: 'composite', n: [4, 12], build: C12, name: 'list-rows' },
};
