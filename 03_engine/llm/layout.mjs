// LAYOUT_ADVISE — 패턴 후보가 2개 이상일 때만 호출한다 (DECISIONS D-17)
// 규칙 엔진이 이미 후보를 좁혔으므로 LLM 은 "고르기"만 한다. 좌표를 만들지 않는다.
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['pick', 'reason'],
  properties: {
    pick: { type: 'string', description: '후보 패턴 key 중 하나' },
    reason: { type: 'string', description: '한 문장. MC 화면에는 노출하지 않는다' },
  },
};

const sys = `너는 배너 레이아웃 패턴을 고른다. 주어진 후보 중 하나의 key 만 고른다.
판단 기준(우선순위 순):
1. 텍스트가 들어갈 여유 — headline 글자수가 많으면 텍스트 영역이 넓은 패턴
2. 시선 흐름 — 가로형은 좌→우, 세로형은 위→아래
3. 대표 제품 강조 — HERO 가 가격·부피에서 두드러지면 큰 슬롯을 주는 패턴
후보에 없는 key 를 고르면 안 된다. 좌표나 크기를 만들지 않는다.`;

/**
 * @returns {{pick:string, reason:string, source:'openai'|'rule'}}
 */
export async function advise({ candidates, size, products, copy },
  { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL_LAYOUT || 'gpt-5.1-mini' } = {}) {
  const keys = candidates.map(c => c.key);
  const ruleAnswer = { pick: keys[0], reason: '규칙 엔진 1순위', source: 'rule' };
  if (!apiKey || keys.length < 2) return ruleAnswer;
  try {
    const input = {
      size: { w: size.w, h: size.h, label: size.label, ratio: +(size.w / size.h).toFixed(2) },
      candidates: candidates.map(c => ({ key: c.key, name: c.name })),
      products: products.map(p => ({ name: p.name, sale: p.sale, kind: p.kind })),
      copy: { headline: copy.headline, headlineLen: copy.headline.length,
              sublineLen: copy.subline.length, limits: size.limits },
    };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(input) }],
        response_format: { type: 'json_schema', json_schema: { name: 'pick', strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const j = JSON.parse((await res.json()).choices[0].message.content);
    // 후보에 없는 key 를 반환하면 규칙 엔진 답으로 되돌린다
    if (!keys.includes(j.pick)) return { ...ruleAnswer, reason: `LLM 이 후보 밖 "${j.pick}" 반환 → 규칙 1순위로 대체` };
    return { pick: j.pick, reason: j.reason, source: 'openai' };
  } catch (e) {
    return { ...ruleAnswer, reason: `LLM 실패(${String(e).slice(0, 50)}) → 규칙 1순위` };
  }
}
