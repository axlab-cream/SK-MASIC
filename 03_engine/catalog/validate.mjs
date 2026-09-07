// product.schema.json 의 실사용 부분집합 검증기 (외부 의존성 없음)
// required · type · enum · pattern · minimum/maximum · additionalProperties 만 다룬다.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const typeOf = v => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v === 'number'
  ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v;

function checkOne(obj, def, errs, at = '') {
  for (const k of def.required || []) {
    // null 을 허용하는 필드(type 에 "null", enum 에 null)는 null 이어도 통과시킨다.
    // 공식몰에 값이 없는 항목을 "누락"으로 버리면 실제 상품이 목록에서 사라진다.
    const spec = def.properties?.[k];
    const nullOk = spec && ((Array.isArray(spec.type) && spec.type.includes('null'))
      || (Array.isArray(spec.enum) && spec.enum.includes(null)));
    if (obj[k] === undefined || (obj[k] === null && !nullOk)) errs.push(`${at}${k}: 필수값 누락`);
  }
  if (def.additionalProperties === false) {
    for (const k of Object.keys(obj)) if (!def.properties?.[k]) errs.push(`${at}${k}: 스키마에 없는 필드`);
  }
  for (const [k, spec] of Object.entries(def.properties || {})) {
    const v = obj[k];
    if (v === undefined) continue;
    const allowed = spec.enum ? null : [].concat(spec.type ?? []);
    if (spec.enum && !spec.enum.includes(v)) errs.push(`${at}${k}: ${JSON.stringify(v)} — 허용값 ${spec.enum.join('|')}`);
    if (allowed?.length) {
      const t = typeOf(v);
      const okT = allowed.includes(t) || (allowed.includes('number') && t === 'integer');
      if (!okT) errs.push(`${at}${k}: 타입 ${t} — ${allowed.join('|')} 기대`);
    }
    if (v !== null && spec.pattern && typeof v === 'string' && !new RegExp(spec.pattern).test(v))
      errs.push(`${at}${k}: "${v}" — 패턴 ${spec.pattern} 불일치`);
    if (typeof v === 'number') {
      if (spec.minimum !== undefined && v < spec.minimum) errs.push(`${at}${k}: ${v} < ${spec.minimum}`);
      if (spec.maximum !== undefined && v > spec.maximum) errs.push(`${at}${k}: ${v} > ${spec.maximum}`);
    }
  }
  return errs;
}

export async function loadSchema(p) {
  const file = p || fileURLToPath(new URL('../../01_spec/product.schema.json', import.meta.url));
  return JSON.parse(await readFile(file, 'utf8'));
}

/** 상품 1건 검증 */
export function validateProduct(p, schema) {
  const def = schema.$defs.product;
  const errs = checkOne(p, def, []);
  return { ok: errs.length === 0, errs };
}

/** 카탈로그 전체 — 실패 항목은 제외하고 통과분만 반환한다 (HANDOFF C) */
export function validateCatalog(cat, schema) {
  const errs = [];
  if (!cat.syncedAt) errs.push('syncedAt: 필수값 누락');
  if (!Array.isArray(cat.products)) errs.push('products: 배열이어야 함');
  const kept = [], dropped = [];
  for (const p of cat.products || []) {
    const r = validateProduct(p, schema);
    (r.ok ? kept : dropped).push(r.ok ? p : { goodsId: p.goodsId, errs: r.errs });
  }
  return { topErrs: errs, kept, dropped };
}
