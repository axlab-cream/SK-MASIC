import { mkdir, readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import path from 'node:path';

async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await check(file);
    else if (file.endsWith('.mjs')) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }
}
await check('03_engine');
await check('api');
const html = await readFile('03_engine/ui/index.html', 'utf8');
for (const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
await mkdir('public', { recursive: true });
console.log('Build passed: server and browser JavaScript syntax checked; Vercel function entry ready.');
