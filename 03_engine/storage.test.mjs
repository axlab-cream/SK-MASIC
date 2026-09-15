import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { sessionId, saveLibrary, readLibrary, starLibrary } from './storage.mjs';
import { handler } from './server.mjs';

test('session paths reject traversal and encoded separators', () => {
  for (const value of ['../outside', 'a/b', 'a\\b', '%2f', '', {}, '__proto__/x']) {
    assert.throws(() => sessionId(value), { statusCode: 400 });
  }
  assert.match(sessionId(), /^[0-9a-f-]{36}$/);
});

test('local library preserves existing entries and response fields', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'skmasic-test-'));
  const file = path.join(dir, 'library.json');
  try {
    await writeFile(file, JSON.stringify({ items: [{ id: 'existing', title: 'preserved', star: false }] }));
    const saved = await saveLibrary('local', file, { session: 'test', files: ['banner.png'], styleName: 'Original',
      products: ['Product'], target: 'Target', greeting: 'Hello', id: 'existing' });
    assert.equal(saved.count, 2);
    const { items } = await readLibrary('local', file);
    assert.equal(items[1].title, 'preserved');
    assert.notEqual(items[0].id, 'existing');
    assert.equal(items[0].styleName, 'Original');
    assert.deepEqual(items[0].products, ['Product']);
    assert.equal((await starLibrary('local', file, items[0].id)).star, true);
    const before = await readFile(file, 'utf8');
    await assert.rejects(saveLibrary('local', file, { session: '../escape', files: ['banner.png'] }), { statusCode: 400 });
    assert.equal(await readFile(file, 'utf8'), before);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('API serves catalog and rejects invalid generation requests', async () => {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const meta = await (await fetch(`${base}/api/meta`)).json();
    // 상품 수는 SK매직 라인업이 바뀔 때마다 달라진다. 숫자를 박아두면 크롤이 정상일 때도
    // 테스트가 깨진다 — API 가 카탈로그 파일을 그대로 서빙하는지만 확인한다.
    const catalog = JSON.parse(await readFile(new URL('../02_data/catalog/products.json', import.meta.url), 'utf8'));
    assert.equal(meta.products.length, catalog.products.length);
    assert.ok(meta.products.length > 20, `카탈로그가 너무 작다 (${meta.products.length}종)`);
    assert.equal(meta.stale, false, '카탈로그가 7일을 넘기면 배너 생성이 차단된다');
    for (const route of ['copy', 'render', 'sizes']) {
      const result = await fetch(`${base}/api/${route}`, { method: 'POST', body: '{}' });
      assert.equal(result.status, 400);
    }
    const result = await fetch(`${base}/api/library`, { method: 'POST', headers: { origin: 'https://other.example' }, body: '{}' });
    assert.equal(result.status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
