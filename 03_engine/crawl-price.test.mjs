// Price extraction is anchored to labels on an asynchronously rendered page.
// Every fixture below is verbatim body innerText observed on skmagic.com
// (2026-09-15) - these are the exact shapes the crawler must tell apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPrices, priceShapeOk } from './crawler/pattern.mjs';

const LABELS = { base: '기준 구독료', sale: '기본 할인가', promo: '최종 할인가' };
const read = text => {
  const pr = extractPrices(text, LABELS);
  return { pr, ok: priceShapeOk(pr, text, LABELS) };
};

// G000067185 - 최종 할인가 == 기본 할인가, no conditional sentence.
// The product simply has no conditional promotion; this is a complete page.
const NO_CONDITIONAL_PROMO = `기준 구독료

월 37,900 원

기본 할인가

월 24,900 원

최종 할인가
최종 할인혜택가 안내

월 24,900 원

방문주기 : 12개월 필터주기 4개월, 의무사용 84개월`;

// G000069623 - 최종 할인가 < 기본 할인가 with the sentence stating the terms.
const CONDITIONAL_PROMO = `기준 구독료

월 26,900 원

기본 할인가

월 23,900 원

최종 할인가
최종 할인혜택가 안내

월 11,950 원

방문주기 : 12개월, 의무사용 72개월
구독료 납부 월부터 6개월간 청구되는 구독료이며, 7개월차부터 할인 구독료 월 23,900원이 청구됩니다.`;

// The failure this whole design exists to prevent: 기본 할인가 has rendered its
// label but not its value, so the next amount down the page belongs to 최종 할인가.
const SALE_NOT_YET_RENDERED = `기준 구독료

월 37,900 원

기본 할인가

최종 할인가
최종 할인혜택가 안내

월 24,900 원

방문주기 : 12개월 필터주기 4개월, 의무사용 84개월`;

test('평상시 가격만 있는 상품 — 최종 할인가가 기본 할인가와 같으면 확정한다', () => {
  const { pr, ok } = read(NO_CONDITIONAL_PROMO);
  assert.equal(pr.base, 37900);
  assert.equal(pr.sale, 24900);
  assert.equal(pr.promo, 24900);
  assert.equal(pr.promoTerms, null);
  assert.ok(ok, '조건부 프로모션이 없는 정상 페이지를 거부하면 안 된다');
});

test('조건부 프로모션 상품 — 값과 조건을 함께 읽는다', () => {
  const { pr, ok } = read(CONDITIONAL_PROMO);
  assert.equal(pr.sale, 23900);
  assert.equal(pr.promo, 11950);
  assert.deepEqual(pr.promoTerms, { months: 6, fromMonth: 7, afterPrice: 23900 });
  assert.ok(ok);
});

test('기본 할인가 값이 아직 안 그려졌으면 다음 섹션 금액을 내 값으로 읽지 않는다', () => {
  const { pr, ok } = read(SALE_NOT_YET_RENDERED);
  assert.equal(pr.sale, null, '최종 할인가의 24,900 을 기본 할인가로 집으면 안 된다');
  assert.equal(pr.promo, 24900);
  assert.ok(!ok, '덜 그려진 페이지는 거부하고 다시 읽어야 한다');
});

test('조건부 가격인데 조건 문장이 없으면 거부한다 (D-33)', () => {
  const text = CONDITIONAL_PROMO.replace(/구독료 납부 월부터[^]*$/, '');
  const { pr, ok } = read(text);
  assert.equal(pr.promo, 11950);
  assert.equal(pr.promoTerms, null);
  assert.ok(!ok, '조건을 모르는 조건부 가격은 광고에 쓸 수 없다');
});

test('가격 위계가 뒤집히면 거부한다', () => {
  const { ok } = read(NO_CONDITIONAL_PROMO.replace('월 37,900 원', '월 12,900 원'));
  assert.ok(!ok, '기본 할인가가 기준 구독료보다 비쌀 수 없다');
});
