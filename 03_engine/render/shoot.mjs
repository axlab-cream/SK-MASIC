import { chromium } from 'playwright';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildHtml } from './template.mjs';
import { SIZES } from '../layout/spec.mjs';

let browser = null;

// 컨테이너/서버에 이미 설치된 Chromium 을 쓰도록 경로를 허용한다.
// PLAYWRIGHT_CHROMIUM_PATH 가 있으면 그것을, 없으면 playwright 기본 번들을 쓴다.
export async function getBrowser() {
  if (browser) return browser;
  const opts = { args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) opts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  browser = await chromium.launch(opts);
  return browser;
}
export async function closeBrowser() { if (browser) { await browser.close(); browser = null; } }

// 고정 뷰포트에서 렌더 — MC 기기 화면 크기와 무관하게 동일 결과 (DECISIONS D-01)
export async function shoot(opts) {
  const size = SIZES[opts.sizeKey];
  const html = buildHtml(opts);
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  // setContent 로 넣으면 페이지 출처가 about:blank 가 되고, 실제 Chrome 은 그 상태에서
  // file:// 하위 리소스(제품 사진·폰트)를 차단한다 — alt 텍스트만 찍힌 배너가 나온다.
  // 임시 파일에 쓰고 file:// 로 열어야 같은 출처가 되어 사진과 폰트가 로드된다.
  const tmp = path.join(os.tmpdir(), `skmasic-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  await writeFile(tmp, html, 'utf8');
  try {
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load', timeout: 30000 });
    // 사진이 실제로 디코드됐는지 확인한다. 깨진 이미지는 QA 에서 걸러야 한다.
    await page.evaluate(() => Promise.all(
      [...document.images].map(im => im.complete ? null : new Promise(r => { im.onload = im.onerror = r; }))));
  } finally {
    await rm(tmp, { force: true }).catch(() => {});
  }

  const report = await page.evaluate(() => window.__run());
  report.images = await page.evaluate(() => [...document.images].map(im => ({
    src: (im.currentSrc || im.src || '').slice(-60), ok: im.naturalWidth > 0 })));
  // QA 는 **화면에 실제로 찍힌** 고지문을 검사해야 한다.
  // 따로 만든 문장을 검사하면, 표시 가격 기준에 따라 달라지는 조건 문장을 놓친다.
  report.noticeText = await page.evaluate(() =>
    document.querySelector('[data-slot="notice"]')?.textContent?.trim() || '');
  const el = await page.$('#banner');
  const buf = await el.screenshot({ type: 'png' });
  await page.close();
  if (opts.outPath) {
    await mkdir(path.dirname(opts.outPath), { recursive: true });
    await writeFile(opts.outPath, buf);
    if (opts.saveHtml) await writeFile(opts.outPath.replace(/\.png$/, '.html'), html);
  }
  return { buf, report, errors, size, bytes: buf.length };
}
