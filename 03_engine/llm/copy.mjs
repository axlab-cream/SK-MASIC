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
const SCENES = {
  '이사 예정': {
    '9월 이사철': ['가을 이사 준비', '새집 가전 구성', '이사 전 설치'],
    '환절기': ['환절기 이사 준비', '새집 생활 가전', '이사 후 관리'],
    '추석': ['추석 이사 준비', '명절 새집 맞이', '명절 전 설치'],
    '연말': ['연말 이사 준비', '새해 새집 가전', '연말 설치 일정'],
  },
  '신혼': {
    '9월 이사철': ['가을 신혼 살림', '둘이 고르는 가전', '신혼집 설치'],
    '환절기': ['환절기 신혼 살림', '둘의 생활 가전', '신혼집 가전 관리'],
    '추석': ['첫 명절 살림', '신혼집 손님맞이', '명절 가전 준비'],
    '연말': ['연말 신혼 살림', '둘의 새해 준비', '신혼 가전 상담'],
  },
  '1인가구': {
    '9월 이사철': ['가을 1인 살림', '혼자 쓰는 가전', '1인 가전 설치'],
    '환절기': ['환절기 1인 살림', '나의 생활 가전', '1인 가전 관리'],
    '추석': ['추석 1인 살림', '나를 위한 가전', '명절 전 가전'],
    '연말': ['연말 1인 살림', '나의 새해 가전', '1인 살림 점검'],
  },
  '사무실': {
    '9월 이사철': ['가을 사무실 가전', '업무 공간 가전', '사무실 설치'],
    '환절기': ['환절기 사무실', '함께 쓰는 가전', '사무실 가전 관리'],
    '추석': ['명절 사무실 준비', '연휴 전 가전', '사무실 가전 상담'],
    '연말': ['연말 사무실 준비', '새해 업무 공간', '사무실 가전 점검'],
  },
};
const TONES = {
  '혜택 강조': { endings: ['조건 비교', '구성 비교', '혜택 확인'], ctas: ['조건 상담하기', '구성 문의하기', '혜택 확인하기'] },
  '정보 전달': { endings: ['살펴보기', '구성 안내', '상담 안내'], ctas: ['제품 상담하기', '구성 확인하기', '상담 예약하기'] },
  '친근하게': { endings: ['같이 볼까요', '함께 골라요', '물어봐요'], ctas: ['함께 골라보기', '편하게 문의하기', '지금 물어보기'] },
};
const BADGES = { '9월 이사철': '가을 준비', '환절기': '환절기 준비', '추석': '추석 준비', '연말': '새해 준비' };

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
  const attrs = p => [p.care, p.feature, p.color].filter(Boolean).join(' · ');
  const scenes = SCENES[target] || SCENES['이사 예정'];
  const topics = scenes[season] || scenes['9월 이사철'];
  const voice = TONES[tone] || TONES['혜택 강조'];
  const mk = (angle, head, sub, cta) => {
    const a = screen(cut(head, limits.headline));
    const b = screen(cut(sub, limits.subline));
    return {
      angle, headline: a.text, subline: b.text, cta: cut(cta, limits.cta),
      labels: products.map(p => cut(attrs(p) || p.name, limits.label)),
      badge: angle === 'benefit' ? BADGES[season] || '가전 준비' : null,
      _screened: [...a.hits, ...b.hits],
    };
  };
  const first = products[0] || {};
  return ['benefit', 'scene', 'price'].map((angle, i) =>
    mk(angle, `${topics[i]} ${voice.endings[i]}`, attrs(first) || first.name || '선택 상품 상담', voice.ctas[i]));
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
