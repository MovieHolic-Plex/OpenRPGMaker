// Focused exported-player browser evidence. No suites, canonical writes or editor shell.
// Start npm run dev:worktree; set OPRN_QA_URL and OPRN_QA_PROJECT to a portable authored campaign.
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const url = process.env.OPRN_QA_URL;
const projectPath = process.env.OPRN_QA_PROJECT;
if (!url || !projectPath) throw new Error('Set OPRN_QA_URL and OPRN_QA_PROJECT');
const out = resolve(process.env.OPRN_QA_OUT ?? 'verify-shots/emerald-surfaces');
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(projectPath, 'utf8'));
// Profile-only copy; original maps/species/stock/events/art remain unchanged.
project.meta.oprnMonsterStyle = { version: 1, reference: 'emerald' };
Object.assign(project.system, { menuUiStyle: 'field-list', battleUiStyle: 'pokemon', dialogueStyle: 'handheld', playResolution: { width: 480, height: 320 }, cameraZoom: 2 });
delete project.system.opening;
const body = JSON.stringify(project);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, reducedMotion: 'reduce' });
const errors = [], httpErrors = [];
const report = { projectPath, maps: Object.keys(project.maps).length, species: project.database.monsterSpecies.length, scope: 'ExportEntry/player.html with store shim; original campaign copy; QA teleports and party preparation; no canonical store writes. Not a built export or full playthrough.' };
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__emerald_surface_project.json', saveNamespace: `emerald-surfaces-${Date.now()}`, qaInstrumentation: true }; });
await page.route('**/__emerald_surface_project.json', r => r.fulfill({ contentType: 'application/json', body }));
const key = async name => { await page.keyboard.press(name); await page.waitForTimeout(150); };
const shot = async name => { await page.screenshot({ path: `${out}/${name}.png` }); if (name === '08-item-context' || name === '09-battle-command') await writeFile(`${out}/${name}-dom.json`, JSON.stringify(await page.locator('.status-menu-detail-list, .status-menu-detail-showcase, .battle-actor-hp, .battle-stat-bar-hp').evaluateAll(nodes => nodes.map(n => ({ html: n.outerHTML, rect: n.getBoundingClientRect().toJSON(), css: { top: getComputedStyle(n).top, height: getComputedStyle(n).height, display: getComputedStyle(n).display, gridArea: getComputedStyle(n).gridArea }, after: { content: getComputedStyle(n, '::after').content, textShadow: getComputedStyle(n, '::after').textShadow } }))), null, 2)); };
async function choose(id) {
 const row = page.getByTestId(id); await row.waitFor({ timeout: 15000 });
 if (id.startsWith('actor-command-')) { await row.focus(); await key('Enter'); return; }
 for (let i = 0; i < 100; i++) { if ((await row.getAttribute('class'))?.includes('selected') || await row.getAttribute('data-battle-command-cursor') === 'true') { await key('Enter'); return; } await key('ArrowDown'); }
 throw new Error(`Cursor did not reach ${id}`);
}
async function drain(limit = 100) {
 for (let i = 0; i < limit; i++) {
  if (await page.getByTestId('runtime-choices').count()) return 'choices';
  if (!await page.getByTestId('dialogue-box').count()) { await page.waitForTimeout(250); if (!await page.getByTestId('dialogue-box').count() && !await page.evaluate(() => window.__oprnHooksScene?.running)) return 'done'; }
  await key('Enter');
 }
 throw new Error('Dialogue did not finish');
}
try {
 await page.goto(`${url.replace(/\/$/u, '')}/player.html`, { waitUntil: 'domcontentloaded' });
 await page.waitForFunction(() => document.querySelector('[data-testid="title-screen"], [data-testid="oprn-game-file-picker"]'), undefined, { timeout: 120000 });
 if (await page.getByTestId('oprn-game-file-picker').count()) throw new Error(await page.getByTestId('oprn-game-file-picker-status').innerText());
 await page.getByTestId('title-screen').waitFor({ timeout: 120000 }); await key('Enter');
 await page.waitForFunction(() => window.__oprnDebug?.readState().currentMapId, undefined, { timeout: 120000 });
 await page.getByTestId('play-loading-overlay').waitFor({ state: 'detached', timeout: 120000 });
 await page.getByTestId('dialogue-box').waitFor(); await page.waitForTimeout(600); await shot('01-dialogue'); await drain();
 await page.evaluate(() => window.__oprnDebug.teleport('mx_map_lab', 7, 6)); await page.waitForTimeout(600);
 await page.evaluate(() => window.__oprnInput.face('up')); await key('z');
 await drain(); await shot('02-starter-choices'); await key('Enter'); await drain();
 // Session-only preparation exercises six slots from real species, without changing campaign data.
 await page.evaluate(async () => {
  const { giveMonster } = await import('/src/project/monsterCollection.ts');
  const project = await (await fetch('/__emerald_surface_project.json')).json();
  window.__emeraldCampaign = project;
  const session = window.__oprnHooksScene.getSession();
  const species = project.database.monsterSpecies;
  for (let i = 1; i < 6; i++) giveMonster(project, session, { speciesId: species[i].id, level: 8 + i });
  session.monsterInstances[session.monsterParty[0]].currentHp = 1;
 });
 await key('Escape'); await shot('03-field-menu');
 await choose('status-menu-command-monsters'); await shot('04-party');
 report.partySlots = await page.locator('[data-party-slot]').count();
 await key('Enter'); await shot('05-summary');
 report.summary = await page.getByTestId('status-menu-detail').innerText();
 const known = page.locator('[data-testid^="status-menu-monster-known-skill-"]').first();
 await choose(await known.getAttribute('data-testid')); await shot('06-summary-pp');
 await key('Escape'); await key('Escape');
 await choose('status-menu-command-items'); await shot('07-bag');
 const medicineRecord = project.database.items.find(item => item.hpRecovery?.flat > 0 && item.type === 'medicine');
 const medicine = page.getByTestId(`status-menu-item-${medicineRecord.id}`);
 const medicineId = await medicine.getAttribute('data-testid');
 await choose(medicineId); await shot('08-item-context');
 await choose(medicineId.replace('status-menu-item-', 'status-menu-item-use-')); await shot('08-item-target');
 const first = await page.evaluate(() => window.__oprnHooksScene.getSession().monsterParty[0]);
 const before = await page.evaluate(id => { const s = window.__oprnHooksScene.getSession(); return { hp: s.monsterInstances[s.monsterParty[0]].currentHp, inventory: { ...s.inventory } }; }, medicineId);
 await choose(`status-menu-monster-${first}`);
 const after = await page.evaluate(() => { const s = window.__oprnHooksScene.getSession(); return { hp: s.monsterInstances[s.monsterParty[0]].currentHp, inventory: { ...s.inventory } }; });
 report.medicine = { before, after };
 if (!(after.hp > before.hp)) throw new Error('Medicine did not heal');
 if (after.inventory[medicineRecord.id] !== before.inventory[medicineRecord.id] - 1) throw new Error('Medicine inventory did not decrease by one');
 await key('Escape'); await key('Escape');
 if (await page.getByTestId('main-menu').count()) await key('Escape');
 await drain();
 await page.evaluate(() => window.__oprnDebug.teleport('mx_map_meadow', 5, 10)); await page.waitForTimeout(400);
 // Actual authored wild troop and native command DOM, session launched through real scene.playBattle.
 await page.evaluate(() => { const scene = window.__oprnHooksScene; const p = window.__emeraldCampaign; window.__emeraldBattleDone = false; scene.playBattle({ kind: 'battleProcessing', troopId: p.maps.mx_map_meadow.encounterTable[0].troopId, canEscape: true, canLose: true }).then(() => { window.__emeraldBattleDone = true; }); });
 await page.getByTestId('actor-command-fight').waitFor({ timeout: 20000 }); await page.waitForTimeout(400); await shot('09-battle-command');
 report.battle = await page.getByTestId('battle-scene').evaluate(node => { const rect = node.getBoundingClientRect(); const style = getComputedStyle(node); return { rect: { width: rect.width, height: rect.height }, width: style.width, height: style.height, scale: node.dataset.battleStageScale, profile: node.dataset.monsterStyle }; });
 await key('Enter'); await shot('10-battle-moves');
 report.moves = await page.locator('.battle-command-panel').innerText();
 if (await page.getByTestId('dialogue-box').count() || !report.moves.includes('/')) throw new Error('Native move/PP panel did not open');
 await key('Escape'); await choose('actor-command-item'); await shot('11-battle-items');
 report.battleItems = await page.locator('.battle-command-panel').innerText();
 if (!report.battleItems.includes(medicineRecord.name)) throw new Error('Native battle item panel did not open');
 report.editorChrome = await page.locator('.editor-shell, .workspace-topbar, #editor-root').count();
 report.errors = errors; report.httpErrors = httpErrors;
 await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
 await writeFile(`${out}/SUMMARY.md`, `# Emerald surfaces browser evidence\n\n${report.scope}\n\n- Content: ${report.maps} maps / ${report.species} species.\n- Native keyboard: menu→six-slot party→summary/current PP→cancel→bag→medicine target→HP/inventory mutation→battle/Fight/moves→Bag/items.\n- Six slots: ${report.partySlots}. Medicine HP: ${before.hp}→${after.hp}.\n- Battle: ${JSON.stringify(report.battle)}.\n- Editor chrome ${report.editorChrome}; page errors ${errors.length}; HTTP errors ${httpErrors.length}.\n- Opening/title and store are other owners. Saves and equipment were preserved but not executed by this probe.\n\n## 즉시 확인\n\n- 01-dialogue.png\n- 02-starter-choices.png\n- 03-field-menu.png\n- 04-party.png\n- 05-summary.png\n- 06-summary-pp.png\n- 07-bag.png\n- 08-item-context.png\n- 08-item-target.png\n- 09-battle-command.png\n- 10-battle-moves.png\n- 11-battle-items.png\n`);
 console.log(JSON.stringify({ out, partySlots: report.partySlots, medicine: report.medicine, battle: report.battle, errors, httpErrors }));
} catch (error) { await shot('failure'); await writeFile(`${out}/failure.json`, JSON.stringify({ error: String(error), errors, httpErrors, text: await page.locator('body').innerText() }, null, 2)); throw error; }
finally { await browser.close(); }
