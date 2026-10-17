// 오프닝 렌더 기록기 — 두 갈래를 한 프로젝트에서 모두 남긴다.
//   A) 공용 렌더러(drawAnimaticFrame: 재생·미리보기·스크러버가 같이 쓰는 함수)로 전 샷을 실제 시간에 따라
//      프레임화 → 컨택트 시트 + mp4. 실제 dev 서버 페이지에서 실제 모듈을 불러 그리므로 번들 애셋 URL 도 그대로 해석된다.
//   B) 실제 출하 경로: player-qa 서버가 서빙하는 player.html(= 내보내기 플레이어 번들)을 띄워 타이틀에서 Enter →
//      오프닝 재생 → 시작 맵 handoff 까지 실제 키 입력으로 통과시키며 webm + 단계 스크린샷을 남긴다.
// 정본·라이브 서비스·원격 저장에는 아무것도 쓰지 않는다.
// 사용: node scripts/qa/opening-pixel-record.mjs <project.json> <outDir> [--dev-url http://127.0.0.1:9904]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../lib/runtimeQaRun.mjs';

const argv = process.argv.slice(2);
const devUrl = (() => { const i = argv.indexOf('--dev-url'); return i < 0 ? 'http://127.0.0.1:9904' : argv[i + 1]; })();
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dev-url');
const [projectPath, outDirRaw] = positional;
if (!projectPath) throw Error('Usage: opening-pixel-record.mjs <project.json> <outDir> [--dev-url http://127.0.0.1:9904]');
const outDir = path.resolve(outDirRaw ?? '/tmp/opening-pixel-record');
const framesDir = path.join(outDir, 'animatic-frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

/* ---------- A. shared renderer through the real dev-server modules ---------- */
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-features=NetworkChangeNotifier'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const renderErrors = [];
page.on('pageerror', (e) => renderErrors.push(String(e.message ?? e)));
await page.route('**/opening-pixel-record.html', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>opening pixel record</title><main id="host"></main>' }));
await page.goto(new URL('/opening-pixel-record.html', devUrl).href);
const rendered = await page.evaluate(async (projectJson) => {
  const project = projectJson;
  const { drawAnimaticFrame } = await import('/src/player/openingAnimaticRenderer.ts');
  const { resolveAssetResourceUrl } = await import('/src/assets/generatedAssetResourceResolver.ts');
  const scenes = project.system?.opening?.scenes ?? [];
  const images = new Map();
  const failures = [];
  for (const scene of scenes) {
    if (scene.kind !== 'animatic') continue;
    for (const layer of scene.composition.layers) {
      if (layer.kind !== 'image' || images.has(layer.resourceId)) continue;
      const url = project.assets?.uploaded?.[layer.resourceId]?.dataUrl ?? resolveAssetResourceUrl(layer.resourceId, { project });
      if (!url) { failures.push(layer.resourceId); continue; }
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = url;
      try { await image.decode(); } catch { failures.push(layer.resourceId); continue; }
      images.set(layer.resourceId, image);
    }
  }
  // 정지 그림/영상 장면의 배경도 컨택트 시트를 위해 미리 디코드한다.
  for (const scene of scenes) {
    if (scene.kind !== 'image' && scene.kind !== 'video') continue;
    if (!scene.resourceId || images.has(scene.resourceId)) continue;
    const url = project.assets?.uploaded?.[scene.resourceId]?.dataUrl ?? resolveAssetResourceUrl(scene.resourceId, { project });
    if (!url) { failures.push(scene.resourceId); continue; }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    try { await image.decode(); } catch { failures.push(scene.resourceId); continue; }
    images.set(scene.resourceId, image);
  }
  const shots = [];
  for (const scene of scenes) {
    if (scene.kind !== 'animatic') {
      // 정지 그림/글/영상 장면도 컨택트 시트에 실제로 그린다 — run-2 처럼 오프닝이 «그림 컷» 으로만
      // 구성되면 pngs 가 비고 layers 가 없어 시트 코드가 죽었다(2026-10-16 실측: Cannot read properties of undefined).
      // 여기는 그림 장면의 공용 DOM 경로를 캔버스로 근사한 것이다 — 실제 재생은 아래 player.html 이 맡는다.
      const canvas = document.createElement('canvas');
      const grid = scene.composition?.pixelGrid;
      const stageW = scene.composition?.width ?? 320, stageH = scene.composition?.height ?? 240;
      const scale = grid ? Math.max(1, Math.floor(480 / grid.width)) : Math.max(1, Math.round(480 / stageW));
      canvas.width = grid ? grid.width * scale : Math.round(stageW * scale);
      canvas.height = grid ? grid.height * scale : Math.round(stageH * scale);
      const ctx = canvas.getContext('2d');
      const fps = 8;
      const count = Math.max(2, Math.round(((scene.durationMs ?? 2000) / 1000) * fps));
      const pngs = [];
      const resourceId = scene.kind === 'image' || scene.kind === 'video' ? scene.resourceId : undefined;
      const image = resourceId ? images.get(resourceId) ?? null : null;
      const backdrop = scene.presentation?.backgroundColor ?? '#000000';
      const bar = scene.kind === 'image' ? Math.round(canvas.height * ((scene.presentation?.letterbox ?? 0) / 100)) : 0;
      const from = scene.direction?.camera?.from ?? [0.5, 0.5, 1], to = scene.direction?.camera?.to ?? from;
      for (let i = 0; i < count; i += 1) {
        const k = count === 1 ? 0 : i / (count - 1);
        const zoom = from[2] + (to[2] - from[2]) * k, cx = from[0] + (to[0] - from[0]) * k, cy = from[1] + (to[1] - from[1]) * k;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true;
        ctx.fillStyle = backdrop; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (image) {
          const cover = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
          const w = image.naturalWidth * cover, h = image.naturalHeight * cover;
          const dx = (canvas.width - w) * cx, dy = (canvas.height - h) * cy;
          ctx.drawImage(image, dx, dy, w, h);
        }
        if (bar > 0) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, bar); ctx.fillRect(0, canvas.height - bar, canvas.width, bar); }
        pngs.push(canvas.toDataURL('image/png'));
      }
      shots.push({
        id: scene.id, kind: scene.kind, durationMs: scene.durationMs ?? 0, pngs, grid: grid ?? null, width: canvas.width, height: canvas.height,
        layers: [],
        caption: scene.kind === 'image' || scene.kind === 'video' ? [] : [String(scene.narration ?? '')].filter(Boolean),
      });
      continue;
    }
    const canvas = document.createElement('canvas');
    const grid = scene.composition.pixelGrid;
    const scale = grid ? Math.max(1, Math.floor(480 / grid.width)) : Math.max(1, Math.round(480 / scene.composition.width));
    canvas.width = grid ? grid.width * scale : Math.round(scene.composition.width * scale);
    canvas.height = grid ? grid.height * scale : Math.round(scene.composition.height * scale);
    const fps = 12;
    const count = Math.max(2, Math.round((scene.durationMs / 1000) * fps));
    const pngs = [];
    for (let i = 0; i < count; i++) {
      const at = Math.round(i * scene.durationMs / (count - 1));
      drawAnimaticFrame(canvas, scene.composition, images, at, { durationMs: scene.durationMs });
      pngs.push(canvas.toDataURL('image/png'));
    }
    shots.push({
      id: scene.id, kind: 'animatic', durationMs: scene.durationMs, pngs, grid: grid ?? null, width: canvas.width, height: canvas.height,
      layers: scene.composition.layers.map((l) => ({ id: l.id, kind: l.kind, resourceId: l.resourceId ?? null, region: l.region?.mode ?? null, glow: !!l.glow, shaft: !!l.shaft, walk: !!l.walk, emote: l.emote?.preset ?? null })),
      caption: scene.composition.layers.filter((l) => l.kind === 'caption').flatMap((l) => (l.caption?.cues ?? []).map((c) => `${(c.atMs / 1000).toFixed(1)}s ${c.text}`)),
    });
  }
  return { shots, failures };
}, project);

let frameIndex = 0;
const sheetRows = [];
for (const shot of rendered.shots) {
  const sampleIndices = [0.16, 0.45, 0.72, 0.92].map((f) => Math.min(shot.pngs.length - 1, Math.max(0, Math.round((shot.pngs.length - 1) * f))));
  const samples = sampleIndices.map((idx) => shot.pngs[idx]).filter(Boolean);
  for (const png of shot.pngs) {
    const file = path.join(framesDir, `f_${String(frameIndex).padStart(5, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'));
    frameIndex += 1;
  }
  sheetRows.push({ id: shot.id, durationMs: shot.durationMs, grid: shot.grid, layers: shot.layers ?? [], caption: shot.caption ?? [], samples: samples.slice(0, 4) });
}
const sheetUrl = await page.evaluate(async (rows) => {
  const cell = 300, lineHeight = Math.round(cell * 9 / 16), header = 20;
  const canvas = document.createElement('canvas');
  canvas.width = 4 * cell; canvas.height = rows.length * (lineHeight + header);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0e1014'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '12px monospace';
  // Draw the decoded images, not just the <img> tags: an unawaited src assignment paints nothing.
  const decoded = await Promise.all(rows.flatMap((row) => row.samples.map(async (png) => {
    const image = new Image();
    image.src = png;
    await image.decode();
    return image;
  })));
  let cursor = 0;
  rows.forEach((row, r) => {
    const y = r * (lineHeight + header);
    ctx.fillStyle = '#8ce0c0';
    const metaLabel = `${row.id}  ${(row.durationMs / 1000).toFixed(1)}s  ${row.grid ? `${row.grid.width}x${row.grid.height}` : 'no-grid'}`;
    ctx.fillText(metaLabel, 6, y + 14);
    const metaWidth = ctx.measureText(metaLabel).width;
    const moves = row.layers.filter((l) => l.region || l.glow || l.shaft || l.walk || l.emote).map((l) => `${l.id}:${l.region ?? (l.glow ? 'glow' : l.shaft ? 'shaft' : l.walk ? 'walk' : l.emote)}`);
    ctx.fillStyle = '#c8cdd6';
    ctx.fillText(moves.join(' ').slice(0, 88), Math.max(290, Math.ceil(metaWidth + 24)), y + 14);
    row.samples.forEach((_png, c) => {
      // contain-fit each sample inside its cell so a 384-wide shot cannot bleed into the neighbouring column
      const image = decoded[cursor];
      const scale = Math.min(cell / image.naturalWidth, lineHeight / image.naturalHeight);
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      ctx.drawImage(image, c * cell + (cell - w) / 2, y + header + (lineHeight - h) / 2, w, h);
      cursor += 1;
    });
  });
  return canvas.toDataURL('image/png');
}, sheetRows);
fs.writeFileSync(path.join(outDir, 'contact-sheet.png'), Buffer.from(sheetUrl.slice(sheetUrl.indexOf(',') + 1), 'base64'));
await browser.close();

const mp4 = path.join(outDir, 'opening-animatic.mp4');
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', path.join(framesDir, 'f_%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', mp4], { encoding: 'utf8' });
const mp4Ok = ff.status === 0 && fs.existsSync(mp4);

/* ---------- B. real player bundle: title -> opening -> start map handoff ---------- */
const totalOpeningMs = (project.system?.opening?.scenes ?? []).reduce((n, s) => n + (s.durationMs ?? 0), 0);
const videoDir = path.join(outDir, 'player-video');
const shotsDir = path.join(outDir, 'player-shots');
fs.mkdirSync(videoDir, { recursive: true });
fs.mkdirSync(shotsDir, { recursive: true });
const server = await startPlayerQaServer();
const browser2 = await chromium.launch({ headless: true, ...(process.env.QA_CHROME ? { executablePath: process.env.QA_CHROME } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--disable-gpu', '--disable-background-networking', '--disable-features=NetworkChangeNotifier'] });
const context = await browser2.newContext({ viewport: { width: 960, height: 720 }, recordVideo: { dir: videoDir, size: { width: 960, height: 720 } } });
const page2 = await context.newPage();
const pageErrors = [];
page2.on('pageerror', (e) => pageErrors.push(String(e.message ?? e)));
page2.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
await page2.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } window.__OPENRPG_BOOT__ = { projectUrl: '/__runtime-qa/project.json', saveNamespace: 'opening-pixel-qa', qaInstrumentation: true }; });
await page2.route('**/__runtime-qa/project.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(project) }));
const marks = [];
const snap = async (label) => { marks.push(label); await page2.screenshot({ path: path.join(shotsDir, `${String(marks.length).padStart(2, '0')}-${label}.png`) }); };
let enterAt = 0;
let titleGate = { menuPresent: false, logoNodePresent: false, logoVisible: false };
try {
  await page2.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
  await page2.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
  await page2.waitForTimeout(600);
  titleGate = await page2.evaluate(() => {
    const menu = document.querySelector("[data-testid='title-screen'] .rm-title-menu");
    const logo = document.querySelector("[data-testid='title-screen'] [data-testid='title-logo'],[data-testid='title-screen'] [data-testid='title-text']");
    const style = logo instanceof HTMLElement ? getComputedStyle(logo) : null;
    return { menuPresent: !!menu, logoNodePresent: !!logo, logoVisible: !!logo && style?.display !== 'none' && style?.visibility !== 'hidden' && Number(style?.opacity ?? 1) > 0.05 };
  });
  await snap('title');
  enterAt = Date.now();
  const clickedNew = await page2.evaluate(() => {
    const btn = document.querySelector("[data-action='new']");
    if (btn instanceof HTMLElement) { btn.click(); return true; }
    return false;
  });
  if (!clickedNew) {
    await page2.keyboard.press('Enter');
    await page2.waitForTimeout(250);
    await page2.keyboard.press('Enter');
  }
  const openingDom = await page2.waitForSelector("[data-testid='opening-animatic-stage']", { timeout: 25000 }).then(() => true).catch(() => false);
  if (openingDom) {
    await page2.waitForTimeout(900);
    await snap('opening-01');
  }
  const step = Math.max(2500, Math.round(totalOpeningMs / 5));
  for (let i = 1; i <= 4; i++) {
    await page2.waitForTimeout(step);
    const live = await page2.evaluate(() => !!document.querySelector("[data-testid='opening-animatic-stage']"));
    await snap(`opening-${String(i + 1).padStart(2, '0')}${live ? '' : '-ended'}`);
    if (!live) break;
  }
  await page2.waitForFunction(() => !document.querySelector("[data-testid='opening-animatic-stage']"), null, { timeout: 25000 }).catch(() => {});
  const handoff = await page2.evaluate(() => ({
    title: !!document.querySelector("[data-testid='title-screen']"),
    animatic: !!document.querySelector("[data-testid='opening-animatic-stage']"),
    canvas: !!document.querySelector('canvas'),
    state: (() => { try { return JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? 'null'); } catch { return null; } })(),
  })).catch(() => null);
  await page2.waitForTimeout(1500);
  await snap('after-handoff');
  const beforeInput = await page2.evaluate(() => { try { return JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? 'null'); } catch { return null; } }).catch(() => null);
  await page2.keyboard.press('ArrowRight');
  await page2.waitForTimeout(500);
  await page2.keyboard.press('ArrowDown');
  await page2.waitForTimeout(700);
  await snap('map-input');
  const afterInput = await page2.evaluate(() => { try { return JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? 'null'); } catch { return null; } }).catch(() => null);
  const openingElapsedMs = Date.now() - enterAt;
  const video = page2.video();
  await context.close();
  await browser2.close();
  await server.close();
  const videoPath = video ? await video.path() : null;
  const finalVideo = path.join(outDir, 'opening-player.webm');
  if (videoPath && fs.existsSync(videoPath)) fs.copyFileSync(videoPath, finalVideo);
  const summary = {
    projectPath, outDir, openingMs: totalOpeningMs, openingElapsedMs, shots: rendered.shots.length,
    resourceFailures: rendered.failures, rendererErrors: renderErrors,
    shotList: rendered.shots.map((s) => ({ id: s.id, durationMs: s.durationMs, caption: s.caption, layers: s.layers })),
    animaticMp4: mp4Ok ? mp4 : null, contactSheet: path.join(outDir, 'contact-sheet.png'),
    playerVideo: fs.existsSync(finalVideo) ? finalVideo : null,
    openingDomPresent: openingDom, handoff, beforeInput, afterInput, titleGate, marks, pageErrors,
  };
  fs.writeFileSync(path.join(outDir, 'record.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ shots: summary.shots, openingMs: totalOpeningMs, animaticMp4: summary.animaticMp4, playerVideo: summary.playerVideo, resourceFailures: summary.resourceFailures, rendererErrors: renderErrors, pageErrors, handoff, marks }, null, 1));
  process.exit(0);
} catch (error) {
  const video = page2.video();
  await browser2.close().catch(() => undefined);
  await server.close().catch(() => undefined);
  const videoPath = video ? await video.path().catch(() => null) : null;
  if (videoPath && fs.existsSync(videoPath)) fs.copyFileSync(videoPath, path.join(outDir, 'opening-player.webm'));
  fs.writeFileSync(path.join(outDir, 'record.json'), JSON.stringify({ error: String(error), marks, pageErrors, rendererErrors: renderErrors }, null, 1));
  console.error('player record failed:', String(error));
  process.exit(1);
}
