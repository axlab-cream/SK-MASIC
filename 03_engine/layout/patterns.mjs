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

/* ── 단품 S2: 리파인 기준 패턴 ───────────────────────────── */
const S2 = () => ({                       // text-top / hero-bottom
  headline: [0, 0, 1, 0.19],
  subline:  [0, 0.20, 1, 0.09],
  products: [[0.14, 0.31, 0.72, 0.44]],
  cta:      [0, 0.78, 0.70, 0.11],
  brand:    [0.73, 0.78, 0.27, 0.11],
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
  S2: { kind: 'single', n: [1, 1], build: S2,  name: 'text-top / hero-bottom' },
  C2: { kind: 'composite', n: [2, 2],  build: C2,  name: 'duo-split' },
  C3: { kind: 'composite', n: [3, 3],  build: C3,  name: 'hero + 2' },
  C4: { kind: 'composite', n: [4, 4],  build: C4,  name: 'grid 2x2' },
  C6: { kind: 'composite', n: [5, 6],  build: C6,  name: 'hero + grid' },
  C12:{ kind: 'composite', n: [4, 12], build: C12, name: 'list-rows' },
};
