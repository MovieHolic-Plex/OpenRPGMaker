// Actual shipping-player frames, one preset per clip; compose contact sheets after capture.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { startPlayerQaServer, runRuntimeQa, performObservedFrames } from '../../lib/runtimeQaRun.mjs';
process.env.WEATHER_QA_KIND = 'none';
const { default: scenario } = await import('./weather-quality.scenario.mjs');
const template = JSON.parse(await readFile(scenario.projectFixture, 'utf8'));
const kinds = (process.env.ATMOSPHERE_QA_KINDS ?? 'leaves,petals,dust,sand,fireflies,magic,spirits,poison,ash,embers,smog,steam,leaks,sparks,sunrays,underwater').split(',');
const evidence = resolve('.omo/evidence/atmosphere');
await mkdir(evidence, { recursive: true });
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  const page = await browser.newPage();
  const receipts = [];
  for (const kind of kinds) {
    const project = structuredClone(template);
    project.maps[project.startMapId].atmosphereEffects = [{ kind, amount: 0.8, speed: 1, size: 1.3, opacity: 0.85 }];
    const fixture = join(evidence, `${kind}.project.json`);
    await writeFile(fixture, JSON.stringify(project));
    const out = resolve(`verify-shots/runtime-qa/atmosphere-${kind}`);
    const report = await runRuntimeQa(page, { ...scenario, id: `atmosphere-${kind}`, projectFixture: fixture,
      viewport: { width: 640, height: 480 }, beats: scenario.beats.slice(0, 2) }, { serverUrl: server.url, outDir: out });
    const summary = await readFile(join(out, 'SUMMARY.md'), 'utf8');
    console.log(summary.split('\n').filter(line => /게이트:|런타임 에러/.test(line)).join('\n'));
    if (report.errors.length || report.beats.some(beat => beat.failures.length)) throw new Error(`Failed ${kind}: read ${out}/SUMMARY.md`);
    const frames = join(evidence, kind);
    await mkdir(frames, { recursive: true });
    const errors = [];
    const errorHandler = error => errors.push(error.message);
    page.on('pageerror', errorHandler);
    for (let index = 0; index < 60; index++) {
      await performObservedFrames(page, { frames: 6, deltaMs: 16 });
      await page.screenshot({ path: join(frames, `${String(index).padStart(3, '0')}.png`) });
    }
    page.off('pageerror', errorHandler);
    if (errors.length) throw new Error(errors.join('\n'));
    receipts.push({ kind, frames: 60, frameMs: 96, errors });
    await writeFile(join(evidence, 'receipts.json'), JSON.stringify(receipts, null, 2));
    console.log(`Captured ${kind}: 60 real frames`);
  }
} finally { await browser?.close(); await server.close(); }
