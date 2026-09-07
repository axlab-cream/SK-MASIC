#!/usr/bin/env node
// 정규화 — raw/harvest-*.json → 02_data/catalog/products.json  (HANDOFF C · P0-06 · P0-07)
// 원칙: 가격을 추정하지 않는다. 크롤은 후보만 싣고, 확정은 오버라이드 CSV 또는 사람이 한다.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadSchema, validateCatalog } from './validate.mjs';
import { loadOverride, applyOverride } from './override.mjs';
import { trimOne } from './trim.mjs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);

const KIND_BY_CATEGORY = { '정수기': 'purifier', '공기청정기': 'air', '비데': 'bidet',
  '식기세척기': 'dish', '전기레인지': 'range', '매트리스': 'bed', '프레임': 'bed', '필터 정기배송': 'filter' };

// 제품명 정리 — 라인명 + 유형 + 크기 변형만 남긴다 (content-copy-rules)
const cleanName = s => (s || '').replace(/\s*[|\-–—]\s*(SK매직|SKmagic).*$/i, '')
  .replace(/^(SK매직|SKmagic)\s*/i, '').replace(/\s{2,}/g, ' ').trim() || null;

async function pickHarvest() {
  const from = arg('from');
  if (from) return path.resolve(from);
  const dir = path.join(ROOT, '02_data/raw');
  if (!existsSync(dir)) throw new Error(`raw 폴더가 없습니다: ${dir} — 먼저 npm run crawl`);
  const files = (await readdir(dir)).filter(f => /^harvest-.*\.json$/.test(f)).sort();
  if (!files.length) throw new Error('harvest-*.json 이 없습니다 — 먼저 npm run crawl');
  return path.join(dir, files.at(-1));
}

async function fetchImage(url, dst) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) return { ok: false, status: r.status };
    await mkdir(path.dirname(dst), { recursive: true });
    await writeFile(dst, Buffer.from(await r.arrayBuffer()));
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e).slice(0, 80) }; }
  finally { clearTimeout(t); }
}

async function main() {
  const src = await pickHarvest();
  const h = JSON.parse(await readFile(src, 'utf8'));
  console.log(`\n원본 ${path.relative(ROOT, src)} · ${h.products?.length ?? 0}건`);

  const ovFile = arg('override', path.join(ROOT, '02_data/override.csv'));
  let ov = {};
  try { ov = await loadOverride(ovFile); } catch (e) { console.warn(`  ! 오버라이드 실패: ${e.message}`); }
  const nOv = Object.keys(ov).length;
  console.log(nOv ? `오버라이드 ${nOv}건 (${path.relative(ROOT, ovFile)})` : '오버라이드 없음 — 가격은 미확정으로 남는다');

  const doImages = !has('no-images');
  const origDir = path.join(ROOT, '02_data/assets/original');
  const trimDir = path.join(ROOT, '02_data/assets/trimmed');
  const stats = { imgOk: 0, imgFail: 0, trimmed: 0 };

  const products = [];
  for (const r of h.products || []) {
    const p = {
      goodsId: r.goodsId,
      model: r.model || null,
      name: cleanName(r.name),
      kind: r.kind || KIND_BY_CATEGORY[r.category] || 'purifier',
      care: r.care ? r.care.replace(/\s/g, '') : null,
      feature: r.feature || null,
      color: r.color || null,
      term: r.term ?? null,
      // 아이스 캠페인 스타일 노출 조건 (D-15). 이름·기능·필터에서 추론한다.
      ice: /얼음|아이스|ICE/i.test([r.name, r.feature, r.category, r.filterKey].join(' ')),
      // 수확기가 라벨 앵커로 확정한 값만 싣는다. 라벨을 못 찾았으면 null 로 남는다 (D-02)
      base: r.base ?? null,
      sale: r.sale ?? null,
      partner: null,
      // 최종 할인가는 조건부다. 조건(promoTerms)이 없으면 가격 자체를 버린다 (D-33)
      promoPrice: (r.promoPrice != null && r.promoTerms) ? r.promoPrice : null,
      promoTerms: (r.promoPrice != null && r.promoTerms) ? r.promoTerms : null,
      partnerMax: r.partnerMax ?? null,
      careCycle: r.careCycle ?? null,
      obligMonths: r.obligMonths ?? null,
      filterKey: r.filterKey ?? null,
      sizes: r.sizes?.length ? r.sizes : null,
      title: r.title ?? null,
      priceCandidates: r.priceCandidates || [],
      promo: (r.promo || []).slice(0, 3),
      images: r.images || [],
      image: null,
      category: r.category, sourceUrl: r.sourceUrl, harvestedAt: r.harvestedAt,
    };

    /* 이미지: CDN 원본 → original → 트림 → trimmed */
    if (doImages && p.images.length) {
      const url = p.images[0];
      const ext = (url.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1] || 'png').toLowerCase();
      const orig = path.join(origDir, `${p.goodsId}_1.${ext}`);
      const got = existsSync(orig) ? { ok: true } : await fetchImage(url, orig);
      if (got.ok) {
        stats.imgOk++;
        try {
          const dst = path.join(trimDir, `${p.goodsId}.png`);
          const t = await trimOne(orig, dst);
          if (t && !t.empty) {
            p.image = path.relative(ROOT, dst).split(path.sep).join('/');
            stats.trimmed++;
            console.log(`  ${p.goodsId} 이미지 ${t.before.w}×${t.before.h} → ${t.after.w}×${t.after.h} (여백 ${(t.ratio * 100).toFixed(0)}% 제거)`);
          } else console.log(`  ${p.goodsId} 이미지 전부 배경 — 자리표시자 사용`);
        } catch (e) { console.warn(`  ! ${p.goodsId} 트림 실패: ${String(e).slice(0, 70)}`); }
      } else { stats.imgFail++; console.warn(`  ! ${p.goodsId} 이미지 실패 (${got.status || got.error})`); }
    }

    const { product, applied } = applyOverride(p, ov);
    if (applied.length) console.log(`  ${p.goodsId} 오버라이드 적용: ${applied.join(', ')}`);
    product.needsPriceConfirm = product.sale == null;
    product.needsReview = !product.model || !product.name || !product.care;
    products.push(product);
  }

  /* 검증 — 실패 항목은 제외한다 */
  const schema = await loadSchema();
  const cat = { syncedAt: h.harvestedAt || new Date().toISOString(),
                source: `${path.basename(src)} (패턴 수확)`,
                note: '가격이 null 인 항목은 needsPriceConfirm=true 다. 오버라이드 CSV 로 확정한다.',
                products };
  const { topErrs, kept, dropped } = validateCatalog(cat, schema);
  topErrs.forEach(e => console.warn(`  ! ${e}`));
  dropped.forEach(d => console.warn(`  ✗ 제외 ${d.goodsId}: ${d.errs.join(' / ')}`));

  const out = path.join(ROOT, '02_data/catalog/products.json');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ ...cat, products: kept }, null, 2));

  const needConfirm = kept.filter(p => p.needsPriceConfirm).length;
  console.log(`\n통과 ${kept.length} · 제외 ${dropped.length} → ${path.relative(ROOT, out)}`);
  if (doImages) console.log(`이미지 확보 ${stats.imgOk} · 트림 ${stats.trimmed} · 실패 ${stats.imgFail}`);
  if (needConfirm) {
    console.log(`\n⚠ 가격 미확정 ${needConfirm}건 — 배너에서 가격이 숨겨진다 ("상담 시 안내")`);
    console.log(`  02_data/override.csv 에 model,base,sale,term 을 채우고 다시 실행하면 확정된다.`);
  }
  return { out, kept: kept.length, dropped: dropped.length };
}

main().then(async () => { const { closeBrowser } = await import('../render/shoot.mjs'); await closeBrowser(); })
  .catch(async e => { console.error('✗ ' + e.message); try { const { closeBrowser } = await import('../render/shoot.mjs'); await closeBrowser(); } catch {} process.exit(1); });
