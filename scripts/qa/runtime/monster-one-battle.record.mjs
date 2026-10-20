// 도트 몬스터 한 종의 실제 전투(통상 공격 → 피격 → 스킬 → 피격 … → 쓰러짐)를 출하 player.html(내보내기 shim) 경로로 녹화한다.
// 실행: node scripts/qa/runtime/monster-one-battle.record.mjs --resource generated-enemy-ontology-8da61312 \
//         --out /tmp/x [--res 480x270|640x360] [--skin retro2003|pokemon] [--skill skill_mon_frost_orb] [--name 룬 조각돌]
// 산출: <out>/battle.mp4 (무대 crop), command.png · enemy-*.png 순간 캡처, timing.json
// 녹화 사본(retro2003 픽스처)만 고친다 — 정본·기본 DB 는 건드리지 않는다. 적 레코드가 없는 종도 일회용 적 행을 만들어 세운다.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
import { recordingFixture } from './retro2003-gif-fixture.mjs';

const run = promisify(execFile);
const { values } = parseArgs({ options: {
  out: { type: 'string' }, res: { type: 'string', default: '480x270' }, skin: { type: 'string', default: 'retro2003' },
  resource: { type: 'string' }, skill: { type: 'string', default: 'skill_mon_frost_orb' }, name: { type: 'string', default: 'QA 몬스터' },
  hp: { type: 'string', default: '60' }, rounds: { type: 'string', default: '6' },
} });
if (!values.resource) throw new Error('--resource <monsterResourceId> 가 필요합니다');
const out = resolve(values.out ?? 'verify-shots/monster-one-battle/run');
await mkdir(out, { recursive: true });
process.env.VITE_CACHE_DIR ??= resolve('.vite-cache/monster-one-battle');
const [resW, resH] = values.res.split('x').map(Number);
const viewport = { width: resW * 2, height: resH * 2 };
const id = (v) => `[data-testid="${v}"]`;

let server, browser;
const timing = { res: values.res, skin: values.skin, resource: values.resource, events: [], errors: [], notes: [] };
try {
  server = await startPlayerQaServer({ logLevel: 'error' });
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  // 기본 DB 의 몬스터 스킬·상태·전투 애니메이션을 사본에 합친다(스킬 연출이 실제로 돌게).
  const setup = await browser.newPage();
  await setup.route('**/__mob-setup', (route) => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await setup.goto(server.url + '/__mob-setup');
  const defaults = await setup.evaluate(async () => {
    const m = await import('/src/project/defaults/defaultDatabaseStarterRecords.ts');
    return { skills: m.defaultSkillRecords(), battleAnimations: m.defaultBattleAnimationRecords(), states: m.defaultStateRecords() };
  });
  await setup.close();

  const fixture = await recordingFixture();
  const project = fixture.project;
  project.system.battleUiStyle = values.skin;
  project.system.battleFlow = 'strict';  // 차례제: 적(민첩 높음)이 매 라운드 먼저, 아군 명령은 손으로
  if (resW !== 320 || resH !== 240) project.system.playResolution = { width: resW, height: resH };
  for (const key of ['skills', 'battleAnimations', 'states']) {
    const rows = defaults[key];
    project.database[key] = [...project.database[key].filter((row) => !rows.some((r) => r.id === row.id)), ...rows];
  }
  project.system.startActorIds = ['actor_hero'];
  if (project.session) project.session.partyActorIds = ['actor_hero'];
  for (const actor of project.database.actors) {
    if (actor.parameterCurves) { actor.parameterCurves.maxHp = actor.parameterCurves.maxHp.map(() => 9999); actor.parameterCurves.agility = actor.parameterCurves.agility.map(() => 1); }
  }
  for (const job of project.database.classes) {
    if (job.parameterCurves?.maxHp) job.parameterCurves.maxHp = job.parameterCurves.maxHp.map(() => 9999);
    if (job.parameterCurves?.agility) job.parameterCurves.agility = job.parameterCurves.agility.map(() => 1);
  }
  const sample = structuredClone(project.database.enemies[0]);
  delete sample.collapseEffect;
  const enemy = { ...sample, id: 'qa_one_enemy', name: values.name, monsterResourceId: values.resource,
    stats: { ...sample.stats, maxHp: 1, maxMp: 999, attack: 1, mind: 1, defense: 1, agility: 200 },
    actions: [
      { skillId: 'skill_attack', priority: 5, condition: { kind: 'turn', start: 0, interval: 2 } },
      { skillId: values.skill, priority: 5, condition: { kind: 'turn', start: 1, interval: 2 } },
    ] };
  delete enemy.speciesId; delete enemy.stealItems; delete enemy.learnableSkillIds;
  if (enemy.rewards) delete enemy.rewards.dropItemId;
  project.database.enemies.push(enemy);
  const troopId = 'qa_one_troop';
  project.database.troops.push({ ...structuredClone(project.database.troops[0]), id: troopId, name: values.name, enemyIds: [enemy.id], autoAlign: true,
    members: [{ enemyId: enemy.id, x: 0, y: 0, hidden: false }], pages: [], battleEventPages: [] });
  const map = project.maps[fixture.entry.mapId];
  for (const event of map.events) if (event.id === fixture.entry.eventId) {
    for (const page of event.pages?.length ? event.pages : [event]) for (const command of page.commands ?? []) {
      if (command.kind === 'battleProcessing') { command.troopId = troopId; command.troopSource = 'fixed'; command.canEscape = false; }
    }
  }
  enemy.stats.maxHp = Number(values.hp);  // 아군 통상 공격 두세 번에 쓰러지게(--hp 로 맞춘다)
  await writeFile(join(out, 'recording-project.json'), JSON.stringify(project));

  const context = await browser.newContext({ viewport, recordVideo: { dir: join(out, 'video'), size: viewport } });
  const page = await context.newPage();
  page.on('pageerror', (e) => timing.errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400 && /pixel-enem/.test(r.url())) timing.errors.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__mob/project.json', saveNamespace: 'monster-one-battle', qaInstrumentation: true }; });
  await page.route('**/__mob/project.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
  const wall0 = Date.now();
  let started = 0, ended = 0, crop = null;
  await page.goto(server.url + '/player.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
  for (let attempt = 0; ; attempt++) {
    try { await page.waitForSelector(id('title-screen'), { timeout: 60000 }); break; }
    catch (e) { if (attempt >= 2) throw e; await page.reload({ waitUntil: 'domcontentloaded' }); }
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 120000 });
  await page.evaluate((e) => { window.__oprnDebug.setSeed(3); window.__oprnDebug.teleport(e.mapId, e.x, e.y); window.__oprnInput.face('up'); }, fixture.entry);
  await page.waitForTimeout(600);
  started = (Date.now() - wall0) / 1000;
  await page.keyboard.press('z');
  for (let i = 0; i < 40 && !await page.locator(id('battle-scene')).count(); i++) { await page.waitForTimeout(150); await page.keyboard.press('z'); }
  await page.waitForSelector(id('battle-scene'));
  await page.evaluate(() => {
    const root = document.querySelector('[data-testid="battle-scene"]');
    const ev = window.__mob = { t0: performance.now(), events: [] };
    new MutationObserver((recs) => { for (const r of recs) {
      if (r.type !== 'attributes') continue;
      const n = r.target;
      if (n.classList?.contains('battle-enemy')) ev.events.push({ t: Math.round(performance.now() - ev.t0), k: r.attributeName, v: n.getAttribute(r.attributeName) });
    } }).observe(root, { subtree: true, attributes: true, attributeFilter: ['data-retro-beat', 'data-battle-pose-frame', 'data-retro-pixel-cell', 'class'] });
  });
  const box = await page.locator('.play-stage, [data-testid="play-stage"]').first().boundingBox().catch(() => null);
  crop = box ? Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v)])) : { x: 0, y: 0, width: viewport.width, height: viewport.height };

  const state = () => page.evaluate(() => {
    const root = document.querySelector('[data-testid="battle-scene"]');
    const e = root?.querySelector('.battle-enemy');
    return { phase: root?.dataset.battlePhase, busy: root?.dataset.battleSequenceBusy,
      result: root?.querySelector('[data-testid="battle-result-panel"]')?.getAttribute('data-battle-result') ?? null,
      cell: e?.dataset.battlePoseFrame ?? null, beat: e?.dataset.retroBeat ?? null };
  });
  async function waitCommand(ms = 40000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const s = await state();
      if (s.result) return s;
      if (s.phase === 'actorCommand' && s.busy === 'false' && await page.locator(id('actor-command-attack')).isVisible().catch(() => false)) return s;
      await page.waitForTimeout(60);
    }
    return null;
  }
  async function attack() {
    for (let step = 0; step < 32; step++) {
      const next = await page.evaluate(() => {
        const menu = document.querySelector('.battle-command-host');
        const target = [...(menu?.querySelectorAll('button.battle-command') ?? [])].find((n) => n.dataset.testid === 'actor-command-attack');
        const current = menu?.querySelector('[data-battle-command-cursor="true"]');
        if (!target || !current) return { error: 'no attack command' };
        if (target === current) return { done: true };
        const a = current.getBoundingClientRect(), b = target.getBoundingClientRect();
        const dx = b.x + b.width / 2 - a.x - a.width / 2, dy = b.y + b.height / 2 - a.y - a.height / 2;
        return { key: Math.abs(dx) > 10 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp') };
      });
      if (next.error) { timing.notes.push(next.error); return; }
      if (next.done) { await page.waitForTimeout(120); await page.keyboard.press('z'); break; }
      await page.keyboard.press(next.key); await page.waitForTimeout(70);
    }
    for (let i = 0; i < 40; i++) {
      const st = await state();
      if (st.busy === 'true' || st.result) break;
      if (await page.locator(id('battle-target-prompt')).count()) { await page.waitForTimeout(150); await page.keyboard.press('z'); }
      await page.waitForTimeout(60);
    }
  }
  // 순간 캡처: 적 칸이 바뀔 때마다 한 장(칸 이름별 첫 장).
  const shots = new Set();
  const watcher = (async () => {
    while (!shots.has('__stop')) {
      const s = await state().catch(() => null);
      if (!s) break;
      const key = s.cell ?? 'none';
      if (!shots.has(key)) { shots.add(key); await page.screenshot({ path: join(out, `enemy-${key}.png`) }).catch(() => {}); }
      await page.waitForTimeout(40);
    }
  })();
  const first = await waitCommand();
  if (first) await page.screenshot({ path: join(out, 'command.png') });
  // 적 통상 공격은 첫 명령 전에 나온다. 아군 공격(적 피격) → 적 스킬 → 아군 공격 … 적이 쓰러질 때까지.
  for (let n = 0; n < Number(values.rounds); n++) {
    const s = await waitCommand();
    if (!s || s.result) break;
    await attack();
  }
  for (let i = 0; i < 200; i++) { const s = await state(); if (s.result) break; await page.waitForTimeout(100); }
  timing.popups = await page.evaluate(() => [...document.querySelectorAll('.battle-damage-popup')].map((n) => n.textContent));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, 'result.png') });
  shots.add('__stop');
  await watcher;
  ended = (Date.now() - wall0) / 1000;
  timing.events = await page.evaluate(() => window.__mob?.events ?? []).catch(() => []);
  const video = page.video();
  await context.close();
  fixture.cleanup();
  const raw = await video.path();
  const c = crop;
  await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, started - 0.3)), '-t', String(ended - started + 0.3), '-i', raw,
    '-vf', `crop=${c.width}:${c.height}:${c.x}:${c.y}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'veryfast', '-an', join(out, 'battle.mp4')]);
  timing.crop = crop;
} catch (e) {
  timing.errors.push(String(e.stack ?? e));
} finally {
  await browser?.close(); await server?.close();
  await writeFile(join(out, 'timing.json'), JSON.stringify(timing, null, 1));
  console.log(JSON.stringify({ errors: timing.errors.map((e) => e.slice(0, 300)), notes: timing.notes, events: timing.events.length }));
}
