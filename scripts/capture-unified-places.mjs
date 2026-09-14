import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const dir = 'output/evidence/unified-places';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.addInitScript(() => { localStorage.setItem('oprn:editor-welcome-dismissed', '1'); localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert'); });
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:9815'}/?blankProject=1&aiBridge=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('toolbar-database').click({ timeout: 120000 });
  const group = page.getByTestId('db-tab-group-world');
  if (await group.getAttribute('aria-expanded') === 'false') await group.click();
  await page.getByTestId('db-tab-spatial-places').click();
  const ruleId = await page.evaluate(async () => {
    const { listSpatialGalleryCards } = await import('/src/editor/panels/spatialCatalog.ts');
    const { spatialSession } = await import('/src/editor/panels/spatialAuthoringSession.ts');
    return listSpatialGalleryCards(spatialSession()).find(card => card.kind === 'spaces').id;
  });
  await page.getByTestId(`spatial-card-${ruleId}`).click();
  await page.getByRole('button', { name: '← 장소 돌아가기', exact: true }).click();
  await page.getByTestId(`spatial-card-${ruleId}`).waitFor();
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { mixedFixture } = await import('/test/support/spatialMixedFixture.ts');
    const { clearAuthoringSession } = await import('/src/editor/panels/spatialAuthoringAccess.ts');
    clearAuthoringSession();
    (await import('/src/editor/panels/spatialAuthoringSession.ts')).resetSpatialAuthoringSessions();
    store.replace(mixedFixture(), { preserveEventDrafts: false });
  });
  await page.getByTestId('db-tab-spatial-places').click();
  assert.equal(await page.getByTestId('db-tab-spatial-spaces').count(), 0);
  const picker = page.getByTestId('composition-design');
  await picker.waitFor();
  assert.ok(await picker.locator('option[value="library-space/library/room-design"]').count());
  assert.ok(await picker.locator('option[value="library-place/library/inn"]').count());
  await page.screenshot({ path: `${dir}/places.png` });
  await picker.selectOption('library-space/library/room-design');
  await page.getByRole('button', { name: '← 장소 돌아가기', exact: true }).waitFor();
  assert.equal(await page.evaluate(async () => (await import('/src/editor/panels/spatialAuthoringSession.ts')).spatialSession().tab), 'spaces');
  await page.screenshot({ path: `${dir}/room.png` });
  await page.getByRole('button', { name: '← 장소 돌아가기', exact: true }).click();
  await picker.waitFor();
  assert.equal(await page.evaluate(async () => (await import('/src/editor/panels/spatialAuthoringSession.ts')).spatialSession().tab), 'places');
  await page.setViewportSize({ width: 1024, height: 768 });
  await picker.selectOption('library-space/library/room-design');
  await page.getByRole('button', { name: '← 장소 돌아가기', exact: true }).waitFor();
  await page.screenshot({ path: `${dir}/room-1024.png` });
  await page.getByRole('button', { name: '← 장소 돌아가기', exact: true }).click();
  await picker.waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: unified choices, hidden space rail, correct room editor and return at both viewport sizes');
} catch (error) { await page.screenshot({ path: `${dir}/failure.png` }); throw error; }
finally { await browser.close(); }
