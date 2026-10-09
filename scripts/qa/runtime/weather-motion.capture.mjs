// Capture actual shipping-player frames at native speed; no interpolated or generated frames.
// WEATHER_QA_KIND=cloud node scripts/qa/runtime/weather-motion.capture.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer, runRuntimeQa, performObservedFrames } from '../../lib/runtimeQaRun.mjs';

process.env.WEATHER_QA_KIND ??= 'cloud';
const { default: scenario } = await import('./weather-quality.scenario.mjs');
const kind = process.env.WEATHER_QA_KIND;
const label = process.env.WEATHER_QA_AMOUNT === undefined ? `${kind}-motion-v2` : `${kind}-amount-${process.env.WEATHER_QA_AMOUNT}`;
const out = resolve(`verify-shots/runtime-qa/${label}-capture`);
const evidence = resolve('.omo/evidence/weather-quality');
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  const page = await browser.newPage();
  const report = await runRuntimeQa(page, {
    ...scenario, id: `${label}-capture`, viewport: { width: 640, height: 480 }, beats: scenario.beats.slice(0, 2),
  }, { serverUrl: server.url, outDir: out });
  if (report.errors.length || report.beats.some(beat => beat.failures.length)) throw new Error('Runtime boot failed; read SUMMARY.md');
  const framesDir = join(out, 'frames');
  await mkdir(framesDir, { recursive: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const states = [];
  for (let index = 0; index < 125; index++) {
    // 5 native frames × 16ms = 80ms per GIF frame, 125 samples = 10 seconds at 1× speed.
    await performObservedFrames(page, { frames: 5, deltaMs: 16 });
    await page.screenshot({ path: join(framesDir, `${String(index).padStart(3, '0')}.png`) });
    if (index % 25 === 0) {
      states.push(await page.evaluate(() => window.__oprnCloudShadows?.()));
      console.log(`Captured ${index + 1}/125 frames`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await mkdir(evidence, { recursive: true });
  const target = join(evidence, `${label}.gif`);
  const encode = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12.5', '-i', join(framesDir, '%03d.png'),
    '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a',
    '-loop', '0', target], { stdio: 'inherit' });
  if (encode.status !== 0) throw new Error('GIF encoding failed');
  await writeFile(join(evidence, `${label}.json`), JSON.stringify({ durationSeconds: 10, frameCount: 125,
    frameDurationMs: 80, viewport: { width: 640, height: 480 }, source: 'player.html', states, errors }, null, 2));
  console.log(target);
} finally {
  await browser?.close();
  await server.close();
}
