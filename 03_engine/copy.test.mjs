import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fallback, validate } from './llm/copy.mjs';
import { SIZES } from './layout/spec.mjs';

const { products } = JSON.parse(await readFile(new URL('../02_data/catalog/products.json', import.meta.url), 'utf8'));
const targets = ['이사 예정', '신혼', '1인가구', '사무실'];
const seasons = ['9월 이사철', '환절기', '추석', '연말'];
const tones = ['혜택 강조', '정보 전달', '친근하게'];

test('all 48 option combinations produce three valid copies at every size', () => {
  const representatives = [...new Map(products.map(p => [p.kind, p])).values()];
  for (const product of representatives) {
    for (const size of Object.values(SIZES)) {
      const variants = new Set();
      for (const target of targets) for (const season of seasons) for (const tone of tones) {
        const copies = fallback({ products: [product], target, season, tone, limits: size.limits });
        assert.equal(copies.length, 3);
        assert.equal(new Set(copies.map(c => c.headline)).size, 3);
        for (const c of copies) {
          assert.deepEqual(validate(c, size.limits, [product]), { ok: true, errs: [] });
          assert.ok(c.badge == null || c.badge.length <= 8);
          assert.equal(c.labels.length, 1);
          assert.ok(c.labels.every(label => label.length <= size.limits.label));
          assert.doesNotMatch(c.headline + c.subline, /무료|면제|단독|\d종|깨끗한 물/);
          const attrs = [product.care, product.feature, product.color].filter(Boolean).join(' · ');
          if (attrs) assert.ok(attrs.startsWith(c.subline));
        }
        variants.add(JSON.stringify(copies));
      }
      assert.equal(variants.size, 48, `${product.kind} ${size.label}`);
    }
  }
});

test('missing product attributes do not fabricate a care mode, function or color', () => {
  const copies = fallback({ products: [{ name: '확인 중인 상품' }], limits: SIZES.W0800.limits });
  for (const c of copies) assert.equal(c.subline, '확인 중인 상품');
});
