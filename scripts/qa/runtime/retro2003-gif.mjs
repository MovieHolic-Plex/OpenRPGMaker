// 실행: node scripts/qa/runtime/retro2003-gif.mjs [--project project.json] [--fps 15] [--width 640] [--max-seconds 120]
// 출하 플레이어·실시간 비디오를 쓴다. 전투 입력은 방향키와 Z, 자동 전투 F뿐이다.
import { mkdir, writeFile, stat, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
import { recordingFixture } from './retro2003-gif-fixture.mjs';

const run = promisify(execFile);
const { values } = parseArgs({ options: {
  project: { type: 'string' }, fps: { type: 'string', default: '15' }, width: { type: 'string', default: '640' },
  'max-seconds': { type: 'string', default: '120' }, out: { type: 'string' },
} });
const fps = Number(values.fps), width = Number(values.width), maxSeconds = Number(values['max-seconds']);
if (!Number.isInteger(fps) || fps < 1 || fps > 30 || !Number.isInteger(width) || width < 160 || width > 1280
  || !Number.isFinite(maxSeconds) || maxSeconds < 10 || maxSeconds > 600) throw new Error('fps 1~30, width 160~1280, max-seconds 10~600 범위로 지정하세요.');
const out = resolve(values.out ?? process.env.QA_OUT_DIR ?? 'verify-shots/runtime-qa/retro2003-gif');
await mkdir(out, { recursive: true });
const report = { options: { fps, width, maxSeconds, project: values.project ?? 'demo-v3 (녹화용 사본)' }, clips: [], actions: [], errors: [], notes: [], hud: {} };
const segments = {};
const castSkillsUsed = new Set();
const castActors = new Set();
let fixture, server, browser, context, page, video, crop, started, stopped;
// 도트 적마다 공격 구간을 따로 찍는다(enemy-slime, enemy-bat). 녹화 사본의 적은 통상 공격만 한다.
const ENEMY_CLIPS = { enemy_slime: 'enemy-slime', enemy_cave_bat: 'enemy-bat' };
const enemyStarts = {};
const id = (value) => `[data-testid="${value}"]`;
const elapsed = () => (performance.now() - started) / 1000;
const remaining = () => Math.max(1, (maxSeconds - elapsed()) * 1000);
const budget = () => { if (elapsed() >= maxSeconds) throw new Error(`--max-seconds ${maxSeconds}초 초과`); };
const sleep = (ms) => page.waitForTimeout(Math.min(ms, remaining()));

async function measure() {
  const state = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="battle-scene"]');
    return {
      phase: root?.dataset.battlePhase, busy: root?.dataset.battleSequenceBusy, step: root?.dataset.battleDirectorStep,
      actor: root?.querySelector('.battle-actor-status.is-active-actor')?.getAttribute('data-record-id'),
      message: root?.querySelector('.battle-message-line')?.textContent ?? '',
      enemyActing: root?.querySelector('.battle-enemy-group .battle-enemy[data-retro-beat]')?.getAttribute('data-record-id') ?? null,
      // 근접 착탄 순간: 때린 아군이 **맞은 적 바로 앞**에 서 있는가(가로 틈·발 높이 차, 화면 px).
      strike: (() => {
        const actor = root?.querySelector('.battle-actor-group .battle-actor[data-retro-action="attack"][data-retro-beat="impact"]');
        const struck = root?.querySelector('.battle-enemy.battle-motion-knockback');
        if (!actor || !struck) return null;
        const a = actor.querySelector('.battle-actor-sprite')?.getBoundingClientRect() ?? actor.getBoundingClientRect();
        const e = struck.querySelector('.battle-enemy-image').getBoundingClientRect();
        const nearest = [...root.querySelectorAll('.battle-enemy:not(.defeated)')].map((node) => {
          const r = node.querySelector('.battle-enemy-image').getBoundingClientRect();
          return { id: node.dataset.testid, d: Math.hypot(r.left + r.width / 2 - (a.left + a.width / 2), r.bottom - a.bottom) };
        }).sort((x, y) => x.d - y.d)[0]?.id;
        return { actor: actor.dataset.recordId, struck: struck.dataset.testid, nearest, gapX: Math.round(a.left + a.width * 0.29 - (e.left + e.width * 0.75)), feetY: Math.round(a.bottom - e.bottom) };
      })(),
      result: root?.querySelector('[data-testid="battle-result-panel"]')?.getAttribute('data-battle-result'),
      poses: [...(root?.querySelectorAll('.battle-actor-group .battle-actor') ?? [])].map((node) => node.dataset.battlePose),
    };
  });
  if (state.strike && !report.strikes?.some((s) => s.actor === state.strike.actor && s.struck === state.strike.struck)) {
    (report.strikes ??= []).push(state.strike);
    console.log(`[retro2003-gif] strike ${JSON.stringify(state.strike)}`);
  }
  // 방어 직후 적 행동이 같은 busy 구간에 이어져도 놓치지 않는다. 적마다 첫 공격 한 번씩.
  for (const [recordId, name] of Object.entries(ENEMY_CLIPS)) {
    if (segments[name]) continue;
    const acting = state.busy === 'true' && state.enemyActing === recordId;
    if (acting) enemyStarts[recordId] ??= elapsed();
    else if (enemyStarts[recordId] !== undefined) {
      segments[name] = { start: Math.max(0, enemyStarts[recordId] - 0.3), duration: elapsed() - enemyStarts[recordId] + 0.6 };
      report.actions.push({ name, ...segments[name], observed: true });
      console.log(`[retro2003-gif] ${name} ${elapsed().toFixed(1)}s`);
    }
  }
  return state;
}

// 2열 루트와 1열 하위 목록 모두 실제 사각형으로 방향을 고른다. DOM 커서를 직접 쓰지 않는다.
async function choose(testId, confirm = true) {
  for (let step = 0; step < 32; step++) {
    budget();
    const next = await page.evaluate((targetId) => {
      const menu = document.querySelector('.battle-command-host');
      const target = [...(menu?.querySelectorAll('button.battle-command') ?? [])].find((node) => node.dataset.testid === targetId);
      const current = menu?.querySelector('[data-battle-command-cursor="true"]');
      if (!target || !current) return { error: `명령/커서 없음: ${targetId}` };
      if (target.getAttribute('aria-disabled') === 'true') return { error: `사용 불가: ${targetId}` };
      if (target === current) return { done: true };
      const a = current.getBoundingClientRect(), b = target.getBoundingClientRect();
      const dx = b.x + b.width / 2 - a.x - a.width / 2;
      const dy = b.y + b.height / 2 - a.y - a.height / 2;
      return { key: Math.abs(dx) > 10 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp') };
    }, testId);
    if (next.error) throw new Error(next.error);
    if (next.done) { await sleep(180); if (confirm) await page.keyboard.press('z'); return; }
    await page.keyboard.press(next.key);
    await sleep(65);
  }
  throw new Error(`키보드 커서 도달 실패: ${testId}`);
}

async function finishAction(name, command, wantedSkill) {
  const start = elapsed();
  await choose(command);
  if (name.startsWith('magic')) {
    await page.waitForSelector('[data-testid^="actor-skill-"]', { timeout: Math.min(5000, remaining()) });
    const candidates = await page.locator('[data-testid^="actor-skill-"]:not([aria-disabled="true"])').evaluateAll((nodes) => nodes.map((node) => node.dataset.testid));
    const skill = (wantedSkill && candidates.find((entry) => entry === `actor-skill-${wantedSkill}`))
      ?? candidates.find((entry) => !castSkillsUsed.has(entry) && !/skill_attack|skill_sword_slash/.test(entry));
    if (!skill) { await page.keyboard.press('x'); return false; }
    castSkillsUsed.add(skill);
    if (name === 'magic') {
      await auditHud('magic-menu');
      await choose('actor-command-back', false);
      await auditHud('magic-menu-bottom');
    }
    await choose(skill);
    report.notes.push(`${name}: ${skill.replace('actor-skill-', '')}`);
  } else if (name === 'item') {
    const items = page.locator('[data-testid^="actor-item-"]:not([aria-disabled="true"])');
    if (!await items.count()) { await page.keyboard.press('x'); report.notes.push('소모품 없음: 아이템 구간 생략'); return false; }
    await choose(await items.first().getAttribute('data-testid'));
  }
  // 대상 없는 방어·자신 대상 아이템도 같은 루프를 쓴다.
  let acted = false;
  while (elapsed() - start < 20) {
    budget();
    const state = await measure();
    if (state.phase === 'targetSelect' && state.busy === 'false') {
      // 통상 공격은 기본 대상(첫 적)이 아닌 적을 골라 "고른 적에게 간다" 를 녹화한다.
      if (name === 'attack' && !report.retargeted) { report.retargeted = true; await page.keyboard.press('ArrowDown'); await sleep(160); }
      await sleep(200); await page.keyboard.press('z');
    }
    if (state.busy === 'true') acted = true;
    if (acted && state.busy === 'false') break;
    await sleep(40);
  }
  if (!acted) throw new Error(`${name} 실행 연출을 관측하지 못함`);
  segments[name] ??= { start, duration: elapsed() - start };
  report.actions.push({ name, ...segments[name], observed: true });
  console.log(`[retro2003-gif] ${name} ${elapsed().toFixed(1)}s`);
  return true;
}

async function auditHud(name) {
  const geometry = await page.evaluate(() => {
    const box = (selector) => {
      const node = document.querySelector(selector), rect = node?.getBoundingClientRect();
      return node && { x: rect.x, y: rect.y, width: rect.width, height: rect.height, font: getComputedStyle(node).fontSize };
    };
    const menu = document.querySelector('.battle-command-menu');
    const cursor = menu?.querySelector('[data-battle-command-cursor="true"]');
    return { party: box('.battle-party'), command: box('.battle-command-panel'), message: box('.battle-message-window'),
      name: box('.battle-actor-name'), menu: { height: menu?.clientHeight, scrollHeight: menu?.scrollHeight, columns: menu && getComputedStyle(menu).gridTemplateColumns },
      cursorImage: cursor && getComputedStyle(cursor, '::before').backgroundImage,
      rows: [...document.querySelectorAll('.battle-party .battle-actor-status')].map((row) => ({ width: row.clientWidth, scrollWidth: row.scrollWidth, right: row.getBoundingClientRect().right, padding: getComputedStyle(row).padding, cursor: getComputedStyle(row, '::before').content })),
    };
  });
  report.hud[name] = geometry;
  await page.screenshot({ path: join(out, `${name}.png`), clip: crop, animations: 'allow' });
  if (geometry.party.x >= geometry.command.x || geometry.party.x + geometry.party.width > geometry.command.x + 1) throw new Error('HUD 좌우 배치/겹침 오류');
  if (geometry.rows.some((row) => row.scrollWidth > row.width + 1 || row.right > geometry.party.x + geometry.party.width + 1)) throw new Error('파티 행 가로 넘침');
}

async function probe(path) {
  const { stdout } = await run('/usr/bin/ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_read_frames:format=duration,size', '-of', 'json', path]);
  return JSON.parse(stdout);
}

async function encode(rawPath, offset, name, segment, colors = 128, rate = fps) {
  const path = join(out, `${name}.gif`);
  const filter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},fps=${rate},scale=${width}:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`;
  await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-filter_complex_threads', '1', '-ss', String(Math.max(0, offset + segment.start)), '-t', String(segment.duration), '-i', rawPath, '-filter_complex', filter, '-loop', '0', path], { maxBuffer: 1024 * 1024 });
  return { name, ...segment, fps: rate, colors, bytes: (await stat(path)).size, probe: await probe(path) };
}

try {
  fixture = await recordingFixture(values.project);
  report.replacements = fixture.replacements;
  report.entry = fixture.entry;
  server = await startPlayerQaServer();
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  context = await browser.newContext({ viewport: { width: 960, height: 720 }, reducedMotion: 'no-preference', recordVideo: { dir: join(out, 'video'), size: { width: 960, height: 720 } } });
  page = await context.newPage(); video = page.video();
  page.on('pageerror', (error) => report.errors.push(String(error)));
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__retro2003-gif/project.json', saveNamespace: 'retro2003-gif', qaInstrumentation: true }; });
  await page.route('**/__retro2003-gif/project.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture.project) }));
  // 금지된 생성 아군이 새 경로로 다시 섞이면 화면 대신 오류 증거를 남긴다.
  await page.route(/\/assets\/generated\/starter\/(?:hires\/)?hero-\d+-(?:charset|battle)\.png/, (route) => {
    report.errors.push(`금지된 아군 그림 요청: ${route.request().url()}`); return route.abort();
  });
  console.log('[retro2003-gif] 플레이어 부팅');
  await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(id('title-screen'), { timeout: 120000 });
  console.log('[retro2003-gif] 타이틀 준비');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Boolean(window.__oprnDebug?.readState?.().currentMapId), null, { timeout: 120000 });
  await page.evaluate((entry) => { window.__oprnDebug.setSeed(1); window.__oprnDebug.teleport(entry.mapId, entry.x, entry.y); }, fixture.entry);
  await page.waitForFunction((entry) => { const s = window.__oprnDebug.readState(); return s.currentMapId === entry.mapId && s.x === entry.x && s.y === entry.y; }, fixture.entry);
  started = performance.now();
  await page.evaluate(() => window.__oprnInput.face('up'));
  await page.keyboard.press('z');
  for (let i = 0; i < 40 && !await page.locator(id('battle-scene')).count(); i++) {
    budget(); await sleep(180); await page.keyboard.press('z');
  }
  await page.waitForSelector(id('battle-actor-sprites'), { timeout: Math.min(30000, remaining()) });
  crop = await page.locator(id('battle-scene')).boundingBox();
  crop = Object.fromEntries(Object.entries(crop).map(([key, value]) => [key, Math.round(value)]));
  await page.waitForSelector('.battle-scene[data-battle-sequence-busy="false"]', { timeout: Math.min(30000, remaining()) });
  await page.waitForSelector(id('actor-command-attack'), { timeout: Math.min(30000, remaining()) });
  segments.intro = { start: 0, duration: elapsed() };
  await auditHud('command');
  await sleep(650);
  await finishAction('attack', 'actor-command-attack');

  let magic = false, defended = false, enemy = false, item = false;
  // 마법은 종류마다 시전 동작이 다르다 — 서로 다른 마법을 최대 세 번 찍는다(마도사 화염·비전, 성직자 치유 등).
  let casts = 0;
  const party = fixture.project.system.startActorIds ?? [];
  const castCapable = fixture.project.database.actors.filter((actor) => party.includes(actor.id)
    && actor.learnedSkills?.some((skill) => !/skill_attack|skill_sword_slash/.test(skill.skillId))).length;
  while (!(magic && casts >= Math.min(3, castCapable) && defended && enemy && item)) {
    budget();
    const state = await measure();
    enemy ||= Object.values(ENEMY_CLIPS).every((name) => segments[name]);
    if (state.result) throw new Error('수동 필수 구간 전에 전투가 끝남');
    if (state.phase === 'actorCommand' && state.busy === 'false' && await page.locator(id('actor-command-defend')).isVisible()) {
      const actor = fixture.project.database.actors.find((entry) => entry.id === state.actor);
      const castable = actor?.learnedSkills?.some((skill) => !/skill_attack|skill_sword_slash/.test(skill.skillId));
      if (casts < 3 && castable && !castActors.has(actor.id)) {
        castActors.add(actor.id);
        const ok = await finishAction(casts === 0 ? 'magic' : `magic-${casts + 1}`, 'actor-command-skill', actor.id === 'actor_mage' && casts === 0 ? 'skill_fire' : undefined);
        if (ok) { casts += 1; magic = true; } else { await finishAction('defend', 'actor-command-defend'); defended = true; }
      } else if (magic && defended && enemy && !item) {
        if (await page.locator(`${id('actor-command-item')}:not([aria-disabled="true"])`).count()) await finishAction('item', 'actor-command-item');
        else report.notes.push('사용 가능한 아이템 명령 없음: 구간 생략');
        item = true;
      } else { await finishAction('defend', 'actor-command-defend'); defended = true; }
    }
    await sleep(40);
  }
  // 직업마다 근접 접근이 다르다(질주·도약·순간이동·섬광) — 파티 전원의 통상 공격을 한 번씩 찍는다.
  const attacked = new Set(report.strikes?.map((strike) => strike.actor) ?? []);
  while (party.some((actorId) => !attacked.has(actorId))) {
    budget();
    const state = await measure();
    if (state.result) { report.notes.push(`통상 공격 미녹화: ${party.filter((actorId) => !attacked.has(actorId)).join(', ')} (전투 종료)`); break; }
    if (state.phase === 'actorCommand' && state.busy === 'false' && await page.locator(id('actor-command-attack')).isVisible()) {
      if (!attacked.has(state.actor)) {
        attacked.add(state.actor);
        await finishAction(`attack-${state.actor.replace('actor_', '')}`, 'actor-command-attack');
      } else await finishAction('defend', 'actor-command-defend');
    }
    await sleep(40);
  }
  await page.keyboard.press('f');
  console.log(`[retro2003-gif] auto ${elapsed().toFixed(1)}s`);
  await page.waitForSelector(id('battle-result-panel'), { timeout: remaining() });
  const victoryStart = elapsed();
  const result = await measure();
  if (result.result !== 'victory' || !result.poses.includes('victory')) throw new Error(`승리 결과/포즈 누락: ${JSON.stringify(result)}`);
  await sleep(2200);
  segments.victory = { start: Math.max(0, victoryStart - 1.5), duration: elapsed() - victoryStart + 1.5 };
  await page.screenshot({ path: join(out, 'result.png'), clip: crop, animations: 'allow' });
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  if (page) await page.screenshot({ path: join(out, 'failure.png'), animations: 'allow' }).catch(() => {});
} finally {
  stopped = performance.now();
  await context?.close();
  await browser?.close();
  await server?.close();
  fixture?.cleanup();
}

try {
  if (video && crop && started) {
    console.log('[retro2003-gif] GIF 변환 시작');
    const rawPath = await video.path();
    const raw = await probe(rawPath);
    const duration = Math.min(maxSeconds, (stopped - started) / 1000);
    // 마지막 비디오 프레임에 종료 시각을 맞춘다. 서버 부팅 시간은 GIF에 들어가지 않는다.
    const offset = Math.max(0, Number(raw.format.duration) - (stopped - started) / 1000);
    report.video = { path: rawPath, raw, offset, crop };
    let full = await encode(rawPath, offset, 'battle', { start: 0, duration });
    // 전체 길이는 보존한다. 8 MB를 넘으면 팔레트, 마지막으로 프레임률만 낮춘다.
    for (const colors of [96, 64, 32]) {
      if (full.bytes <= 8_000_000) break;
      full = await encode(rawPath, offset, 'battle', { start: 0, duration }, colors);
    }
    if (full.bytes > 8_000_000) full = await encode(rawPath, offset, 'battle', { start: 0, duration }, 32, Math.min(fps, 10));
    // 전체 GIF 가 넘쳐도 구간 GIF 는 만든다(구간이 검토의 본체다). 초과는 메모로 남긴다.
    if (full.bytes > 8_000_000) report.notes.push(`전체 GIF ${(full.bytes / 1e6).toFixed(1)} MB — 8 MB 초과. --fps 또는 --width 를 줄이세요.`);
    report.clips.push(full);
    for (const [name, segment] of Object.entries(segments)) {
      if (name === 'intro') continue;
      report.clips.push(await encode(rawPath, offset, name, segment));
    }
    // GIF 디코더를 거쳐 뽑은 그림이 실제 배포 산출물의 HUD 검토 증거다.
    for (const [name, time] of [['hud', segments.intro.duration + 0.2], ['magic', (segments.magic?.start ?? 0) + 0.3], ['victory', segments.victory?.start ?? 0]]) {
      await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(time), '-i', join(out, 'battle.gif'), '-frames:v', '1', join(out, `${name}-from-gif.png`)]);
    }
  }
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  await copyFile(join(out, 'command.png'), join(out, 'failure.png')).catch(() => {});
}
const failed = report.errors.length > 0;
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
await writeFile(join(out, 'SUMMARY.md'), [
  '# retro2003 전투 GIF', '', `- 실행: ${failed ? '실패' : '통과'}`, '- 출하 player.html · 키보드 입력 · 실시간 비디오 → 무대 영역 crop · palettegen/paletteuse',
  `- 입력: ${report.options.project}`, `- 요청: ${fps}fps / 폭 ${width}px / 최대 ${maxSeconds}초`,
  '- 즉시 확인: hud-from-gif.png, magic-from-gif.png, victory-from-gif.png',
  '- command.png / magic-menu.png는 브라우저 원본, *-from-gif.png는 GIF에서 디코딩한 프레임이다.',
  '- 메시지는 텍스트 노드라 CSS만으로 기술명만 분홍색 강조할 수 없다.',
  '', '| 구간 | 시작(초) | 길이(초) | 크기(MiB) | 프레임 | FPS |', '|---|---:|---:|---:|---:|---:|',
  ...report.clips.map((clip) => `| ${clip.name}.gif | ${clip.start.toFixed(2)} | ${Number(clip.probe.format.duration).toFixed(2)} | ${(clip.bytes / 1024 ** 2).toFixed(2)} | ${clip.probe.streams[0].nb_read_frames} | ${clip.fps} |`),
  '', ...report.notes.map((note) => `- 참고: ${note}`), ...report.errors.map((error) => `- 오류: ${error}`), '',
].join('\n'));
console.log(JSON.stringify({ out, passed: !failed, clips: report.clips.map(({ name, bytes }) => ({ name, bytes })), errors: report.errors }));
process.exitCode = failed ? 1 : 0;
