// 서버·CLI 공용 파이프라인 — 문구 생성 → 패턴 결정 → 렌더 → QA
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIZES } from './layout/spec.mjs';
import { STYLES, smallOnRed } from './layout/styles.mjs';
import { candidates, rank } from './layout/decide.mjs';
import { generate, validate } from './llm/copy.mjs';
import { advise } from './llm/layout.mjs';
import { notice as buildNotice } from './llm/compliance.mjs';
import { shoot } from './render/shoot.mjs';
import { gate, contrast } from './qa/gate.mjs';

export const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export function contrastPairs(styleId, size) {
  const s = STYLES[styleId], S = Math.min(size.w, size.h), pairs = [];
  const large = (px, bold) => px >= 24 || (bold && px >= 18.66);
  const push = (label, fg, bg, px, bold) => {
    if (!fg || !bg || fg === 'transparent') return;
    pairs.push({ label, ratio: contrast(fg, bg), large: large(px, bold) });
  };
  push('제목', s.band ? s.bandInk : s.ink, s.band ? (s.bandBg || '#151515') : s.bg, S * .075, true);
  push('본문', s.sub, s.bg, S * .032, false);
  push('CTA', s.ctaInk, s.ctaBg === 'transparent' ? s.bg : s.ctaBg, S * .042, true);
  push('가격 배지', s.badgeInk, smallOnRed(s.badgeBg), S * .024, true);
  push('제품 라벨', s.sub, s.imgBg, S * .024, false);
  push('고지문', s.sub, s.bg, Math.max(14, S * .017), false);
  return pairs;
}

/** 규격별 문구 3안 — 서버측 재검사를 통과한 것만 돌려준다 */
export async function makeCopy({ products, target, tone, season, sizeKey }) {
  const size = SIZES[sizeKey];
  const gen = await generate({ products, target, tone, season, limits: size.limits });
  const usable = [], rejected = [];
  for (const c of gen.candidates) {
    const v = validate(c, size.limits, products);
    (v.ok ? usable : rejected).push(v.ok ? c : { angle: c.angle, errs: v.errs });
  }
  return { source: gen.source, usable, rejected };
}

/** 한 스타일을 렌더하고 QA 한다. 실패하면 문구·패턴을 되돌려 재시도한다. */
export async function renderStyle({ products, usable, styleId, sizeKey, consultant, season, outDir, hasIce }) {
  const size = SIZES[sizeKey];
  const cand = candidates({ styleId, sizeKey, n: products.length, hasIce });
  if (!cand.ok) return { styleId, name: STYLES[styleId].name, pass: false, excluded: true, reason: cand.reason };

  const ranked = rank(cand.list, size);
  let advice = { pick: ranked[0].key, source: 'rule', reason: '규칙 엔진 1순위' };
  if (ranked.length > 1) {
    advice = await advise({ candidates: ranked, size, products, copy: usable[0] });
    const i = ranked.findIndex(c => c.key === advice.pick);
    if (i > 0) { const [c] = ranked.splice(i, 1); ranked.unshift(c); }
  }

  const code = (products.length > 1 ? `CMP-${products.length}P` : `SGL-${products[0].model}`) + `-${size.id}-${styleId}`;
  const outPath = path.join(outDir, code + '.png');
  let copyIdx = 0, patIdx = 0, last = null, tries = 0;

  while (patIdx < Math.min(5, ranked.length) && copyIdx < Math.min(3, usable.length)) {
    const pat = ranked[patIdx], copy = usable[copyIdx];
    const r = await shoot({ products, copy, styleId, sizeKey, patternKey: pat.key, consultant, season, outPath });
    const q = gate({ report: r.report, bytes: r.bytes, noticeText: buildNotice(products),
                     contrastPairs: contrastPairs(styleId, size),
                     // 템플릿이 조건부 가격을 표시하는 조건과 동일하게 판정한다 (D-33)
                     conditionalPriceShown: products.every(x => x.promoPrice != null && x.promoTerms) });
    last = { pat, copy, r, q }; tries++;
    if (q.pass) break;
    // 사진이 안 뜬 건 문구나 패턴을 바꿔도 그대로다. 재시도로 시간 쓰지 않고 즉시 멈춘다.
    if (q.route === 'asset') break;
    if (q.route === 'copy' && copyIdx + 1 < usable.length) copyIdx++;
    else if (patIdx + 1 < ranked.length) patIdx++;
    else break;
  }

  const { pat, copy, r, q } = last;
  return {
    styleId, name: STYLES[styleId].name, hint: STYLES[styleId].hint,
    pass: q.pass, pattern: pat.key, patternName: pat.name, advice,
    retries: tries - 1, kb: Math.round(r.bytes / 1024),
    file: code + '.png', w: size.w, h: size.h, sizeKey, sizeLabel: size.label,
    copy: { headline: copy.headline, subline: copy.subline, cta: copy.cta, badge: copy.badge },
    checks: q.checks, failed: q.failed, route: q.route,
    collides: r.report.log.filter(l => l.step === 'collide' && l.iou).length,
    scrims: r.report.log.filter(l => l.step === 'scrim').length,
  };
}

/** 동반 인사말 — 이미지를 못 보는 고객도 문자만으로 판단할 수 있어야 한다 */
export function greeting({ products, copy, priceShown }) {
  const names = products.map(p => p.name).join(' · ');
  const sum = products.reduce((a, p) => a + (p.sale || 0), 0);
  const money = priceShown && sum ? `묶음 기준 월 ${sum.toLocaleString('ko-KR')}원부터이고, ` : '';
  return `${copy.headline}\n\n${names}\n${copy.subline}\n\n${money}설치 일정까지 한 번에 잡아드릴 수 있습니다. `
       + `편한 시간 알려주시면 짧게 통화로 안내드릴게요.\n\n※ ${buildNotice(products)}`;
}
