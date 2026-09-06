import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

const out = 'output/evidence/monster-ui/browser';
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '11942', '--strictPort'], {
  env: { ...process.env, DEV_SERVER_PORT: '11942', DEV_SERVER_NO_TLS: '1', E2E_FREEZE_DEV_SERVER: '1', VITE_CACHE_DIR: `${process.cwd()}/output/evidence/monster-ui/vite-cache` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
let browser;
let page;
const results = { browser: process.env.MONSTER_QA_BROWSER ?? 'chromium', viewports: [], captures: [], imageChecks: [], controls: [], remoteWrites: [], pageErrors: [], failedRequests: [], browserErrors: [], httpErrors: [] };
try {
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('Owned Vite server did not announce readiness')), 60000);
    server.once('error', error => { clearTimeout(deadline); reject(error); });
    server.once('exit', code => { clearTimeout(deadline); reject(new Error(`Owned Vite exited before ready: ${code}`)); });
    server.stdout.on('data', data => {
      serverLog += data.toString();
      if (serverLog.includes('11942') && serverLog.includes('Local:')) { clearTimeout(deadline); resolve(); }
    });
    server.stderr.on('data', data => { serverLog += data.toString(); });
  });
  // Finish the multi-megabyte stylesheet transform before the browser requests the
  // entire editor module graph. This awaits actual HTTP completion, never a delay.
  const stylesheet = await fetch('http://127.0.0.1:11942/src/styles/index.css', { signal: AbortSignal.timeout(60000) });
  assert.equal(stylesheet.status, 200);
  results.stylesheetBytes = (await stylesheet.arrayBuffer()).byteLength;
  browser = await (results.browser === 'firefox' ? firefox : chromium).launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => results.pageErrors.push(error.message));
  page.on('requestfailed', request => results.failedRequests.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  page.on('console', message => { if (message.type() === 'error') results.browserErrors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) results.httpErrors.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  // Driver-level interception aborts Vite's large CSS module on this host.
  // The disposable boot disables persistence; assert that before every fixture mutation.
  page.on('request', request => {
    if (request.method() !== 'GET' && /\/supabase\/|\/rest\/v1\//.test(request.url())) {
      results.remoteWrites.push({ method: request.method(), url: new URL(request.url()).pathname });
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert');
  });
  await page.goto('http://127.0.0.1:11942/?freshProject=1', { waitUntil: 'load', timeout: 90000 });
  await page.getByTestId('toolbar-database').waitFor({ state: 'visible', timeout: Number(process.env.MONSTER_BOOT_TIMEOUT ?? '120000') });
  assert.equal(await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    if (store.isRemotePersistenceEnabled()) return false;
    store.update(project => { project.database.enemies = []; }, { scope: 'database', collection: 'enemies', label: 'Local metadata QA empty enemies' });
    return true;
  }), true, 'QA must never edit a remote-enabled project');
  await page.getByTestId('toolbar-database').click();
  const monsterGroup = page.locator('[data-group-slug="monster"]');
  if (await monsterGroup.getAttribute('aria-expanded') === 'false') await monsterGroup.click();
  await page.getByTestId('db-tab-enemies').click();
  await page.getByTestId('db-monster-resources-open').click();
  const name = page.getByTestId('db-monster-resource-name');
  await name.waitFor({ state: 'visible' });
  const id = await page.getByTestId('db-monster-resource-id').innerText();
  const original = await name.inputValue();
  assert.equal(await page.getByTestId('db-monster-resource-row').count(), await page.evaluate(async () => {
    const { listMonsterResources } = await import('/src/assets/monsterResourceCatalog.ts');
    const { store } = await import('/src/project/store.ts');
    return listMonsterResources(store.getCurrent()).length;
  }));
  const capture = async label => {
    const images = await page.locator('.db-monster-resource-identity img').evaluateAll(async nodes => Promise.all(nodes.filter(image => {
      const rect = image.getBoundingClientRect();
      const clip = image.closest('.db-ws-detail-body').getBoundingClientRect();
      return rect.bottom > clip.top && rect.top < clip.bottom && rect.right > clip.left && rect.left < clip.right;
    }).map(async image => {
      let deadline;
      try {
        await Promise.race([image.decode(), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Visible preview decode deadline')), 15000); })]);
        return { width: image.naturalWidth, height: image.naturalHeight, complete: image.complete };
      } finally { clearTimeout(deadline); }
    })));
    if (label.startsWith('catalog-')) assert.equal(images.length, 1, 'Catalog capture must include the selected preview');
    assert.ok(images.every(image => image.complete && image.width > 0 && image.height > 0));
    const path = `${out}/${label}.png`;
    await page.screenshot({ path });
    const bytes = await readFile(path);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), page.viewportSize().width);
    assert.equal(bytes.readUInt32BE(20), page.viewportSize().height);
    results.imageChecks.push({ label, images, signature: 'PNG', dimensions: page.viewportSize() });
    results.captures.push(path);
    console.log(`Captured ${label}`);
  };
  for (const width of [375, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.db-monster-resource-dialog .db-ws-detail-body').evaluate(node => { node.scrollTop = 0; });
    // Native resize event delivered before capture; font readiness is semantic, not a sleep.
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.locator('.db-monster-resource-dialog').evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height, left: rect.left, top: rect.top, overflow: node.scrollWidth - node.clientWidth };
    });
    assert.ok(geometry.left >= 0 && geometry.left + geometry.width <= width + 1);
    assert.ok(geometry.overflow <= 1, `dialog overflow at ${width}`);
    results.viewports.push({ viewport: width, ...geometry });
    await capture(`catalog-${width}`);
    for (const field of ['name', 'tags', 'description', 'apply', 'close']) {
      const control = page.getByTestId(`db-monster-resource-${field}`);
      await control.scrollIntoViewIfNeeded();
      const geometry = await control.evaluate(node => {
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return { width: rect.width, height: rect.height, reachable: hit === node || node.contains(hit) };
      });
      assert.ok(geometry.reachable, `${width}: ${field} is clipped`);
      assert.ok(geometry.height >= 24, `${width}: ${field} target is too short`);
      results.controls.push({ viewport: width, field, ...geometry });
    }
  }
  const row = page.getByTestId('db-monster-resource-row').first();
  await row.focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByTestId('db-monster-resource-row').nth(1).evaluate(node => document.activeElement === node), true, 'ArrowDown must focus the second resource');
  await page.keyboard.press('Enter');
  assert.equal(await name.evaluate(node => document.activeElement === node), true, 'Keyboard selection must focus the metadata name');
  assert.equal(await page.getByTestId('db-monster-resource-id').innerText(), await page.getByTestId('db-monster-resource-row').nth(1).getAttribute('data-resource-id'));
  await page.getByTestId('db-monster-resource-row').first().click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await name.fill('지역 수호 몬스터');
  await page.getByTestId('db-monster-resource-tags').fill('방패\n초록\n방패');
  await page.getByTestId('db-monster-resource-description').fill('방패를 든 초록색 몬스터. 이름과 외형 정보는 전투 능력치와 별개입니다.');
  await page.getByTestId('db-monster-resource-search').fill('no-such-monster-49309309');
  assert.equal(await page.getByTestId('db-monster-resource-row').count(), 0);
  assert.equal(await name.inputValue(), '지역 수호 몬스터');
  await capture('dirty-empty-search');
  await page.keyboard.press('Escape');
  await page.getByTestId('app-modal-cancel').waitFor({ state: 'visible' });
  await capture('dirty-close-confirmation');
  await page.getByTestId('app-modal-cancel').click();
  await page.getByTestId('app-modal-cancel').waitFor({ state: 'detached' });
  assert.equal(await name.inputValue(), '지역 수호 몬스터');
  await name.fill('   ');
  await page.getByTestId('db-monster-resource-apply').click();
  assert.equal(await page.getByTestId('db-monster-resource-status').getAttribute('role'), 'alert');
  await capture('validation-error');
  await name.fill('지역 수호 몬스터');
  await page.getByTestId('db-monster-resource-apply').click();
  assert.deepEqual(await page.evaluate(async resourceId => {
    const { store } = await import('/src/project/store.ts');
    return store.getCurrent().monsterMetadata[resourceId];
  }, id), { name: '지역 수호 몬스터', tags: ['방패', '초록'], description: '방패를 든 초록색 몬스터. 이름과 외형 정보는 전투 능력치와 별개입니다.' });
  await capture('applied');
  await page.evaluate(async () => { const { undoMapEdit } = await import('/src/editor/mapEditHistory.ts'); undoMapEdit(); });
  assert.equal(await name.inputValue(), original);
  await page.evaluate(async () => { const { redoMapEdit } = await import('/src/editor/mapEditHistory.ts'); redoMapEdit(); });
  assert.equal(await name.inputValue(), '지역 수호 몬스터');
  await page.getByTestId('db-monster-resource-reset').click();
  assert.equal(await name.inputValue(), original);
  await page.getByTestId('db-monster-resource-search').fill('');
  await name.fill('교체 전 보존할 초안');
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { createBlankProject } = await import('/src/project/defaults.ts');
    store.replaceProject(createBlankProject());
  });
  assert.equal(await page.getByTestId('db-monster-resource-apply').isDisabled(), true);
  assert.equal(await name.inputValue(), '교체 전 보존할 초안');
  await capture('project-replaced-draft-retained');
  await page.getByTestId('db-monster-resource-close').click();
  await page.getByTestId('app-modal-confirm').click();
  await page.getByTestId('db-monster-resources').waitFor({ state: 'detached' });
  assert.deepEqual(results.remoteWrites, []);
  assert.deepEqual(results.pageErrors, []);
  results.behavior = 'catalog, empty enemies/search, dirty cancellation, validation, apply, undo/redo, reset, project replacement and cleanup passed';
} catch (error) {
  results.failure = error instanceof Error ? error.message : String(error);
  if (page) {
    results.failureBody = (await page.locator('body').innerText()).slice(0, 8000);
    results.bootDiagnostics = await page.evaluate(() => ({ readyState: document.readyState, url: location.href, html: document.body.innerHTML.slice(0, 3000), styles: document.querySelectorAll('style').length, hasStore: Boolean(window.__oprnEditorStore), resources: performance.getEntriesByType('resource').map(entry => ({ name: new URL(entry.name).pathname, duration: entry.duration, bytes: entry.transferSize })).filter(entry => entry.name.includes('index.css') || entry.name.includes('main.ts')), resourceCount: performance.getEntriesByType('resource').length }));
    await page.screenshot({ path: `${out}/failure.png` });
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  const exited = once(server, 'exit');
  if (server.exitCode === null && server.signalCode === null) { server.kill('SIGTERM'); await exited; }
  results.serverStopped = server.exitCode !== null || server.signalCode !== null;
  await rm('output/evidence/monster-ui/vite-cache', { recursive: true, force: true });
  await writeFile(`${out}/server.log`, serverLog);
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
