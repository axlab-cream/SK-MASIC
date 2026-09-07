import { SIZES, safeZone, toPx, fmin, noticeMin, QA } from '../layout/spec.mjs';
import { STYLES, smallOnRed } from '../layout/styles.mjs';
import { PATTERNS } from '../layout/patterns.mjs';
import { notice as buildNotice, priceVisibility, priceTiers } from '../llm/compliance.mjs';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const FONTDIR = pathToFileURL(path.resolve(fileURLToPath(new URL('../fonts/', import.meta.url))) + path.sep).href;

const fontCss = () => ['400','500','700'].map(w => `
@font-face{font-family:'Roboto';font-style:normal;font-weight:${w};font-display:block;
  src:url('${FONTDIR}/roboto-latin-${w}-normal.woff2') format('woff2');}
@font-face{font-family:'Noto Sans KR';font-style:normal;font-weight:${w};font-display:block;
  src:url('${FONTDIR}/noto-sans-kr-korean-${w}-normal.woff2') format('woff2');
  unicode-range:U+1100-11FF,U+3130-318F,U+A960-A97F,U+AC00-D7A3,U+D7B0-D7FF,U+3000-303F,U+FF00-FFEF;}
@font-face{font-family:'Noto Sans KR';font-style:normal;font-weight:${w};font-display:block;
  src:url('${FONTDIR}/noto-sans-kr-latin-${w}-normal.woff2') format('woff2');unicode-range:U+0000-00FF;}`).join('');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const won = n => Number(n).toLocaleString('ko-KR');

/**
 * 로고: `01_spec/assets/logo/` 에 원본을 넣으면 자동으로 잡힌다.
 * 파일이 없으면 지금처럼 빈 슬롯이 남는다 — **로고를 만들어 넣지 않는다** (공식 CI 자산만 사용, D-09).
 *
 * 파일명 규칙 (앞에 있는 것을 먼저 쓴다)
 *   밝은 배경용 : logo.svg → logo.png → logo-black.svg → logo-black.png
 *   어두운 배경용: logo-white.svg → logo-white.png → (없으면 밝은 배경용 파일)
 */
const LOGODIR = path.resolve(fileURLToPath(new URL('../../01_spec/assets/logo/', import.meta.url)));
function logoFile(onDark) {
  const order = onDark
    ? ['logo-white.svg', 'logo-white.png', 'logo.svg', 'logo.png', 'logo-black.svg', 'logo-black.png']
    : ['logo.svg', 'logo.png', 'logo-black.svg', 'logo-black.png', 'logo-white.svg', 'logo-white.png'];
  for (const f of order) {
    const abs = path.join(LOGODIR, f);
    if (existsSync(abs)) return pathToFileURL(abs).href;
  }
  return null;
}

// 제품 사진: 트림된 로컬 파일이 있으면 쓰고, 없으면 카테고리별 실루엣 자리표시자
function productVisual(p, st) {
  if (p.image && existsSync(p.image)) {
    return `<img src="${pathToFileURL(path.resolve(p.image)).href}" alt="${esc(p.name)} ${esc(p.color || '')}" class="pimg">`;
  }
  const stroke = st.dark ? '#5A5A5A' : '#C8C8C8';
  const g = {
    purifier: `<rect x="9" y="4" width="34" height="64" rx="6"/><path d="M16 20h20"/><rect x="19" y="34" width="14" height="9" rx="2"/><path d="M26 43v7"/>`,
    air:      `<rect x="11" y="8" width="30" height="56" rx="10"/><circle cx="26" cy="30" r="8"/><path d="M18 52h16"/>`,
    bidet:    `<rect x="8" y="18" width="36" height="26" rx="8"/><path d="M18 18v-6h16v6"/>`,
    dish:     `<rect x="8" y="10" width="36" height="50" rx="5"/><circle cx="26" cy="26" r="7"/><path d="M16 48h20"/>`,
    range:    `<rect x="6" y="16" width="40" height="34" rx="5"/><circle cx="17" cy="28" r="5"/><circle cx="35" cy="28" r="5"/><path d="M13 42h26"/>`,
    bed:      `<rect x="4" y="26" width="44" height="20" rx="5"/><path d="M4 34h44M12 26v-8h24v8"/>`,
  }[p.kind || 'purifier'] || `<rect x="9" y="6" width="34" height="60" rx="6"/>`;
  return `<svg class="pimg" viewBox="0 0 52 72" fill="none" stroke="${stroke}" stroke-width="2.2"
    stroke-linecap="round" role="img" aria-label="${esc(p.name)} ${esc(p.color || '')} (자리표시자)"
    preserveAspectRatio="xMidYMid meet"><g>${g}</g></svg>`;
}

export function buildHtml({ products, copy, styleId, sizeKey, patternKey, consultant, season, debug = false }) {
  const st = STYLES[styleId], size = SIZES[sizeKey], pat = PATTERNS[patternKey];
  // 담당자는 문자열로도 들어온다("김민수 MC"). 객체만 받으면 연락처 칸이 빈 상자로 찍힌다.
  const mc = typeof consultant === 'string'
    ? { name: consultant, phone: '' }
    : (consultant && consultant.name ? { name: consultant.name, phone: consultant.phone || '' } : null);
  const { w, h } = size;
  const S = Math.min(w, h);                       // 짧은 변 — 모든 상대 단위의 기준
  let noticeText = buildNotice(products);   // 가격 기준 확정 후 아래에서 다시 만든다
  const noticeH = Math.round(S * (st.noticeStrong ? 0.075 : 0.055));
  const sz = safeZone(w, h, noticeH);
  let slots = pat.build(products.length);
  // 가격 강조: headline 축소 → 가격 블록 삽입 → 제품 영역 하강. 오버레이로 얹으면 제품과 겹친다.
  if (st.priceHero && slots.products) {
    const sq = r => [r[0], r[1], r[2], r[3]];
    slots = { ...slots,
      headline: [0, 0, 1, 0.11],
      pricehero: [0, 0.13, 1, 0.20],
      products: slots.products.map(r => {
        const y0 = 0.36, y1 = 0.72;                     // 제품 영역을 이 구간으로 압축
        const src = sq(r), lo = 0.18, hi = 0.74;
        const map = v => y0 + ((v - lo) / (hi - lo)) * (y1 - y0);
        const ny = map(src[1]), nh = Math.max(0.06, map(src[1] + src[3]) - ny);
        return [src[0], ny, src[2], nh];
      }),
      subline: null,
      cta: [0, 0.78, 0.60, 0.12],
      brand: [0.63, 0.78, 0.37, 0.12],
    };
  }
  const FMIN = fmin(w, h);
  const pv = priceVisibility(products);
  // 조건부 가격(최종 할인가)은 **전 제품이 조건을 갖췄을 때만** 쓴다.
  // 일부만 프로모션이면 합계가 서로 다른 기준을 섞게 되므로 전부 기본 할인가로 내린다 (D-33)
  const tiers = products.map(priceTiers);
  const allPromo = tiers.length > 0 && tiers.every(t => t.heroConditional && t.hero != null);
  const heroOf = i => allPromo ? tiers[i].hero : (products[i].sale ?? null);
  const heroSum = products.reduce((a, _, i) => a + (heroOf(i) || 0), 0);
  const baseSum = products.reduce((a, p) => a + (p.base || 0), 0);
  const standingSum = allPromo ? products.reduce((a, p) => a + (p.sale || 0), 0) : 0;
  // 제휴카드 "월 최대 N원 할인" 은 카드 실적 조건이 붙은 상한이다.
  // 상품 수만큼 곱해지는 값이라는 근거가 없으므로 **합산하지 않고, 배너에 금액을 쓰지 않는다** (D-35).
  const hasPartner = products.some(p => p.partnerMax);
  // 프로모션 조건 문장은 **프로모션가를 실제로 표시했을 때만** 넣는다.
  // 기본 할인가를 보여주면서 "최초 18개월" 을 고지하면 그 자체가 오인 표시다.
  noticeText = buildNotice(products, { promoShown: allPromo && pv.show });
  const pad = Math.round(S * QA.exclusionPadRatio);

  const px = r => toPx(r, w, h, sz);
  const box = (r, cls, inner, extra = '') =>
    `<div class="slot ${cls}" data-slot="${cls}" style="left:${px(r).x}px;top:${px(r).y}px;width:${px(r).w}px;height:${px(r).h}px" ${extra}>${inner}</div>`;

  /* 제품 카드 (이미지 + 가격 배지 + 라벨) */
  const prodBox = (r, p, i, big) => {
    // 배지 가격은 히어로와 같은 기준을 쓴다. 하나는 프로모션가, 하나는 기본가면 고지문과 어긋난다.
    const shown = heroOf(i);
    const price = pv.show && shown
      ? `<div class="pbadge" data-badge="${i}">${won(shown)}원${big ? '/월' : ''}</div>` : '';
    // 단품·대표 제품은 **제품명이 보여야** 고객이 무엇에 대한 광고인지 안다.
    // 이름이 없으면 속성만 남아 "무슨 제품인가"에 답하지 못한다.
    const nameLine = big && p.name ? `<div class="pname1">${esc(p.name)}</div>` : '';
    const label = copy.labels?.[i]
      ? `<div class="plabel">${esc(copy.labels[i])}</div>` : '';
    return box(r, `product-${i}`,
      `<div class="pwrap">${productVisual(p, st)}${price}</div>${nameLine}${label}`, 'data-kind="product"');
  };

  let bodyInner = '';

  if (pat.name === 'list-rows') {
    bodyInner += box(slots.headline, 'headline', `<span class="fit">${esc(copy.headline)}</span>`, 'data-kind="text"');
    bodyInner += `<div class="rule" style="left:${px(slots.headline).x}px;top:${px(slots.headline).y + px(slots.headline).h + 6}px;width:${px(slots.headline).w}px"></div>`;
    // 행 높이가 두 줄(이름 + 속성)을 최소폰트로 담을 수 없으면 속성 줄을 접는다.
    // 억지로 넣으면 글씨가 최소폰트 아래로 내려가 카톡 압축 후 판독이 불가해진다.
    const rowH = px(slots.rows[0].text).h;
    const twoLine = rowH >= FMIN * 2.35;
    slots.rows.forEach((row, i) => {
      const p = products[i]; if (!p) return;
      bodyInner += box(row.thumb, `product-${i}`, `<div class="pwrap">${productVisual(p, st)}</div>`, 'data-kind="product"');
      bodyInner += box(row.text, `rowtext-${i}`,
        `<div class="rname">${esc(p.name)}</div>` +
        (twoLine && copy.labels?.[i] ? `<div class="rattr">${esc(copy.labels[i])}</div>` : ''), 'data-kind="text"');
      // 기준가(취소선)는 이 레이아웃에서 최소폰트를 만족시킬 수 없어 생략하고 할인가만 남긴다.
      // 가격 3단 위계는 하단 합계 줄에서 유지된다.
      const rh = heroOf(i);
      bodyInner += box(row.price, `rowprice-${i}`, pv.show && rh
        ? `<div class="rsale">${won(rh)}<span class="runit aux">원</span></div>`
        : `<div class="rattr">${pv.replacement}</div>`, 'data-kind="text"');
    });
    bodyInner += box(slots.total, 'total', pv.show && heroSum
      ? `<div class="tlabel">${products.length}종 묶음 상담 시</div>` +
        (baseSum ? `<div class="tbase aux">월 ${won(baseSum)}원</div>` : '') +
        `<div class="tsum">${won(heroSum)}원/월</div>`
      : `<div class="tlabel">묶음 상담 시 ${pv.replacement}</div>`, 'data-kind="text"');
    bodyInner += box(slots.cta, 'cta', `<span class="fit">${esc(copy.cta)}</span>`, 'data-kind="text"');
  } else {
    // 밴드 스타일: headline 을 불투명 밴드 안에 둔다 (엔진 규칙 4 — 밴드 우선, 스크림 차선)
    // 밴드는 패턴이 아니라 "스타일"의 속성이다 — 모든 패턴에서 동일하게 나와야 스타일 정체성이 유지된다.
    const headPx = slots.headline ? px(slots.headline) : null;
    const bandH = st.band && headPx ? headPx.y + headPx.h + Math.round(S * 0.045) : 0;
    if (bandH) bodyInner += `<div class="band" style="left:0;top:0;width:${w}px;height:${bandH}px"></div>`;

    // 로고 슬롯과 프로모션 태그는 같은 줄에 나란히 둔다. 같은 좌표에 겹치면 서로를 가린다.
    const hdrY = Math.round(sz.top * 0.34);
    const logoW = Math.round(S * 0.13);
    // 흰 플레이트 스타일은 로고를 흰 판 위에 올리므로 '밝은 배경용' 파일을 쓴다
    const logoOnDark = !st.logoPlate && (st.dark || (bandH > 0 && st.bandInk === '#FFFFFF'));
    const logoSrc = logoFile(logoOnDark);
    const logoPos = `left:${sz.left}px;top:${hdrY}px`;
    bodyInner += logoSrc
      ? `<div class="logobox${st.logoPlate ? ' plated' : ''}" style="${logoPos}"><img src="${logoSrc}" alt="SK매직" class="logoimg"></div>`
      : st.logoPlate
        ? `<div class="plate" style="${logoPos}">LOGO</div>`
        : `<div class="logoslot${bandH ? ' onband' : ''}" style="${logoPos}">LOGO SLOT</div>`;
    if (copy.badge) {
      const tagCls = bandH ? 'tag onband' : 'tag';
      bodyInner += `<div class="${tagCls}" style="left:${sz.left + logoW + Math.round(S * 0.018)}px;top:${hdrY}px">${esc(copy.badge)}</div>`;
    }

    if (slots.headline) bodyInner += box(slots.headline, 'headline', `<span class="fit">${esc(copy.headline)}</span>`, 'data-kind="text"');
    (slots.products || []).forEach((r, i) => { if (products[i]) bodyInner += prodBox(r, products[i], i, i === 0); });

    if (st.chips && copy.badge) {
      const r = slots.subline;
      const chips = ['설치비 면제', '등록비 면제', '무상 A/S'];
      bodyInner += box(r, 'chips', chips.map(c => `<span class="chip">${c}</span>`).join(''), 'data-kind="text"');
    } else if (slots.subline) {
      bodyInner += box(slots.subline, 'subline', `<span class="fit">${esc(copy.subline)}</span>`, 'data-kind="text"');
    }

    // 가격 히어로 — 기준가(취소선) → 할인가 → 제휴 혜택가 3단 위계
    if (st.priceHero && slots.pricehero && pv.show && heroSum) {
      // 3단: 기준 구독료(취소선) → 표시 구독료(가장 큰 숫자) → 조건 한 줄
      // 3단째는 만들어낸 문구가 아니라 카탈로그에 있는 조건만 쓴다. 없으면 줄을 뺀다.
      const third = allPromo && standingSum
        ? `이후 월 ${won(standingSum)}원`
        : (hasPartner ? '제휴카드 조건 충족 시 추가 할인' : '');
      bodyInner += box(slots.pricehero, 'pricehero',
        (baseSum ? `<div class="phbase aux">월 ${won(baseSum)}원</div>` : '') +
        `<div class="phsale"><b>${won(heroSum)}</b><span>원/월</span></div>` +
        (third ? `<div class="phpart aux">${esc(third)}</div>` : ''), 'data-kind="text"');
    }

    if (slots.cta) bodyInner += box(slots.cta, 'cta', `<span class="fit">${esc(copy.cta)}</span>`, 'data-kind="text"');
    // 연락처가 없으면 이름만 넣는다. 빈 span 을 남기면 빈 상자가 보인다.
    if (slots.brand && mc) bodyInner += box(slots.brand, 'brand',
      `<span class="fit brandfit"><span class="bname">${esc(mc.name)}</span>` +
      (mc.phone ? `<span class="bphone">${esc(mc.phone)}</span>` : '') + `</span>`, 'data-kind="text"');
  }

  bodyInner += `<div class="notice" data-slot="notice" style="left:${sz.left}px;right:${sz.right}px;bottom:${Math.round(S * 0.014)}px">${esc(noticeText)}</div>`;
  if (debug) bodyInner += `<div class="safe" style="left:${sz.left}px;top:${sz.top}px;right:${sz.right}px;bottom:${sz.bottom}px"></div>`;

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontCss()}
*{box-sizing:border-box;margin:0}
html,body{background:#fff}
body{font-family:"Roboto","Noto Sans KR",Arial,sans-serif;letter-spacing:-.035em;
  -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
#banner{position:relative;width:${w}px;height:${h}px;overflow:hidden;
  background:${st.bgGradient || st.bg};color:${st.ink}}
.slot{position:absolute;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.slot[data-slot^="rowprice"]{align-items:flex-end}
.band{position:absolute;background:${st.bandGradient || st.bandBg || '#151515'};z-index:1}
.tag{position:absolute;z-index:3;background:${smallOnRed(st.badgeBg)};color:${st.badgeInk};
  font-weight:700;font-size:${Math.max(FMIN * 0.62, Math.round(S * 0.026))}px;
  height:${Math.round(S * .062)}px;display:flex;align-items:center;
  padding:0 ${Math.round(S * .016)}px;border-radius:2px;white-space:nowrap}
.tag.onband{background:${st.bandTag && st.bandTag !== 'transparent' ? st.bandTag : 'transparent'};
  color:${st.bandTagInk || st.bandInk};
  ${st.bandTag === 'transparent' ? `border:1px solid ${st.bandTagInk || st.bandInk};` : ''}}
.logoslot{position:absolute;z-index:3;width:${Math.round(S * .13)}px;height:${Math.round(S * .062)}px;
  border:1px dashed ${st.dark ? '#4A4A4A' : '#C8C8C8'};color:${st.faint};font-size:${Math.round(S * .017)}px;
  display:flex;align-items:center;justify-content:center;letter-spacing:.06em}
.logoslot.onband{border-color:${st.bandInk === '#FFFFFF' ? 'rgba(255,255,255,.45)' : 'rgba(21,21,21,.35)'};
  color:${st.bandInk === '#FFFFFF' ? 'rgba(255,255,255,.7)' : 'rgba(21,21,21,.55)'}}
.logobox{position:absolute;z-index:3;width:${Math.round(S * .13)}px;height:${Math.round(S * .062)}px;
  display:flex;align-items:center;justify-content:flex-start}
.logobox.plated{background:#fff;border-radius:${Math.round(S * .006)}px;padding:0 ${Math.round(S * .008)}px;justify-content:center}
.logoimg{max-width:100%;max-height:100%;object-fit:contain;display:block}
.plate{position:absolute;z-index:3;width:${Math.round(S * .13)}px;height:${Math.round(S * .062)}px;background:#fff;color:#8A8A8A;
  font-size:${Math.round(S * .017)}px;display:flex;align-items:center;justify-content:center;letter-spacing:.06em}
.headline{z-index:3;font-weight:${st.headWeight};letter-spacing:-.045em;line-height:1.2;
  color:${st.band && st.bandInk ? st.bandInk : st.ink};justify-content:flex-end}
.headline .fit{display:block;font-size:${Math.round(S * .075)}px}
.subline{z-index:3;color:${st.sub};line-height:1.45}
.subline .fit{display:block;font-size:${Math.round(S * .032)}px}
.chips{z-index:3;flex-direction:row;gap:${Math.round(S * .01)}px;align-items:center}
.chip{flex:1;text-align:center;background:${st.badgeBg};color:${st.badgeInk};font-weight:700;
  font-size:${Math.max(FMIN, Math.round(S * .026))}px;padding:${Math.round(S * .009)}px 0;border-radius:2px;
  white-space:nowrap}
.cta{z-index:3;background:${st.ctaBg};color:${st.ctaInk};font-weight:700;align-items:center;
  ${st.ctaBorder ? `border:2px solid ${st.ctaBorder};` : ''}border-radius:${Math.round(S * .011)}px;justify-content:center}
.cta .fit{font-size:${Math.round(S * .042)}px}
.brand{z-index:3;border:1px solid ${st.line};border-radius:${Math.round(S * .008)}px;
  padding:0 ${Math.round(S * .012)}px;justify-content:center;align-items:flex-start}
.brandfit{display:block;font-size:${Math.round(S * .036)}px;line-height:1.25}
.bname{display:block;font-weight:700;color:${st.ink}}
.bphone{display:block;color:${st.sub};font-size:.92em}
.slot[data-kind="product"]{z-index:2;background:${st.imgBg};border-radius:${Math.round(S * .008)}px;
  justify-content:center;align-items:center;gap:${Math.round(S * .006)}px;padding:${Math.round(S * .012)}px}
.pwrap{position:relative;flex:1;width:100%;display:flex;align-items:center;justify-content:center;min-height:0}
.pimg{max-width:82%;max-height:100%;object-fit:contain}
.pname1{position:relative;z-index:3;text-align:center;font-weight:700;color:${st.ink};
  font-size:${Math.max(FMIN, Math.round(S * .036))}px;line-height:1.2;letter-spacing:-.04em;
  margin-top:${Math.round(S * .012)}px;padding:0 ${Math.round(S * .01)}px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pbadge{position:absolute;right:0;bottom:0;background:${smallOnRed(st.badgeBg)};color:${st.badgeInk};
  font-weight:700;font-size:${Math.max(FMIN, Math.round(S * .024))}px;padding:${Math.round(S * .005)}px ${Math.round(S * .01)}px;border-radius:2px}
.plabel{flex:none;font-size:${Math.max(FMIN, Math.round(S * .024))}px;color:${st.sub};text-align:center;
  white-space:nowrap;overflow:hidden;text-overflow:clip;max-width:100%}
.pricehero{z-index:3;gap:${Math.round(S * .004)}px;justify-content:center}
.phbase{font-size:${Math.max(FMIN, Math.round(S * .028))}px;color:${st.faint};text-decoration:line-through}
.phsale{display:flex;align-items:baseline;gap:${Math.round(S * .006)}px;
  border-bottom:${Math.max(2, Math.round(S * .004))}px solid ${st.ink};padding-bottom:${Math.round(S * .006)}px}
.phsale b{font-size:${Math.round(S * .105)}px;font-weight:700;letter-spacing:-.03em;color:${st.priceInk};line-height:1}
.phsale span{font-size:${Math.max(FMIN, Math.round(S * .030))}px;font-weight:700;color:${st.ink}}
.phpart{font-size:${Math.max(FMIN, Math.round(S * .026))}px;color:${st.sub}}
.rule{position:absolute;height:${Math.max(2, Math.round(S * .0035))}px;background:${st.ink};z-index:3}
.rname{font-size:${Math.max(FMIN, Math.round(S * .030))}px;font-weight:700;color:${st.ink};
  white-space:nowrap;overflow:hidden;text-overflow:clip;line-height:1.25}
.rattr{font-size:${Math.max(FMIN, Math.round(S * .026))}px;color:${st.sub};
  white-space:nowrap;overflow:hidden;line-height:1.25}
.rsale{font-size:${Math.max(FMIN, Math.round(S * .034))}px;font-weight:700;color:${st.priceInk};
  text-align:right;line-height:1.2;white-space:nowrap}
.runit{font-size:.66em;font-weight:400;color:${st.sub};margin-left:2px}
.total{z-index:3;background:${st.imgBg};flex-direction:row;align-items:center;
  padding:0 ${Math.round(S * .016)}px;border-radius:2px}
.tlabel{flex:1;font-size:${Math.max(FMIN, Math.round(S * .028))}px;font-weight:700;color:${st.ink};white-space:nowrap}
.tbase{font-size:${Math.max(FMIN * .8, Math.round(S * .024))}px;color:${st.faint};
  text-decoration:line-through;margin-right:${Math.round(S * .014)}px;white-space:nowrap}
.tsum{font-size:${Math.max(FMIN, Math.round(S * .036))}px;font-weight:700;color:${st.accent};white-space:nowrap}
.notice{position:absolute;z-index:4;font-size:${Math.max(noticeMin(w, h), Math.round(S * (st.noticeStrong ? .019 : .017)))}px;
  line-height:1.35;color:${st.sub}}
.safe{position:absolute;z-index:9;border:1px dashed rgba(234,23,56,.6);pointer-events:none}
.scrim{position:absolute;z-index:2;pointer-events:none}
</style></head><body><div id="banner">${bodyInner}</div>
<script>
window.__LAYOUT = ${JSON.stringify({ w, h, S, FMIN, NMIN: noticeMin(w, h), sz, pad, qa: QA, dark: !!st.dark, bg: st.bg })};
${LAYOUT_JS}
</script></body></html>`;
}

/* ── 인페이지 레이아웃 엔진: fit-text → 충돌 해소 → 대비 보정 ── */
const LAYOUT_JS = String.raw`
(function(){
  const L = window.__LAYOUT, log = [];
  const R = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; };
  const inter = (a,b) => Math.max(0, Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)) *
                         Math.max(0, Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const iou = (a,b) => { const i = inter(a,b); const u = a.w*a.h + b.w*b.h - i; return u<=0?0:i/u; };
  const pad = (r,p) => ({x:r.x-p,y:r.y-p,w:r.w+2*p,h:r.h+2*p});

  // 1) fit-text: 지정 박스 안에 들어가는 최대 폰트 크기를 이진 탐색
  function fitText(){
    document.querySelectorAll('.fit').forEach(el => {
      const boxEl = el.closest('.slot');
      const max = parseFloat(getComputedStyle(el).fontSize);
      let lo = L.FMIN, hi = max, best = L.FMIN;
      const fits = s => { el.style.fontSize = s+'px';
        return el.scrollHeight <= boxEl.clientHeight + 1 && el.scrollWidth <= boxEl.clientWidth + 1; };
      if (fits(max)) { best = max; }
      else {
        for (let i=0;i<14 && hi-lo>0.4;i++){ const mid=(lo+hi)/2; if (fits(mid)) { best=mid; lo=mid; } else hi=mid; }
      }
      el.style.fontSize = best+'px';
      const under = best <= L.FMIN + 0.5 && !fits(L.FMIN);
      log.push({step:'fitText', slot:boxEl.dataset.slot, from:Math.round(max), to:Math.round(best),
                belowMin: under});
    });
  }

  // 2) 배타 영역 등록 + 제품 슬롯 재배치 (축소 0.94 · 여유 방향 이동, 최대 5회)
  function resolve(){
    const texts = [...document.querySelectorAll('.slot[data-kind="text"], .tag, .rule')]
      .filter(e => e.textContent.trim() || e.classList.contains('rule'));
    const excl = texts.map(e => ({ slot: e.dataset.slot || e.className, rect: pad(R(e), L.pad) }));
    const prods = [...document.querySelectorAll('.slot[data-kind="product"]')];
    for (let pass=1; pass<=L.qa.maxCollisionPasses; pass++){
      let worst = 0, acted = false;
      prods.forEach(p => {
        const pr = R(p);
        for (const e of excl){
          const v = iou(pr, e.rect);
          if (v > worst) worst = v;
          if (v > L.qa.collisionIouTrigger){
            const cur = parseFloat(p.dataset.scale || '1');
            const next = +(cur*0.94).toFixed(3);
            p.dataset.scale = next;
            // 배타영역 반대 방향으로 밀어낸다
            const dy = (pr.y + pr.h/2) < (e.rect.y + e.rect.h/2) ? -1 : 1;
            const shift = Math.round(L.S*0.012);
            const curShift = parseInt(p.dataset.shift || '0', 10) + dy*shift;
            p.dataset.shift = curShift;
            p.style.transform = 'translateY('+curShift+'px) scale('+next+')';
            p.style.transformOrigin = dy < 0 ? 'bottom center' : 'top center';
            acted = true;
            log.push({step:'collide', pass, slot:p.dataset.slot, against:e.slot,
                      iou:+v.toFixed(3), scale:next, shiftY:curShift});
          }
        }
      });
      if (!acted){ log.push({step:'collide', pass, result:'clear', worstIou:+worst.toFixed(3)}); break; }
    }
  }

  // 3) 대비 보정 — 텍스트가 이미지 면 위에 남아 있으면 스크림(그라데이션) 삽입
  function scrim(){
    const banner = document.getElementById('banner');
    const prods = [...document.querySelectorAll('.slot[data-kind="product"]')].map(R);
    document.querySelectorAll('.slot[data-kind="text"]').forEach(t => {
      if (!t.textContent.trim()) return;
      const tr = R(t);
      const over = prods.some(pr => inter(tr, pr) / Math.max(1, tr.w*tr.h) > 0.10);
      if (!over) return;
      const d = document.createElement('div');
      d.className = 'scrim';
      d.style.left = (tr.x-8)+'px'; d.style.top = (tr.y-8)+'px';
      d.style.width = (tr.w+16)+'px'; d.style.height = (tr.h+16)+'px';
      d.style.background = L.dark
        ? 'linear-gradient(180deg,rgba(21,21,21,0) 0%,rgba(21,21,21,.86) 35%,rgba(21,21,21,.92) 100%)'
        : 'linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.90) 32%,rgba(255,255,255,.96) 100%)';
      banner.insertBefore(d, t);
      log.push({step:'scrim', slot:t.dataset.slot, reason:'텍스트가 이미지 위 10% 초과'});
    });
  }

  // 4) 실측 rect 수집 — QA 게이트는 이 값만 신뢰한다 (DECISIONS D-16)
  function report(){
    const rects = {};
    document.querySelectorAll('[data-slot]').forEach(e => {
      if (!e.textContent.trim() && e.dataset.kind !== 'product') return;
      // 슬롯 컨테이너가 아니라 "실제로 글자가 그려진 요소"의 최소 폰트를 잰다.
      // 컨테이너는 font-size 를 상속만 하므로 여기서 재면 항상 16px 로 나온다 (측정 버그)
      let minFont = null, minAux = null, bold = false;
      if (e.dataset.kind !== 'product') {
        const leaves = [...e.querySelectorAll('*')].filter(n => n.children.length === 0 && n.textContent.trim());
        const nodes = leaves.length ? leaves : [e];
        for (const n of nodes) {
          const cs = getComputedStyle(n), f = parseFloat(cs.fontSize);
          // .aux = 단위 접미사·취소선 기준가처럼 "읽지 않아도 되는" 보조 정보.
          // 고지문과 같은 성격이라 읽기 하한(FMIN) 대신 보조 하한(NMIN)을 적용한다.
          const isAux = n.classList && n.classList.contains('aux');
          if (isAux) { if (minAux === null || f < minAux) minAux = f; continue; }
          if (minFont === null || f < minFont) { minFont = f; bold = parseInt(cs.fontWeight, 10) >= 600; }
        }
      }
      rects[e.dataset.slot] = { ...R(e), kind: e.dataset.kind || 'text', font: minFont, aux: minAux, bold };
    });
    return { rects, log, fmin: L.FMIN, noticeMin: L.NMIN,
             safe: { x:L.sz.left, y:L.sz.top, w:L.w-L.sz.left-L.sz.right, h:L.h-L.sz.top-L.sz.bottom } };
  }

  window.__run = async () => {
    await document.fonts.ready;          // 폰트 로딩 전에 재면 폴백 폰트로 측정된다
    fitText(); resolve(); scrim();
    await document.fonts.ready;
    return report();
  };
})();
`;
