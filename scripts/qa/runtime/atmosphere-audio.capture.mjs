import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { ATMOSPHERE_SCENES, normalizeAtmosphereEffects } from '../../../src/project/atmosphere.ts';
import { startPlayerQaServer, runRuntimeQa, resumeRuntimeFrames } from '../../lib/runtimeQaRun.mjs';
process.env.WEATHER_QA_KIND = 'none';
const { default: scenario } = await import('./weather-quality.scenario.mjs');
const template = JSON.parse(await readFile(scenario.projectFixture, 'utf8'));
const evidence = resolve('.omo/evidence/atmosphere');
await mkdir(evidence, { recursive: true });
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    window.atmosphereCaptures = [];
    AudioNode.prototype.connect = function(destination, ...args) {
      const result = connect.call(this, destination, ...args);
      if (destination === this.context.destination) {
        const context = this.context;
        const stream = context.createMediaStreamDestination(), analyser = context.createAnalyser();
        connect.call(this, stream); connect.call(this, analyser);
        const chunks = [], recorder = new MediaRecorder(stream.stream, { mimeType: 'audio/webm;codecs=opus' });
        recorder.ondataavailable = event => chunks.push(event.data);
        recorder.start();
        window.atmosphereCaptures.push({ context, analyser, recorder, chunks });
      }
      return result;
    };
  });
  const receipts = [];
  for (const id of ['enchanted-forest', 'sunken-temple', 'bamboo-grove', 'power-station']) {
    const preset = ATMOSPHERE_SCENES.find(p => p.id === id);
    const project = structuredClone(template);
    const map = project.maps[project.startMapId];
    map.atmosphereEffects = normalizeAtmosphereEffects(preset.effects);
    const next = structuredClone(map); next.id = 'qa_silent'; next.name = 'Silent QA'; next.events = []; delete next.atmosphereEffects;
    project.maps[next.id] = next;
    const clear = map.events.find(e => e.id === 'qa_clear_weather');
    clear.commands = [{ kind: 'transfer', mapId: next.id, ...project.startPos, fade: 'none' }];
    clear.pages[0].commands = clear.commands;
    const fixture = join(evidence, `${id}.project.json`);
    await writeFile(fixture, JSON.stringify(project));
    const out = resolve(`verify-shots/runtime-qa/atmosphere-audio-${id}`);
    const report = await runRuntimeQa(page, { ...scenario, id: `atmosphere-audio-${id}`, projectFixture: fixture,
      viewport: { width: 640, height: 480 }, beats: scenario.beats.slice(0, 2) }, { serverUrl: server.url, outDir: out });
    const summary = await readFile(join(out, 'SUMMARY.md'), 'utf8');
    console.log(summary.split('\n').filter(line => /게이트:|런타임 에러/.test(line)).join('\n'));
    if (report.errors.length || report.beats.some(beat => beat.failures.length)) throw new Error(`Failed ${id}: ${out}/SUMMARY.md`);
    await resumeRuntimeFrames(page);
    await page.waitForTimeout(8500);
    const result = await page.evaluate(async () => {
      const { getAudioEngine } = await import('/src/player/audio/index.ts');
      const engine = getAudioEngine(), capture = window.atmosphereCaptures.at(-1);
      if (!capture) throw new Error('No WebAudio ambience');
      const rms = () => {
        const data = new Float32Array(capture.analyser.fftSize);
        capture.analyser.getFloatTimeDomainData(data);
        return Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
      };
      let audible = 0;
      for (let n = 0; n < 12; n++) { audible = Math.max(audible, rms()); await new Promise(resolve => setTimeout(resolve, 100)); }
      engine.setVolume('se', 0); await new Promise(resolve => setTimeout(resolve, 500)); const muted = rms();
      engine.setVolume('se', 0.8); await new Promise(resolve => setTimeout(resolve, 500));
      let restored = 0;
      for (let n = 0; n < 12; n++) { restored = Math.max(restored, rms()); await new Promise(resolve => setTimeout(resolve, 100)); }
      const bytes = await new Promise(resolve => {
        capture.recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(capture.chunks).arrayBuffer())));
        capture.recorder.stop();
      });
      return { audible, muted, restored, bytes };
    });
    if (!(result.audible > 0.0001 && result.muted < 0.0001 && result.restored > 0.0001)) throw new Error(JSON.stringify({ ...result, bytes: undefined }));
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(1800);
    const stopped = await page.evaluate(() => ({ map: window.__oprnDebug.readState().currentMapId,
      state: window.atmosphereCaptures.at(-1).context.state }));
    if (stopped.map !== 'qa_silent' || stopped.state !== 'closed') throw new Error(`Map transfer audio leak: ${JSON.stringify(stopped)}`);
    await writeFile(join(evidence, `${id}.webm`), Buffer.from(result.bytes)); delete result.bytes;
    const encode = spawnSync('ffmpeg', ['-y','-loglevel','error','-i',join(evidence,`${id}.webm`),'-t','8',join(evidence,`${id}.mp3`)]);
    if (encode.status) throw new Error('Audio encode failed');
    receipts.push({ id, ...result, stopped, errors: report.errors });
    await writeFile(join(evidence, 'scene-audio.json'), JSON.stringify(receipts, null, 2));
    console.log(`Recorded ${id}: ${JSON.stringify(result)}, transfer stopped audio`);
  }
} finally { await browser?.close(); await server.close(); }
