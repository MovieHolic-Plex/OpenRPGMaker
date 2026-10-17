import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';

const [run4Dir, run5Dir, projectFile, outFile] = process.argv.slice(2);
if (!run4Dir || !run5Dir || !projectFile || !outFile) throw Error('Usage: opening-pixel-run5-metrics.mjs <run4-frames> <run5-frames> <project.json> <out.json>');

function files(dir) {
  return fs.readdirSync(dir).filter((file) => /^f_\d+\.png$/u.test(file)).sort().map((file) => path.join(dir, file));
}
function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}
function frameMetrics(frame) {
  const colors = new Set();
  let brightness = 0;
  let nearWhite = 0;
  for (let i = 0; i < frame.data.length; i += 4) {
    const key = `${frame.data[i]},${frame.data[i + 1]},${frame.data[i + 2]}`;
    colors.add(key);
    brightness += (0.2126 * frame.data[i] + 0.7152 * frame.data[i + 1] + 0.0722 * frame.data[i + 2]) / 255;
    if (frame.data[i] > 245 && frame.data[i + 1] > 245 && frame.data[i + 2] > 245) nearWhite += 1;
  }
  let equal = 0, pairs = 0;
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const i = (y * frame.width + x) * 4;
    if (x + 1 < frame.width) { pairs += 1; const j = i + 4; if (frame.data[i] === frame.data[j] && frame.data[i + 1] === frame.data[j + 1] && frame.data[i + 2] === frame.data[j + 2]) equal += 1; }
    if (y + 1 < frame.height) { pairs += 1; const j = i + frame.width * 4; if (frame.data[i] === frame.data[j] && frame.data[i + 1] === frame.data[j + 1] && frame.data[i + 2] === frame.data[j + 2]) equal += 1; }
  }
  return { colours: colors.size, neighbourEqualRatio: pairs ? equal / pairs : 1, meanBrightness: brightness / (frame.width * frame.height), nearWhiteRatio: nearWhite / (frame.width * frame.height) };
}
function changedRate(a, b) {
  let changed = 0, pixels = a.width * a.height;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) changed += 1;
  return changed / pixels;
}
function hueSaturation(frame) {
  let hueX = 0, hueY = 0, saturation = 0, count = 0;
  for (let i = 0; i < frame.data.length; i += 4) {
    const r = frame.data[i] / 255, g = frame.data[i + 1] / 255, b = frame.data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
    if (d === 0) continue;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= Math.PI / 3;
    hueX += Math.cos(h); hueY += Math.sin(h); saturation += s; count += 1;
  }
  return { hue: count ? (Math.atan2(hueY, hueX) * 180 / Math.PI + 360) % 360 : 0, saturation: count ? saturation / count : 0 };
}
function sourceImageStats(project, resourceId) {
  const dataUrl = project.assets?.uploaded?.[resourceId]?.dataUrl;
  if (!dataUrl?.startsWith('data:image/png;base64,')) return null;
  try { return hueSaturation(PNG.sync.read(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'))); } catch { return null; }
}
const percentile = (values, p) => values.length ? values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] : 0;
function summarize(dir) {
  const paths = files(dir), frames = paths.map(readPng), stats = frames.map(frameMetrics);
  const changes = [];
  for (let i = 1; i < frames.length; i += 1) changes.push(changedRate(frames[i - 1], frames[i]));
  return {
    frameCount: frames.length,
    maxColours: Math.max(...stats.map((s) => s.colours), 0),
    minNeighbourEqualRatio: Math.min(...stats.map((s) => s.neighbourEqualRatio), 1),
    meanNeighbourEqualRatio: stats.length ? stats.reduce((n, s) => n + s.neighbourEqualRatio, 0) / stats.length : 0,
    changedPixelRatePerFrame: { p10: percentile(changes, 0.1), median: percentile(changes, 0.5), p90: percentile(changes, 0.9), max: Math.max(...changes, 0) },
    meanBrightness: stats.length ? stats.reduce((n, s) => n + s.meanBrightness, 0) / stats.length : 0,
  };
}
function perShotSummary(dir, project) {
  const paths = files(dir), frames = paths.map(readPng), rows = [];
  let offset = 0;
  for (const scene of project.system?.opening?.scenes ?? []) {
    if (scene.kind !== 'animatic') continue;
    const count = Math.max(2, Math.round((scene.durationMs / 1000) * 12));
    const shotFrames = frames.slice(offset, offset + count);
    const stats = shotFrames.map(frameMetrics), changes = [];
    for (let i = 1; i < shotFrames.length; i += 1) changes.push(changedRate(shotFrames[i - 1], shotFrames[i]));
    rows.push({
      shotId: scene.id,
      durationMs: scene.durationMs,
      frameCount: shotFrames.length,
      maxColours: Math.max(...stats.map((s) => s.colours), 0),
      minNeighbourEqualRatio: Math.min(...stats.map((s) => s.neighbourEqualRatio), 1),
      meanNeighbourEqualRatio: stats.length ? stats.reduce((n, s) => n + s.neighbourEqualRatio, 0) / stats.length : 0,
      changedPixelRatePerFrame: { median: percentile(changes, 0.5), max: Math.max(...changes, 0) },
      meanBrightness: stats.length ? stats.reduce((n, s) => n + s.meanBrightness, 0) / stats.length : 0,
      nearWhiteRatio: stats.length ? stats.reduce((n, s) => n + s.nearWhiteRatio, 0) / stats.length : 0,
      sourceHueSaturation: (() => {
        const bg = scene.composition.layers.find((layer) => layer.kind === 'image' && layer.role === 'background');
        const source = bg?.resourceId ? sourceImageStats(project, bg.resourceId) : null;
        const rendered = shotFrames.length ? hueSaturation(shotFrames[Math.floor(shotFrames.length / 2)]) : null;
        if (!source || !rendered) return null;
        const delta = Math.abs(source.hue - rendered.hue);
        return { hueErrorDegrees: Math.min(delta, 360 - delta), sourceSaturation: source.saturation, renderedSaturation: rendered.saturation };
      })(),
      nearWhiteRatio: stats.length ? stats.reduce((n, s) => n + s.nearWhiteRatio, 0) / stats.length : 0,
    });
    offset += count;
  }
  return rows;
}
function boundaryBrightnessJumps(dir, project) {
  const frames = files(dir).map(readPng), jumps = [];
  let offset = 0;
  const mean = (frame) => frameMetrics(frame).meanBrightness;
  const scenes = (project.system?.opening?.scenes ?? []).filter((scene) => scene.kind === 'animatic');
  for (let i = 0; i < scenes.length - 1; i += 1) {
    offset += Math.max(2, Math.round((scenes[i].durationMs / 1000) * 12));
    if (frames[offset - 1] && frames[offset]) jumps.push({ from: scenes[i].id, to: scenes[i + 1].id, brightnessJump: Math.abs(mean(frames[offset]) - mean(frames[offset - 1])) });
  }
  return jumps;
}
const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
const recordFile = path.join(path.dirname(run5Dir), 'record.json');
const record = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : {};
const backdropHashes = [];
for (const scene of project.system?.opening?.scenes ?? []) {
  if (scene.kind !== 'animatic') continue;
  const layer = scene.composition.layers.find((candidate) => candidate.kind === 'image' && candidate.role === 'background');
  const asset = layer?.resourceId ? project.assets?.uploaded?.[layer.resourceId] : null;
  const bytes = asset?.dataUrl ?? layer?.resourceId ?? '';
  backdropHashes.push({ shotId: scene.id, resourceId: layer?.resourceId ?? null, hash: crypto.createHash('sha256').update(bytes).digest('hex') });
}
const result = {
  generatedAt: new Date().toISOString(),
  before: summarize(run4Dir),
  after: summarize(run5Dir),
  afterPerShot: perShotSummary(run5Dir, project),
  boundaryBrightnessJumps: boundaryBrightnessJumps(run5Dir, project),
  sceneCount: project.system?.opening?.scenes?.length ?? 0,
  handoff: {
    ...(record.handoff ?? {}),
    beforeInput: record.beforeInput ?? null,
    afterInput: record.afterInput ?? null,
    positionChanged: record.beforeInput?.player && record.afterInput?.player
      ? record.beforeInput.player.x !== record.afterInput.player.x || record.beforeInput.player.y !== record.afterInput.player.y
      : null,
  },
  titleGate: record.titleGate ?? null,
  backdropHashes,
  distinctBackdropHashes: new Set(backdropHashes.map((row) => row.hash)).size,
  shotCountWithBackdrops: backdropHashes.length,
  targets: { coloursPerFrame: 2000, neighbourEqualRatio: 0.6 },
};
fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
