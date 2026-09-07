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
    assert.equal(meta.products.length, 92);
    for (const route of ['copy', 'render', 'sizes']) {
      const result = await fetch(`${base}/api/${route}`, { method: 'POST', body: '{}' });
      assert.equal(result.status, 400);
    }
    const result = await fetch(`${base}/api/library`, { method: 'POST', headers: { origin: 'https://other.example' }, body: '{}' });
    assert.equal(result.status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
