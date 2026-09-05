// Editor QA: use a disposable project; never persists authored test data remotely.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.env.MONSTER_QA_OUT ?? 'output/evidence/monster-improvements';
const base = process.env.AUDIT_BASE ?? 'http://127.0.0.1:24873/';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
page.setDefaultTimeout(45000);
const results = {};
await page.addInitScript(() => {
  localStorage.setItem('oprn:editor-ui-mode', 'expert');
  localStorage.setItem('oprn:ai-consent', 'accepted');
});
const tab = async (slug) => {
  console.log(`QA tab: ${slug}`);
  await page.getByTestId(`db-tab-${slug}`).evaluate((node) => node.click());
  await page.waitForTimeout(900);
};
try {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(`${base}?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    try { await page.getByTestId('edit-canvas').waitFor({ state: 'visible', timeout: 60000 }); break; }
    catch (error) { if (attempt === 1) throw error; }
  }
  await page.getByTestId('toolbar-database').click();
  await page.getByTestId('database-modal').waitFor({ state: 'visible' });
  await page.evaluate(() => window.__oprnEditorStore.update((p) => {
    p.database.monsterSpecies[0].skillsByLevel = [{ level: 1, skillId: p.database.skills[0].id }, { level: 10, skillId: p.database.skills[1].id }];
    p.system.typeChart = { types: ['fire', 'water'], multipliers: {} };
    p.database.monsterSpecies[0].types = ['old-type', 'other-old'];
    p.database.enemies[0].stateRates = {};
    p.database.enemies[0].actionProfile = { attack: { kind: 'projectile' } };
    p.database.troops[0].battleEventPages = [];
    p.factions = { defs: [{ id: 'guard', name: '경비병' }], relations: [{ a: 'guard', b: 'enemy', stance: -1 }], playerKillReputation: { weight: 0.25 } };
  }));
  await tab('monster-species');
  const skills = await page.evaluate(() => window.__oprnEditorStore.getCurrent().database.skills.slice(0, 3).map((s) => s.id));
  await page.getByTestId('db-monster-species-skill-level-0').fill('20');
  await page.getByTestId('db-monster-species-skill-level-0').press('Tab');
  await page.getByTestId('db-monster-species-skill-0').selectOption(skills[2]);
  results.skills = await page.evaluate(() => window.__oprnEditorStore.getCurrent().database.monsterSpecies[0].skillsByLevel);
  assert.deepEqual(results.skills, [{ level: 10, skillId: skills[1] }, { level: 20, skillId: skills[2] }]);
  await page.getByTestId('db-monster-species-type-old-type').click();
  await page.getByTestId('db-monster-species-type-fire').check();
  results.types = await page.evaluate(() => window.__oprnEditorStore.getCurrent().database.monsterSpecies[0].types);
  assert.deepEqual(results.types, ['other-old', 'fire']);
  const previewBefore = await page.getByTestId('db-monster-species-stats-preview').innerText();
  await page.getByTestId('db-monster-species-hp').fill('900');
  assert.notEqual(await page.getByTestId('db-monster-species-stats-preview').innerText(), previewBefore);
  await tab('enemies');
  const stateId = await page.evaluate(() => window.__oprnEditorStore.getCurrent().database.states[0].id);
  const state = page.getByTestId(`db-picker-enemy-state-rate-${stateId}`);
  assert.equal(await state.inputValue(), '');
  assert.match(await state.innerText(), /미지정 · 적용 100%/);
  assert.match(await state.innerText(), /C · 적용 60%/);
  assert.equal(await page.getByTestId('db-field-enemy-attack-cooldown').inputValue(), '1200');
  assert.equal(await page.getByTestId('db-field-enemy-projectile-speed').inputValue(), '6');
  results.defaults = { state: 'implicit 100%, C 60%', cooldown: 1200, speed: 6 };
  await tab('troops');
  for (let i = 0; i < 3; i++) await page.getByTestId('db-troop-event-add-page').click();
  await page.getByTestId('db-troop-event-page-tab-2').click();
  await page.getByTestId('db-troop-event-delete-page').click();
  await page.getByTestId('db-troop-event-add-page').click();
  results.pageIds = await page.evaluate(() => window.__oprnEditorStore.getCurrent().database.troops[0].battleEventPages.map((p) => p.id));
  assert.equal(new Set(results.pageIds).size, 3);
  await page.getByTestId('db-field-troop-event-run-once').uncheck();
  assert.equal(await page.getByTestId('db-field-troop-event-run-once').isChecked(), false);
  await page.getByTestId('db-field-troop-event-condition-kind').selectOption('enemyHp');
  results.hpTargets = await page.getByTestId('db-field-troop-event-condition-enemy-hp-target').innerText();
  assert.match(results.hpTargets, /슬롯 1/);
  await tab('factions');
  await page.getByTestId('db-faction-preview-count').fill('4');
  results.reputation = await page.getByTestId('db-faction-reputation-preview-result').innerText();
  assert.match(results.reputation, /경비병: 0 → 1/);
  await page.getByTestId('db-faction-row-enemy').click();
  const usage = page.locator('[data-testid^="db-faction-use-enemy-"]').first();
  await usage.click();
  assert.equal(await page.getByTestId('db-tab-enemies').evaluate((node) => node.classList.contains('active')), true);
  for (const width of [1680, 1280, 1024]) {
    await page.setViewportSize({ width, height: width === 1680 ? 1050 : 768 });
    for (const slug of ['enemies', 'monster-species', 'troops', 'factions']) {
      await tab(slug);
      await page.screenshot({ path: `${out}/${slug}-${width}.png` });
      if (slug === 'troops') results[`troopLayout${width}`] = await page.locator('.db-troops-classic-workbench').evaluate((node) => ({ columns: getComputedStyle(node).gridTemplateColumns, width: node.clientWidth, scrollWidth: node.scrollWidth }));
    }
  }
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  await page.screenshot({ path: `${out}/error.png` });
  console.error(error); process.exitCode = 1;
} finally { await browser.close(); }
