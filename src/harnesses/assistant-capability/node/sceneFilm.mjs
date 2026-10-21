// 장면 교훈 시도의 저장본을 출하 player.html(prepareWebExport + export shim)로 실제 키 입력으로 돌려 영상으로 남긴다.
//   node sceneFilm.mjs --out <실행 폴더> --case <id> [--attempt 1] [--name film] [--max-targets 6] [--seconds 120]
// 순간이동·상태 주입 없음. 길은 sceneRoute.mts(제품 canMove)로 찾고 __oprnDebug.playerRoute 로 걷는다(실제 걷기 경로).
// 대상 순서: 시작 맵 이벤트를 가까운 순으로 — 말 걸기(action) 이벤트는 옆에서 보고 결정 키, 접촉 이벤트(문·출구)는 밟는다.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { openGenrePlayer } from './genreExperiment.mjs';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const root = resolve(option('out')), caseId = option('case'), attempt = Number(option('attempt', '1'));
const name = option('name', 'film'), maxTargets = Number(option('max-targets', '6')), seconds = Number(option('seconds', '120'));
const live = resolve(root, caseId, `attempt-${attempt}`, 'live.json');
const project = JSON.parse(readFileSync(live, 'utf8'));
const sleep = ms => new Promise(done => setTimeout(done, ms));
const log = [];
const note = (kind, data) => { log.push({ t: Date.now(), kind, ...data }); console.log(kind, JSON.stringify(data)); };

function route(mapId, from, to, blocked) {
  const run = spawnSync('bun', [resolve('src/harnesses/assistant-capability/node/sceneRoute.mts'), live, mapId,
    String(from.x), String(from.y), String(to.x), String(to.y), blocked.map(b => `${b.x},${b.y}`).join(';')], { encoding: 'utf8', maxBuffer: 1 << 24 });
  try { return JSON.parse(run.stdout.trim().split('\n').pop()); } catch { return { moves: [], reached: false, error: run.stderr.slice(-300) }; }
}
const kindOf = event => {
  const pages = event.pages ?? [];
  const text = JSON.stringify(pages);
  const trigger = pages[0]?.trigger?.kind ?? pages[0]?.trigger;
  return { transfer: text.includes('"kind":"transfer"'), talk: text.includes('"kind":"text"') || text.includes('"kind":"showChoices"'), trigger };
};

// Share the experiment's browser slots (at most 2 browsers on this box, editors and players together).
async function acquireSlot() {
  const slots = Math.min(3, JSON.parse(readFileSync(resolve(root, 'experiment.json'), 'utf8')).maximumConcurrentEditors ?? 3);
  for (;;) {
    for (let slot = 0; slot < slots; slot++) {
      const file = resolve(root, `editor-slot-${slot}.lock`);
      try { const fd = openSync(file, 'wx'); writeFileSync(fd, JSON.stringify({ film: caseId, pid: process.pid })); closeSync(fd);
        return () => { try { if (JSON.parse(readFileSync(file, 'utf8')).pid === process.pid) unlinkSync(file); } catch {} }; }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    await sleep(10000);
  }
}
const releaseSlot = await acquireSlot();
process.on('exit', releaseSlot);
const player = await openGenrePlayer(root, caseId, { attempt, name, recordVideo: true, viewport: { width: 960, height: 540 } });
const { page } = player;
const started = Date.now();
const deadline = () => Date.now() - started > seconds * 1000;
const state = () => page.evaluate(() => window.__oprnDebug?.readState?.() ?? null).catch(() => null);
const dialogueOpen = () => page.evaluate(() => Boolean(document.querySelector('[data-testid="dialogue-box"]'))).catch(() => false);
// Runtime's own machine-readable snapshot: an event is running or input is locked → keep advancing with Enter.
const busy = () => page.evaluate(() => {
  try { const raw = JSON.parse(document.querySelector('[data-testid="runtime-state-json"]')?.textContent ?? 'null');
    return raw ? { running: raw.running === true, input: raw.inputEnabled !== false } : null; } catch { return null; }
}).catch(() => null);
async function drainDialogue(limit = 40) {
  let idle = 0, stuckRounds = 0;
  for (let i = 0; i < limit && idle < 3; i++) {
    await sleep(900);
    const b = await busy();
    const box = await dialogueOpen();
    if (b && !b.running && b.input && !box) { idle++; continue; }
    idle = 0; stuckRounds++;
    // Enter pages through text; a shop/inn window that Enter cannot close (or would buy from) gets Escape after a few rounds.
    await page.keyboard.press(stuckRounds > 5 && stuckRounds % 2 === 0 ? 'Escape' : 'Enter');
  }
}
try {
  await page.addInitScript(([projectUrl, saveNamespace]) => {
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace, qaInstrumentation: true };
  }, [player.projectUrl, `scene-film:${caseId}:${Date.now()}`]);
  await page.goto(player.server.url + '/player.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 120000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('[data-testid="title-screen"]')?.dataset.seqState !== 'running', null, { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Boolean(window.__oprnDebug?.readState?.()?.currentMapId), null, { timeout: 60000 });
  for (let i = 0; i < 40; i++) {
    const opening = await page.evaluate(() => /Esc\s*건너뛰기|Esc to skip/i.test(document.body.innerText)).catch(() => false);
    if (!opening) break;
    await page.keyboard.press('Escape'); await sleep(1200);
  }
  note('start', await state());
  await drainDialogue();
  const visited = new Set();
  for (let n = 0; n < maxTargets && !deadline(); n++) {
    const s = await state(); if (!s) break;
    const map = project.maps[s.currentMapId];
    const located = id => s.eventLocations?.[id];
    const events = (map?.events ?? []).map(event => ({ ...event, ...(located(event.id)?.mapId === map.id ? { x: located(event.id).x, y: located(event.id).y } : {}) }));
    const candidates = events.filter(event => !visited.has(`${map.id}:${event.id}`)).map(event => ({ event, kind: kindOf(event) }))
      .filter(c => c.kind.transfer || c.kind.talk)
      .sort((a, b) => (Math.abs(a.event.x - s.x) + Math.abs(a.event.y - s.y)) - (Math.abs(b.event.x - s.x) + Math.abs(b.event.y - s.y)))
      // talk first, transfers last so the tour sees a map before leaving it
      .sort((a, b) => Number(a.kind.transfer && !a.kind.talk) - Number(b.kind.transfer && !b.kind.talk));
    const target = candidates[0];
    if (!target) { note('no-target', { mapId: map?.id }); break; }
    visited.add(`${map.id}:${target.event.id}`);
    const blocked = events.filter(e => e.id !== target.event.id).map(e => ({ x: e.x, y: e.y }));
    const isTouch = ['touch', 'playerTouch'].includes(target.kind.trigger);
    const goalBlocked = !isTouch ? [{ x: target.event.x, y: target.event.y }] : [];
    let path = route(map.id, s, target.event, [...blocked, ...goalBlocked]);
    note('target', { mapId: map.id, eventId: target.event.id, name: target.event.name, at: [target.event.x, target.event.y], eventKind: target.kind, steps: path.moves?.length, planned: path.reached });
    if (!path.reached) continue;
    // Real arrow keys, one tile at a time: hold until the hero's tile changes, release, wait until the hero stops,
    // then re-route from where the hero really is (a held key can carry the hero one tile further, and the static
    // route cannot see every runtime blocker). A refused step marks that cell blocked for the re-route.
    const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const refused = [];
    let arrived = path.moves.length === 0, walked = 0;
    for (let guard = 0; guard < 80 && !arrived && path.reached && !deadline(); guard++) {
      const dir = path.moves[0];
      const before = await state(); if (!before || before.currentMapId !== map.id) break;
      await page.keyboard.down(KEY[dir]);
      const t0 = Date.now(); let moved = false;
      while (Date.now() - t0 < 2500) {
        await sleep(40); const now = await state();
        if (!now) break;
        if (now.currentMapId !== map.id || now.x !== before.x || now.y !== before.y) { moved = true; break; }
      }
      await page.keyboard.up(KEY[dir]);
      let here = await state(), stable = 0;
      for (let i = 0; i < 20 && stable < 4; i++) { await sleep(80); const now = await state(); if (now && here && now.x === here.x && now.y === here.y && now.currentMapId === here.currentMapId) stable++; else stable = 0; here = now; }
      if (!here || here.currentMapId !== map.id) break;
      if (!moved) { refused.push({ x: before.x + DELTA[dir][0], y: before.y + DELTA[dir][1] }); note('blocked-step', { dir, at: [before.x, before.y] }); }
      else walked++;
      path = route(map.id, here, target.event, [...blocked, ...goalBlocked, ...refused]);
      if (path.reached && path.moves.length === 0) arrived = true;
    }
    note('walked', { steps: walked, refused: refused.length });
    note('arrived', { eventId: target.event.id, arrived });
    if (!arrived) continue;
    if (path.face) {
      await page.evaluate(dir => window.__oprnInput.face(dir), path.face).catch(() => {});
      await sleep(250);
      if (target.kind.transfer && !target.kind.talk) { await page.evaluate(dir => window.__oprnInput.dir(dir), path.face); await sleep(500); await page.evaluate(() => window.__oprnInput.dir(null)); }
      else await page.evaluate(() => window.__oprnInput.action());
    } else if (!isTouch) await page.evaluate(() => window.__oprnInput.action());
    await sleep(800);
    await drainDialogue();
    await sleep(1500);
    note('after', await state());
  }
  await sleep(1500);
} catch (error) { note('error', { message: error.message.slice(0, 400) }); }
finally {
  const video = page.video();
  await player.close();
  const webm = video ? await video.path().catch(() => null) : null;
  const dir = player.evidenceDir;
  writeFileSync(resolve(dir, 'film-log.json'), JSON.stringify(log, null, 2));
  if (webm && existsSync(webm)) {
    const mp4 = resolve(dir, 'film.mp4');
    const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    console.log('video', ff.status === 0 ? mp4 : `ffmpeg failed ${ff.stderr}`);
  }
  releaseSlot();
}
