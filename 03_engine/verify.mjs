#!/usr/bin/env node
// 환경 자체점검 — 새 PC 에서 제일 먼저 돌린다. 무엇이 되고 무엇이 막혔는지 한 화면에 보여준다.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const rows = [];
const ok = (n, d) => rows.push({ s: 'OK', n, d });
const warn = (n, d) => rows.push({ s: '주의', n, d });
const bad = (n, d) => rows.push({ s: '실패', n, d });

/* Node */
const [maj] = process.versions.node.split('.').map(Number);
maj >= 20 ? ok('Node', process.version) : bad('Node', `${process.version} — 20 이상 필요`);

/* playwright + chromium */
let chromium = null;
try { ({ chromium } = await import('playwright')); ok('playwright', '모듈 로드'); }
catch { bad('playwright', 'npm install 후 npx playwright install chromium'); }

if (chromium) {
  const launch = {};
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  try {
    const b = await chromium.launch(launch);
    const p = await b.newPage();
    await p.setContent('<b id="x">ok</b>');
    const t = await p.textContent('#x');
    await b.close();
    t === 'ok' ? ok('Chromium', launch.executablePath || '기본 번들') : bad('Chromium', '렌더 확인 실패');
  } catch (e) {
    const msg = String(e).split('\n')[0];
    const hint = /Executable doesn't exist/.test(msg)
      ? 'npx playwright install chromium  (또는 기존 Chromium 경로를 .env 의 PLAYWRIGHT_CHROMIUM_PATH 에 지정)'
      : msg.slice(0, 100);
    bad('Chromium', hint);
  }
}

/* 폰트 */
const fdir = path.join(ROOT, '03_engine/fonts');
const need = ['noto-sans-kr-korean-400-normal.woff2', 'noto-sans-kr-korean-700-normal.woff2',
              'roboto-latin-400-normal.woff2', 'roboto-latin-700-normal.woff2'];
const miss = need.filter(f => !existsSync(path.join(fdir, f)));
miss.length ? bad('폰트', `누락 ${miss.length}개: ${miss[0]} 등`) : ok('폰트', `${need.length}개 확인 · 로컬 임베드`);

/* 로고 */
// 폴더 존재만 보면 README 만 있어도 OK 로 나온다 — 실제 로고 파일을 확인한다
const logoDir = path.join(ROOT, '01_spec/assets/logo');
const LOGO_NAMES = ['logo.svg', 'logo.png', 'logo-black.svg', 'logo-black.png'];
const LOGO_DARK = ['logo-white.svg', 'logo-white.png'];
const haveLight = LOGO_NAMES.filter(f => existsSync(path.join(logoDir, f)));
const haveDark = LOGO_DARK.filter(f => existsSync(path.join(logoDir, f)));
if (haveLight.length && haveDark.length) ok('로고', `${haveLight[0]} + ${haveDark[0]}`);
else if (haveLight.length) warn('로고', `${haveLight[0]} 만 있음 — 어두운 스타일용 logo-white 없음`);
else warn('로고', '없음 — 배너에 빈 슬롯으로 렌더 (01_spec/assets/logo/README.md 참고)');

/* 카탈로그 */
const catDir = path.join(ROOT, '02_data/catalog');
const cands = ['products.json', 'products.sample.json'].map(f => path.join(catDir, f)).filter(existsSync);
if (!cands.length) bad('카탈로그', '02_data/catalog 비어 있음 — npm run crawl 필요');
else {
  const f = cands[0];
  try {
    const c = JSON.parse(readFileSync(f, 'utf8'));
    const age = (Date.now() - new Date(c.syncedAt).getTime()) / 86400000;
    const label = `${path.basename(f)} · 상품 ${c.products?.length ?? 0}종 · ${age.toFixed(1)}일 경과`;
    if (path.basename(f).includes('sample')) warn('카탈로그', label + ' — 샘플이다. 실제 수확 필요');
    else if (age > 7) warn('카탈로그', label + ' — 7일 초과, 배너 생성 차단됨');
    else ok('카탈로그', label);
  } catch (e) { bad('카탈로그', '파싱 실패: ' + String(e).slice(0, 70)); }
}

/* 트림 이미지 */
const tdir = path.join(ROOT, '02_data/assets/trimmed');
let nTrim = 0;
try { nTrim = (await import('node:fs')).readdirSync(tdir).filter(f => /\.(png|jpg|webp)$/i.test(f)).length; } catch {}
nTrim ? ok('제품 이미지', `트림본 ${nTrim}개`) : warn('제품 이미지', '없음 — 자리표시자로 렌더 (HANDOFF C)');

/* 네트워크 */
const probe = async (label, url, hint) => {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000);
    const r = await fetch(url, { method: 'GET', signal: c.signal, redirect: 'follow' });
    clearTimeout(t);
    // 403 / 407 은 대개 사내·컨테이너 egress 프록시의 거부다. "응답이 왔다"를 도달로 오판하지 않는다.
    if (r.status >= 200 && r.status < 400) ok(label, `HTTP ${r.status} · 도달`);
    else if (r.status === 403 || r.status === 407) bad(label, `HTTP ${r.status} 차단 — ${hint} (사내 프록시/방화벽 또는 봇 차단)`);
    else warn(label, `HTTP ${r.status} — ${hint}`);
  } catch (e) { bad(label, `도달 불가 — ${hint}`); }
};
await probe('skmagic.com', (process.env.SKMAGIC_BASE || 'https://www.skmagic.com') + '/', '크롤러 실행 불가');
await probe('static CDN', (process.env.SKMAGIC_CDN || 'https://static.skmagic.com') + '/image/goods/G000069846/G000069846_2.png', '실제 제품 사진 사용 불가');

/* OpenAI */
process.env.OPENAI_API_KEY
  ? ok('OpenAI', `키 있음 · 모델 ${process.env.OPENAI_MODEL_COPY || 'gpt-5.1'}`)
  : warn('OpenAI', '키 없음 — 문구는 규칙 폴백으로 생성됨 (동작에는 문제 없음)');

/* 출력 */
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)));
console.log('\nSK MASIC 환경 점검\n' + '─'.repeat(78));
for (const r of rows) console.log(`${pad(r.s, 5)} ${pad(r.n, 16)} ${r.d}`);
console.log('─'.repeat(78));
const nb = rows.filter(r => r.s === '실패').length, nw = rows.filter(r => r.s === '주의').length;
console.log(`실패 ${nb} · 주의 ${nw} · 정상 ${rows.length - nb - nw}`);

const next = [];
if (rows.some(r => r.n === 'skmagic.com' && r.s === 'OK')) next.push('npm run crawl        # 실제 상품DB 패턴 수확');
else next.push('skmagic.com 차단 해제 확인 후 npm run crawl (사내망이면 프록시 예외 요청)');
if (rows.some(r => r.n === '제품 이미지' && r.s !== 'OK')) next.push('HANDOFF.md 의 C 단계 — 이미지 트림기 구현');
if (rows.some(r => r.n === '로고' && r.s !== 'OK')) next.push('01_spec/assets/logo/ 에 로고 원본 배치');
next.push('npm run poc          # 배너 재생성 후 qa-report.json 비교');
console.log('\n다음 할 일');
next.forEach(s => console.log('  · ' + s));
console.log('');
process.exit(nb ? 1 : 0);
