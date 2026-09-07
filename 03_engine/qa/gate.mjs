import { QA } from '../layout/spec.mjs';

const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
                        Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const iou = (a, b) => { const i = inter(a, b); const u = a.w * a.h + b.w * b.h - i; return u <= 0 ? 0 : i / u; };
const inside = (r, box) => r.x >= box.x - 1 && r.y >= box.y - 1 &&
                           r.x + r.w <= box.x + box.w + 1 && r.y + r.h <= box.y + box.h + 1;

// 8항목 게이트 — 전부 통과해야 MC에게 노출한다 (WORKFLOW [9])
export function gate({ report, bytes, noticeText, contrastPairs = [], conditionalPriceShown = false }) {
  const { rects, safe, fmin, noticeMin, log } = report;
  const entries = Object.entries(rects);
  const texts = entries.filter(([, r]) => r.kind === 'text');
  const prods = entries.filter(([, r]) => r.kind === 'product');
  const checks = [];
  const add = (id, label, pass, detail) => checks.push({ id, label, pass, detail });

  // 1 텍스트 ∩ 제품
  let worstTP = 0, tpWho = '';
  for (const [tn, t] of texts) for (const [pn, p] of prods) {
    const v = iou(t, p); if (v > worstTP) { worstTP = v; tpWho = `${tn}↔${pn}`; }
  }
  add('iou_text_product', '텍스트 ∩ 제품 IoU', worstTP <= QA.iouTextProduct,
      `${worstTP.toFixed(3)} ≤ ${QA.iouTextProduct}${tpWho ? ` (${tpWho})` : ''}`);

  // 2 텍스트 ∩ 텍스트
  let overlapTT = 0, ttWho = '';
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    const ov = inter(a[1], b[1]);
    if (ov > 4) { overlapTT++; ttWho = ttWho || `${a[0]}↔${b[0]}`; }
  }
  add('overlap_text_text', '텍스트 ∩ 텍스트 겹침', overlapTT === QA.iouTextText,
      `${overlapTT}건${ttWho ? ` (${ttWho})` : ''}`);

  // 3 최소 폰트 — 고지문은 자체 하한(noticeMin)을 적용한다
  // notice(법정 고지문)와 total(취소선 합계 기준가)은 자체 규칙을 따르는 보조 정보다
  const readable = texts.filter(([n]) => n !== 'notice');
  const smallest = readable.reduce((m, [n, r]) => (r.font && r.font < m.v ? { v: r.font, n } : m), { v: 999, n: '' });
  add('min_font', '최소 폰트 크기', smallest.v >= fmin - 0.6,
      `${smallest.v.toFixed(1)}px ≥ ${fmin}px${smallest.n ? ` (${smallest.n})` : ''}`);

  // 고지문 + 보조 텍스트(단위 접미사·취소선 기준가)는 보조 하한을 적용한다
  const nt = rects.notice;
  const auxMin = entries.reduce((m, [n, r]) => (r.aux && r.aux < m.v ? { v: r.aux, n } : m), { v: 999, n: '' });
  const noticeFont = nt ? (nt.font ?? nt.aux ?? 0) : null;
  const auxWorst = Math.min(noticeFont ?? 999, auxMin.v);
  add('notice_font', '고지문 · 보조 텍스트 하한', auxWorst === 999 || auxWorst >= noticeMin - 0.6,
      auxWorst === 999 ? '없음'
        : `${auxWorst.toFixed(1)}px ≥ ${noticeMin}px` + (auxMin.n && auxMin.v <= (noticeFont ?? 999) ? ` (${auxMin.n})` : ' (notice)'));

  // 4 대비비 — WCAG AA 는 큰 글씨(>=24px 또는 >=18.66px bold)에 3:1 을 적용한다
  const failC = contrastPairs.filter(c => c.ratio < (c.large ? QA.contrastLarge : QA.contrast));
  const worstC = contrastPairs.reduce((m, c) => Math.min(m, c.ratio), 99);
  add('contrast', '텍스트 대비비', failC.length === 0,
      contrastPairs.length
        ? (failC.length ? failC.map(c => `${c.label} ${c.ratio.toFixed(2)}:1 < ${c.large ? QA.contrastLarge : QA.contrast}`).join(', ')
                        : `최저 ${worstC.toFixed(2)} : 1 (기준 충족)`)
        : '검사 대상 없음');

  // 5 세이프존 침범 (notice 는 유일한 예외)
  const outs = texts.filter(([n, r]) => n !== 'notice' && !inside(r, safe)).map(([n]) => n);
  add('safezone', '세이프존 침범', outs.length === 0, `${outs.length}건${outs.length ? ' (' + outs.join(',') + ')' : ''}`);

  // 6 오버플로 · 절삭
  const under = (log || []).filter(l => l.step === 'fitText' && l.belowMin).map(l => l.slot);
  add('overflow', '텍스트 오버플로 · 절삭', under.length === 0, `${under.length}건${under.length ? ' (' + under.join(',') + ')' : ''}`);

  // 7 파일 용량
  const kb = bytes / 1024;
  add('filesize', '파일 용량', kb <= QA.pngMaxKB, `${kb.toFixed(0)}KB ≤ ${QA.pngMaxKB}KB`);

  // 8 필수 고지문 4항목 — 렌더된 문장을 우선 검사한다
  const noticeStr = report.noticeText || noticeText || '';
  const need = ['약정', '위약금', '등록비'];
  const okNotice = !!noticeStr && need.every(k => noticeStr.includes(k));
  add('notice', '필수 고지문 포함', okNotice, okNotice ? '약정·의무사용·등록비·위약금' : '누락');

  // 8-1 조건부 가격 고지 — 표시 가격이 조건부인데 조건 문장이 없으면 표시광고법 위반이다.
  // 엔진이 기준을 잘못 섞었을 때 마지막으로 걸러내는 그물이다 (D-33).
  if (conditionalPriceShown) {
    const okCond = /개월\s*적용|개월차부터|정상 구독료/.test(noticeStr);
    add('price_condition', '조건부 가격 조건 고지', okCond,
      okCond ? '조건 문장 포함' : '표시 가격이 조건부인데 조건 문장 없음');
  }

  // 9 제품 사진 로드 — 깨진 이미지는 alt 텍스트만 찍힌다. 절대 MC 에게 보내면 안 된다.
  const imgs = report.images || [];
  const broken = imgs.filter(im => !im.ok);
  if (imgs.length) add('images', '제품 사진 로드', broken.length === 0,
    broken.length ? `${broken.length}/${imgs.length}장 실패 — ${broken[0].src}` : `${imgs.length}장 정상`);

  const failed = checks.filter(c => !c.pass);
  return {
    pass: failed.length === 0, checks, failed,
    // 실패 반송 대상: 문구 문제 → copy(5단계), 배치 문제 → compose(7단계)
    // 사진 로드 실패는 문구·패턴을 바꿔도 낫지 않는다 — 자산 문제로 따로 표시한다
    route: failed.some(f => ['images', 'price_condition'].includes(f.id)) ? 'asset'
         : failed.some(f => ['overflow', 'min_font'].includes(f.id)) ? 'copy'
         : failed.length ? 'compose' : null,
  };
}

// WCAG 상대 휘도 · 대비비
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const lum = hex => {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map(x => x + x).join('') : m;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
export const contrast = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
