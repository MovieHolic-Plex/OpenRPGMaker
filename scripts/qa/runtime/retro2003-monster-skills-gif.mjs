// node scripts/qa/runtime/retro2003-monster-skills-gif.mjs [--out DIR] [--skills acid_spit,dark_judgment] [--fps 12] [--width 520]
// 몬스터 스킬 42개(계약 src/assets/retroMonsterSkills.ts)를 스킬마다 대표 몬스터(RETRO_MONSTER_SKILLSETS 에서 그 스킬을 가진 첫 slug)
// 한 마리 트룹으로 세워 그 스킬 한 번을 녹화하고 mskill-<id>.gif 로 자른다. retro2003-monsters-gif.mjs 와 같은 출하 player.html 경로·키보드 입력.
// 녹화 사본만 고친다: 기본 DB 의 스킬·상태·전투 애니메이션을 합치고, 적은 그 스킬 하나만(MP 999·민첩 999), 아군 파티 셋(전체기 확인)은 방어로 넘긴다.
// 이펙트 PNG(public/assets/generated/pixel-fx/mon_*.png)가 없으면 그 레이어만 비어 찍힌다 — SUMMARY 에 빠진 키를 적는다.
import { mkdir, writeFile, stat, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
import { recordingFixture } from './retro2003-gif-fixture.mjs';

const { values } = parseArgs({ options: {
  out: { type: 'string', default: '.omo/retro-monster-skills/recording' },
  skills: { type: 'string' }, fps: { type: 'string', default: '12' }, width: { type: 'string', default: '520' },
} });
const fps = Number(values.fps), width = Number(values.width);
if (!Number.isInteger(fps) || fps < 1 || fps > 30 || !Number.isInteger(width) || width < 320 || width > 1280) throw new Error('fps 1..30, width 320..1280');
const out = resolve(values.out);
await mkdir(join(out, 'video'), { recursive: true });
await mkdir(join(out, 'browser-tmp'), { recursive: true });
process.env.TMPDIR = join(out, 'browser-tmp');
process.env.VITE_CACHE_DIR ??= resolve('.omo/retro-monster-skills/vite-cache');
const run = promisify(execFile);
const selector = (id) => '[data-testid="' + id + '"]';
const report = { clips: [], skipped: [], errors: [], evidence: [] };
let server, browser;

try {
  server = await startPlayerQaServer();
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  // 계약·시트 카탈로그·기본 DB 를 Vite 로 읽는다(런타임과 같은 목록).
  const setup = await browser.newPage();
  await setup.route('**/__mskill-setup', (route) => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await setup.goto(server.url + '/__mskill-setup');
  const defaults = await setup.evaluate(async () => {
    const sheets = await import('/src/assets/pixelEnemySheets.ts');
    const contract = await import('/src/assets/retroMonsterSkills.ts');
    const battle = await import('/src/project/defaults/defaultDatabaseBattleRecords.ts');
    const m = await import('/src/project/defaults/defaultDatabaseStarterRecords.ts');
    const enemies = battle.defaultBattleRecords().enemies;
    const catalog = sheets.PIXEL_ENEMY_SHEETS.map((sheet) => {
      const slug = sheet.path.split('/').pop().replace(/\.png$/, '');
      const matches = enemies.filter((row) => row.monsterResourceId === sheet.resourceId);
      const enemy = matches.find((row) => row.id === 'enemy_' + slug.replace(/-/g, '_')) ?? matches[0];
      return { slug, resourceId: sheet.resourceId, path: sheet.path, motion: sheet.motion, cell: sheet.cell ?? 48, enemy };
    });
    return {
      catalog, skillsets: contract.RETRO_MONSTER_SKILLSETS,
      contract: contract.RETRO_MONSTER_SKILLS.map((s) => ({ id: s.id, name: s.name, motion: s.motion, effect: s.effect, layers: s.layers.map((l) => ({ key: l.key, anchor: l.anchor })) })),
      skills: m.defaultSkillRecords(), battleAnimations: m.defaultBattleAnimationRecords(), states: m.defaultStateRecords(),
    };
  });
  await setup.close();
  const all = defaults.contract.map((row) => row.id);
  const wanted = values.skills ? values.skills.split(',').map((id) => id.startsWith('skill_mon_') ? id : 'skill_mon_' + id) : all;
  const unknown = wanted.filter((id) => !all.includes(id));
  if (unknown.length) throw new Error('Unknown --skills: ' + unknown.join(','));
  const ready = [];
  for (const skill of defaults.contract.filter((row) => wanted.includes(row.id))) {
    // 대표 몬스터 = 계약 목록 순서에서 이 스킬을 가진 첫 slug.
    const slug = Object.keys(defaults.skillsets).find((key) => defaults.skillsets[key].includes(skill.id));
    const row = defaults.catalog.find((entry) => entry.slug === slug);
    if (!row) { report.skipped.push({ slug: skill.id, reason: 'no monster slug has this skill' }); continue; }
    try { await access(resolve('public', row.path)); } catch { report.skipped.push({ slug: skill.id, reason: 'sheet missing: ' + row.path }); continue; }
    if (!row.enemy) { report.skipped.push({ slug: skill.id, reason: 'no enemy record uses ' + row.resourceId }); continue; }
    const missingFx = [];
    for (const layer of skill.layers) { try { await access(resolve('public/assets/generated/pixel-fx', layer.key + '.png')); } catch { missingFx.push(layer.key); } }
    ready.push({ ...row, slug: skill.id.replace(/^skill_mon_/, ''), monster: row.slug, skill, missingFx });
  }
  console.log('[mskills] ' + ready.length + ' ready, ' + report.skipped.length + ' skipped');
  if (ready.length) await recordAll(ready, defaults);
} catch (e) {
  report.errors.push(String(e.stack ?? e));
} finally {
  await browser?.close(); await server?.close();
}

async function recordAll(rows, defaults) {
  const fixture = await recordingFixture();
  let context, page, video, crop, start;
  const segments = [];
  const elapsed = () => (performance.now() - start) / 1000;
  const sleep = (ms) => page.waitForTimeout(ms);
  const scene = () => page.evaluate(() => {
    const r = document.querySelector('[data-testid="battle-scene"]');
    const enemy = r?.querySelector('.battle-enemy-group .battle-enemy');
    return { present: !!r, phase: r?.dataset.battlePhase, busy: r?.dataset.battleSequenceBusy, result: !!r?.querySelector('[data-testid="battle-result-panel"]'),
      enemyBeat: enemy?.dataset.retroBeat ?? null, pixel: enemy?.dataset.pixelEnemy ?? null, cell: enemy?.dataset.pixelEnemyCell ?? null,
      reach: enemy?.dataset.retroReach ?? null, sheet: enemy?.querySelector('.battle-enemy-image')?.dataset.pixelSheet ?? null,
      frame: enemy?.dataset.retroPixelCell ?? null, classSkill: enemy?.dataset.retroClassSkill ?? null,
      fx: [...(r?.querySelectorAll('.retro-class-fx') ?? [])].map((n) => n.dataset.retroSkillFx + '@' + n.dataset.retroFxAnchor + ':' + n.dataset.fxBox),
      screens: [...(r?.querySelectorAll('[data-retro-screen]') ?? [])].map((n) => n.dataset.retroScreen),
      sounds: Number(r?.querySelector('.battle-field, [data-retro-class-skill-sounds]')?.dataset.retroClassSkillSounds ?? document.querySelector('[data-retro-class-skill-sounds]')?.dataset.retroClassSkillSounds ?? 0),
      layer: [...(r?.querySelectorAll('.battle-animation-layer *') ?? [])].length };
  });
  async function choose(id) {
    for (let i = 0; i < 40; i++) {
      const next = await page.evaluate((id) => {
        const menu = document.querySelector('.battle-command-host');
        const buttons = [...(menu?.querySelectorAll('button.battle-command') ?? [])];
        const target = buttons.find((n) => n.dataset.testid === id);
        const current = menu?.querySelector('[data-battle-command-cursor="true"]');
        if (!target || !current) return { error: id };
        if (target === current) return { done: true };
        const a = current.getBoundingClientRect(), b = target.getBoundingClientRect();
        const dy = b.y + b.height / 2 - a.y - a.height / 2, dx = b.x + b.width / 2 - a.x - a.width / 2;
        if (Math.abs(dy) <= 10 && Math.abs(dx) > 10) return { key: dx > 0 ? 'ArrowRight' : 'ArrowLeft' };
        return { key: buttons.indexOf(target) > buttons.indexOf(current) ? 'ArrowDown' : 'ArrowUp' };
      }, id);
      if (next.error) throw new Error('Missing command: ' + next.error);
      if (next.done) { await page.keyboard.press('z'); return; }
      await page.keyboard.press(next.key); await sleep(45);
    }
    throw new Error('Cursor never reached ' + id);
  }
  try {
    const project = fixture.project;
    // 기본 DB 의 스킬(몬스터 스킬 42 포함)·상태·전투 애니메이션을 사본에 합친다.
    for (const key of ['skills', 'battleAnimations', 'states']) {
      const rows = defaults[key];
      project.database[key] = [...project.database[key].filter((row) => !rows.some((r) => r.id === row.id)), ...rows];
    }
    // 전체기·단일기 대상이 보이게 셋. 이름이 겹치는 아군 스킬(독침·연막탄)이 이미 사본에 있어도 연출 판정은 편으로 가른다.
    const party = ['actor_hero', 'actor_guardian', 'actor_mage'].filter((id) => project.database.actors.some((a) => a.id === id));
    project.system.startActorIds = party;
    if (project.session) project.session.partyActorIds = party;
    for (const actor of project.database.actors) {
      if (actor.parameterCurves) { actor.parameterCurves.maxHp = actor.parameterCurves.maxHp.map(() => 9999); actor.parameterCurves.agility = actor.parameterCurves.agility.map(() => 1); }
    }
    for (const job of project.database.classes) {
      if (job.parameterCurves?.maxHp) job.parameterCurves.maxHp = job.parameterCurves.maxHp.map(() => 9999);
      if (job.parameterCurves?.agility) job.parameterCurves.agility = job.parameterCurves.agility.map(() => 1);
    }
    // 스킬마다 트룹 하나(대표 몬스터 한 마리, 자동 진형). 적은 그 스킬 하나만, 먼저 행동, 맞아도 죽지 않는다.
    const have = new Set(project.database.enemies.map((row) => row.id));
    for (const row of rows) {
      const enemy = structuredClone(row.enemy);
      enemy.id = 'qa_mskill_' + row.slug;
      enemy.name = row.enemy.name;
      // 기본 DB 행을 데모 사본에 옮긴다 — 사본에 없는 참조(종·드롭·훔칠 아이템·행동 기술)는 걷어 로드 검증을 통과시킨다.
      delete enemy.speciesId;
      if (enemy.rewards) delete enemy.rewards.dropItemId;
      delete enemy.stealItems;
      delete enemy.learnableSkillIds;
      delete enemy.elementRates; delete enemy.stateRates;
      enemy.stats = { ...enemy.stats, maxHp: 99999, maxMp: 999, attack: 1, mind: 1, agility: 999 };
      enemy.actions = [{ skillId: row.skill.id, priority: 9, condition: { kind: 'always' }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
      if (!have.has(enemy.id)) project.database.enemies.push(enemy);
      project.database.troops.push({ id: 'qa_troop_' + row.slug, name: row.skill.name, enemyIds: [enemy.id], members: [{ enemyId: enemy.id, x: 88, y: 132, hidden: false }], autoAlign: true, battleEventPages: [] });
    }
    // 전투 이벤트는 변수 qa_monster_index 번째 트룹을 읽는다(troopSource variable). 종마다 변수만 바꿔 다시 말을 건다.
    const map = project.maps[fixture.entry.mapId];
    const event = map.events.find((row) => row.id === fixture.entry.eventId);
    const page0 = event.pages?.find((row) => row.commands?.some((c) => c.kind === 'battleProcessing')) ?? event;
    const battle = page0.commands.find((c) => c.kind === 'battleProcessing');
    battle.troopSource = 'variable'; battle.troopVariableId = 'var_qa_monster_troop'; battle.canEscape = false; battle.canLose = true;
    // 조건 없이 늘 같은 페이지가 뜨게 뒤 페이지·후속 명령을 걷는다.
    page0.commands = page0.commands.filter((c) => c.kind === 'battleProcessing');
    if (event.pages) event.pages = [page0];
    project.variables = [...(project.variables ?? []).filter((v) => v.id !== 'var_qa_monster_troop'), { id: 'var_qa_monster_troop', name: 'QA 트룹' }];
    await writeFile(join(out, 'recording-project.json'), JSON.stringify(project));
    context = await browser.newContext({ viewport: { width: 960, height: 720 }, recordVideo: { dir: join(out, 'video'), size: { width: 960, height: 720 } } });
    page = await context.newPage(); video = page.video();
    page.on('pageerror', (e) => report.errors.push('[page] ' + e));
    page.on('response', (r) => { if (r.status() >= 400 && /pixel-enemies|pixel-fx\/mon_/.test(r.url())) report.errors.push('Asset ' + r.status() + ': ' + r.url()); });
    await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__mskills-qa/project.json', saveNamespace: 'retro-mskills-qa', qaInstrumentation: true }; });
    await page.route('**/__mskills-qa/project.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
    for (let attempt = 0; ; attempt++) {
      await page.goto(server.url + '/player.html', { waitUntil: 'domcontentloaded' });
      try { await page.waitForSelector(selector('title-screen'), { timeout: 120000 }); break; }
      catch (e) { if (attempt >= 1) throw e; console.log('[mskills] title timeout, reloading'); }
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 120000 });
    start = performance.now();
    await page.evaluate(() => {
      const marker = document.createElement('div'); marker.id = 'monster-video-marker';
      Object.assign(marker.style, { position: 'fixed', right: '0', bottom: '0', width: '16px', height: '16px', zIndex: '2147483647', background: '#000', pointerEvents: 'none' });
      document.body.append(marker);
    });
    for (const row of rows) {
      try { await recordOne(row); }
      catch (e) { report.errors.push('[' + row.slug + '] ' + String(e.message ?? e)); await page.screenshot({ path: join(out, 'failure-' + row.slug + '.png') }).catch(() => {}); await leaveBattle(); }
    }
  } catch (e) {
    report.errors.push(String(e.stack ?? e));
    await page?.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
  } finally {
    await context?.close(); fixture?.cleanup();
  }

  async function leaveBattle() {
    // 결과 창까지 넘긴 뒤 필드로. 적 HP 가 커서 이기지 못하므로 이 사본의 전투는 패배 가능 + 도주 불가 — 실패 때만 새로고침으로 빠진다.
    if (!(await scene()).present) return;
    // 부하가 높으면 새로고침 한 번이 타이틀까지 120초를 넘길 때가 있다(실측) — 한 번 더 시도한다.
    for (let attempt = 0; ; attempt++) {
      await page.goto(server.url + '/player.html', { waitUntil: 'domcontentloaded' });
      try { await page.waitForSelector(selector('title-screen'), { timeout: 120000 }); break; }
      catch (e) { if (attempt >= 1) throw e; console.log('[mskills] title timeout after battle, reloading'); }
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 120000 });
    await page.evaluate(() => {
      if (document.getElementById('monster-video-marker')) return;
      const marker = document.createElement('div'); marker.id = 'monster-video-marker';
      Object.assign(marker.style, { position: 'fixed', right: '0', bottom: '0', width: '16px', height: '16px', zIndex: '2147483647', background: '#000', pointerEvents: 'none' });
      document.body.append(marker);
    });
  }

  async function recordOne(row) {
    const entry = fixture.entry;
    // 트룹 변수는 숫자 = troops 1부터 번호(commandBattle.resolveBattleTroopId). 기존 디버그 훅 setVariable 만 쓴다.
    const troopNumber = fixture.project.database.troops.findIndex((t) => t.id === 'qa_troop_' + row.slug) + 1;
    if (troopNumber <= 0) throw new Error('QA troop missing: ' + row.slug);
    await page.evaluate(({ entry, troopNumber }) => {
      window.__oprnDebug.setSeed(1);
      window.__oprnDebug.setVariable('var_qa_monster_troop', troopNumber);
      window.__oprnDebug.teleport(entry.mapId, entry.x, entry.y);
    }, { entry, troopNumber });
    await page.waitForFunction((e) => { const s = window.__oprnDebug.readState(); return s.currentMapId === e.mapId && s.x === e.x && s.y === e.y; }, entry);
    await page.evaluate(() => window.__oprnInput.face('up'));
    for (let i = 0; i < 40 && !(await scene()).present; i++) { await page.keyboard.press('z'); await sleep(200); }
    await page.waitForSelector(selector('battle-actor-sprites'), { timeout: 30000 });
    crop ??= await page.locator(selector('battle-scene')).boundingBox().then((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v)])));
    const odd = segments.length % 2 === 1;
    const seen = { beats: [], frames: [], reach: null, sheet: null, pixel: null, cell: null, played: false, fx: new Set(), screens: new Set(), sounds: 0, layer: 0 };
    let from = -1, done = false;
    for (let i = 0; i < 600 && !done; i++) {
      const s = await scene();
      if (s.classSkill === row.skill.id) seen.played = true;
      for (const key of s.fx) seen.fx.add(key); for (const key of s.screens) seen.screens.add(key);
      seen.sounds = Math.max(seen.sounds, s.sounds); seen.layer = Math.max(seen.layer, s.layer);
      if (s.sheet) seen.sheet = s.sheet; if (s.pixel) seen.pixel = s.pixel; if (s.cell) seen.cell = s.cell; if (s.reach) seen.reach = s.reach;
      if (s.enemyBeat && from < 0) {
        from = elapsed();
        await page.evaluate((odd) => { document.getElementById('monster-video-marker').style.background = odd ? 'rgb(0, 255, 255)' : 'rgb(255, 0, 255)'; }, odd);
      }
      if (s.enemyBeat && seen.beats.at(-1) !== s.enemyBeat) seen.beats.push(s.enemyBeat);
      if (s.frame && seen.frames.at(-1) !== s.frame) seen.frames.push(s.frame);
      if (from >= 0 && !s.enemyBeat && s.busy === 'false') done = true;
      // 아군 차례가 먼저 오면 방어로 넘긴다(녹화 구간 밖).
      if (from < 0 && s.phase === 'actorCommand' && s.busy === 'false') { await choose('actor-command-defend'); await sleep(200); }
      await sleep(30);
    }
    await sleep(250);
    await page.evaluate(() => { document.getElementById('monster-video-marker').style.background = '#000'; });
    const problems = [];
    if (from < 0) problems.push('enemy never acted');
    if (!done) problems.push('attack did not finish');
    if (seen.sheet !== row.resourceId) problems.push('pixel sheet not applied (' + seen.sheet + ')');
    if (String(seen.cell) !== String(row.cell)) problems.push('cell ' + seen.cell + ' != ' + row.cell);
    if (!seen.played) problems.push('monster skill player never started');
    if (!seen.frames.includes('attack') && row.skill.motion !== 'buff') problems.push('attack cell not shown');
    if (!seen.frames.includes('windup')) problems.push('windup cell not shown');
    const seenKeys = new Set([...seen.fx].map((k) => k.split('@')[0]));
    // 그림이 있는 레이어는 반드시 떠야 한다. 없는 그림은 레이어 노드만 빈 배경으로 뜬다(missingFx 로 따로 적는다).
    for (const layer of row.skill.layers) if (!seenKeys.has(layer.key)) problems.push('layer ' + layer.key + ' not shown');
    if (seen.layer > 0) problems.push('stock animation layer also played (' + seen.layer + ')');
    if (row.skill.motion === 'finisher' && !seen.screens.has('dim')) problems.push('finisher without dim');
    const fx = [...seen.fx];
    report.evidence.push({ slug: row.slug, skill: row.skill.id, name: row.skill.name, monster: row.monster, motion: row.skill.motion, cell: row.cell, enemy: row.enemy.id,
      beats: seen.beats, frames: seen.frames, reach: seen.reach, sheet: seen.sheet, pixel: seen.pixel, fx, screens: [...seen.screens], sounds: seen.sounds, missingFx: row.missingFx, problems });
    if (from >= 0) segments.push({ slug: row.slug, start: from, duration: elapsed() - from });
    console.log('[mskills] ' + row.slug + ' (' + row.monster + ') ' + row.skill.motion + ' frames=' + seen.frames.join('>') + ' fx=' + [...seen.fx].join(',') + ' ' + problems.join('; '));
    await leaveBattle();
  }

  if (!video || !crop || !start || !segments.length) return;
  try {
    const raw = await video.path();
    const { stdout: pixels } = await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '2', '-i', raw, '-vf', 'fps=50,crop=2:2:952:712,scale=1:1,format=rgb24', '-f', 'rawvideo', 'pipe:1'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    const runs = [];
    let open = -1, gap = 0, color = '';
    for (let i = 0; i < pixels.length / 3; i++) {
      const [r, g, b] = pixels.subarray(i * 3, i * 3 + 3);
      const now = r > 200 && b > 200 && g < 120 ? 'm' : r < 120 && g > 200 && b > 200 ? 'c' : '';
      if (now && open >= 0 && now !== color) { runs.push([open, i - 1 - gap, color]); open = -1; gap = 0; }
      if (now) { if (open < 0) { open = i; color = now; } gap = 0; }
      else if (open >= 0 && ++gap > 4) { runs.push([open, i - gap, color]); open = -1; gap = 0; }
    }
    if (open >= 0) runs.push([open, pixels.length / 3 - 1, color]);
    const usable = runs.filter(([a, b]) => b - a >= 10);
    if (usable.length !== segments.length) throw new Error(usable.length + ' marker runs for ' + segments.length + ' monsters');
    for (const [i, segment] of segments.entries()) {
      const [a, b] = usable[i];
      segment.start = Math.max(0, a / 50 - 0.2); segment.duration = (b - a + 1) / 50 + 0.2;
      const file = join(out, 'mskill-' + segment.slug + '.gif');
      const filter = 'crop=' + crop.width + ':' + crop.height + ':' + crop.x + ':' + crop.y + ',fps=' + fps + ',scale=' + width + ':-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none';
      await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-ss', String(segment.start), '-t', String(segment.duration), '-i', raw, '-filter_complex', filter, '-loop', '0', file]);
      report.clips.push({ ...segment, file, bytes: (await stat(file)).size });
    }
  } catch (e) { report.errors.push(String(e.stack ?? e)); }
}

report.passed = report.errors.length === 0 && report.evidence.length > 0 && report.clips.length === report.evidence.length && report.evidence.every((row) => !row.problems.length);
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
const rows = report.evidence.map((row) => '| ' + row.slug + ' | ' + row.name + ' | ' + row.monster + ' | ' + row.motion + ' | ' + (report.clips.some((c) => c.slug === row.slug) ? 'yes' : 'no') + ' | ' + row.frames.join('>') + ' | ' + row.fx.join(' ') + ' | ' + (row.missingFx.join(' ') || '-') + ' | ' + (row.problems.join('; ') || '-') + ' |');
const summary = ['# retro2003 monster skill recording', '', (report.passed ? 'PASS' : 'FAIL') + ' · ' + report.clips.length + '/' + report.evidence.length + ' clips · skipped ' + report.skipped.length, '',
  '| skill | name | monster | motion | gif | cells seen | fx (key@anchor:box) | missing png | problems |', '|---|---|---|---|---|---|---|---|---|', ...rows, '',
  ...(report.skipped.length ? ['## skipped', '', ...report.skipped.map((s) => '- ' + s.slug + ': ' + s.reason), ''] : []),
  ...report.errors.map((e) => '    ' + e.split('\n')[0]), ''].join('\n');
await writeFile(join(out, 'SUMMARY.md'), summary);
console.log(JSON.stringify({ out, passed: report.passed, clips: report.clips.length, skipped: report.skipped.length, errors: report.errors.map((e) => e.split('\n')[0]) }));
process.exitCode = report.passed ? 0 : 1;
