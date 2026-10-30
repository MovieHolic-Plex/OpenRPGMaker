#!/usr/bin/env node
// Capture the same surfaces on two builds and compose side-by-side PNGs (canvas in the
// already-running Chromium; no PIL). Surfaces come from a lane module or a JSON file.
//   node scripts/qa/hig-ux/before-after.mjs --before-url http://127.0.0.1:9881 --after-url http://127.0.0.1:9882 \
//     --lane selftest --out-dir .vite-cache/hig-ux-evidence/ba-selftest
// --surfaces <file.json> takes [{id,width,height,lang,dsf,steps}] instead of --lane.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as lib from './lib.mjs';
import { pageSummaryProbe } from './probes.mjs';

const USAGE =
  'usage: before-after.mjs --before-url <url> --after-url <url> (--lane <name> | --surfaces <file.json>) --out-dir <dir> [--only id,id] [--before-label s] [--after-label s] [--headed]';

async function capture(browser, baseUrl, surface) {
  const { ctx, page, log } = await lib.openSurface(browser, baseUrl, surface);
  try {
    await lib.runSteps(page, surface.steps ?? [], { lang: surface.lang, log });
    await page.waitForTimeout(400);
    const png = await page.screenshot({ animations: 'disabled', timeout: 30_000 });
    const probe = await pageSummaryProbe(page);
    return { png, probe, stepErrors: log.stepErrors, viaOverflow: log.viaOverflow };
  } finally {
    await ctx.close();
  }
}

/** Compose two PNG buffers side by side under labelled headers; returns a PNG buffer. */
export async function composeSideBySide(browser, beforePng, afterPng, { beforeLabel = 'before', afterLabel = 'after', title = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
  try {
    const page = await ctx.newPage();
    const dataUrl = await page.evaluate(
      async ({ a, b, la, lb, title }) => {
        const load = (src) =>
          new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = src;
          });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const gap = 16;
        const head = 44;
        const w = ia.width + ib.width + gap * 3;
        const h = Math.max(ia.height, ib.height) + head + gap;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = '#1d1f24';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffffff';
        g.font = '600 20px sans-serif';
        g.textBaseline = 'middle';
        g.fillText(`${la}${title ? ` - ${title}` : ''}`, gap, head / 2);
        g.fillText(lb, ia.width + gap * 2, head / 2);
        g.drawImage(ia, gap, head);
        g.drawImage(ib, ia.width + gap * 2, head);
        return c.toDataURL('image/png');
      },
      {
        a: `data:image/png;base64,${beforePng.toString('base64')}`,
        b: `data:image/png;base64,${afterPng.toString('base64')}`,
        la: beforeLabel,
        lb: afterLabel,
        title,
      },
    );
    return Buffer.from(dataUrl.split(',')[1], 'base64');
  } finally {
    await ctx.close();
  }
}

async function main() {
  let args;
  try {
    args = lib.parseArgs(process.argv.slice(2), {
      'before-url': 'str', 'after-url': 'str', lane: 'str', surfaces: 'str', 'out-dir': 'str', only: 'str',
      'before-label': 'str', 'after-label': 'str', headed: 'bool',
    });
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    return 2;
  }
  if (!args['before-url'] || !args['after-url'] || !args['out-dir'] || !args.lane === !args.surfaces) {
    console.error(USAGE);
    return 2;
  }
  let surfaces;
  if (args.lane) {
    const mod = await import(pathToFileURL(path.join(lib.HERE, 'devices', `${args.lane}.mjs`)).href);
    surfaces = Object.entries(mod.surfaces).map(([id, s]) => ({ id, ...s }));
  } else {
    surfaces = JSON.parse(fs.readFileSync(args.surfaces, 'utf8'));
  }
  const only = (args.only ?? '').split(',').filter(Boolean);
  surfaces = surfaces
    .filter((s) => !only.length || only.includes(s.id))
    .map((s) => ({ width: 1440, height: 900, lang: 'ko', dsf: 1, ...s }));
  fs.mkdirSync(args['out-dir'], { recursive: true });

  const manifest = [];
  let failures = 0;
  const browser = await lib.launchBrowser({ headed: !!args.headed });
  try {
    for (const s of surfaces) {
      const key = lib.surfaceKey(s);
      const rec = { surface: key };
      try {
        const before = await capture(browser, args['before-url'], s);
        const after = await capture(browser, args['after-url'], s);
        const png = await composeSideBySide(browser, before.png, after.png, {
          beforeLabel: args['before-label'] ?? 'before',
          afterLabel: args['after-label'] ?? 'after',
          title: key,
        });
        fs.writeFileSync(path.join(args['out-dir'], `${key}__before.png`), before.png);
        fs.writeFileSync(path.join(args['out-dir'], `${key}__after.png`), after.png);
        fs.writeFileSync(path.join(args['out-dir'], `${key}.png`), png);
        Object.assign(rec, {
          png: `${key}.png`,
          before: { probe: before.probe, stepErrors: before.stepErrors },
          after: { probe: after.probe, stepErrors: after.stepErrors },
        });
        if (before.stepErrors.length || after.stepErrors.length) failures++;
        console.log(`ok   ${key}${before.stepErrors.length + after.stepErrors.length ? ' (step errors)' : ''}`);
      } catch (e) {
        rec.fatal = String(e.message).split('\n')[0].slice(0, 200);
        failures++;
        console.log(`FAIL ${key} ${rec.fatal}`);
      }
      manifest.push(rec);
    }
  } finally {
    await browser.close();
  }
  lib.writeJson(path.join(args['out-dir'], 'manifest.json'), { beforeUrl: args['before-url'], afterUrl: args['after-url'], surfaces: manifest });
  console.log(`DONE ${manifest.length} surfaces, ${failures} with errors -> ${args['out-dir']}`);
  return failures ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
