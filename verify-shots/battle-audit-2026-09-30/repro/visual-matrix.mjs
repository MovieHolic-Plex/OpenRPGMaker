import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { startPlayerQaServer, runRuntimeQa } from '../../scripts/lib/runtimeQaRun.mjs';
import retroScenario from '../../scripts/qa/runtime/retro2003.scenario.mjs';

const out = resolve('verify-shots/battle-audit-2026-09-30');
const temp = resolve('.omo/battle-audit-3852');
await mkdir(temp, { recursive: true });
const fixture = JSON.parse(await readFile(retroScenario.projectFixture, 'utf8'));
const results = [];
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });

async function measure(page) {
  return page.evaluate(() => {
    const rect = n => n ? n.getBoundingClientRect().toJSON() : null;
    const scene = document.querySelector('[data-testid="battle-scene"]');
    const msg = scene?.querySelector('[data-testid="battle-message-window"]');
    const summary = scene?.querySelector('[data-testid="battle-result-summary"]');
    const mr = rect(msg), sr = rect(summary);
    const intersects = mr && sr && Math.min(mr.right, sr.right) > Math.max(mr.left, sr.left) && Math.min(mr.bottom, sr.bottom) > Math.max(mr.top, sr.top);
    return {
      viewport: [innerWidth, innerHeight], phase: scene?.dataset.battlePhase, step: scene?.dataset.battleDirectorStep,
      busy: scene?.dataset.battleSequenceBusy, scene: rect(scene),
      message: { text: msg?.innerText, display: msg ? getComputedStyle(msg).display : null, visibility: msg ? getComputedStyle(msg).visibility : null, rect: mr },
      summary: { text: summary?.innerText, rect: sr }, messageOverlapsSummary: Boolean(intersects),
      buttons: [...(scene?.querySelectorAll('button') ?? [])].filter(n => n.getBoundingClientRect().width > 0 && getComputedStyle(n).visibility !== 'hidden').map(n => ({ id: n.dataset.testid, text: n.innerText, disabled: n.disabled, cursor: n.dataset.battleCommandCursor, rect: rect(n) })),
      images: [...(scene?.querySelectorAll('.battle-skin-actor-image,.battle-enemy-image') ?? [])].map(n => ({ rect: rect(n), bg: getComputedStyle(n).backgroundImage, rendering: getComputedStyle(n).imageRendering })),
      scroll: [...(scene?.querySelectorAll('.battle-command-menu,.battle-submenu,.battle-target-list') ?? [])].map(n => ({ cls: n.className, clientHeight: n.clientHeight, scrollHeight: n.scrollHeight, scrollTop: n.scrollTop })),
    };
  });
}
async function capture(page, dir, name, entry) {
  await page.screenshot({ path: join(dir, name + '.png') });
  entry.extra.push({ name, geometry: await measure(page) });
}
async function menu(page, id) {
  const node = page.getByTestId(id);
  if (!await node.count() || await node.isDisabled()) return false;
  await node.focus();
  await page.keyboard.press('z');
  return true;
}

try {
  const cases = [
    { id: 'retro-1024-settled', viewport: { width: 1024, height: 768 }, skin: 'retro2003', result: true },
    { id: 'retro-1280-menus', viewport: { width: 1280, height: 800 }, skin: 'retro2003', menus: true },
    { id: 'retro-1440', viewport: { width: 1440, height: 900 }, skin: 'retro2003' },
    { id: 'retro-active', viewport: { width: 1024, height: 768 }, skin: 'retro2003', atbMode: 'active' },
    { id: 'retro-strict', viewport: { width: 1024, height: 768 }, skin: 'retro2003', flow: 'strict', menus: true },
    { id: 'retro-reduced', viewport: { width: 1024, height: 768 }, skin: 'retro2003', reduced: true, result: true },
    { id: 'rm2000-control', viewport: { width: 1024, height: 768 }, skin: 'rm2000', result: true },
  ];
  const wantedCases = process.env.AUDIT_CASES?.split(',');
  for (const c of cases.filter(c => !wantedCases || wantedCases.includes(c.id))) {
    const project = structuredClone(fixture);
    project.system.battleUiStyle = c.skin;
    project.system.battleFlow = c.flow ?? 'gauge';
    project.system.atbMode = c.atbMode ?? 'wait';
    for (const troop of project.database.troops) troop.battleFlow = c.flow ?? 'gauge';
    const path = join(temp, c.id + '.json');
    await writeFile(path, JSON.stringify(project));
    const beats = structuredClone(retroScenario.beats.slice(0, c.result ? 7 : 5));
    const command = beats.find(b => b.id === 'battle-command');
    command.ops = command.ops.filter(o => !(o.kind === 'waitForAttr' && ['data-battle-skin', 'data-battle-flow'].includes(o.attr)));
    command.ops.push({ kind: 'waitForAttr', testid: 'battle-scene', attr: 'data-battle-skin', value: c.skin });
    command.ops.push({ kind: 'waitForAttr', testid: 'battle-scene', attr: 'data-battle-flow', value: c.flow ?? 'gauge' });
    if (c.skin === 'rm2000') delete command.expect.battlerGeometry;
    if (c.result && c.skin === 'rm2000') beats.at(-1).expect = { testidPresent: ['battle-result-panel'] };
    const context = await browser.newContext({ reducedMotion: c.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const dir = join(out, c.id);
    const entry = { id: c.id, settings: c, extra: [], errors: [] };
    results.push(entry);
    try {
      const report = await runRuntimeQa(page, { ...retroScenario, id: c.id, projectFixture: path, viewport: c.viewport, beats }, { serverUrl: server.url, outDir: dir });
      entry.beats = report.beats.map(b => ({ id: b.id, failures: b.failures }));
      entry.errors = report.errors;
      if (c.result) {
        await page.waitForTimeout(1800);
        await capture(page, dir, 'result-settled', entry);
        await page.keyboard.press('z');
        await page.waitForTimeout(700);
        await capture(page, dir, 'result-revealed', entry);
      } else {
        if (c.skin === 'retro2003') await page.waitForSelector('[data-testid="battle-scenery"][data-layers="ready"]', { state: 'attached', timeout: 20000 });
        await capture(page, dir, 'command-settled', entry);
        if (c.menus && await menu(page, 'actor-command-skill')) {
          await page.waitForTimeout(180);
          await capture(page, dir, 'skills', entry);
          await page.keyboard.press('x');
          entry.skillCancel = await measure(page);
        }
        if (c.menus && await menu(page, 'actor-command-attack')) {
          await page.waitForSelector('[data-testid="battle-target-prompt"]', { state: 'attached', timeout: 10000 });
          await capture(page, dir, 'target', entry);
          await page.keyboard.press('ArrowRight');
          await capture(page, dir, 'target-next', entry);
          await page.keyboard.press('x');
          await capture(page, dir, 'target-cancel', entry);
        }
      }
    } catch (error) {
      entry.errors.push(String(error.stack ?? error));
      await mkdir(dir, { recursive: true });
      await page.screenshot({ path: join(dir, 'failure.png') }).catch(() => {});
    } finally {
      await writeFile(join(dir, 'extra.json'), JSON.stringify(entry, null, 2));
      await context.close();
    }
    console.log(JSON.stringify({ matrix: c.id, failedBeats: entry.beats?.filter(b => b.failures.length), errors: entry.errors, overlap: entry.extra.filter(e => e.geometry.messageOverlapsSummary).map(e => e.name) }));
  }
} finally {
  await browser.close(); await server.close();
  let previous = [];
  try { previous = JSON.parse(await readFile(join(out, 'matrix.json'), 'utf8')); } catch {}
  const merged = [...previous.filter(r => !results.some(n => n.id === r.id)), ...results];
  await writeFile(join(out, 'matrix.json'), JSON.stringify(merged, null, 2));
  await writeFile(join(out, 'MATRIX.md'), ['# 전투 Visual QA Matrix', '', 'Shipping player.html / transient fixtures / canonical store untouched.', '', ...merged.map(r => `- ${r.id}: failed beats ${r.beats?.filter(b => b.failures.length).length ?? 'boot failure'}, runtime errors ${r.errors.length}; 즉시 확인: ${r.extra.map(e => r.id + '/' + e.name + '.png').join(', ')}`)].join('\n'));
}
