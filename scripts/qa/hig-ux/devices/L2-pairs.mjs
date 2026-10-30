#!/usr/bin/env node
// Before/after PNG pairs for lane L2. before-after.mjs only knows label steps, and L2 changes the
// English labels those steps would look for, so this runner opens each surface through the data-testid prepare
// functions exported as `pairs` from L2.mjs and composes with before-after.mjs's composeSideBySide.
//   node scripts/qa/hig-ux/devices/L2-pairs.mjs --before-url <baseline> --after-url <head> --out-dir <dir> [--only key,key]
import fs from 'node:fs';
import path from 'node:path';
import * as lib from '../lib.mjs';
import { composeSideBySide } from '../before-after.mjs';
import { pairs, surfaces } from './L2.mjs';

const args = lib.parseArgs(process.argv.slice(2), { 'before-url': 'str', 'after-url': 'str', 'out-dir': 'str', only: 'str' });
if (!args['before-url'] || !args['after-url'] || !args['out-dir']) {
  console.error('usage: L2-pairs.mjs --before-url <url> --after-url <url> --out-dir <dir> [--only key,key]');
  process.exit(2);
}
const only = (args.only ?? '').split(',').filter(Boolean);
fs.mkdirSync(args['out-dir'], { recursive: true });

async function capture(browser, baseUrl, pair) {
  const surface = { width: 1440, height: 900, lang: 'ko', dsf: 1, ...surfaces[pair.surface] };
  const { ctx, page } = await lib.openSurface(browser, baseUrl, surface);
  try {
    await pair.prepare({ page });
    await page.waitForTimeout(500);
    return await page.screenshot({ animations: 'disabled', timeout: 30_000 });
  } finally {
    await ctx.close();
  }
}

const browser = await lib.launchBrowser();
let failures = 0;
try {
  for (const [key, pair] of Object.entries(pairs)) {
    if (only.length && !only.includes(key)) continue;
    try {
      const before = await capture(browser, args['before-url'], pair);
      const after = await capture(browser, args['after-url'], pair);
      const png = await composeSideBySide(browser, before, after, { beforeLabel: 'before (baseline)', afterLabel: 'after (L2)', title: key });
      fs.writeFileSync(path.join(args['out-dir'], `${key}.png`), png);
      console.log(`ok   ${key}`);
    } catch (e) {
      failures++;
      console.log(`FAIL ${key} ${String(e.message).split('\n')[0].slice(0, 200)}`);
    }
  }
} finally {
  await browser.close();
}
process.exitCode = failures ? 1 : 0;
