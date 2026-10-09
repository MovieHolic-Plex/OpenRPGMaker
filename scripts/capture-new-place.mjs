import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const dir = 'output/evidence/new-place'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
try {
  await page.addInitScript(() => { localStorage.setItem('oprn:editor-welcome-dismissed', '1'); localStorage.setItem('oprn:editor-ui-mode', 'expert'); });
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:9815'}/?blankProject=1&aiBridge=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('toolbar-database').click({ timeout: 120000 });
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { mixedFixture } = await import('/test/support/spatialMixedFixture.ts');
    (await import('/src/editor/panels/spatialAuthoringAccess.ts')).clearAuthoringSession();
    (await import('/src/editor/panels/spatialAuthoringSession.ts')).resetSpatialAuthoringSessions();
    store.replace(mixedFixture(), { preserveEventDrafts: false });
  });
  const group = page.getByTestId('db-tab-group-world');
  if (await group.getAttribute('aria-expanded') === 'false') await group.click();
  await page.getByTestId('db-tab-spatial-places').click();
  await page.getByTestId('spatial-add').click();
  await page.getByTestId('new-place-name').fill('취소할 장소');
  await page.getByTestId('new-place-cancel').click();
  for (const [kind, name] of [['interior', '작은 침실'], ['outdoor', '집 앞 마당'], ['building', '새 여관']]) {
    await page.getByTestId('db-tab-spatial-places').click();
    await page.getByTestId('spatial-add').click();
    await page.getByTestId('new-place-name').fill(name);
    await page.getByTestId('new-place-kind').selectOption(kind);
    await page.getByRole('spinbutton', { name: '가로 칸 수', exact: true }).fill('12');
    if (kind === 'building') await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: `${dir}/${kind}-dialog.png` });
    await page.getByTestId('new-place-create').click();
    await page.getByTestId('new-place-dialog').waitFor({ state: 'detached' });
    await page.getByTestId('spatial-preview').click();
    await page.getByTestId('spatial-apply').click();
    assert.ok(await page.evaluate(async ({ kind, name }) => {
      const { store } = await import('/src/project/store.ts');
      const library = store.getCurrent().spatialAuthoring.library;
      const records = kind === 'building' ? library.places : library.spaces;
      return Object.values(records).some(record => record.name === name);
    }, { kind, name }));
    await page.screenshot({ path: `${dir}/${kind}-created.png` });
    if (kind === 'interior') {
      await page.getByTestId('composition-create-building').click();
      await page.getByTestId('spatial-preview').click();
      await page.getByTestId('spatial-apply').click();
      await page.getByTestId('place-add-floor').click();
      await page.getByTestId('new-place-create').click();
      await page.getByTestId('new-place-dialog').waitFor({ state: 'detached' });
      await page.getByTestId('spatial-preview').click();
      await page.getByTestId('spatial-apply').click();
      assert.ok(!(await page.getByTestId('spatial-place-child-label').innerText()).includes('space'));
      await page.screenshot({ path: `${dir}/room-expanded-building.png` });
    }
    if (kind === 'building') {
      const inspectorToggle = page.getByTestId('spatial-inspector-toggle');
      if (await inspectorToggle.getAttribute('aria-expanded') === 'true') await inspectorToggle.click();
      await page.getByTestId('place-add-room').click();
      await page.getByTestId('new-place-name').fill('손님방');
      await page.getByTestId('new-place-create').click();
      await page.getByTestId('new-place-dialog').waitFor({ state: 'detached' });
      await page.getByTestId('spatial-preview').click(); await page.getByTestId('spatial-apply').click();
      await page.getByTestId('place-add-floor').click();
      assert.equal(await page.getByRole('spinbutton', { name: '추가할 층', exact: true }).inputValue(), '2');
      await page.getByTestId('new-place-create').click();
      await page.getByTestId('new-place-dialog').waitFor({ state: 'detached' });
      await page.getByTestId('spatial-preview').click(); await page.getByTestId('spatial-apply').click();
      assert.deepEqual(await page.evaluate(async () => {
        const { store } = await import('/src/project/store.ts');
        return Object.values(store.getCurrent().spatialAuthoring.library.places).find(p => p.name === '새 여관').children.map(c => c.level);
      }), [1, 1, 2]);
      await page.getByTestId('spatial-place-floor-2').click();
      await page.screenshot({ path: `${dir}/building-rooms-floor2.png` });
    }

  }
  const runtimeFixture = await page.evaluate(async () => {
    const { composedPlaceFloorsFixture } = await import('/test/support/spatialComposedFloorsFixture.ts');
    const { compiled, first } = composedPlaceFloorsFixture();
    const room = Object.values(compiled.spatialAuthoring.occurrences).find(o => o.parentId === 'painted-floors' && o.source.id === first.id);
    const binding = room.bindings[0];
    compiled.startMapId = binding.mapId;
    compiled.startPos = { x: binding.ports[0].x, y: binding.ports[0].y - 1 };
    return compiled;
  });
  await writeFile(`${dir}/runtime-fixture.json`, JSON.stringify(runtimeFixture));
  assert.deepEqual(errors, []);
  console.log('PASS: cancel and create/apply interior, outdoor and building; desktop and 1024px');
} catch (error) { await page.screenshot({ path: `${dir}/failure.png` }); throw error; }
finally { await browser.close(); }
