// 수집·관리 UI 화면 캡처(파티·도감·박스·스타터·메뉴·저장). player.html shim 경로, 편집기 셸 없음.
// 사용: node scripts/qa/runtime/collect-menu.probe.mjs [--project <json>] [--out <dir>] [--stages a,b,c] [--lab]
//   --stages 기본 = all. 이름: starter(--lab 필요) party summary dex box pc save card options
//   --lab: 연구소에서 실제 스타터 선택 이벤트를 거친다(느림). 없으면 스타터를 코드로 준다.
// 프로젝트가 없으면 monsterExpedition 예제를 /tmp/psc/exp/project.json 으로 먼저 빌드해 둔다:
//   node scripts/content/build-monster-expedition.mjs /tmp/psc/exp /tmp/psc/evidence
// 이 호스트의 크로미움은 가끔 vite 모듈을 놓쳐 백지로 뜬다(ERR_NETWORK_CHANGED 계열) — 백지면 다시 불러온다.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const flag = name => process.argv.includes(`--${name}`);
const projectPath = arg('project', '/tmp/psc/exp/project.json');
const out = resolve(arg('out', 'verify-shots/poke-sys-collect'));
const stages = new Set((arg('stages', 'all')).split(','));
const want = name => stages.has('all') || stages.has(name);
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(projectPath, 'utf8'));
if (process.env.QA_PROJECT_PATCH) await (await import(resolve(process.env.QA_PROJECT_PATCH))).default(project);
const body = JSON.stringify(project);
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu', '--disable-background-networking', '--disable-features=NetworkChangeNotifier'] });
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (process.env.QA_DEBUG && m.type() === 'error') console.log('console.error', m.text().slice(0, 200)); });
await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__collect_project.json', saveNamespace: `collect-${Date.now()}`, qaInstrumentation: true }; });
await page.route('**/__collect_project.json', r => r.fulfill({ contentType: 'application/json', body }));
const key = async (name, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(name); await page.waitForTimeout(140); } };
const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const visible = id => page.getByTestId(id).isVisible().catch(() => false);
async function menuOpen() { if (!await page.getByTestId('main-menu').count()) { await key('Escape'); await page.waitForTimeout(300); } }
async function railOpen() {
  await menuOpen();
  for (let i = 0; i < 5 && !(await visible('status-menu-command-monsters') || await visible('status-menu-command-monster-dex')); i++) await key('Escape');
  await menuOpen();
}
async function choose(id) {
  const row = page.getByTestId(id); await row.waitFor({ timeout: 15000 });
  for (let i = 0; i < 100; i++) { if ((await row.getAttribute('class'))?.includes('selected')) { await key('Enter'); return; } await key('ArrowDown'); }
  throw new Error(`Cursor did not reach ${id}`);
}
async function drain(limit = 120) {
  let idle = 0;
  for (let i = 0; i < limit; i++) {
    if (await page.getByTestId('runtime-choices').count()) return 'choices';
    const busy = await page.getByTestId('dialogue-box').count() || await page.getByTestId('cinematic-sequence').count() || await page.evaluate(() => Boolean(window.__oprnHooksScene?.running));
    if (!busy) { idle++; if (idle >= 6) return 'done'; await page.waitForTimeout(200); continue; }
    idle = 0; await key('Enter');
  }
  throw new Error('drain limit');
}
const log = { stages: [...stages] };
const run = async (name, fn) => { if (want(name)) { try { await fn(); } catch (e) { log[`fail_${name}`] = String(e).slice(0, 300); await shot(`fail-${name}`); } } };
try {
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const ok = await page.getByTestId('title-screen').waitFor({ timeout: attempt < 4 ? 70000 : 240000 }).then(() => true, () => false);
    if (ok) break;
    console.log('blank page, retry', attempt + 1);
  }
  await page.getByTestId('title-screen').waitFor({ timeout: 5000 });
  if (want('title')) await shot('00-title');
  await page.waitForTimeout(1500);
  await key('Enter');
  await page.waitForFunction(() => window.__oprnDebug?.readState().currentMapId, undefined, { timeout: 120000 });
  await page.getByTestId('play-loading-overlay').waitFor({ state: 'detached', timeout: 120000 });
  await page.waitForTimeout(800); await drain();
  if (flag('lab')) {
    await page.evaluate(() => window.__oprnDebug.teleport('mx_map_lab', 7, 6)); await page.waitForTimeout(600);
    await page.evaluate(() => window.__oprnInput.face('up')); await key('z');
    log.starterDrain = await drain(); await shot('02-starter-choices');
    await key('Enter'); await drain(); await shot('03-starter-after');
  }
  await page.evaluate(async () => {
    const { giveMonster } = await import('/src/project/monsterCollection.ts');
    const project = await (await fetch('/__collect_project.json')).json();
    window.__collectProject = project;
    const session = window.__oprnHooksScene.getSession();
    const species = project.database.monsterSpecies;
    if (!session.monsterParty.length) giveMonster(project, session, { speciesId: species[0].id, level: 5 });
    const extra = Number(new URLSearchParams(location.search).get('n') ?? 11);
    for (let i = 1; i <= 11; i++) giveMonster(project, session, { speciesId: species[(i * 3) % species.length].id, level: 6 + i * 3 });
    const hurt = session.monsterInstances[session.monsterParty[1]]; hurt.currentHp = 3;
    session.switches[`mx_seen_${species[20].id}`] = true; session.switches[`mx_seen_${species[21].id}`] = true;
    void extra;
  });
  log.party = await page.evaluate(() => { const s = window.__oprnHooksScene.getSession(); return { party: s.monsterParty.length, box: s.monsterBox.length }; });
  await run('field', async () => { await shot('04-field'); });
  await run('menu', async () => { await menuOpen(); await shot('04-field-menu'); });
  await run('party', async () => { await railOpen(); await choose('status-menu-command-monsters'); await shot('05-party'); });
  await run('summary', async () => {
    await railOpen(); await choose('status-menu-command-monsters'); await key('Enter'); await shot('06-summary');
    await key('ArrowDown', 7); await shot('06b-summary-scrolled');
  });
  await run('box', async () => { await railOpen(); await choose('status-menu-command-monsters'); await choose('status-menu-monster-toggle'); await shot('07-box'); });
  await run('dex', async () => {
    await railOpen(); await choose('status-menu-command-monster-dex'); await shot('08-dex-list');
    await key('Enter'); await shot('09-dex-detail'); await key('Escape');
    await key('ArrowDown', 20); await shot('10-dex-scrolled'); await key('Enter'); await shot('11-dex-detail-seen-only');
  });
  await run('card', async () => { await railOpen(); await choose('status-menu-command-trainer-card'); await shot('12-trainer-card'); });
  await run('save', async () => { await railOpen(); await choose('status-menu-command-save'); await shot('13-save'); });
  await run('options', async () => { await railOpen(); await choose('status-menu-command-options'); await shot('14-options'); });
  if (process.env.QA_AFTER) await (await import(resolve(process.env.QA_AFTER))).default({ page, key, shot, choose, railOpen, menuOpen, drain, log, out, project });
  await writeFile(`${out}/probe-log.json`, JSON.stringify({ ...log, errors }, null, 2));
  console.log(JSON.stringify({ ...log, errors }));
} catch (e) { await shot('failure'); console.error(e); await writeFile(`${out}/failure.json`, JSON.stringify({ error: String(e), errors, text: await page.locator('body').innerText().catch(() => '') }, null, 2)); process.exitCode = 1; }
finally { await browser.close(); await server.close(); }
