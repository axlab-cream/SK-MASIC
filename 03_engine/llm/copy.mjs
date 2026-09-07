// COPY_GEN — OpenAI Structured Outputs + 오프라인 규칙 폴백
// 절대 규칙: 응답 스키마에 price / notice 필드를 두지 않는다 (DECISIONS D-18)
import { screen } from './compliance.mjs';

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['angle', 'headline', 'subline', 'cta', 'labels', 'badge'],
        properties: {
          angle: { type: 'string', enum: ['benefit', 'scene', 'price'] },
          headline: { type: 'string' },
          subline: { type: 'string' },
          cta: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
          badge: { type: ['string', 'null'] },
        },
      },
    },
  },
};

const sys = `너는 SK매직 렌탈 상품의 카카오톡 배너 문구를 쓴다.
규칙:
1. subline 은 반드시 "관리방식 · 핵심기능 · 색상" 순서로 쓴다.
2. 가격, 금액, 고지문은 절대 쓰지 않는다. 숫자를 만들지 않는다.
3. 최상급(최고/최상/1위), 비교(타사보다/업계 유일), 의료 효능 표현을 쓰지 않는다.
4. headline 은 혜택 또는 상황 하나만 담고 제품명을 반복하지 않는다.
5. cta 는 구체적 동작 하나. "자세히 보기" 같은 모호한 표현 금지.
6. 각 필드는 주어진 최대 글자수를 넘지 않는다.`;

export async function generate(input, { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL_COPY || 'gpt-5.1' } = {}) {
  if (!apiKey) return { source: 'fallback', candidates: fallback(input) };
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(input) }],
        response_format: { type: 'json_schema', json_schema: { name: 'copy', strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const j = await res.json();
    const parsed = JSON.parse(j.choices[0].message.content);
    return { source: 'openai', candidates: parsed.candidates };
  } catch (e) {
    return { source: 'fallback', error: String(e), candidates: fallback(input) };
  }
}

/* ── 오프라인 규칙 폴백 (API 키 없이도 PoC가 돌아야 한다) ── */
const HEAD = {
  '이사 예정': ['이사하면서 한 번에', '새 집 첫날부터 깨끗하게', '이사 준비 이것부터'],
  '신혼':      ['시작부터 제대로', '새 살림 기본 3종', '신혼집 필수 구성'],
  '1인가구':   ['혼자 살아도 제대로', '작은 집에 딱 맞게', '한 대로 충분하게'],
  '사무실':    ['사무실에도 깨끗한 물', '직원 많은 곳에 맞게', '관리까지 맡기세요'],
};
const SUB_TAIL = {
  '혜택 강조': '설치비·등록비 면제, 묶음 상담으로 부담 줄이기',
  '정보 전달': '방문관리로 필터 교체까지 맡기실 수 있습니다',
  '친근하게': '이사 일정에 맞춰 설치까지 잡아드릴게요',
};
const CTA = { '혜택 강조': '상담 예약하기', '정보 전달': '견적 받기', '친근하게': '지금 문의하기' };

function cut(s, max) {
  if (s.length <= max) return s;
  // 구분점으로 나뉜 문구는 뒤 항목을 통째로 버린다 — 중간에서 자르면 "방문관리 · 냉온정얼음 ·" 처럼 남는다
  if (s.includes(' · ')) {
    const parts = s.split(' · ');
    while (parts.length > 1 && parts.join(' · ').length > max) parts.pop();
    const joined = parts.join(' · ');
    if (joined.length <= max) return joined;
  }
  const cutAt = s.lastIndexOf(' ', max);
  return (cutAt > max * 0.6 ? s.slice(0, cutAt) : s.slice(0, max)).replace(/[·,\s]+$/, '').trim();
}

export function fallback({ products, target = '이사 예정', tone = '혜택 강조', season, limits }) {
  const n = products.length;
  const attrs = p => [p.care, p.feature, p.color].filter(Boolean).join(' · ');
  const heads = HEAD[target] || HEAD['이사 예정'];
  const nWord = n > 1 ? `${n}종 ` : '';
  const mk = (angle, head, sub, cta) => {
    const a = screen(cut(head, limits.headline));
    const b = screen(cut(sub, limits.subline));
    return {
      angle, headline: a.text, subline: b.text, cta: cut(cta, limits.cta),
      labels: products.map(p => cut(attrs(p) || p.name, limits.label)),
      badge: angle === 'benefit' ? (season ? cut(season + ' 혜택', 8) : '단독 혜택') : null,
      _screened: [...a.hits, ...b.hits],
    };
  };
  const first = products[0] || {};
  return [
    mk('benefit', `${heads[0].replace('한 번에', nWord + '한 번에')}`, SUB_TAIL[tone] || SUB_TAIL['혜택 강조'], CTA[tone] || '상담 예약하기'),
    mk('scene', heads[1], attrs(first) || '방문관리 · 냉온정 · 화이트', '지금 문의하기'),
    mk('price', `${nWord ? nWord + '묶음' : '이 제품'} 이렇게 준비했어요`, attrs(first) || '방문관리 · 냉온정 · 화이트', '견적 받기'),
  ];
}

// 서버측 재검사 — 프롬프트를 신뢰하지 않는다
export function validate(c, limits, products) {
  const errs = [];
  if (c.headline.length > limits.headline) errs.push(`headline ${c.headline.length}/${limits.headline}`);
  if (c.subline.length > limits.subline) errs.push(`subline ${c.subline.length}/${limits.subline}`);
  if (c.cta.length > limits.cta) errs.push(`cta ${c.cta.length}/${limits.cta}`);
  if ('price' in c || 'notice' in c) errs.push('가격·고지문 필드 발견 → 폐기');
  if (/\d{3,}\s*원|월\s*\d/.test(c.headline + c.subline)) errs.push('문구에 금액 등장 → 폐기');
  const s = screen(c.headline + ' ' + c.subline);
  if (!s.passed) errs.push('금지어: ' + s.hits.map(h => h.kind).join(','));
  // 3속성 순서 검사 (관리 → 기능 → 색상)
  const p0 = products[0] || {};
  if (p0.care && p0.color && c.subline.includes(p0.care) && c.subline.includes(p0.color)) {
    if (c.subline.indexOf(p0.care) > c.subline.indexOf(p0.color)) errs.push('3속성 순서 위반');
  }
  return { ok: errs.length === 0, errs };
}
