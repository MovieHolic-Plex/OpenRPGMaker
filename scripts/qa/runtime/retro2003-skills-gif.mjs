// node scripts/qa/runtime/retro2003-skills-gif.mjs [--set class|legacy] [--skills a,b] [--out DIR] [--reduced]
// class(기본): 계약 src/assets/retroClassSkills.ts 의 직업 스킬 96개(기존 6직업 48 + 2026-09-28 확장 6직업 48)를
// 그 직업의 배우가 차례로 쓰고 skill-<id>.gif 로 자른다. --set new 는 확장 48개만, --set old 는 기존 48개만.
// legacy: 예전 17종(모든 배우가 배운다). 녹화 사본만 고친다 — 실제 player.html, 키보드 입력, 정본 쓰기 없음.
// 조 네 개: (주인공·수호자·마도사·정찰병), (성직자·궁수·쓰러진 주인공 — 부활 대상), (사무라이·닌자·무도가), (음유시인·드루이드·마녀).
// 확장 배우는 데모 픽스처에 없으므로 현재 기본 DB 의 배우·직업·장비를 녹화 사본에 합친다. 사본에서 레벨 22·MP 999·적 HP 99999.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
import { recordingFixture } from './retro2003-gif-fixture.mjs';

const { values } = parseArgs({ options: {
  out: { type: 'string', default: '.omo/retro-skills/recording' },
  set: { type: 'string', default: 'class' },
  fps: { type: 'string', default: '15' }, width: { type: 'string', default: '640' },
  skills: { type: 'string' }, reduced: { type: 'boolean', default: false },
} });
const fps = Number(values.fps), width = Number(values.width);
if (!Number.isInteger(fps) || fps < 1 || fps > 30 || !Number.isInteger(width) || width < 320 || width > 1280) throw new Error('fps 1..30, width 320..1280');
if (!['class', 'new', 'old', 'legacy'].includes(values.set)) throw new Error('--set class|new|old|legacy');
const out = resolve(values.out);
await mkdir(join(out, 'video'), { recursive: true });
await mkdir(join(out, 'browser-tmp'), { recursive: true });
process.env.TMPDIR = join(out, 'browser-tmp');
process.env.VITE_CACHE_DIR ??= resolve('.omo/retro-skills/vite-cache');
const run = promisify(execFile);
const LEGACY = ['sword_slash','focus','arcane_bolt','heal','sleep_mist','weaken','poison_sting','fire','ice','thunder','earth','wind','dark','holy','water','leaf','throwing_knife'].map((name) => 'skill_' + name);
const report = { set: values.set, reduced: values.reduced, clips: [], errors: [], evidence: [] };
let server, browser;
const selector = (id) => '[data-testid="' + id + '"]';

try {
  server = await startPlayerQaServer();
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  // 현재 기본 DB(스킬·상태·직업·애니메이션)를 Vite 로 읽는다. 옛 데모 픽스처에는 새 스킬이 없다.
  const setup = await browser.newPage();
  await setup.route('**/__skill-setup', (route) => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await setup.goto(server.url + '/__skill-setup');
  const defaults = await setup.evaluate(async () => {
    const m = await import('/src/project/defaults/defaultDatabaseStarterRecords.ts');
    const c = await import('/src/project/defaults/defaultDatabaseClassRecords.ts');
    const p = await import('/src/project/defaults/defaultDatabasePartyRecords.ts');
    const k = await import('/src/assets/retroClassSkills.ts');
    const party = p.defaultPartyRecords();
    return { skills: m.defaultSkillRecords(), battleAnimations: m.defaultBattleAnimationRecords(), states: m.defaultStateRecords(), classes: c.defaultClassRecords(),
      actors: party.actors, equipment: party.equipment,
      contract: k.RETRO_CLASS_SKILLS.map((s, index) => ({ id: s.id, actorId: s.actorId, motion: s.motion, layers: s.layers.map((l) => l.key), extension: index >= 48 })) };
  });
  await setup.close();
  const contract = new Map(defaults.contract.map((row) => [row.id, row]));
  const all = values.set === 'legacy' ? LEGACY
    : defaults.contract.filter((row) => values.set === 'class' || (values.set === 'new') === row.extension).map((row) => row.id);
  const wanted = values.skills ? values.skills.split(',').map((id) => id.startsWith('skill_') ? id : 'skill_' + id) : all;
  if (wanted.some((id) => !all.includes(id))) throw new Error('Unknown --skills id');
  const groups = values.set === 'legacy'
    ? [{ party: ['actor_hero', 'actor_guardian', 'actor_mage', 'actor_scout'], dead: [], skills: wanted }]
    : [
      { party: ['actor_hero', 'actor_guardian', 'actor_mage', 'actor_scout'], dead: [] },
      { party: ['actor_cleric', 'actor_ranger', 'actor_hero'], dead: ['actor_hero'] },
      { party: ['actor_samurai', 'actor_ninja', 'actor_monk'], dead: [] },
      { party: ['actor_bard', 'actor_druid', 'actor_witch'], dead: [] },
    ].map((group) => ({ ...group, skills: wanted.filter((id) => group.party.includes(contract.get(id)?.actorId) && !group.dead.includes(contract.get(id)?.actorId)) }))
      .filter((group) => group.skills.length > 0);
  if (groups.reduce((n, g) => n + g.skills.length, 0) !== wanted.length) throw new Error('Some skills have no recording group');
  for (const [groupIndex, group] of groups.entries()) await recordGroup(groupIndex, group, defaults, contract);
} catch (e) {
  report.errors.push(String(e.stack ?? e));
} finally {
  await browser?.close(); await server?.close();
}

async function recordGroup(groupIndex, group, defaults, contract) {
  const fixture = await recordingFixture();
  let context, page, video, crop, start;
  const segments = [];
  const elapsed = () => (performance.now() - start) / 1000;
  const sleep = (ms) => page.waitForTimeout(ms);
  const state = () => page.evaluate(() => {
    const r = document.querySelector('[data-testid="battle-scene"]');
    const active = r?.querySelector('.battle-actor.is-active-actor[data-record-id]')?.dataset.recordId ?? r?.querySelector('.is-active-actor[data-record-id]')?.dataset.recordId;
    return { phase: r?.dataset.battlePhase, busy: r?.dataset.battleSequenceBusy, result: !!r?.querySelector('[data-testid="battle-result-panel"]'), active,
      playing: !!document.querySelector('.battle-field[data-retro-class-skill]') };
  });
  async function choose(id) {
    for (let i = 0; i < 160; i++) {
      const next = await page.evaluate((id) => {
        const menu = document.querySelector('.battle-command-host');
        const buttons = [...menu.querySelectorAll('button.battle-command')];
        const target = buttons.find((n) => n.dataset.testid === id);
        const current = menu.querySelector('[data-battle-command-cursor="true"]');
        if (!target || !current || target.getAttribute('aria-disabled') === 'true') return { error: id, have: buttons.map((n) => n.dataset.testid).join(' ') };
        if (target === current) return { done: true };
        // 목록 순서로 위/아래를 고른다(스크롤로 가려진 항목도 도달한다). 같은 줄이면 좌우.
        const a = current.getBoundingClientRect(), b = target.getBoundingClientRect();
        const dy = b.y + b.height / 2 - a.y - a.height / 2, dx = b.x + b.width / 2 - a.x - a.width / 2;
        if (Math.abs(dy) <= 10 && Math.abs(dx) > 10) return { key: dx > 0 ? 'ArrowRight' : 'ArrowLeft' };
        return { key: buttons.indexOf(target) > buttons.indexOf(current) ? 'ArrowDown' : 'ArrowUp' };
      }, id);
      if (next.error) throw new Error('Missing/disabled command: ' + id + ' [' + next.have + ']');
      if (next.done) { await page.keyboard.press('z'); return; }
      await page.keyboard.press(next.key); await sleep(45);
    }
    throw new Error('Cursor never reached ' + id);
  }
  try {
    const project = fixture.project;
    // 확장 배우·직업은 데모에 없다 — 기본 DB 의 행을 덧붙인다(같은 id 는 데모 행을 둔다: 기존 배우의 저작 값 보존).
    for (const key of ['actors', 'equipment']) {
      const have = new Set(project.database[key].map((row) => row.id));
      project.database[key] = [...project.database[key], ...defaults[key].filter((row) => !have.has(row.id))];
    }
    {
      const have = new Set(project.database.classes.map((row) => row.id));
      project.database.classes = [...project.database.classes, ...defaults.classes.filter((row) => !have.has(row.id)).map((row) => structuredClone(row))];
    }
    for (const key of ['skills', 'battleAnimations', 'states']) {
      const rows = defaults[key];
      project.database[key] = [...project.database[key].filter((row) => !rows.some((r) => r.id === row.id)), ...rows];
    }
    // 직업은 기본 DB 의 습득표(계약 레벨)를 쓴다.
    for (const job of project.database.classes) {
      const fresh = defaults.classes.find((row) => row.id === job.id);
      if (fresh) { job.learnedSkills = fresh.learnedSkills; job.skillIds = fresh.skillIds; }
      if (job.parameterCurves?.maxMp) job.parameterCurves.maxMp = job.parameterCurves.maxMp.map(() => 999);
      if (job.parameterCurves?.maxHp) job.parameterCurves.maxHp = job.parameterCurves.maxHp.map(() => 999);
    }
    for (const actor of project.database.actors) {
      actor.initialLevel = 22; // 계약 최고 습득 레벨
      if (values.set === 'legacy') actor.learnedSkills = LEGACY.map((skillId) => ({ level: 1, skillId }));
      if (actor.parameterCurves) {
        actor.parameterCurves.maxMp = actor.parameterCurves.maxMp.map(() => 999);
        actor.parameterCurves.maxHp = actor.parameterCurves.maxHp.map(() => 999);
      }
    }
    for (const enemy of project.database.enemies) {
      enemy.stats.maxHp = 99999; enemy.stats.attack = 1; enemy.stats.agility = 1;
      enemy.actions = [{ skillId: 'skill_attack', priority: 5, condition: { kind: 'always' } }];
      enemy.stealItems = [{ itemId: 'item_potion', rate: 100 }];
    }
    for (const skill of project.database.skills.filter((s) => group.skills.includes(s.id))) { skill.hitRate = 100; skill.successRate = 100; }
    project.system.startActorIds = [...group.party];
    if (project.session) project.session.partyActorIds = [...group.party];
    await writeFile(join(out, 'recording-project-' + groupIndex + '.json'), JSON.stringify(project));
    context = await browser.newContext({ viewport: { width: 960, height: 720 }, reducedMotion: values.reduced ? 'reduce' : 'no-preference', recordVideo: { dir: join(out, 'video'), size: { width: 960, height: 720 } } });
    page = await context.newPage(); video = page.video();
    page.on('pageerror', (e) => report.errors.push('[group ' + groupIndex + '] ' + e));
    page.on('response', (r) => { if (r.status() >= 400 && /pixel-fx|easyrpg\/sound/.test(r.url())) report.errors.push('Asset ' + r.status() + ': ' + r.url()); });
    await page.addInitScript(() => {
      window.__OPENRPG_BOOT__ = { projectUrl: '/__skills-qa/project.json', saveNamespace: 'retro-skills-qa', qaInstrumentation: true };
      window.__skillEvidence = []; window.__skillPoses = []; window.__legacySkillLayers = 0;
      const seen = new WeakSet();
      const observe = () => {
        const users = document.querySelectorAll('.battle-actor[data-retro-class-skill], .battle-actor[data-retro-skill]');
        for (const user of users) {
          const pose = user.dataset.retroFrame;
          if (pose && window.__skillPoses.at(-1)?.pose !== pose) window.__skillPoses.push({ actor: user.dataset.recordId, pose, flip: user.classList.contains('retro-skill-flip') });
        }
        if (users.length && document.querySelector('.battle-animation-layer')?.childElementCount) window.__legacySkillLayers++;
        for (const node of document.querySelectorAll('.retro-skill-fx')) {
          if (seen.has(node)) continue; seen.add(node);
          const frames = [], positions = [];
          const row = { fx: node.dataset.retroSkillFx, anchor: node.dataset.retroFxAnchor, size: node.dataset.fxSize, box: node.dataset.fxBox, frames, positions,
            width: getComputedStyle(node).width, rendering: getComputedStyle(node).imageRendering };
          window.__skillEvidence.push(row);
          const capture = () => { const n = Number(node.dataset.fxFrame); if (frames.at(-1) !== n) { frames.push(n); positions.push(node.style.backgroundPosition); } };
          capture(); new MutationObserver(capture).observe(node, { attributes: true, attributeFilter: ['data-fx-frame'] });
        }
      };
      document.addEventListener('DOMContentLoaded', () => new MutationObserver(observe).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-retro-frame', 'class'] }));
    });
    await page.route('**/__skills-qa/project.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
    console.log('[skills] group ' + groupIndex + ': ' + group.party.join(',') + ' -> ' + group.skills.length + ' skills');
    // 소스를 고친 직후 첫 부팅은 Vite 재최적화로 흰 화면에서 멈출 수 있다(실측) — 한 번 다시 연다.
    for (let attempt = 0; ; attempt++) {
      await page.goto(server.url + '/player.html?e2eVitals=1', { waitUntil: 'domcontentloaded' });
      try { await page.waitForSelector(selector('title-screen'), { timeout: 120000 }); break; }
      catch (e) { if (attempt >= 1) throw e; console.log('[skills] title timeout, reloading'); }
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 120000 });
    const vitals = await page.evaluate(({ entry, dead, party }) => {
      window.__oprnDebug.setSeed(1); window.__oprnDebug.teleport(entry.mapId, entry.x, entry.y);
      // 회복기가 숫자를 보이도록 산 배우는 HP 절반, 부활 대상은 쓰러진 채로.
      for (const id of party) window.__oprnSetActorVitals?.(id, dead.includes(id) ? 0 : 500, 999);
      return typeof window.__oprnSetActorVitals;
    }, { entry: fixture.entry, dead: group.dead, party: group.party });
    if (vitals !== 'function') throw new Error('e2eVitals hook missing');
    await page.waitForFunction((e) => { const s = window.__oprnDebug.readState(); return s.currentMapId === e.mapId && s.x === e.x && s.y === e.y; }, fixture.entry);
    start = performance.now();
    await page.evaluate(() => window.__oprnInput.face('up'));
    for (let i = 0; i < 40 && !await page.locator(selector('battle-scene')).count(); i++) { await page.keyboard.press('z'); await sleep(200); }
    await page.waitForSelector(selector('battle-actor-sprites'), { timeout: 30000 });
    crop = await page.locator(selector('battle-scene')).boundingBox();
    crop = Object.fromEntries(Object.entries(crop).map(([k, v]) => [k, Math.round(v)]));
    await page.evaluate(() => {
      const marker = document.createElement('div'); marker.id = 'skill-video-marker';
      Object.assign(marker.style, { position: 'fixed', right: '0', bottom: '0', width: '16px', height: '16px', zIndex: '2147483647', background: '#000', pointerEvents: 'none' });
      document.body.append(marker);
    });
    const queue = [...group.skills];
    const ownerOf = (id) => values.set === 'legacy' ? undefined : contract.get(id)?.actorId;
    let idle = 0;
    while (queue.length) {
      await page.waitForFunction(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battlePhase === 'actorCommand' && r.dataset.battleSequenceBusy === 'false' && !document.querySelector('.battle-field[data-retro-class-skill]'); }, null, { timeout: 60000 });
      const s = await state();
      if (s.result) throw new Error('Battle ended before all skills');
      const index = queue.findIndex((id) => !ownerOf(id) || ownerOf(id) === s.active);
      if (index < 0) {
        // 이 배우가 쓸 스킬이 없으면 방어로 차례를 넘긴다(녹화 구간 밖).
        if (++idle > 120) throw new Error('No skill for active actor ' + s.active);
        await choose('actor-command-defend');
        await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleSequenceBusy === 'true', null, { timeout: 4000 }).catch(() => {});
        continue;
      }
      const skill = queue.splice(index, 1)[0];
      await choose('actor-command-skill');
      await page.waitForSelector(selector('actor-skill-' + skill));
      await page.evaluate(() => { window.__skillEvidence = []; window.__skillPoses = []; window.__legacySkillLayers = 0; const f = document.querySelector('.battle-field'); if (f) delete f.dataset.retroClassSkillSounds; });
      const from = elapsed();
      // 표식 색을 스킬마다 마젠타·청록으로 번갈아 켠다 — 이어지는 두 스킬 사이의 꺼짐이 짧아도 경계가 남는다.
      await page.evaluate((odd) => { document.getElementById('skill-video-marker').style.background = odd ? 'rgb(0, 255, 255)' : 'rgb(255, 0, 255)'; }, segments.length % 2 === 1);
      await choose('actor-skill-' + skill);
      let acted = false, completed = false, targeted = false;
      for (let i = 0; i < 900; i++) {
        const t = await state();
        if (t.result) throw new Error('Battle ended before all skills');
        if (t.phase === 'targetSelect' && t.busy === 'false' && !targeted) {
          targeted = true;
          // 부활은 쓰러진 배우를 고른다. 나머지 단일 대상은 첫 후보.
          if (/revive/.test(skill) && group.dead[0]) await choose('battle-target-' + group.dead[0]);
          else await page.keyboard.press('z');
          await sleep(100);
          continue;
        }
        if (t.busy === 'true' || t.playing) acted = true;
        if (acted && t.busy === 'false' && !t.playing) { completed = true; break; }
        await sleep(40);
      }
      await sleep(120);
      const detail = await page.evaluate(() => {
        document.getElementById('skill-video-marker').style.background = '#000';
        return { effects: window.__skillEvidence, poses: window.__skillPoses, legacyLayers: window.__legacySkillLayers,
          sounds: Number(document.querySelector('.battle-field')?.dataset.retroClassSkillSounds ?? 0),
          remainingFx: document.querySelectorAll('.retro-skill-fx, .retro-class-veil, .retro-class-cutin').length };
      });
      const row = { skill, group: groupIndex, completed, ...detail, layerKeys: [...new Set(detail.effects.map((e) => e.fx))], problems: [] };
      if (!completed) row.problems.push('did not complete');
      if (detail.remainingFx) row.problems.push(detail.remainingFx + ' fx left');
      if (detail.legacyLayers) row.problems.push('legacy animation layer shown');
      if (values.set !== 'legacy') {
        const missing = [...new Set(contract.get(skill).layers)].filter((key) => !row.layerKeys.includes(key));
        if (missing.length && !values.reduced) row.problems.push('missing layers ' + missing.join(','));
        if (!detail.sounds && !values.reduced) row.problems.push('no sound event');
        for (const e of detail.effects) {
          // 화면 상자 = 칸 × 2, 단 128px 대상 층(target·allTargets)은 칸 × 1(retroClassFxBox).
          const size = Number(e.size) >= 128 && (e.anchor === 'target' || e.anchor === 'allTargets') ? Number(e.size) : Number(e.size) * 2;
          if (e.box && Number(e.box) !== size) row.problems.push('box ' + e.fx + ' ' + e.box + ' != ' + size);
          if (e.width !== size + 'px' || e.rendering !== 'pixelated') row.problems.push('scale ' + e.fx + ' ' + e.width);
          e.positions.forEach((p, i) => { const want = e.frames[i] === 0 ? '0px 0px' : '-' + size * e.frames[i] + 'px 0px'; if (p !== want) row.problems.push('frame step ' + e.fx + ' ' + p + ' != ' + want); });
        }
        row.problems = [...new Set(row.problems)];
      }
      report.evidence.push(row);
      segments.push({ skill, start: from, duration: elapsed() - from });
      console.log('[skills] ' + skill + ': layers ' + row.layerKeys.length + ' nodes ' + detail.effects.length + ' sounds ' + detail.sounds + ' ' + row.problems.join('; '));
    }
    await page.screenshot({ path: join(out, 'completed-' + groupIndex + '.png') });
  } catch (e) {
    report.errors.push('[group ' + groupIndex + '] ' + (e.stack ?? e));
    await page?.screenshot({ path: join(out, 'failure-' + groupIndex + '.png') }).catch(() => {});
  } finally {
    await context?.close(); fixture?.cleanup();
  }
  if (!video || !crop || !start || !segments.length) return;
  try {
    const raw = await video.path();
    // 표식은 스킬마다 마젠타(짝수 번째)·청록(홀수 번째)으로 켜진다 — 같은 색 연속 구간을 순서대로 스킬에 대응시킨다.
    const { stdout: pixels } = await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '2', '-filter_threads', '1', '-i', raw, '-vf', 'fps=50,crop=2:2:952:712,scale=1:1,format=rgb24', '-f', 'rawvideo', 'pipe:1'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
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
    // 꺼짐이 아주 짧아 같은 색 구간이 끊기면 다시 잇는다(코덱 오차 한두 칸).
    const merged = [];
    for (const item of runs) {
      const last = merged.at(-1);
      if (last && last[2] === item[2] && item[0] - last[1] <= 8) last[1] = item[1];
      else merged.push([...item]);
    }
    const usable = merged.filter(([a, b]) => b - a >= 10);
    if (usable.length !== segments.length) throw new Error('group ' + groupIndex + ': ' + usable.length + ' marker runs for ' + segments.length + ' skills');
    for (const [i, segment] of segments.entries()) {
      const [a, b] = usable[i];
      segment.start = a / 50; segment.duration = (b - a + 1) / 50;
      const file = join(out, 'skill-' + segment.skill + '.gif');
      const filter = 'crop=' + crop.width + ':' + crop.height + ':' + crop.x + ':' + crop.y + ',fps=' + fps + ',scale=' + width + ':-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none';
      await run('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-filter_complex_threads', '1', '-ss', String(segment.start), '-t', String(segment.duration), '-i', raw, '-filter_complex', filter, '-loop', '0', file]);
      report.clips.push({ ...segment, group: groupIndex, file, bytes: (await stat(file)).size });
    }
  } catch (e) { report.errors.push(String(e.stack ?? e)); }
}

const expected = report.evidence.length;
report.passed = report.errors.length === 0 && expected > 0 && report.clips.length === expected && report.evidence.every((row) => !row.problems.length);
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
const rows = report.evidence.map((row) => {
  const clip = report.clips.find((c) => c.skill === row.skill);
  return '| ' + row.skill + ' | ' + (clip ? 'yes' : 'no') + ' | ' + row.layerKeys.length + ' (' + row.effects.length + ' nodes) | ' + row.sounds + ' | ' + (row.problems.join('; ') || '-') + ' |';
});
const summary = ['# retro2003 skill recording (' + values.set + ')', '', (report.passed ? 'PASS' : 'FAIL') + ' · ' + report.clips.length + '/' + expected + ' clips · reduced=' + values.reduced, '',
  '| skill | recorded | layers shown | sound events | errors |', '|---|---|---|---|---|', ...rows, '', ...report.errors.map((e) => '    ' + e.split('\n')[0]), ''].join('\n');
await writeFile(join(out, 'SUMMARY.md'), summary);
console.log(JSON.stringify({ out, passed: report.passed, clips: report.clips.length, errors: report.errors.map((e) => e.split('\n')[0]) }));
process.exitCode = report.passed ? 0 : 1;

