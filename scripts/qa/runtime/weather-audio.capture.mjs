// Shipping-player audio evidence. Capture the real WebAudio destination bus.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { startPlayerQaServer, runRuntimeQa, resumeRuntimeFrames } from '../../lib/runtimeQaRun.mjs';
process.env.WEATHER_QA_KIND ??= 'storm';
const { default: scenario } = await import('./weather-quality.scenario.mjs');
const kind = process.env.WEATHER_QA_KIND;
const out = resolve(`verify-shots/runtime-qa/weather-audio-${kind}`);
const evidence = resolve('.omo/evidence/weather-quality');
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    window.weatherAudioCaptures = [];
    window.weatherThunderStarts = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) {
      if (this.buffer && Math.abs(this.buffer.duration - 2.2) < 0.001) window.weatherThunderStarts++;
      return start.apply(this, args);
    };
    AudioNode.prototype.connect = function(destination, ...args) {
      const result = connect.call(this, destination, ...args);
      if (destination === this.context.destination) {
        const context = this.context;
        const stream = context.createMediaStreamDestination();
        const analyser = context.createAnalyser();
        connect.call(this, stream); connect.call(this, analyser);
        const chunks = [];
        const recorder = new MediaRecorder(stream.stream, { mimeType: 'audio/webm;codecs=opus' });
        recorder.ondataavailable = event => chunks.push(event.data);
        recorder.start();
        window.weatherAudioCaptures.push({ context, analyser, recorder, chunks });
      }
      return result;
    };
  });
  const report = await runRuntimeQa(page, { ...scenario, id: `weather-audio-${kind}`, beats: scenario.beats.slice(0, 2) }, { serverUrl: server.url, outDir: out });
  console.log(await readFile(`${out}/SUMMARY.md`, 'utf8'));
  if (report.errors.length || report.beats.some(beat => beat.failures.length)) throw new Error('Runtime failure');
  await resumeRuntimeFrames(page);
  await page.waitForTimeout(6000);
  const result = await page.evaluate(async () => {
    const { getAudioEngine } = await import('/src/player/audio/index.ts');
    const engine = getAudioEngine();
    const captures = window.weatherAudioCaptures;
    const current = captures.at(-1);
    if (!current) throw new Error('No audio destination connected');
    function rms() {
      const data = new Float32Array(current.analyser.fftSize);
      current.analyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    }
    const audible = rms();
    engine.setVolume('se', 0);
    await new Promise(resolve => setTimeout(resolve, 400));
    const muted = rms();
    engine.setVolume('se', 0.8);
    await new Promise(resolve => setTimeout(resolve, 400));
    const restored = rms();
    const bytes = await new Promise(resolve => {
      current.recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(current.chunks).arrayBuffer())));
      current.recorder.stop();
    });
    engine.stopAll();
    await new Promise(resolve => setTimeout(resolve, 50));
    return { audible, muted, restored, stopped: current.context.state, bytes, contexts: captures.length, thunderStarts: window.weatherThunderStarts };
  });
  if (!(result.audible > 0.001 && result.muted < 0.0001 && result.restored > 0.001 && result.stopped === 'closed')) throw new Error(JSON.stringify({ ...result, bytes: undefined }));
  if (kind === 'storm' && result.thunderStarts < 2) throw new Error('Missing lightning thunder');
  if (kind === 'rain' && result.thunderStarts !== 0) throw new Error('Thunder during plain rain');
  await page.evaluate(() => window.__oprnInput.action());
  await page.waitForTimeout(2000);
  result.weatherCleared = await page.evaluate(() => window.weatherAudioCaptures.at(-1).context.state === 'closed');
  if (!result.weatherCleared) throw new Error('Weather clear left audio running');
  await mkdir(evidence, { recursive: true });
  await writeFile(`${evidence}/${kind}-audio.webm`, Buffer.from(result.bytes));
  delete result.bytes;
  await writeFile(`${evidence}/${kind}-audio.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser?.close(); await server.close(); }
