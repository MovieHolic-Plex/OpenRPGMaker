// 전투 체감(battle feel) 전/후 비교 녹화 — 출하 player.html + export shim, 키보드 입력만.
// 실행: node scripts/qa/runtime/battle-feel.record.mjs --out /tmp/bf/x [--res 640x360] [--only group,boss,defeat]
// 산출: <out>/<scenario>.mp4 (무대 crop), <scenario>-*.png, timing.json, SUMMARY.md
// 정본 프로젝트는 건드리지 않는다. demo-v3 녹화 사본에 적 그룹 셋(일반·보스·전멸)을 붙인다.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
import { recordingFixture } from './retro2003-gif-fixture.mjs';

const run = promisify(execFile);
const { values } = parseArgs({ options: { out: { type: 'string' }, res: { type: 'string', default: '640x360' }, only: { type: 'string' } } });
const out = resolve(values.out ?? 'verify-shots/battle-feel/run');
await mkdir(out, { recursive: true });
const [resW, resH] = values.res.split('x').map(Number);
const viewport = { width: resW * 2, height: resH * 2 };

const enemy = (id, name, resourceId, stats, actions = [{ skillId: 'skill_attack', priority: 5, condition: { kind: 'always' } }], extra = {}) => ({ id, name, resourceId, stats, actions, extra });
const SCENARIOS = {
  // 일반 무리: 다양한 크기의 다시 그린 몬스터 넷. 통상 공격·마법·아이템·방어를 손으로, 나머지는 자동.
  group: { backdrop: 'battle-scenery-forest', enemies: [
    enemy('bf_goblin', '고블린 척후', 'generated-enemy-goblin-scout', { maxHp: 260, attack: 95, defense: 30, agility: 44 }),
    enemy('bf_wolf', '회색 늑대', 'generated-enemy-wolf-grey', { maxHp: 240, attack: 105, defense: 30, agility: 46 }),
    enemy('bf_wisp', '푸른 도깨비불', 'generated-enemy-wisp-blue', { maxHp: 200, attack: 90, defense: 25, mind: 70, agility: 42 }, [{ skillId: 'skill_fire', priority: 5, condition: { kind: 'always' } }]),
    enemy('bf_goblin', '고블린 척후', 'generated-enemy-goblin-scout', null),
  ], manual: ['attack', 'attack', 'item', 'magic'] },
  // 보스: 96px 붉은 용 한 마리, 동굴.
  boss: { backdrop: 'battle-scenery-cave', enemies: [
    enemy('bf_dragon', '붉은 용', 'generated-enemy-dragon-red', { maxHp: 1400, attack: 120, defense: 35, mind: 90, agility: 45 },
      [{ skillId: 'skill_attack', priority: 5, condition: { kind: 'always' } }, { skillId: 'skill_fire', priority: 5, condition: { kind: 'always' } }], { collapseEffect: 'bossSink' }),
  ], manual: ['attack', 'attack', 'defend', 'magic'] },
  // 전멸: 넘을 수 없는 베히모스.
  defeat: { backdrop: 'battle-scenery-plains', enemies: [
    enemy('bf_behemoth', '뿔 베히모스', 'generated-enemy-behemoth-horn', { maxHp: 9999, attack: 400, defense: 50, agility: 40 }),
  ], manual: [] },
};
const only = values.only ? values.only.split(',') : Object.keys(SCENARIOS);
const timing = { res: values.res, viewport, scenarios: {} };

function buildProject(fixture, key) {
  const project = structuredClone(fixture.project);
  const sc = SCENARIOS[key];
  if (resW !== 320 || resH !== 240) project.system.playResolution = { width: resW, height: resH };
  project.session.inventory = { ...(project.session.inventory ?? {}), item_potion: 5, item_hi_potion: 2 };
  const sample = project.database.enemies[0];
  const ids = [];
  for (const e of sc.enemies) {
    if (!project.database.enemies.some((r) => r.id === e.id)) {
      const record = { ...structuredClone(sample), id: e.id, name: e.name, monsterResourceId: e.resourceId,
        stats: { ...sample.stats, ...e.stats }, actions: e.actions, ...e.extra };
      if (!e.extra.collapseEffect) delete record.collapseEffect;
      project.database.enemies.push(record);
    }
    ids.push(e.id);
  }
  const troopId = `troop_bf_${key}`;
  project.database.troops.push({ ...structuredClone(project.database.troops[0]), id: troopId, name: key, enemyIds: ids, autoAlign: true,
    members: ids.map((enemyId) => ({ enemyId, x: 0, y: 0, hidden: false })), previewBackgroundResourceId: sc.backdrop, pages: [] });
  const map = project.maps[fixture.entry.mapId];
  for (const event of map.events) if (event.id === fixture.entry.eventId) {
    for (const page of event.pages?.length ? event.pages : [event]) for (const command of page.commands ?? []) {
      if (command.kind === 'battleProcessing') { command.troopId = troopId; if (key === 'defeat') { command.canLose = false; } }
    }
  }
  return project;
}

const id = (v) => `[data-testid="${v}"]`;

async function instrument(page) {
  await page.evaluate(() => {
    const root = document.querySelector('[data-testid="battle-scene"]');
    const ev = window.__bf = { t0: performance.now(), events: [] };
    const push = (k, v, who) => ev.events.push({ t: Math.round(performance.now() - ev.t0), k, v, who });
    document.addEventListener('keydown', (e) => push('key', e.key), true);
    // 보스 등장 표본: 인트로 3초 동안 100ms 마다 단계·보스 그림 상태.
    for (let d = 0; d <= 3000; d += 100) setTimeout(() => {
      const boss = root.querySelector('.battle-enemy[data-collapse="bossSink"]');
      if (!boss) return;
      const cs = getComputedStyle(boss);
      push('boss', `${root.dataset.battleDirectorStep}|op${cs.opacity}|${cs.filter}|${cs.animationName}`);
    }, d);
    const watch = ['data-retro-beat', 'data-battle-phase', 'data-battle-sequence-busy', 'data-battle-finale'];
    new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === 'attributes') {
          if (!watch.includes(r.attributeName)) continue;
          push(r.attributeName, r.target.getAttribute(r.attributeName), r.target.dataset.testid ?? r.target.className.slice(0, 30));
        } else for (const n of r.addedNodes) {
          if (n.nodeType === 1 && n.classList.contains('battle-damage-popup')) {
            push('popup', n.textContent, n.className);
            if (window.__bfProbe) for (const d of [30, 90, 160]) setTimeout(() => {
              const sc = document.querySelector('[data-testid="battle-scene"]'), fl = sc.querySelector('.battle-field');
              const big = [...sc.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 500 && r.height > 200; });
              const hits = big.flatMap((e) => ['', '::before', '::after'].map((ps) => { const cs = getComputedStyle(e, ps || null);
                if (ps && cs.content === 'none') return null;
                const vis = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || cs.filter !== 'none';
                return vis ? `${e.className?.toString().slice(0, 40)}${ps}|op${cs.opacity}|bg${cs.backgroundColor}|img${cs.backgroundImage.slice(0, 50)}|f${cs.filter}|z${cs.zIndex}|anim${cs.animationName}` : null; })).filter(Boolean);
              push('probe' + d, hits, document.querySelector('[data-testid="battle-scene"]').className);
            }, d);
          }
          if (n.nodeType === 1 && n.matches?.('[data-testid="battle-result-panel"]')) {
            push('result-panel', n.getAttribute('data-battle-result'));
            setTimeout(() => {
              const r = n.getBoundingClientRect();
              const stack = [];
              for (let e = n; e && stack.length < 8; e = e.parentElement) { const cs = getComputedStyle(e);
                stack.push(`${e.className?.toString().slice(0, 40)}|bg${cs.backgroundColor}|img${cs.backgroundImage.slice(0, 30)}|op${cs.opacity}|vis${cs.visibility}|anim${cs.animationName}|disp${cs.display}`); }
              const f = document.querySelector('.battle-field'); if (f) { const cs = getComputedStyle(f); const b = f.getBoundingClientRect(); stack.push(`FIELD ${b.width}x${b.height}|op${cs.opacity}|vis${cs.visibility}|disp${cs.display}|z${cs.zIndex}`); }
              push('result-stack', stack);
            }, 900);
          }
        }
      }
    }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: watch });
  });
}

async function choose(page, testId, confirm = true) {
  for (let step = 0; step < 32; step++) {
    const next = await page.evaluate((targetId) => {
      const menu = document.querySelector('.battle-command-host');
      const target = [...(menu?.querySelectorAll('button.battle-command') ?? [])].find((n) => n.dataset.testid === targetId);
      const current = menu?.querySelector('[data-battle-command-cursor="true"]');
      if (!target || !current) return { error: `no command/cursor: ${targetId}` };
      if (target.getAttribute('aria-disabled') === 'true') return { error: `disabled: ${targetId}` };
      if (target === current) return { done: true };
      const a = current.getBoundingClientRect(), b = target.getBoundingClientRect();
      const dx = b.x + b.width / 2 - a.x - a.width / 2, dy = b.y + b.height / 2 - a.y - a.height / 2;
      return { key: Math.abs(dx) > 10 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp') };
    }, testId);
    if (next.error) return next.error;
    if (next.done) { await page.waitForTimeout(120); if (confirm) await page.keyboard.press('z'); return null; }
    await page.keyboard.press(next.key); await page.waitForTimeout(70);
  }
  return `cursor never reached ${testId}`;
}

const state = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-testid="battle-scene"]');
  return { phase: root?.dataset.battlePhase, busy: root?.dataset.battleSequenceBusy,
    actor: root?.querySelector('.battle-actor-status.is-active-actor')?.getAttribute('data-record-id'),
    result: root?.querySelector('[data-testid="battle-result-panel"]')?.getAttribute('data-battle-result') ?? null,
    gameOver: !!document.querySelector('[data-testid="game-over-screen"], .game-over-screen') };
});

async function waitCommand(page, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await state(page);
    if (s.result || s.gameOver) return s;
    if (s.phase === 'actorCommand' && s.busy === 'false' && await page.locator(id('actor-command-attack')).isVisible().catch(() => false)) return s;
    await page.waitForTimeout(60);
  }
  return null;
}

async function act(page, kind, notes) {
  const s = await waitCommand(page);
  if (!s || s.result) return;
  const mark = await page.evaluate((k) => { window.__bf.events.push({ t: Math.round(performance.now() - window.__bf.t0), k: 'action', v: k }); }, kind);
  void mark;
  let err = null;
  if (kind === 'attack') err = await choose(page, 'actor-command-attack');
  else if (kind === 'defend') err = await choose(page, 'actor-command-defend');
  else if (kind === 'magic') {
    err = await choose(page, 'actor-command-skill');
    if (!err) {
      await page.waitForSelector('[data-testid^="actor-skill-"]', { timeout: 5000 }).catch(() => {});
      const skills = await page.locator('[data-testid^="actor-skill-"]:not([aria-disabled="true"])').evaluateAll((ns) => ns.map((n) => n.dataset.testid));
      const pick = skills.find((s) => /skill_fire/.test(s)) ?? skills.find((s) => /blizzard|thunder|bolt|holy/.test(s)) ?? skills.find((s) => !/skill_attack/.test(s));
      if (pick) { err = await choose(page, pick); notes.push(`${s.actor} magic ${pick}`); } else { await page.keyboard.press('x'); err = await choose(page, 'actor-command-attack'); notes.push(`${s.actor} no magic → attack`); }
    }
  } else if (kind === 'item') {
    err = await choose(page, 'actor-command-item');
    if (!err) {
      await page.waitForSelector('[data-testid^="actor-item-"]', { timeout: 5000 }).catch(() => {});
      const first = await page.locator('[data-testid^="actor-item-"]:not([aria-disabled="true"])').first().getAttribute('data-testid').catch(() => null);
      if (first) { err = await choose(page, first); notes.push(`${s.actor} item ${first}`); } else { await page.keyboard.press('x'); err = await choose(page, 'actor-command-defend'); notes.push('no item'); }
    }
  }
  if (err) { notes.push(`choose error: ${err}`); return; }
  // target prompt: confirm whatever default target
  for (let i = 0; i < 40; i++) {
    const st = await state(page);
    if (st.busy === 'true' || st.result) break;
    if (await page.locator(id('battle-target-prompt')).count()) { await page.waitForTimeout(150); await page.keyboard.press('z'); }
    await page.waitForTimeout(60);
  }
}

let server, browser;
try {
  server = await startPlayerQaServer({ logLevel: 'error' });
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  for (const key of only) {
    const fixture = await recordingFixture();
    const project = buildProject(fixture, key);
    const notes = [], errors = [];
    const context = await browser.newContext({ viewport, recordVideo: { dir: join(out, 'video-' + key), size: viewport } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__battle-feel/project.json', saveNamespace: 'battle-feel', qaInstrumentation: true }; });
    await page.route('**/__battle-feel/project.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
    const wall0 = Date.now();
    let started = 0, ended = 0, crop = null;
    try {
      await page.goto(server.url + '/player.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
      // 부팅 중 ERR_NETWORK_CHANGED 로 백지가 되는 경우가 있다 — 두 번까지 다시 읽는다.
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
      // 확인키를 연타하면 진입 인트로가 빨리감기(SKIP_SPEED)로 지나간다 — 한 번 누르고 기다린다. 안 열리면 몇 초 뒤 다시.
      for (let i = 0; i < 8 && !await page.locator(id('battle-scene')).count(); i++) {
        await page.waitForSelector(id('battle-scene'), { timeout: 2500 }).catch(() => {});
        if (!await page.locator(id('battle-scene')).count()) await page.keyboard.press('z');
      }
      await page.waitForSelector(id('battle-scene'));
      await instrument(page);
      if (process.env.BF_PROBE) await page.evaluate(() => { window.__bfProbe = true; });
      const box = await page.locator('.play-stage, [data-testid="play-stage"]').first().boundingBox().catch(() => null);
      crop = box ? Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v)])) : { x: 0, y: 0, width: viewport.width, height: viewport.height };
      const first = await waitCommand(page, 40000);
      await page.evaluate(() => window.__bf.events.push({ t: Math.round(performance.now() - window.__bf.t0), k: 'first-command' }));
      if (first) await page.screenshot({ path: join(out, `${key}-command.png`) });
      // 배틀러 기하(무대 배율·자산 배율·노드 상자) — 정수 배율 점검용.
      if (first) timing.geometry = { ...(timing.geometry ?? {}), [key]: await page.evaluate(() => {
        const r = (n) => { if (!n) return null; const b = n.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: +b.width.toFixed(2), h: +b.height.toFixed(2), ow: n.offsetWidth, oh: n.offsetHeight }; };
        const scene = document.querySelector('[data-testid="battle-scene"]');
        return { stageScale: scene?.dataset.battleStageScale, assetScale: scene?.dataset.battleAssetScale, stageWidth: scene?.style.getPropertyValue('--battle-stage-width'),
          scene: r(scene), field: r(scene?.querySelector('.battle-field')),
          enemies: [...document.querySelectorAll('.battle-enemy .battle-enemy-image')].map(r),
          actors: [...document.querySelectorAll('.battle-actor .battle-actor-sprite, .battle-actor .battle-actor-image')].map(r) };
      }) };
      for (const kind of SCENARIOS[key].manual) {
        await act(page, kind, notes);
        if (kind === 'magic') await page.waitForTimeout(500).then(() => page.screenshot({ path: join(out, `${key}-magic.png`) }));
      }
      await waitCommand(page, 30000);
      await page.keyboard.press('f');
      const end = Date.now() + 150000;
      let shotMid = false;
      while (Date.now() < end) {
        const s = await state(page);
        if (!shotMid && s.busy === 'true') { await page.waitForTimeout(350); await page.screenshot({ path: join(out, `${key}-action.png`) }); shotMid = true; }
        if (s.result || s.gameOver) break;
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(out, `${key}-result.png`) });
      await page.waitForTimeout(1800);
      for (let i = 0; i < 6; i++) { await page.keyboard.press('z'); await page.waitForTimeout(400); }
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(out, `${key}-after.png`) });
      ended = (Date.now() - wall0) / 1000;
    } catch (e) { errors.push(String(e.stack ?? e)); ended = (Date.now() - wall0) / 1000; await page.screenshot({ path: join(out, `${key}-failure.png`) }).catch(() => {}); }
    const events = await page.evaluate(() => window.__bf?.events ?? []).catch(() => []);
    const video = page.video();
    await context.close();
    fixture.cleanup();
    const raw = await video.path();
    const mp4 = join(out, `${key}.mp4`);
    // 영상 시작 ~ 페이지 생성 사이 오프셋은 작다. 전투 진입 0.5초 전부터 자른다.
    const c = crop ?? { x: 0, y: 0, width: viewport.width, height: viewport.height };
    await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, started - 0.3)), '-t', String(ended - started + 0.3), '-i', raw,
      '-vf', `crop=${c.width}:${c.height}:${c.x}:${c.y}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'veryfast', '-an', mp4]);
    timing.scenarios[key] = { notes, errors, events, crop };
    console.log(JSON.stringify({ key, notes, errors: errors.map((e) => e.slice(0, 200)), events: events.length }));
  }
} finally { await browser?.close(); await server?.close(); }
await writeFile(join(out, 'timing.json'), JSON.stringify(timing, null, 1));
