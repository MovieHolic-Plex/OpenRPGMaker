// 스토어 전투 애니메이션 증거 녹화 — 출하 player.html + export shim, 1배속, 키보드 입력만.
// 프로젝트: store-battle-anim-fixture.mts 가 실제 applyPackToProject 로 넣은 사본(마도사 skill_arcane_bolt → 스토어 애니메이션).
// 실행: node scripts/qa/runtime/store-battle-anim.record.mjs --project /tmp/sba-proof/project.json --out /tmp/sba-proof/rec
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
import { recordingFixture } from './retro2003-gif-fixture.mjs';

const run = promisify(execFile);
const { values } = parseArgs({ options: { project: { type: 'string' }, out: { type: 'string' } } });
const out = resolve(values.out ?? 'verify-shots/store-battle-anim');
await mkdir(out, { recursive: true });
const ANIM = 'store_proof_fire_burst__anim-burst';
const viewport = { width: 1280, height: 720 };
const fixture = await recordingFixture(resolve(values.project));
const project = fixture.project;
project.system.playResolution = { width: 640, height: 360 };
// 마도사만 기술을 쓰고, 녹화가 짧게 끝나도록 적 체력은 그대로 둔다.
const id = (v) => `[data-testid="${v}"]`;
const state = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-testid="battle-scene"]');
  return { phase: root?.dataset.battlePhase, busy: root?.dataset.battleSequenceBusy,
    actor: root?.querySelector('.battle-actor-status.is-active-actor')?.getAttribute('data-record-id') };
});
async function waitCommand(page, ms = 40000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await state(page);
    if (s.phase === 'actorCommand' && s.busy === 'false' && await page.locator(id('actor-command-attack')).isVisible().catch(() => false)) return s;
    await page.waitForTimeout(60);
  }
  return null;
}
async function choose(page, testId) {
  for (let step = 0; step < 32; step++) {
    const next = await page.evaluate((targetId) => {
      const menu = document.querySelector('.battle-command-host');
      const target = [...(menu?.querySelectorAll('button.battle-command') ?? [])].find((n) => n.dataset.testid === targetId);
      const current = menu?.querySelector('[data-battle-command-cursor="true"]');
      if (!target || !current) return { error: `no ${targetId}` };
      if (target === current) return { done: true };
      const a = current.getBoundingClientRect(), b = target.getBoundingClientRect();
      const dx = b.x + b.width / 2 - a.x - a.width / 2, dy = b.y + b.height / 2 - a.y - a.height / 2;
      return { key: Math.abs(dx) > 10 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp') };
    }, testId);
    if (next.error) return next.error;
    if (next.done) { await page.waitForTimeout(120); await page.keyboard.press('z'); return null; }
    await page.keyboard.press(next.key); await page.waitForTimeout(70);
  }
  return 'cursor stuck';
}

const notes = [], errors = [], seen = [];
let server, browser, started = 0, ended = 0, crop = null;
try {
  server = await startPlayerQaServer({ logLevel: 'error' });
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu', '--disable-background-networking', '--disable-features=NetworkChangeNotifier'] });
  const context = await browser.newContext({ viewport, recordVideo: { dir: join(out, 'video'), size: viewport } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__sba/project.json', saveNamespace: 'sba', qaInstrumentation: true }; });
  await page.route('**/__sba/project.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
  const wall0 = Date.now();
  await page.goto(server.url + '/player.html', { waitUntil: 'commit', timeout: 240000 });
  for (let attempt = 0; ; attempt++) {
    try { await page.waitForSelector(id('title-screen'), { timeout: 60000 }); break; }
    catch (e) { if (attempt >= 2) throw e; await page.reload({ waitUntil: 'domcontentloaded' }); }
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 120000 });
  await page.evaluate((e) => { window.__oprnDebug.setSeed(3); window.__oprnDebug.teleport(e.mapId, e.x, e.y); window.__oprnInput.face('up'); }, fixture.entry);
  await page.waitForTimeout(600);
  await page.keyboard.press('z');
  for (let i = 0; i < 8 && !await page.locator(id('battle-scene')).count(); i++) {
    await page.waitForSelector(id('battle-scene'), { timeout: 2500 }).catch(() => {});
    if (!await page.locator(id('battle-scene')).count()) await page.keyboard.press('z');
  }
  await page.waitForSelector(id('battle-scene'));
  started = (Date.now() - wall0) / 1000;
  // 스토어 애니메이션 노드가 붙는 순간과 프레임 진행을 기록한다.
  await page.evaluate((anim) => {
    const t0 = performance.now(); window.__sba = [];
    new MutationObserver(() => {
      const node = document.querySelector(`[data-testid="battle-animation"][data-animation-id="${anim}"]`);
      if (!node) return;
      const frame = node.dataset.currentFrame; const last = window.__sba[window.__sba.length - 1];
      const follow = node.querySelector('[data-testid="battle-animation-followup"]')?.dataset.animationId ?? '';
      if (!last || last.frame !== frame || last.follow !== follow) window.__sba.push({ t: Math.round(performance.now() - t0), frame, follow, cells: node.querySelectorAll('canvas.battle-animation-cell').length });
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-current-frame'] });
  }, ANIM);
  const box = await page.locator('.play-stage, [data-testid="play-stage"]').first().boundingBox().catch(() => null);
  crop = box ? Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v)])) : { x: 0, y: 0, ...viewport };
  // 마도사 차례가 올 때까지 다른 배우는 방어한다. 마도사는 기술 → 비전 화살 → 대상 확정.
  let cast = 0;
  for (let turn = 0; turn < 12 && cast < 2; turn++) {
    const s = await waitCommand(page);
    if (!s) { notes.push('no command'); break; }
    if (s.actor === 'actor_mage') {
      let err = await choose(page, 'actor-command-skill');
      if (!err) { await page.waitForSelector(id('actor-skill-skill_arcane_bolt'), { timeout: 5000 }).catch(() => {}); err = await choose(page, 'actor-skill-skill_arcane_bolt'); }
      if (err) { notes.push(`mage: ${err}`); await page.keyboard.press('x'); await choose(page, 'actor-command-defend'); continue; }
      for (let i = 0; i < 40; i++) {
        const st = await state(page);
        if (st.busy === 'true') break;
        if (await page.locator(id('battle-target-prompt')).count()) { await page.waitForTimeout(150); await page.keyboard.press('z'); }
        await page.waitForTimeout(60);
      }
      cast += 1;
      const shotAt = Date.now() + 8000;
      let shot = false;
      while (Date.now() < shotAt) {
        const frame = await page.locator(`[data-testid="battle-animation"][data-animation-id="${ANIM}"]`).getAttribute('data-current-frame').catch(() => null);
        if (!shot && frame === '3') { await page.screenshot({ path: join(out, `cast${cast}-impact.png`) }); shot = true; }
        if (shot && (await state(page)).busy === 'false') break;
        await page.waitForTimeout(40);
      }
      notes.push(`cast ${cast}: impact shot ${shot}`);
    } else await choose(page, 'actor-command-defend');
  }
  await page.waitForTimeout(1500);
  ended = (Date.now() - wall0) / 1000;
  seen.push(...await page.evaluate(() => window.__sba ?? []));
  const video = page.video();
  await context.close();
  const raw = await video.path();
  const c = crop;
  await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, started - 0.3)), '-t', String(ended - started + 0.3), '-i', raw,
    '-vf', `crop=${c.width}:${c.height}:${c.x}:${c.y}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'veryfast', '-an', join(out, 'store-battle-anim.mp4')]);
} catch (e) { errors.push(String(e.stack ?? e)); }
finally { await browser?.close(); await server?.close(); fixture.cleanup(); }
await writeFile(join(out, 'trace.json'), JSON.stringify({ notes, errors, frames: seen }, null, 1));
console.log(JSON.stringify({ notes, errors: errors.map((e) => e.slice(0, 300)), frames: seen.length, first: seen.slice(0, 14) }));
