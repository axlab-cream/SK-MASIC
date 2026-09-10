import { PATTERNS } from './patterns.mjs';
import { STYLES } from './styles.mjs';
import { SIZES } from './spec.mjs';

// 제품 수 × 규격 × 스타일 → 허용 패턴 교집합 (DECISIONS D-17: 후보 1개면 LLM 생략)
export function candidates({ styleId, sizeKey, n, hasIce }) {
  const st = STYLES[styleId];
  const size = SIZES[sizeKey];
  if (!st || !size) return { ok: false, reason: 'unknown style or size' };
  // sizeFixable: 규격을 격상하면 풀릴 수 있는 제외인지. 아니면 격상 재시도가 무의미하다.
  if (st.requiresIce && !hasIce)
    return { ok: false, reason: 'ice 캠페인은 얼음정수기 대표 제품 전용', sizeFixable: false };
  if (n > size.maxProducts)
    return { ok: false, reason: `${size.label}는 최대 ${size.maxProducts}종`, sizeFixable: true };

  const list = st.allow
    .filter(k => PATTERNS[k] && n >= PATTERNS[k].n[0] && n <= PATTERNS[k].n[1])
    .map(k => ({ key: k, ...PATTERNS[k] }));

  // 패턴의 제품 수 범위는 규격과 무관하다 — 격상해도 풀리지 않는다
  if (!list.length) return { ok: false, reason: `제품 ${n}종에 맞는 패턴이 이 스타일에 없음`, sizeFixable: false };
  return { ok: true, list, needsLLM: list.length > 1 };
}

// 규칙 엔진 1순위 — 세로형은 위→아래, 가로형은 좌→우 흐름을 선호
export function rank(list, size) {
  const ratio = size.w / size.h;
  const pref = ratio >= 1.2 ? ['RSB', 'RSPA', 'RSPB', 'RSHA', 'RSHB', 'RSPR', 'RSI', 'RCB', 'RCPA', 'RCPB', 'RCHA', 'RCHB', 'RCPR', 'RCI']
    : ratio <= 0.85 ? ['RSHA', 'RSHB', 'RSB', 'RSPA', 'RSPB', 'RSPR', 'RSI', 'RCHA', 'RCHB', 'RCB', 'RCPA', 'RCPB', 'RCPR', 'RCI']
    : ['RSB', 'RSPA', 'RSPB', 'RSHA', 'RSHB', 'RSPR', 'RSI', 'RCB', 'RCPA', 'RCPB', 'RCHA', 'RCHB', 'RCPR', 'RCI'];
  return [...list].sort((a, b) => {
    const ia = pref.indexOf(a.key), ib = pref.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}
