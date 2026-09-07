#!/usr/bin/env node
// MC 화면 로컬 서버 — 의존성 없이 node:http 만 쓴다.
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { cloud, ownerOf, sessionId, readLibrary, saveLibrary, starLibrary, persistBanners, serveBanner } from './storage.mjs';
import { SIZES } from './layout/spec.mjs';
import { STYLES } from './layout/styles.mjs';
import { ROOT, makeCopy, renderStyle, greeting } from './pipeline.mjs';
import { priceVisibility } from './llm/compliance.mjs';
import { closeBrowser } from './render/shoot.mjs';

const PORT = Number(process.env.PORT || 5173);
const OUT = path.join(ROOT, '04_output/ui');
const LIB = path.join(ROOT, '02_data/library.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': MIME['.json'] }); res.end(JSON.stringify(obj)); };
const body = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 4e6) no(new Error('too large')); });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); });

async function catalog() {
  for (const f of ['products.json', 'products.sample.json']) {
    const p = path.join(ROOT, '02_data/catalog', f);
    if (existsSync(p)) return { ...JSON.parse(await readFile(p, 'utf8')), _file: f };
  }
  return { syncedAt: null, products: [], _file: null };
}

async function serveFile(res, file) {
  if (!existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
                       'cache-control': 'no-store' });
  res.end(await readFile(file));
}

// MC 표기 — 문자열이든 객체든 같은 모양으로 정규화한다
const mcOf = b => {
  const c = b.consultant;
  if (!c) return null;
  if (typeof c === 'string') return { name: c, phone: b.phone || '' };
  return { name: c.name || '', phone: c.phone || b.phone || '' };
};

export async function handler(req, res) {
  let temporaryDir;
  try {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = decodeURIComponent(u.pathname);
  res.setHeader('cache-control', 'private, no-store');
  if (req.method === 'POST' && req.headers.origin && req.headers.origin !== `https://${req.headers.host}` &&
      req.headers.origin !== `http://${req.headers.host}`) return json(res, 403, { error: '허용되지 않은 요청입니다' });
  const owner = ownerOf(req, res);
    /* ── 정적 ── */
    if (p === '/' || p === '/index.html') return serveFile(res, path.join(ROOT, '03_engine/ui/index.html'));
    if (p.startsWith('/fonts/')) return serveFile(res, path.join(ROOT, '03_engine/fonts', path.basename(p)));
    // 제품 사진 — 트림된 것을 우선 주고, 없으면 원본으로 떨어진다
    if (p.startsWith('/assets/')) {
      const name = path.basename(p);
      const trimmed = path.join(ROOT, '02_data/assets/trimmed', name);
      return serveFile(res, existsSync(trimmed) ? trimmed : path.join(ROOT, '02_data/assets/original', name));
    }
    if (p.startsWith('/out/')) {
      if (cloud) return await serveBanner(owner, p, res);
      return await serveFile(res, path.join(OUT, p.slice(5).split('/').map(s => path.basename(s)).join(path.sep)));
    }

    /* ── 메타 ── */
    if (p === '/api/meta') {
      const cat = await catalog();
      const age = cat.syncedAt ? (Date.now() - new Date(cat.syncedAt).getTime()) / 86400000 : null;
      return json(res, 200, {
        products: cat.products, catalogFile: cat._file, syncedAt: cat.syncedAt,
        catalogAgeDays: age == null ? null : +age.toFixed(1), stale: age != null && age > 7,
        sizes: Object.entries(SIZES).map(([k, s]) => ({ key: k, ...s })),
        styles: Object.entries(STYLES).map(([k, s]) => ({ id: k, name: s.name, hint: s.hint,
          recommended: !!s.recommended, requiresIce: !!s.requiresIce })),
        hasOpenAI: !!process.env.OPENAI_API_KEY,
      });
    }

    /* ── 2단계: 문구 ── */
    if (p === '/api/copy' && req.method === 'POST') {
      const b = await body(req);
      validateGeneration(b);
      const cat = await catalog();
      const products = b.productIds.map(id => cat.products.find(x => x.goodsId === id)).filter(Boolean);
      if (!products.length) return json(res, 400, { error: '상품을 찾을 수 없습니다' });
      const r = await makeCopy({ products, target: b.target, tone: b.tone, season: b.season, sizeKey: b.sizeKey });
      return json(res, 200, { ...r, priceVisibility: priceVisibility(products) });
    }

    /* ── 3단계: 스타일 시안 병렬 프리렌더 ── */
    if (p === '/api/render' && req.method === 'POST') {
      const b = await body(req);
      validateGeneration(b);
      const cat = await catalog();
      const products = b.productIds.map(id => cat.products.find(x => x.goodsId === id)).filter(Boolean);
      const usable = b.copy ? [b.copy] : (await makeCopy({ products, ...b })).usable;
      if (!usable.length) return json(res, 400, { error: '사용 가능한 문구가 없습니다' });
      const session = sessionId(b.session);
      const outDir = cloud ? (temporaryDir = await mkdtemp(path.join(os.tmpdir(), 'skmasic-'))) : path.join(OUT, session);
      await mkdir(outDir, { recursive: true });
      const hasIce = products.some(x => x.ice);
      const styleIds = b.styleIds?.length ? b.styleIds : Object.keys(STYLES);
      const results = [];
      for (const styleId of styleIds) {
        results.push(await renderStyle({ products, usable, styleId, sizeKey: b.sizeKey,
          consultant: mcOf(b), season: b.season, outDir, hasIce }));
      }
      const shown = results.filter(r => r.pass);
      await persistBanners(owner, session, outDir, results);
      return json(res, 200, { session, results, shown: shown.length,
        hidden: results.filter(r => !r.pass && !r.excluded).length,
        excluded: results.filter(r => r.excluded).length });
    }

    /* ── 4단계: 선택 스타일을 여러 규격으로 ── */
    if (p === '/api/sizes' && req.method === 'POST') {
      const b = await body(req);
      validateGeneration(b, true);
      const cat = await catalog();
      const products = b.productIds.map(id => cat.products.find(x => x.goodsId === id)).filter(Boolean);
      const session = sessionId(b.session);
      const outDir = cloud ? (temporaryDir = await mkdtemp(path.join(os.tmpdir(), 'skmasic-'))) : path.join(OUT, session);
      await mkdir(outDir, { recursive: true });
      const hasIce = products.some(x => x.ice);
      const out = [];
      for (const sizeKey of b.sizeKeys) {
        const c = await makeCopy({ products, target: b.target, tone: b.tone, season: b.season, sizeKey });
        if (!c.usable.length) { out.push({ sizeKey, error: '문구 생성 실패' }); continue; }
        out.push(await renderStyle({ products, usable: c.usable, styleId: b.styleId, sizeKey,
          consultant: mcOf(b), season: b.season, outDir, hasIce }));
      }
      const pv = priceVisibility(products);
      const first = out.find(o => o.copy);
      await persistBanners(owner, session, outDir, out);
      return json(res, 200, { session, results: out,
        greeting: first ? greeting({ products, copy: first.copy, priceShown: pv.show }) : '' });
    }

    /* ── 보관함 ── */
    if (p === '/api/library' && req.method === 'GET') return json(res, 200, await readLibrary(owner, LIB));
    if (p === '/api/library' && req.method === 'POST') {
      const b = await body(req);
      return json(res, 200, await saveLibrary(owner, LIB, b));
    }
    if (p === '/api/library/star' && req.method === 'POST') {
      const b = await body(req);
      return json(res, 200, await starLibrary(owner, LIB, b.id));
    }

    res.writeHead(404); res.end('not found');
  } catch (e) {
    const status = e.statusCode || 500;
    if (status === 500) console.error('Request failed:', e.name, (e.stack || '').split('\n').filter(line => line.trim().startsWith('at ')).slice(0, 4).join('\n'));
    json(res, status, { error: status === 500 ? '처리 중 오류가 발생했습니다. 다시 시도해주세요.' : e.message });
  } finally {
    if (temporaryDir) await rm(temporaryDir, { recursive: true, force: true });
  }
}

function validateGeneration(b, multiple = false) {
  const valid = Array.isArray(b.productIds) && b.productIds.length > 0 && b.productIds.length <= 12 &&
    b.productIds.every(id => typeof id === 'string') &&
    (multiple ? Array.isArray(b.sizeKeys) && b.sizeKeys.length > 0 && b.sizeKeys.length <= 4 && b.sizeKeys.every(k => Object.hasOwn(SIZES, k)) && Object.hasOwn(STYLES, b.styleId)
      : Object.hasOwn(SIZES, b.sizeKey)) &&
    (!b.styleIds || (Array.isArray(b.styleIds) && b.styleIds.length <= 6 && b.styleIds.every(k => Object.hasOwn(STYLES, k))));
  if (!valid) throw Object.assign(new Error('상품과 배너 규격을 확인해주세요'), { statusCode: 400 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
const server = createServer(handler);
server.listen(PORT, () => {
  console.log(`\nSK MASIC · MC 화면\n  http://localhost:${PORT}\n`);
  console.log(`카탈로그  ${path.relative(ROOT, path.join(ROOT, '02_data/catalog'))}`);
  console.log(`산출물    ${path.relative(ROOT, OUT)}`);
  console.log(`문구      ${process.env.OPENAI_API_KEY ? 'OpenAI' : '규칙 폴백 (OPENAI_API_KEY 없음)'}\n`);
});
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { await closeBrowser(); process.exit(0); });
}
