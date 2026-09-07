// 제품 이미지 여백 트림 — 겹침 문제의 절반이 여기서 해결된다 (layout-rules 규칙 5)
// 추가 의존성 없이 이미 필요한 Chromium 으로 픽셀 bbox 를 계산한다.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getBrowser } from '../render/shoot.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

/**
 * 원본 1장을 트림한다.
 * @param {string} src 원본 경로
 * @param {string} dst 출력 경로 (.png)
 * @param {object} o  alphaMin: 이 알파 미만은 배경 / whiteTol: 흰색 판정 허용치 / pad: 트림 후 남길 여백(px)
 * @returns {{bbox:object, before:object, after:object, ratio:number}|null}
 */
export async function trimOne(src, dst, { alphaMin = 12, whiteTol = 8, pad = 2 } = {}) {
  const ext = path.extname(src).toLowerCase();
  if (!MIME[ext]) return null;
  const b64 = (await readFile(src)).toString('base64');
  const dataUrl = `data:${MIME[ext]};base64,${b64}`;

  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 8, height: 8 } });
  try {
    const out = await page.evaluate(async ({ dataUrl, alphaMin, whiteTol, pad }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, W, H).data;

      // 배경 판정: 투명하거나(알파 낮음) 흰색에 가까우면 배경
      const isBg = i => {
        const a = d[i + 3];
        if (a < alphaMin) return true;
        return d[i] >= 255 - whiteTol && d[i + 1] >= 255 - whiteTol && d[i + 2] >= 255 - whiteTol;
      };
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!isBg((y * W + x) * 4)) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return { empty: true, W, H };   // 전부 배경 — 트림하지 않는다

      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
      x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
      const w = x1 - x0 + 1, h = y1 - y0 + 1;

      const o = document.createElement('canvas');
      o.width = w; o.height = h;
      // 투명 배경을 유지한다 — 어떤 스타일의 imgBg 위에도 얹을 수 있어야 한다
      o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
      return { empty: false, W, H, x0, y0, w, h, png: o.toDataURL('image/png') };
    }, { dataUrl, alphaMin, whiteTol, pad });

    if (out.empty) return { empty: true, before: { w: out.W, h: out.H } };
    await mkdir(path.dirname(dst), { recursive: true });
    await writeFile(dst, Buffer.from(out.png.split(',')[1], 'base64'));
    return {
      bbox: { x: out.x0, y: out.y0, w: out.w, h: out.h },
      before: { w: out.W, h: out.H }, after: { w: out.w, h: out.h },
      ratio: +(1 - (out.w * out.h) / (out.W * out.H)).toFixed(3),   // 잘라낸 여백 비율
    };
  } finally { await page.close(); }
}

/** 폴더 일괄 트림 */
export async function trimAll({ srcDir, dstDir, opts } = {}) {
  const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
  srcDir ||= path.join(root, '02_data/assets/original');
  dstDir ||= path.join(root, '02_data/assets/trimmed');
  if (!existsSync(srcDir)) return { report: [], note: `원본 폴더 없음: ${srcDir}` };
  const files = (await readdir(srcDir)).filter(f => MIME[path.extname(f).toLowerCase()]);
  const report = [];
  for (const f of files) {
    const dst = path.join(dstDir, path.basename(f, path.extname(f)) + '.png');
    try {
      const r = await trimOne(path.join(srcDir, f), dst, opts);
      report.push({ file: f, ...(r || { skipped: true }) });
      const msg = r?.empty ? '전부 배경 — 건너뜀'
        : r ? `${r.before.w}×${r.before.h} → ${r.after.w}×${r.after.h} (여백 ${(r.ratio * 100).toFixed(0)}% 제거)`
            : '지원하지 않는 형식';
      console.log(`  ${f}  ${msg}`);
    } catch (e) { report.push({ file: f, error: String(e).slice(0, 100) }); console.warn(`  ! ${f}: ${e}`); }
  }
  await mkdir(dstDir, { recursive: true });
  await writeFile(path.join(dstDir, 'trim.json'), JSON.stringify({ trimmedAt: new Date().toISOString(), report }, null, 2));
  return { report, dstDir };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { closeBrowser } = await import('../render/shoot.mjs');
  await trimAll(); await closeBrowser();
}
