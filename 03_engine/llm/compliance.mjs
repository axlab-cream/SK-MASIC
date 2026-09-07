// 금지 표현 → 치환 (01_spec/content-copy-rules.md)
export const BANNED = [
  { re: /최고(의)?|최상(의)?|업계\s*1위|국내\s*1위/g, to: '에너지소비효율 1등급', kind: '최상급' },
  { re: /완벽(한|하게)?|무조건/g, to: '', kind: '검증 불가' },
  { re: /타사보다|타사\s*대비|업계\s*유일|유일한/g, to: '', kind: '비교 표현' },
  { re: /건강해지|아토피|질병\s*예방|치료|효능/g, to: '', kind: '의료·효능' },
  { re: /공짜|무료/g, to: '설치비·등록비 면제', kind: '가격 오인' },
  { re: /평생|영구/g, to: '구독 기간 동안', kind: '기간 오인' },
];

export function screen(text) {
  let out = text, hits = [];
  for (const b of BANNED) {
    if (b.re.test(out)) {
      hits.push({ kind: b.kind, matched: out.match(b.re)?.[0], to: b.to || '(삭제)' });
      out = out.replace(b.re, b.to);
    }
    b.re.lastIndex = 0;
  }
  // 구분점(·) 앞 공백은 유지한다 — "방문관리 · 냉온정" 형식이 카피 규칙이다
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1')
           .replace(/[·,]\s*$/, '').replace(/^\s*[·,]\s*/, '').trim();
  return { text: out, hits, passed: hits.length === 0 };
}

// 필수 고지 4항목 (약정기간 · 의무사용기간 · 등록비 · 중도해지 위약금)
export function notice(products, { partnerCard = true, membership = true, promoShown = true } = {}) {
  const terms = [...new Set(products.map(p => p.term).filter(Boolean))];
  const t = terms.length === 1 ? `${terms[0]}년 약정/${terms[0] * 12}개월 기준` : '약정 기간 상품별 상이';
  const parts = [t];

  // 최종 할인가는 초기 N개월만 적용된다. 이 문장이 빠지면 표시광고법 위반이다 (D-33)
  const promo = promoShown ? products.filter(p => p.promoPrice != null && p.promoTerms) : [];
  if (promo.length) {
    const ms = [...new Set(promo.map(p => p.promoTerms.months))];
    const after = promo.length === 1 ? promo[0].promoTerms.afterPrice : null;
    parts.push(ms.length === 1
      ? `표시 구독료는 최초 ${ms[0]}개월 적용${after ? `, ${promo[0].promoTerms.fromMonth}개월차부터 월 ${after.toLocaleString('ko-KR')}원` : ', 이후 정상 구독료 청구'}`
      : '표시 구독료는 초기 일정 기간만 적용, 이후 정상 구독료 청구');
  }

  parts.push('의무사용기간 내 해지 시 위약금 발생', '등록비 별도');
  if (membership) parts.push('T멤버십 10% 할인 적용가');
  // 제휴카드 할인은 카드 실적 조건이 붙는다. 할인액을 구독료처럼 보이게 쓰지 않는다
  if (partnerCard && products.some(p => p.partnerMax)) parts.push('제휴카드 실적 조건 충족 시 추가 할인');
  else if (partnerCard) parts.push('제휴카드 결제 조건 충족 시');
  return parts.join(' · ');
}

/** 배너에 실제로 올릴 가격 3단을 고른다. 추정하지 않고, 조건 없는 조건부 가격은 버린다 (D-33) */
export function priceTiers(p) {
  const usePromo = p.promoPrice != null && !!p.promoTerms;
  return {
    strike: p.base ?? null,                       // 취소선 — 기준 구독료
    hero: usePromo ? p.promoPrice : (p.sale ?? null),  // 가장 큰 숫자
    heroConditional: usePromo,                    // 참이면 고지문에 조건 문장이 반드시 들어간다
    standing: usePromo ? (p.sale ?? null) : null, // 프로모 종료 후 유지 가격
  };
}

// 약정 혼재 시 가격 숨김 (DECISIONS: R8)
export function priceVisibility(products) {
  const terms = new Set(products.map(p => p.term).filter(Boolean));
  return terms.size <= 1 ? { show: true } : { show: false, replacement: '상담 시 안내' };
}
