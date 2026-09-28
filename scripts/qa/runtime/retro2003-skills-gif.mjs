// node scripts/qa/runtime/retro2003-skills-gif.mjs --out .omo/retro-skills/pass-1
// Only the recording copy learns every skill. Real player.html, keyboard input, no canonical writes.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
import { recordingFixture } from './retro2003-gif-fixture.mjs';

const { values } = parseArgs({ options: {
  out: { type: 'string', default: '.omo/retro-skills/recording' },
  fps: { type: 'string', default: '15' }, width: { type: 'string', default: '640' },
  skills: { type: 'string' }, reduced: { type: 'boolean', default: false },
} });
const fps = Number(values.fps), width = Number(values.width);
if (!Number.isInteger(fps) || fps < 1 || fps > 30 || !Number.isInteger(width) || width < 320 || width > 1280) throw new Error('fps 1..30, width 320..1280');
const out = resolve(values.out);
await mkdir(join(out, 'video'), { recursive: true });
await mkdir(join(out, 'browser-tmp'), { recursive: true });
process.env.TMPDIR = join(out, 'browser-tmp');
process.env.VITE_CACHE_DIR ??= resolve('.omo/retro-skills/vite-cache');
const run = promisify(execFile);
const ALL = ['sword_slash','focus','arcane_bolt','heal','sleep_mist','weaken','poison_sting','fire','ice','thunder','earth','wind','dark','holy','water','leaf','throwing_knife'].map((name) => `skill_${name}`);
const skills = values.skills ? values.skills.split(',').map((id) => id.startsWith('skill_') ? id : `skill_${id}`) : ALL;
if (skills.some((id) => !ALL.includes(id))) throw new Error('Unknown --skills id');
const report = { skills, reduced: values.reduced, clips: [], errors: [], evidence: [] };
let fixture, server, browser, context, page, video, crop, start;
const segments = [];
const elapsed = () => (performance.now() - start) / 1000;
const selector = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => page.waitForTimeout(ms);
async function state() {
  return page.evaluate(() => {
    const r = document.querySelector('[data-testid="battle-scene"]');
    return { phase: r?.dataset.battlePhase, busy: r?.dataset.battleSequenceBusy, result: !!r?.querySelector('[data-testid="battle-result-panel"]') };
  });
}
async function choose(id) {
  for (let i=0; i<80; i++) {
    const next = await page.evaluate((id) => {
      const menu = document.querySelector('.battle-command-host');
      const target = [...menu.querySelectorAll('button.battle-command')].find((n) => n.dataset.testid === id);
      const current = menu.querySelector('[data-battle-command-cursor="true"]');
      if (!target || !current || target.getAttribute('aria-disabled') === 'true') return { error: id };
      if (target === current) return { done: true };
      const a=current.getBoundingClientRect(), b=target.getBoundingClientRect();
      const dx=b.x+b.width/2-a.x-a.width/2, dy=b.y+b.height/2-a.y-a.height/2;
      return { key: Math.abs(dx)>10 ? (dx>0?'ArrowRight':'ArrowLeft') : (dy>0?'ArrowDown':'ArrowUp') };
    }, id);
    if (next.error) throw new Error(`Missing/disabled command: ${id}`);
    if (next.done) { await page.keyboard.press('z'); return; }
    await page.keyboard.press(next.key); await sleep(65);
  }
  throw new Error(`Cursor never reached ${id}`);
}
try {
  fixture = await recordingFixture();
  server = await startPlayerQaServer();
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  // Import the current defaults through Vite before player boot: the old demo lacks nine target skills.
  const setup = await browser.newPage();
  await setup.route('**/__skill-setup', (route) => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await setup.goto(`${server.url}/__skill-setup`);
  const defaults = await setup.evaluate(async () => {
    const m = await import('/src/project/defaults/defaultDatabaseStarterRecords.ts');
    return { skills: m.defaultSkillRecords(), battleAnimations: m.defaultBattleAnimationRecords(), states: m.defaultStateRecords() };
  });
  await setup.close();
  const project = fixture.project;
  for (const [key, rows] of Object.entries(defaults)) {
    project.database[key] = [...project.database[key].filter((row) => !rows.some((r) => r.id === row.id)), ...rows];
  }
  for (const actor of project.database.actors) {
    actor.learnedSkills = ALL.map((skillId) => ({ level: 1, skillId }));
    actor.parameterCurves.maxMp = actor.parameterCurves.maxMp.map(() => 999);
    actor.parameterCurves.maxHp = actor.parameterCurves.maxHp.map(() => 9999);
  }
  for (const job of project.database.classes) {
    if (job.parameterCurves?.maxMp) job.parameterCurves.maxMp = job.parameterCurves.maxMp.map(() => 999);
  }
  for (const enemy of project.database.enemies) {
    enemy.stats.maxHp = 99999; enemy.stats.attack = 1; enemy.stats.agility = 1;
    enemy.actions = [{ skillId: 'skill_attack', priority: 5, condition: { kind: 'always' } }];
  }
  // Make visual sampling deterministic without changing the authored skill scopes/effects.
  for (const skill of project.database.skills.filter((s) => ALL.includes(s.id))) { skill.hitRate = 100; skill.successRate = 100; }
  await writeFile(join(out, 'recording-project.json'), JSON.stringify(project));
  context = await browser.newContext({ viewport: { width: 960, height: 720 }, reducedMotion: values.reduced ? 'reduce' : 'no-preference', recordVideo: { dir: join(out, 'video'), size: { width: 960, height: 720 } } });
  page = await context.newPage(); video = page.video();
  page.on('pageerror', (e) => report.errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400 && /pixel-fx|easyrpg\/sound/.test(r.url())) report.errors.push(`Asset ${r.status()}: ${r.url()}`); });
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: '/__skills-qa/project.json', saveNamespace: 'retro-skills-qa', qaInstrumentation: true };
    window.__skillEvidence = [];
    window.__skillPoses = [];
    window.__legacySkillLayers = 0;
    const poses = new WeakMap();
    const seen = new WeakSet();
    const observe = () => {
      const users = document.querySelectorAll('.battle-actor[data-retro-skill][data-retro-beat]');
      for (const user of users) {
        const pose=user.dataset.retroFrame;
        if (pose && poses.get(user)!==pose) { poses.set(user,pose); window.__skillPoses.push({ actor:user.dataset.recordId, pose }); }
      }
      if (users.length && document.querySelector('.battle-animation-layer')?.childElementCount) window.__legacySkillLayers++;
      for (const node of document.querySelectorAll('.retro-skill-fx')) {
        if (seen.has(node)) continue; seen.add(node);
        const frames = [];
        const row = { fx: node.dataset.retroSkillFx, sound: node.dataset.fxSound, played: node.dataset.fxSoundPlayed, charge: node.classList.contains('retro-skill-charge'), frames, at: performance.now(), width: getComputedStyle(node).width, rendering: getComputedStyle(node).imageRendering };
        window.__skillEvidence.push(row);
        const capture = () => { const n=Number(node.dataset.fxFrame); if (frames.at(-1)!==n) frames.push(n); };
        capture(); new MutationObserver(capture).observe(node, { attributes: true, attributeFilter: ['data-fx-frame'] });
      }
    };
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(observe).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-retro-frame'] }));
  });
  await page.route('**/__skills-qa/project.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
  console.log('[skills] Boot player');
  await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(selector('title-screen'), { timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !!window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 120000 });
  await page.evaluate((entry) => { window.__oprnDebug.setSeed(1); window.__oprnDebug.teleport(entry.mapId, entry.x, entry.y); }, fixture.entry);
  await page.waitForFunction((e) => { const s=window.__oprnDebug.readState(); return s.currentMapId===e.mapId && s.x===e.x && s.y===e.y; }, fixture.entry);
  start = performance.now();
  await page.evaluate(() => window.__oprnInput.face('up'));
  for (let i=0;i<40 && !await page.locator(selector('battle-scene')).count();i++) { await page.keyboard.press('z'); await sleep(200); }
  await page.waitForSelector(selector('battle-actor-sprites'), { timeout: 30000 });
  crop = await page.locator(selector('battle-scene')).boundingBox();
  crop = Object.fromEntries(Object.entries(crop).map(([k,v]) => [k,Math.round(v)]));
  // Video frames have their own clock. A tiny QA-only colour marker provides exact cut boundaries.
  await page.evaluate(() => {
    const marker=document.createElement('div'); marker.id='skill-video-marker';
    Object.assign(marker.style,{position:'fixed',right:'0',bottom:'0',width:'16px',height:'16px',zIndex:'2147483647',background:'#000',pointerEvents:'none'});
    document.body.append(marker);
  });
  for (const [skillIndex, skill] of skills.entries()) {
    await page.waitForFunction(() => { const r=document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battlePhase==='actorCommand' && r.dataset.battleSequenceBusy==='false'; }, null, { timeout: 40000 });
    await choose('actor-command-skill');
    await page.waitForSelector(selector(`actor-skill-${skill}`));
    await page.evaluate(() => { window.__skillEvidence = []; window.__skillPoses = []; window.__legacySkillLayers = 0; });
    const from = elapsed();
    const browserStart = await page.evaluate((index) => {
      document.getElementById('skill-video-marker').style.background=`rgb(255, ${16+index*12}, 255)`;
      return performance.now();
    }, skillIndex);
    await choose(`actor-skill-${skill}`);
    let acted=false, completed=false;
    for (let i=0;i<700;i++) {
      const s=await state();
      if (s.result) throw new Error('Battle ended before all skills');
      if (s.phase==='targetSelect' && s.busy==='false') { await page.keyboard.press('z'); await sleep(100); }
      if (s.busy==='true') acted=true;
      if (acted && s.busy==='false') { completed=true; break; }
      await sleep(40);
    }
    const evidence = await page.evaluate(() => {
      document.getElementById('skill-video-marker').style.background='#000';
      return window.__skillEvidence;
    });
    const detail = await page.evaluate(() => ({ poses: window.__skillPoses, legacyLayers: window.__legacySkillLayers, remainingFx: document.querySelectorAll('.retro-skill-fx').length }));
    report.evidence.push({ skill, effects: evidence, browserStart, ...detail });
    if (!completed || detail.remainingFx || detail.legacyLayers) throw new Error(`Unfinished/overlapping FX: ${skill} ${JSON.stringify(detail)}`);
    const sounds=evidence.filter((e) => e.sound);
    if (sounds.length!==1 || sounds[0].played!=='true') throw new Error(`Release SE expected once from decoded RTP sample: ${skill}`);
    if (!values.reduced && skill==='skill_sword_slash' && detail.poses.filter((p) => p.pose==='attack_strike').length!==3) throw new Error('Sword combo did not display three strikes');
    if (!values.reduced && skill==='skill_poison_sting' && detail.poses.filter((p) => p.pose==='attack_strike').length!==2) throw new Error('Poison did not display two thrusts');
    if (!acted || !evidence.some((e) => !e.charge)) throw new Error(`No target pixel effect for ${skill}`);
    if (evidence.some((e) => e.width !== '128px' || e.rendering !== 'pixelated')) throw new Error(`Pixel scale: ${skill}`);
    if (values.reduced && evidence.some((e) => e.frames.some((f) => f!==3))) throw new Error(`Reduced motion: ${skill}`);
    segments.push({ skill, index: skillIndex, start: from, duration: elapsed()-from });
    console.log(`[skills] ${skill}: ${evidence.map((e) => `${e.fx}[${e.frames}]`).join(' ')} (${elapsed().toFixed(1)}s)`);
  }
  await page.screenshot({ path: join(out,'completed.png') });
} catch (e) {
  report.errors.push(String(e.stack ?? e));
  await page?.screenshot({ path: join(out,'failure.png') }).catch(() => {});
} finally {
  await context?.close(); await browser?.close(); await server?.close(); fixture?.cleanup();
}
if (video && crop && start) {
  try {
    const raw=await video.path();
    // Decode one point inside the marker at 50 Hz; codec colour error stays below half the 12-level gap.
    const { stdout: pixels } = await run('/usr/bin/ffmpeg', ['-hide_banner','-loglevel','error','-threads','2','-filter_threads','1','-i',raw,'-vf','fps=50,crop=2:2:952:712,scale=1:1,format=rgb24','-f','rawvideo','pipe:1'], { encoding: 'buffer', maxBuffer: 16*1024*1024 });
    for (const segment of segments) {
      const samples=[];
      for (let i=0;i<pixels.length/3;i++) {
        const [r,g,b]=pixels.subarray(i*3,i*3+3);
        if (r>230 && b>230 && Math.abs(g-(16+segment.index*12))<6) samples.push(i);
      }
      if (samples.length<10) throw new Error(`Missing video marker: ${segment.skill}`);
      segment.start=samples[0]/50;
      segment.duration=(samples.at(-1)-samples[0]+1)/50;
      const file=join(out,`skill-${segment.skill}.gif`);
      await run('/usr/bin/ffmpeg',['-hide_banner','-loglevel','error','-y','-threads','2','-filter_complex_threads','1','-ss',String(segment.start),'-t',String(segment.duration),'-i',raw,'-filter_complex',`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},fps=${fps},scale=${width}:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none`,'-loop','0',file]);
      report.clips.push({ ...segment, file, bytes: (await stat(file)).size });
    }
  } catch(e) { report.errors.push(String(e.stack??e)); }
}
report.passed=report.errors.length===0 && report.clips.length===skills.length;
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
await writeFile(join(out,'SUMMARY.md'),`# retro2003 skill recording\n\n${report.passed?'PASS':'FAIL'} · ${report.clips.length}/${skills.length} skills · reduced=${values.reduced}\n\nImmediate review: extract GIF contact sheets with PIL; use report.json for observed strip frames and sound ownership.\n\n${report.errors.join('\n')}\n`);
console.log(JSON.stringify({ out, passed:report.passed, clips:report.clips.length, errors:report.errors }));
process.exitCode=report.passed?0:1;
