// 엑셀/CSV 오버라이드 병합 (DECISIONS D-02)
// 가격은 크롤로 확정하지 않는다. 사람이 확인한 값이 여기로 들어와 덮어쓴다.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const NUM = s => { const n = Number(String(s).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : null; };

// 쉼표 안의 인용부호를 존중하는 최소 CSV 파서
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim()));
}

const FIELDS = {
  base: 'base', 기준가: 'base', 구독료: 'base',
  sale: 'sale', 할인가: 'sale',
  partner: 'partner', 제휴혜택가: 'partner',
  term: 'term', 약정: 'term',
  promo: 'promo', 프로모션: 'promo', 배지: 'promo',
  feature: 'feature', 기능: 'feature',
  care: 'care', 관리: 'care', 관리방식: 'care',
  color: 'color', 색상: 'color',
  name: 'name', 제품명: 'name',
};

/** CSV → { key(model 또는 goodsId) : patch } */
export async function loadOverride(file) {
  if (!file || !existsSync(file)) return {};
  const rows = parseCsv(await readFile(file, 'utf8'));
  if (rows.length < 2) return {};
  const head = rows[0].map(h => h.trim().replace(/\s/g, ''));
  const keyIdx = head.findIndex(h => /^(model|모델|모델명|모델코드|goodsid|상품id)$/i.test(h));
  if (keyIdx < 0) throw new Error('오버라이드 CSV 에 model 또는 goodsId 열이 필요합니다');
  const out = {};
  for (const r of rows.slice(1)) {
    const key = (r[keyIdx] || '').trim();
    if (!key) continue;
    const patch = {};
    head.forEach((h, i) => {
      if (i === keyIdx) return;
      const f = FIELDS[h] || FIELDS[h.toLowerCase()];
      const raw = (r[i] ?? '').trim();
      if (!f || raw === '') return;
      patch[f] = ['base', 'sale', 'partner', 'term'].includes(f) ? NUM(raw)
        : f === 'promo' ? raw.split(/[|;/]/).map(s => s.trim()).filter(Boolean).slice(0, 3)
        : raw;
    });
    if (Object.keys(patch).length) out[key] = patch;
  }
  return out;
}

/** 상품에 패치 적용 — 적용된 필드를 기록해 추적 가능하게 한다 */
export function applyOverride(p, table) {
  const patch = table[p.model] || table[p.goodsId];
  if (!patch) return { product: p, applied: [] };
  const next = { ...p, ...patch };
  if (patch.base != null || patch.sale != null) next.needsPriceConfirm = false;
  return { product: next, applied: Object.keys(patch) };
}
