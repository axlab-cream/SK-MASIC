// 패턴 기반 상품DB 수확기
// 물리적으로 페이지를 훑는 대신 "URL 패턴 + ID 패턴"으로 수확한다.
//   1) 카테고리 목록 URL 을 패턴으로 조립 → 페이지 안의 G\d{9} 를 전부 긁어 goodsId 집합을 만든다
//   2) 각 goodsId 로 상세 URL 을 패턴 조립 → 필드 정규식으로 값 추출
//   3) 이미지는 CDN URL 을 패턴 조립해 HEAD 로 존재 여부만 확인 (목록에 없어도 찾아진다)
// 사이트 마크업이 바뀌어도 URL·ID 패턴이 유지되면 계속 동작한다.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const uniq = a => [...new Set(a)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const won = s => { const n = Number(String(s).replace(/[^0-9]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * 상세 페이지 텍스트에서 가격을 **라벨 기준**으로 뽑는다.
 * 페이지에는 관련 상품 가격까지 섞여 20개 넘는 금액이 나타난다.
 * 정렬해서 최소·최대를 고르는 방식은 옆 상품 가격을 내 가격으로 만든다 — 라벨 앵커만 신뢰한다.
 *
 * 관찰된 구조 (2026-09-07 · G000069846):
 *   기준 구독료   → 월 70,900 원      base
 *   기본 할인가   → 월 51,900 원      sale   (약정 내내 유지되는 가격)
 *   최종 할인가   → 월 25,950 원      promo  (조건부 — 아래 문장이 따라붙는다)
 *   "구독료 납부 월부터 18개월간 청구되는 구독료이며, 19개월차부터 할인 구독료 월 51,900원이 청구됩니다."
 */
function extractPrices(text, labels) {
  const after = (label, span = 80) => {
    const i = text.indexOf(label);
    if (i < 0) return null;
    const seg = text.slice(i + label.length, i + label.length + span);
    const m = seg.match(/월\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
    return m ? won(m[1]) : null;
  };
  const base  = after(labels.base);
  const sale  = after(labels.sale);
  const promo = after(labels.promo);

  // 프로모션 조건 — 이 문장이 없으면 promo 를 광고에 쓸 수 없다
  const c = text.match(/(\d{1,3})\s*개월간\s*청구되는[^.]*?(\d{1,3})\s*개월차부터[^0-9]*?월\s*([0-9,]+)\s*원/);
  const promoTerms = c ? { months: Number(c[1]), fromMonth: Number(c[2]), afterPrice: won(c[3]) } : null;

  const partnerMax = won((text.match(/월\s*최대\s*([0-9,]+)\s*할인/) || [])[1]);
  const careCycle  = Number((text.match(/방문주기\s*:\s*(\d{1,2})\s*개월/) || [])[1]) || null;
  const oblig      = Number((text.match(/의무사용\s*(\d{1,3})\s*개월/) || [])[1]) || null;

  return { base, sale, promo, promoTerms, partnerMax, careCycle, obligMonths: oblig };
}

const SIZE_WORD  = /^(싱글|슈퍼싱글|더블|퀸|킹|라지킹|SS|Q|K|LK)$/i;
const COLOR_WORD = /(화이트|블랙|베이지|그레이|실버|아이보리|네이비|브라운|그린|핑크|골드|우드|샌드|차콜|민트|크림)/;

/**
 * 가격이 비동기로 채워지는 페이지다. 라벨은 먼저 그려지고 값은 나중에 온다.
 * 한 번만 읽으면 라벨 바로 뒤의 금액이 **다음 섹션 금액**일 수 있다 —
 * 실제로 같은 상품이 실행마다 sale 43,900 / 21,950 로 달라졌다.
 * 그래서 (1) 두 번 연속 같은 결과가 나올 때까지 다시 읽고, (2) 값의 모양을 검사한다.
 */
function priceShapeOk(pr, text, labels) {
  const { base, sale, promo, promoTerms } = pr;
  // 최종 할인가 라벨이 페이지에 있는데 조건을 못 읽었다면 그 페이지는 아직 덜 그려진 것이다
  if (text.includes(labels.promo) && !(promo != null && promoTerms)) return false;
  // 위계가 뒤집히면 잘못 읽은 것이다
  if (base != null && sale != null && sale > base) return false;
  if (sale != null && promo != null && promo > sale) return false;
  // 최종 할인가가 있으면 sale 은 그것과 달라야 한다 (같으면 같은 값을 두 번 읽은 것)
  if (promo != null && sale != null && promo === sale && text.includes(labels.sale)) return false;
  return true;
}

async function readStable(page, labels, tries = 3, gapMs = 900) {
  let prev = null, prevText = null;
  for (let i = 0; i < tries; i++) {
    const text = await page.evaluate(() => document.body.innerText);
    const pr = extractPrices(text, labels);
    const same = prev && JSON.stringify(pr) === JSON.stringify(prev);
    if (same && priceShapeOk(pr, text, labels)) return { pr, text, stable: true };
    prev = pr; prevText = text;
    await sleep(gapMs);
  }
  // 끝까지 안정되지 않으면 마지막 값을 주되 stable=false 로 알린다 → 가격 미확정 처리
  const text = prevText ?? await page.evaluate(() => document.body.innerText);
  return { pr: extractPrices(text, labels), text, stable: false };
}

/**
 * 제목이 가장 구조적인 출처다.
 *   "MEGA ICE 얼음정수기 | 구독 | 방문관리, 냉온정얼음, 내추럴 화이트 | WPUIAC506SNW | SK매직몰"
 * 본문 정규식보다 먼저 쓰고, 빠진 값만 본문에서 보충한다.
 */
function parseTitle(title) {
  const seg = String(title || '').split('|').map(s => s.trim()).filter(Boolean);
  if (seg.length < 3) return {};
  const out = { name: seg[0] || null };
  const model = seg.find(x => /^[A-Z][A-Z0-9-]{5,15}$/.test(x));
  if (model) out.model = model;

  // 속성 구간을 고른다. 매트리스는 "(슈퍼싱글, 퀸, 킹)방문관리, 3단 모션, ..." 처럼
  // 괄호 안에도 쉼표가 있다 — 그냥 split(',') 하면 사이즈 목록이 속성으로 섞인다.
  const attrs = seg.slice(1).find(x => x.includes(',') && !/^구독$/.test(x));
  if (attrs) {
    // 1) 괄호 그룹을 떼어낸다. 사이즈 목록일 때만 sizes 로 인정한다 —
    //    "Lite(방문주기12개월)" 처럼 사이즈가 아닌 괄호도 있다.
    const g = attrs.match(/\(([^)]*)\)/);
    if (g) {
      const items = g[1].split(',').map(x => x.trim()).filter(Boolean);
      if (items.length && items.every(x => SIZE_WORD.test(x))) out.sizes = items;
    }
    const rest = attrs.replace(/\([^)]*\)/g, ' ').trim();

    // 2) 남은 문자열만 쉼표로 자르고, 각 조각을 종류별로 분류한다
    const parts = rest.split(',').map(x => x.trim().replace(/^[).\s]+|[.\s]+$/g, '').trim()).filter(Boolean);
    out.care = (parts.find(x => /^(방문|셀프)\s*관리$/.test(x)) || '').replace(/\s/g, '') || null;
    const others = parts.filter(x => x.replace(/\s/g, '') !== out.care);
    // 색상은 어휘로 판정한다. 위치(마지막 조각)로 찍으면 기능이 색상 자리에 들어간다.
    out.color = [...others].reverse().find(x => COLOR_WORD.test(x)) || null;
    out.feature = others.find(x => x !== out.color) || null;
  }

  // 제목 첫 조각에 "(슈퍼싱글, 퀸, 킹)방문관리" 가 붙어 오는 상품이 있다 — 제품명에서 떼어낸다
  if (out.name) out.name = out.name.replace(/\s*\([^)]*\)\s*(방문관리|셀프관리)?\s*$/, '').trim() || out.name;
  return out;
}

export async function harvest({ configPath, outDir, limitPerCategory = 0, headless = true } = {}) {
  const cfgFile = configPath || fileURLToPath(new URL('./patterns.config.json', import.meta.url));
  const cfg = JSON.parse(await readFile(cfgFile, 'utf8'));
  const idRe = new RegExp(cfg.idPattern, 'g');
  const out = outDir || path.resolve(fileURLToPath(new URL('../../02_data/raw', import.meta.url)));
  await mkdir(out, { recursive: true });

  const launch = { headless };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const delay = Number(process.env.CRAWL_DELAY_MS || 800);

  /* ── 1) goodsId 집합 수확 ─────────────────────────── */
  // limitPerCategory 는 카테고리마다 따로 적용한다. 전체 합계로 자르면 첫 카테고리만 수확된다.
  const found = new Map();   // goodsId → { kind, category, filterKey }
  for (const c of cfg.categories) {
    const urls = [{ key: null, u: fill(cfg.base + cfg.urlPatterns.goodsList, c) },
      ...Object.entries(c.filters || {}).map(([key, f]) => ({ key, u: fill(cfg.base + cfg.urlPatterns.goodsListF, { ...c, filter: f }) }))];
    const inCat = new Map();
    for (const { key, u } of urls) {
      if (limitPerCategory && inCat.size >= limitPerCategory) break;
      try {
        await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForFunction(re => new RegExp(re).test(document.documentElement.outerHTML),
          cfg.idPattern, { timeout: 15000 }).catch(() => {});
        // 지연 로딩 목록을 끝까지 내린다
        for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 4000); await sleep(400); }
        const html = await page.content();
        const ids = uniq(html.match(idRe) || []);
        for (const id of ids) {
          if (limitPerCategory && inCat.size >= limitPerCategory) break;
          if (!found.has(id) && !inCat.has(id)) inCat.set(id, { kind: c.kind, category: c.name, filterKey: key });
        }
        console.log(`  ${c.name} ${u.split('?')[1]} → 발견 ${ids.length} · 채택 ${inCat.size}${limitPerCategory ? `/${limitPerCategory}` : ''}`);
      } catch (e) { console.warn(`  ! ${c.name} 목록 실패: ${String(e).slice(0, 90)}`); }
      await sleep(delay);
    }
    for (const [id, m] of inCat) found.set(id, m);
    console.log(`  → ${c.name} ${inCat.size}건 확정 (누적 ${found.size})`);
  }

  /* ── 2) 상세 파싱 ─────────────────────────────────── */
  const fp = Object.fromEntries(Object.entries(cfg.fieldPatterns).map(([k, v]) => [k, new RegExp(v, 'g')]));
  const results = [];
  for (const [goodsId, meta] of found) {
    const u = fill(cfg.base + cfg.urlPatterns.goodsDetail, { goodsId });
    try {
      // networkidle 은 이 사이트에서 신뢰할 수 없다 (분석 스크립트가 네트워크를 계속 붙잡는다).
      // DOM 만 받고, 우리가 실제로 필요한 **가격 라벨이 나타날 때까지** 기다린다.
      let text = null, title = null, stable = true;
      for (let attempt = 0; attempt < 2 && text == null; attempt++) {
        try {
          await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
          // 가격 블록이 다 그려질 때까지 기다린다. 기준 구독료 라벨만으로는 부족했다 —
          // 값이 비동기로 채워지므로 **가격 블록 끝(방문주기/의무사용 줄)** 까지 기다린다.
          await page.waitForFunction(
            a => document.body && document.body.innerText.includes(a),
            cfg.priceLabels.base, { timeout: 12000 }).catch(() => {});
          await page.waitForFunction(
            () => /의무사용\s*\d+\s*개월|방문주기\s*:/.test(document.body?.innerText || ''),
            null, { timeout: 8000 }).catch(() => {});
          const r = await readStable(page, cfg.priceLabels);
          text = r.text; stable = r.stable;
          title = await page.title();
        } catch (e) {
          if (attempt === 1) throw e;
          console.warn(`  ~ ${goodsId} 1차 실패, 재시도`);
          await sleep(1500);
        }
      }
      const pick = (k, i = 0) => { fp[k].lastIndex = 0; const m = fp[k].exec(text); return m ? (m[i] ?? m[0]) : null; };
      const t = parseTitle(title);
      // 안정되지 않은 읽기는 가격을 싣지 않는다. 조건부 가격을 상시가로 잘못 싣는 것보다
      // "가격 미확정" 이 훨씬 안전하다 (D-33)
      const pr = stable ? extractPrices(text, cfg.priceLabels)
                        : { base: null, sale: null, promo: null, promoTerms: null,
                            partnerMax: null, careCycle: null, obligMonths: null };
      // 관찰된 모든 금액은 근거용으로만 남긴다. 이 배열로 가격을 고르지 않는다.
      const seen = uniq((text.match(fp.price) || []).map(x => Number(x.replace(/[^0-9]/g, '')))).sort((a, b) => a - b);
      const promoTags = uniq((text.match(fp.promoTag) || []).map(x => x.trim())).slice(0, 4);
      const rec = {
        goodsId, kind: meta.kind, category: meta.category, filterKey: meta.filterKey || null, sourceUrl: u,
        // 원본 제목을 그대로 보관한다. 파싱 규칙을 고칠 때 재크롤 없이 다시 해석할 수 있어야 한다.
        title: title || null,
        name: t.name || (title || '').replace(/\s*[|\-–].*$/, '').trim() || null,
        model: t.model || pick('model'),
        care: (t.care || pick('care') || '').replace(/\s/g, '') || null,
        feature: t.feature || null,
        color: (t.color || pick('color') || '').trim() || null,
        // 약정은 "의무사용 N개월" 이 가장 확실하다. 없으면 본문 "N년 약정" 으로 보충한다.
        term: pr.obligMonths ? Math.round(pr.obligMonths / 12) : (Number(pick('term', 1) || pick('term', 2)) || null),
        // 가격은 라벨 앵커로만 확정한다 (D-02). 라벨을 못 찾으면 null 로 남긴다 — 추정하지 않는다.
        base: pr.base, sale: pr.sale, promoPrice: pr.promo, promoTerms: pr.promoTerms,
        partnerMax: pr.partnerMax, careCycle: pr.careCycle, obligMonths: pr.obligMonths,
        priceCandidates: seen,
        priceStable: stable,
        promo: promoTags,
        images: [],
        harvestedAt: new Date().toISOString(),
      };
      /* ── 3) 이미지 존재 확인 (패턴 조립 + HEAD) ── */
      const [lo, hi] = cfg.imageIndexRange;
      for (let n = lo; n <= hi; n++) for (const ext of cfg.imageExts) {
        const iu = fill(cfg.cdn + cfg.urlPatterns.goodsImage, { goodsId, n, ext });
        try { const r = await ctx.request.head(iu, { timeout: 8000 }); if (r.ok()) { rec.images.push(iu); break; } } catch {}
      }
      results.push(rec);
      const pt = rec.promoPrice && rec.promoTerms ? ` · 프로모 ${rec.promoPrice.toLocaleString('ko-KR')}(${rec.promoTerms.months}개월)` : '';
      if (!stable) console.warn(`  ~ ${goodsId} 가격 읽기 불안정 — 가격 미확정으로 남김`);
      console.log(`  ${goodsId} ${rec.model || '?'} · 기준 ${rec.base ?? '?'} / 할인 ${rec.sale ?? '?'}${pt} · 이미지 ${rec.images.length}`);
    } catch (e) { console.warn(`  ! ${goodsId} 상세 실패: ${String(e).slice(0, 90)}`); }
    await sleep(delay);
  }

  await browser.close();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const file = path.join(out, `harvest-${stamp}.json`);
  await writeFile(file, JSON.stringify({ harvestedAt: new Date().toISOString(), config: path.basename(cfgFile),
    idPattern: cfg.idPattern, count: results.length, products: results }, null, 2));
  console.log(`\n${results.length}건 → ${file}`);
  return { file, results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  harvest({ limitPerCategory: Number(process.argv[2] || 0) }).catch(e => { console.error(e); process.exit(1); });
}
