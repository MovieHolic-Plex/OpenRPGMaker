// All audiovisual presets in the shipping player. GIFs have no audio; capture real audio separately.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { ATMOSPHERE_SCENES, ATMOSPHERE_GENRES, normalizeAtmosphereEffects } from '../../../src/project/atmosphere.ts';
import { startPlayerQaServer, runRuntimeQa, performObservedFrames } from '../../lib/runtimeQaRun.mjs';
process.env.WEATHER_QA_KIND = 'none';
const { default: scenario } = await import('./weather-quality.scenario.mjs');
const template = JSON.parse(await readFile(scenario.projectFixture, 'utf8'));
const root = resolve('.omo/evidence/atmosphere-30');
await mkdir(root, { recursive: true });
if (ATMOSPHERE_SCENES.length !== 30 || new Set(ATMOSPHERE_SCENES.map(p => p.id)).size !== 30) throw new Error('Expected 30 distinct presets');
for (const genre of ATMOSPHERE_GENRES) if (ATMOSPHERE_SCENES.filter(p => p.genre === genre).length !== 5) throw new Error(`Wrong genre count: ${genre}`);
const catalog = ATMOSPHERE_SCENES.map(p => ({ ...p, effects: normalizeAtmosphereEffects(p.effects) }));
await writeFile(join(root, 'catalog.json'), JSON.stringify(catalog, null, 2));
const requested = process.env.ATMOSPHERE_QA_PRESETS?.split(',');
const presets = requested ? catalog.filter(p => requested.includes(p.id)) : catalog;
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    window.ambienceCaptures = [];
    AudioNode.prototype.connect = function(destination, ...args) {
      const result = connect.call(this, destination, ...args);
      if (destination === this.context.destination) {
        const context = this.context;
        const stream = context.createMediaStreamDestination(), analyser = context.createAnalyser();
        connect.call(this, stream); connect.call(this, analyser);
        const chunks = [], recorder = new MediaRecorder(stream.stream, { mimeType: 'audio/webm;codecs=opus' });
        recorder.ondataavailable = event => chunks.push(event.data);
        recorder.start();
        window.ambienceCaptures.push({ context, analyser, chunks, recorder });
      }
      return result;
    };
  });
  for (const preset of presets) {
    const project = structuredClone(template), map = project.maps[project.startMapId];
    map.atmosphereEffects = preset.effects;
    const fixture = join(root, `${preset.id}.project.json`);
    await writeFile(fixture, JSON.stringify(project));
    const out = resolve(`verify-shots/runtime-qa/preset-${preset.id}`);
    const report = await runRuntimeQa(page, { ...scenario, id: `preset-${preset.id}`, projectFixture: fixture,
      viewport: { width: 640, height: 480 }, beats: scenario.beats.slice(0, 2) }, { serverUrl: server.url, outDir: out });
    const summary = await readFile(join(out, 'SUMMARY.md'), 'utf8');
    console.log(summary.split('\n').filter(line => /게이트:|런타임 에러/.test(line)).join('\n'));
    if (report.errors.length || report.beats.some(beat => beat.failures.length)) throw new Error(`Failed ${preset.id}: ${out}/SUMMARY.md`);
    const dir = join(root, preset.id);
    await mkdir(dir, { recursive: true });
    const errors = [], samples = [];
    const onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    for (let index = 0; index < 60; index++) {
      await performObservedFrames(page, { frames: 6, deltaMs: 16 });
      await page.screenshot({ path: join(dir, `${String(index).padStart(3, '0')}.png`) });
      if (index % 5 === 0) samples.push(await page.evaluate(() => {
        const c = window.ambienceCaptures.at(-1);
        if (!c) throw new Error('Missing ambience bus');
        const data = new Float32Array(c.analyser.fftSize); c.analyser.getFloatTimeDomainData(data);
        return { state: c.context.state, rms: Math.sqrt(data.reduce((a, b) => a + b * b, 0) / data.length), peak: Math.max(...data.map(Math.abs)) };
      }));
    }
    const bytes = await page.evaluate(async () => {
      const c = window.ambienceCaptures.at(-1);
      return new Promise(resolve => {
        c.recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(c.chunks).arrayBuffer())));
        c.recorder.stop();
      });
    });
    page.off('pageerror', onError);
    if (errors.length || !samples.some(s => s.rms > 0.00001) || samples.some(s => s.state !== 'running' || s.peak >= 0.99)) throw new Error(`Audio/render failure: ${preset.id} ${JSON.stringify({ samples, errors })}`);
    await writeFile(join(root, `${preset.id}.webm`), Buffer.from(bytes));
    const audio = spawnSync('ffmpeg', ['-y','-loglevel','error','-i',join(root,`${preset.id}.webm`),'-t','8',join(root,`${preset.id}.mp3`)]);
    if (audio.status) throw new Error('Audio encoding failed');
    await writeFile(join(dir, 'receipt.json'), JSON.stringify({ id: preset.id, label: preset.label, genre: preset.genre, frames: 60, frameMs: 96, source: 'player.html', effects: preset.effects, samples, errors }, null, 2));
    console.log(`Captured ${preset.id}: 60 frames + real ambience, ${catalog.findIndex(p => p.id === preset.id) + 1}/30`);
  }
} finally { await browser?.close(); await server.close(); }
