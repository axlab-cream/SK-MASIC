// 조건부 가격 배치 (D-33). 값은 상세 페이지가 스스로 말한 것만 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { placeConditionalPrice } from './catalog/index.mjs';
import { priceTiers, notice } from './llm/compliance.mjs';

// G000069406 워커힐 클라우드 매트리스 — "최종 할인가" 라벨이 없고
// 기본 할인가 11,450원 자체가 6개월 한정가다.
const LABEL_LESS_CONDITIONAL = {
  base: 27900, sale: 11450, promoPrice: null,
  promoTerms: { months: 6, fromMonth: 7, afterPrice: 22900 },
};

// G000069931 MEGA ICE mini — "최종 할인가" 라벨이 있는 일반적인 모양
const LABELLED_CONDITIONAL = {
  base: 62900, sale: 43900, promoPrice: 21950,
  promoTerms: { months: 18, fromMonth: 19, afterPrice: 43900 },
};

test('라벨 없는 조건부 가격을 promoPrice 로 옮기고 상시가를 sale 로 세운다', () => {
  const cp = placeConditionalPrice(LABEL_LESS_CONDITIONAL);
  assert.equal(cp.promoPrice, 11450, '조건부 가격이 promoPrice 여야 한다');
  assert.equal(cp.sale, 22900, '7개월차부터의 금액이 상시가여야 한다');
  assert.deepEqual(cp.promoTerms, LABEL_LESS_CONDITIONAL.promoTerms);
});

test('이미 제자리에 있는 조건부 가격은 건드리지 않는다', () => {
  const cp = placeConditionalPrice(LABELLED_CONDITIONAL);
  assert.equal(cp.promoPrice, 21950);
  assert.equal(cp.sale, 43900);
});

test('조건 문장이 없는 상시가 상품은 그대로 둔다', () => {
  const cp = placeConditionalPrice({ base: 37900, sale: 24900, promoPrice: null, promoTerms: null });
  assert.equal(cp.sale, 24900);
  assert.equal(cp.promoPrice, null);
  assert.equal(cp.promoTerms, null);
});

test('위계가 맞지 않는 조건 문장은 가격을 옮기지 않고 조건을 버린다', () => {
  // 조건 종료 후 금액이 기준 구독료보다 비싸다 — 이 문장은 이 상품 것이 아니다
  const cp = placeConditionalPrice({ base: 27900, sale: 11450, promoPrice: null,
    promoTerms: { months: 6, fromMonth: 7, afterPrice: 39900 } });
  assert.equal(cp.sale, 11450, '원래 값을 바꾸지 않는다');
  assert.equal(cp.promoPrice, null);
  assert.equal(cp.promoTerms, null, '믿을 수 없는 조건은 싣지 않는다');
});

test('배치 후 배너 가격 3단과 필수 고지문이 실제 페이지와 같아진다', () => {
  const cp = placeConditionalPrice(LABEL_LESS_CONDITIONAL);
  const product = { ...LABEL_LESS_CONDITIONAL, ...cp, term: 7 };
  const tiers = priceTiers(product);
  assert.equal(tiers.strike, 27900);
  assert.equal(tiers.hero, 11450);
  assert.equal(tiers.standing, 22900);
  assert.ok(tiers.heroConditional, '조건부로 표시되어야 고지문이 붙는다');

  const text = notice([product]);
  assert.match(text, /최초 6개월 적용/);
  assert.match(text, /7개월차부터 월 22,900원/);
});

test('배치 전에는 고지문이 빠진다 — 이 테스트가 회귀를 잡는다', () => {
  const raw = { ...LABEL_LESS_CONDITIONAL, term: 7 };
  assert.ok(!priceTiers(raw).heroConditional);
  assert.doesNotMatch(notice([raw]), /최초 6개월 적용/);
});
