#!/usr/bin/env node
// PoC 엔진 엔트리 — 카탈로그 → 문구 → 스타일×규격 → 렌더 → QA → 산출
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIZES } from './layout/spec.mjs';
import { STYLES, smallOnRed } from './layout/styles.mjs';
import { candidates, rank } from './layout/decide.mjs';
import { generate, validate, fallback } from './llm/copy.mjs';
import { advise } from './llm/layout.mjs';
import { notice as buildNotice } from './llm/compliance.mjs';
import { shoot, closeBrowser } from './render/shoot.mjs';
import { gate, contrast } from './qa/gate.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);

const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
// 최소 3개 보장 실패 시 격상 순서 (P3-08). 좁은 규격에서 넓은 규격으로.
const ESCALATE = { W0800: 'S1080', S1080: 'C1350', C1350: 'L1920', L1920: null };
const daysOld = iso => (Date.now() - new Date(iso).getTime()) / 86400000;

// WCAG AA: 큰 글씨(>=24px 또는 >=18.66px bold)는 3:1, 그 외 4.5:1
function contrastPairs(styleId, size) {
  const s = STYLES[styleId];
  const S = Math.min(size.w, size.h);
  const pairs = [];
  const isLarge = (px, bold) => px >= 24 || (bold && px >= 18.66);
  const push = (label, fg, bg, px, bold) => {
    if (!fg || !bg || fg === 'transparent') return;
    pairs.push({ label, fg, bg, px: Math.round(px), bold: !!bold, large: isLarge(px, bold), ratio: contrast(fg, bg) });
  };
  push('제목(headline)', s.band ? s.bandInk : s.ink, s.band ? (s.bandBg || '#151515') : s.bg, S * 0.075, true);
  push('본문(subline)', s.sub, s.bg, S * 0.032, false);
  push('CTA', s.ctaInk, s.ctaBg === 'transparent' ? s.bg : s.ctaBg, S * 0.042, true);
  push('가격 배지', s.badgeInk, smallOnRed(s.badgeBg), S * 0.022, true);
  push('제품 라벨', s.sub, s.imgBg, S * 0.021, false);
  push('고지문', s.sub, s.bg, Math.max(14, S * 0.017), false);
  return pairs;
}

/** 한 조합(스타일 × 규격)을 만들어낸다. 실패하면 정책에 따라 되돌린다. */
async function produce({ styleId, sizeKey, size, ranked, usable, products, consultant, season, outRoot, gen, escalatedFrom }) {
  const MAX_COMPOSE = 5, MAX_COPY = 2;
  const code = (products.length > 1 ? `CMP-${products.length}P` : `SGL-${products[0].model}`) + `-${size.id}-${styleId}`;
  const outPath = path.join(outRoot, code + '.png');
  const attempts = [];
  let copyIdx = 0, patIdx = 0, last = null;

  // 후보가 2개 이상일 때만 LLM 에 최종 선택을 위임한다 (D-17)
  let advice = { pick: ranked[0].key, reason: '규칙 엔진 1순위 (후보 1개)', source: 'rule' };
  if (ranked.length > 1) {
    advice = await advise({ candidates: ranked, size, products, copy: usable[0] });
    const i = ranked.findIndex(c => c.key === advice.pick);
    if (i > 0) { const [c] = ranked.splice(i, 1); ranked.unshift(c); }
  }

  while (patIdx < Math.min(MAX_COMPOSE, ranked.length) && copyIdx < Math.min(MAX_COPY + 1, usable.length)) {
    const pat = ranked[patIdx], copy = usable[copyIdx];
    const r = await shoot({ products, copy, styleId, sizeKey, patternKey: pat.key,
                            consultant, season, outPath, saveHtml: has('html'), debug: has('debug') });
    const q = gate({ report: r.report, bytes: r.bytes, noticeText: buildNotice(products),
                     conditionalPriceShown: products.every(x => x.promoPrice != null && x.promoTerms),
                     contrastPairs: contrastPairs(styleId, size) });
    const collides = r.report.log.filter(l => l.step === 'collide' && l.iou).length;
    const scrims = r.report.log.filter(l => l.step === 'scrim').length;
    last = { pat, copy, r, q, collides, scrims };
    attempts.push({ pattern: pat.key, copyAngle: copy.angle, pass: q.pass,
                    failed: q.failed.map(f => `${f.label} ${f.detail}`), route: q.route });
    if (q.pass) break;
    if (q.route === 'copy' && copyIdx + 1 < usable.length) copyIdx++;          // 문구 문제 → 다음 후보
    else if (patIdx + 1 < ranked.length) patIdx++;                              // 배치 문제 → 다음 패턴
    else break;
  }

  const { pat, copy, r, q, collides, scrims } = last;
  const retry = attempts.length - 1;
  const line = `${q.pass ? '✓' : '✗'} ${STYLES[styleId].name.padEnd(9, ' ')} ${pat.key.padEnd(4)} ` +
    `${String(Math.round(r.bytes / 1024)).padStart(4)}KB  충돌해소 ${collides} 스크림 ${scrims}` +
    (retry ? `  재시도 ${retry}회` : '') +
    (advice.source === 'openai' ? '  LLM선택' : '') +
    (q.pass ? '' : `  → ${q.failed.map(f => f.label + ' ' + f.detail).join(' | ')} (반송:${q.route})`) +
    (r.errors.length ? `  JS오류:${r.errors.length}` : '');

  return { line, row: { code, sizeKey, size: `${size.w}x${size.h}`, style: styleId, styleName: STYLES[styleId].name,
    pattern: pat.key, patternAdvice: advice, kb: Math.round(r.bytes / 1024), pass: q.pass, retries: retry,
    attempts, checks: q.checks, route: q.route, headline: copy.headline, subline: copy.subline, cta: copy.cta,
    copySource: gen.source, escalatedFrom: escalatedFrom || null, log: r.report.log,
    file: path.relative(ROOT, outPath) } };
}

async function main() {
  const catFile = arg('catalog', path.join(ROOT, '02_data/catalog/products.sample.json'));
  const cat = JSON.parse(await readFile(catFile, 'utf8'));
  const age = daysOld(cat.syncedAt);
  const stale = age > Number(process.env.CATALOG_MAX_AGE_DAYS || 7);
  if (stale && !has('allow-stale')) {
    console.error(`✗ 카탈로그가 ${age.toFixed(1)}일 지났습니다 (상한 7일). --allow-stale 로 강제 가능.`);
    process.exit(2);
  }
  if (stale) console.warn(`⚠ 카탈로그 ${age.toFixed(1)}일 경과 — PoC 검증 목적으로만 진행합니다.`);

  const ids = (arg('products', 'G000069846,G000069931,G000069282')).split(',').map(s => s.trim());
  const products = ids.map(id => cat.products.find(p => p.goodsId === id || p.model === id)).filter(Boolean);
  if (!products.length) { console.error('✗ 상품을 찾을 수 없습니다'); process.exit(2); }

  const sizeKeys = (arg('sizes', 'C1350,W0800')).split(',').map(s => s.trim()).filter(k => SIZES[k]);
  const styleIds = (arg('styles', Object.keys(STYLES).join(','))).split(',').map(s => s.trim()).filter(k => STYLES[k]);
  const target = arg('target', '이사 예정'), tone = arg('tone', '혜택 강조'), season = arg('season', '9월 이사철');
  const consultant = { name: arg('consultant', '김○○ MC'), phone: arg('phone', '010-0000-0000') };
  const hasIce = products.some(p => p.ice);
  const outRoot = path.join(ROOT, '04_output', products.length > 1 ? 'composite' : 'single', stamp());

  console.log(`\n제품 ${products.length}종 — ${products.map(p => p.name).join(', ')}`);
  console.log(`규격 ${sizeKeys.length} × 스타일 ${styleIds.length}\n`);

  const rows = [];
  const skipped = [];
  for (const sizeKey of sizeKeys) {
    const size = SIZES[sizeKey];

    /* [5] copy — 규격별로 글자수 상한이 다르므로 규격마다 생성 */
    const gen = await generate({ products, target, tone, season, limits: size.limits });
    const usable = [];
    for (const c of gen.candidates) {
      const v = validate(c, size.limits, products);
      if (v.ok) usable.push(c); else console.log(`  · 문구 폐기(${c.angle}): ${v.errs.join(' / ')}`);
    }
    if (!usable.length) { console.log(`  ✗ ${size.label}: 사용 가능한 문구 없음`); continue; }
    const copy = usable[0];
    console.log(`[${size.label} ${size.w}×${size.h}] 문구원=${gen.source} · "${copy.headline}"`);

    for (const styleId of styleIds) {
      /* [7] compose — 패턴 후보 결정 */
      const cand = candidates({ styleId, sizeKey, n: products.length, hasIce });
      if (!cand.ok) {
        console.log(`  – ${STYLES[styleId].name}: 제외 (${cand.reason})`);
        // 제외 사유를 남긴다. 규격을 격상하면 후보로 부활할 수 있다 (P3-08)
        skipped.push({ sizeKey, style: styleId, styleName: STYLES[styleId].name,
                       reason: cand.reason, sizeFixable: cand.sizeFixable !== false });
        continue;
      }
      const ranked = rank(cand.list, size);
      const pat = ranked[0];   // 후보 1개면 LLM 생략 (D-17)

      /* [8][9] render → qa → 실패 반송 루프 (P3-07)
         문구 문제면 다음 문구 후보로, 배치 문제면 다음 패턴 후보로 되돌린다. */
      const res = await produce({ styleId, sizeKey, size, ranked, usable, products, consultant, season, outRoot, gen });
      rows.push(res.row);
      console.log('  ' + res.line);
    }
  }

  /* 최소 3개 보장 — 통과 시안이 3개 미만이면 규격을 격상해 다시 채운다 (P3-08)
     대상은 "실패한 스타일"뿐 아니라 좁은 규격에서 "제외된 스타일"까지 포함한다. */
  for (const sizeKey of sizeKeys) {
    const rendered = rows.filter(r => r.sizeKey === sizeKey);
    if (!rendered.length && !skipped.some(s => s.sizeKey === sizeKey)) continue;
    let passing = rendered.filter(r => r.pass).length;
    if (passing >= 3) continue;

    let from = sizeKey;
    while (passing < 3) {
      const up = ESCALATE[from];
      if (!up || !SIZES[up]) { console.log(`\n⚠ ${SIZES[sizeKey].label} 통과 ${passing}개 · 더 격상할 규격이 없음`); break; }
      const upSize = SIZES[up];
      const retryStyles = [
        ...rows.filter(r => r.sizeKey === from && !r.pass).map(r => r.style),
        // 규격 격상으로 풀리지 않는 제외(제품 수·얼음 조건)는 재시도 대상에서 뺀다
        ...skipped.filter(s => s.sizeKey === from && s.sizeFixable).map(s => s.style),
      ];
      if (!retryStyles.length) { console.log(`\n⚠ ${SIZES[sizeKey].label} 통과 ${passing}개 · 재시도할 스타일이 없음`); break; }
      console.log(`\n↑ ${SIZES[from].label} 통과 ${passing}개 (<3) → ${upSize.label} 로 격상 · 대상 ${retryStyles.length}종`);

      const gen2 = await generate({ products, target, tone, season, limits: upSize.limits });
      const usable2 = gen2.candidates.filter(c => validate(c, upSize.limits, products).ok);
      if (!usable2.length) { console.log('  ✗ 격상 규격에서도 사용 가능한 문구 없음'); break; }

      for (const styleId of [...new Set(retryStyles)]) {
        if (passing >= 3) break;
        const cand = candidates({ styleId, sizeKey: up, n: products.length, hasIce });
        if (!cand.ok) {
          console.log(`  – ${STYLES[styleId].name}: 여전히 제외 (${cand.reason})`);
          skipped.push({ sizeKey: up, style: styleId, styleName: STYLES[styleId].name,
                         reason: cand.reason, sizeFixable: cand.sizeFixable !== false });
          continue;
        }
        const res = await produce({ styleId, sizeKey: up, size: upSize, ranked: rank(cand.list, upSize),
          usable: usable2, products, consultant, season, outRoot, gen: gen2, escalatedFrom: from });
        rows.push(res.row);
        if (res.row.pass) passing++;
        console.log('  ' + res.line + '  (격상)');
      }
      from = up;
    }
  }
  await closeBrowser();

  await mkdir(outRoot, { recursive: true });
  await writeFile(path.join(outRoot, 'qa-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), rows, skipped }, null, 2));
  const pass = rows.filter(r => r.pass).length;
  const retried = rows.filter(r => r.retries > 0).length;
  const esc = rows.filter(r => r.escalatedFrom).length;
  const llm = rows.filter(r => r.patternAdvice?.source === 'openai').length;
  console.log(`\n결과 ${pass}/${rows.length} 통과 · ${path.relative(ROOT, outRoot)}/`);
  console.log(`MC에게 노출되는 시안: ${pass}개 (실패분은 목록에서 숨김)`);
  if (retried) console.log(`재시도로 살린 조합: ${rows.filter(r => r.retries > 0 && r.pass).length} / 재시도 발생 ${retried}`);
  if (esc) console.log(`규격 격상으로 채운 시안: ${esc}`);
  if (skipped.length) console.log(`조건으로 제외된 조합: ${skipped.length} (${[...new Set(skipped.map(s => s.styleName))].join(', ')})`);
  console.log(`패턴 선택 — LLM ${llm}회 · 규칙 엔진 ${rows.length - llm}회`);
  if (pass < 3) {
    console.log('⚠ 최소 3개 보장 실패 — 더 격상할 규격이 없거나 조건에 걸린 스타일이 많다');
    if (products.length >= 7)
      console.log(`  제품 ${products.length}종은 행 리스트(카드 리스트) 외에 쓸 패턴이 없다. 배너 2장으로 나누기를 제안한다.`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
