import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { get, list, put } from '@vercel/blob';

export const cloud = process.env.VERCEL === '1';
const options = { access: 'private', addRandomSuffix: false };
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);

export function ownerOf(req, res) {
  if (!cloud) return 'local';
  const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('skmasic_owner='))?.slice(14);
  const owner = cookie && /^[0-9a-f-]{36}$/.test(cookie) ? cookie : randomUUID();
  if (owner !== cookie) res.setHeader('set-cookie', `skmasic_owner=${owner}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`);
  return owner;
}

export function sessionId(value) {
  if (value == null) return randomUUID();
  if (!validId(value)) throw Object.assign(new Error('잘못된 생성 요청입니다'), { statusCode: 400 });
  return value;
}

async function readJson(key) {
  const result = await get(key, { access: 'private', useCache: false });
  return result ? JSON.parse(await new Response(result.stream).text()) : null;
}

export async function readLibrary(owner, localFile) {
  if (!cloud) return existsSync(localFile) ? JSON.parse(await readFile(localFile, 'utf8')) : { items: [] };
  const items = [];
  let cursor;
  do {
    const page = await list({ prefix: `library/${owner}/`, cursor });
    const batch = await Promise.all(page.blobs.map(blob => readJson(blob.pathname)));
    items.push(...batch.filter(Boolean));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return { items: items.sort((a, b) => b.savedAt.localeCompare(a.savedAt)) };
}

async function writeLocal(file, lib) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(lib, null, 2));
}

export async function saveLibrary(owner, localFile, data) {
  if (!validId(data.session) || !Array.isArray(data.files) || !data.files.length || data.files.length > 4 ||
      data.files.some(file => typeof file !== 'string' || !/^[a-zA-Z0-9_.-]+\.png$/.test(file))) {
    throw Object.assign(new Error('저장할 배너를 확인해주세요'), { statusCode: 400 });
  }
  const item = { session: data.session, files: data.files,
    styleId: String(data.styleId || '').slice(0, 100), styleName: String(data.styleName || '').slice(0, 100),
    target: String(data.target || '').slice(0, 100), products: Array.isArray(data.products) ? data.products.slice(0, 12).map(p => String(p).slice(0, 200)) : [],
    title: String(data.title || '').slice(0, 200), sizes: Array.isArray(data.sizes) ? data.sizes.slice(0, 4) : [],
    greeting: String(data.greeting || '').slice(0, 5000), tags: Array.isArray(data.tags) ? data.tags.slice(0, 20) : [],
    id: randomUUID(), savedAt: new Date().toISOString(), star: false };
  if (cloud) {
    // Each entry has its own object: concurrent saves cannot replace another entry.
    await put(`library/${owner}/${item.id}.json`, JSON.stringify(item), { ...options, contentType: 'application/json' });
  } else {
    const lib = await readLibrary(owner, localFile);
    lib.items.unshift(item);
    await writeLocal(localFile, lib);
  }
  const lib = await readLibrary(owner, localFile);
  return { ok: true, count: lib.items.length };
}

export async function starLibrary(owner, localFile, id) {
  if (!validId(id)) throw Object.assign(new Error('잘못된 보관함 항목입니다'), { statusCode: 400 });
  if (cloud) {
    const key = `library/${owner}/${id}.json`;
    const item = await readJson(key);
    if (!item) throw Object.assign(new Error('보관함 항목이 없습니다'), { statusCode: 404 });
    item.star = !item.star;
    await put(key, JSON.stringify(item), { ...options, allowOverwrite: true, contentType: 'application/json' });
    return { ok: true, star: item.star };
  }
  const lib = await readLibrary(owner, localFile);
  const item = lib.items.find(it => it.id === id);
  if (item) item.star = !item.star;
  await writeLocal(localFile, lib);
  return { ok: true, star: item?.star };
}

export async function persistBanners(owner, session, outDir, results) {
  if (!cloud) return;
  for (const result of results.filter(r => r.pass)) {
    const buffer = await readFile(path.join(outDir, result.file));
    const name = `${path.basename(result.file, '.png')}-${randomUUID()}.png`;
    await put(`banners/${owner}/${session}/${name}`, buffer, { ...options, contentType: 'image/png' });
    result.file = name;
  }
}

export async function serveBanner(owner, pathname, res) {
  const [session, file, extra] = pathname.slice(5).split('/');
  if (!validId(session) || !file || !/^[a-zA-Z0-9_.-]+\.png$/.test(file) || extra) {
    res.writeHead(404); return res.end('not found');
  }
  const result = await get(`banners/${owner}/${session}/${file}`, { access: 'private' });
  if (!result) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'private, no-store' });
  res.end(Buffer.from(await new Response(result.stream).arrayBuffer()));
}
