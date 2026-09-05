// Real editor interaction evidence; blank session is a test fixture, never shipped content.
import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.GROWTH_QA_BASE ?? 'http://127.0.0.1:54041';
import { armDomState, finishDomState, inspectGrowthImages, inspectGrowthLayout, blockRemoteWrites, growthEvidenceRoot, growthViewports } from './growth-tree-evidence.mjs';
const out = `${growthEvidenceRoot}/editor`;
await mkdir(out, { recursive: true });
console.log('Launching browser');
const browserType = process.env.GROWTH_QA_BROWSER === 'chromium' ? chromium : firefox;
const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
const errors = [];
const imageEvidence = [], measurements = [], screenshots = [];
const remoteWrites = await blockRemoteWrites(page);
page.on('console', m => { if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,500)); });
page.on('requestfailed', r => console.log('REQUESTFAILED',r.url().slice(0,200),r.failure()?.errorText));
page.on('pageerror', e => { errors.push(e.message); console.log('PAGEERROR', e.message); });
try {
  await page.addInitScript(() => { localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert'); localStorage.setItem('oprn:editor-ui-mode', 'expert'); });
  console.log('Loading editor');
  await page.goto(`${base}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  console.log('Waiting for database launcher');
  await page.getByTestId('toolbar-database').waitFor({ timeout: 120000 });
  await page.getByTestId('toolbar-database').click();
  await page.getByTestId('database-modal').waitFor();
  const switchTab = async id => {
    const tab=page.getByTestId(id);
    if (!await tab.isVisible()) await page.getByTestId('db-tab-group-party').click();
    await tab.click();
  };
  await switchTab('db-tab-skill-trees');
  console.log('Creating tree through editor controls');
  await page.getByTestId('growth-add-tree').click(); console.log('Tree created');
  await page.getByTestId('growth-tree-name').fill('수호자의 길'); await page.getByTestId('growth-tree-name').press('Tab');
  console.log('Tree renamed');
  const names = ['방패 숙련', '수호 자세', '강철 의지', '방패 밀치기', '아군 보호', '최후의 수호'];
  const ids=[];
  for (let i=0;i<names.length;i++) {
    console.log('Adding node',i);
    await page.getByTestId(i===3 || i===5 ? 'growth-add-skill' : 'growth-add-parameter').click();
    await page.getByTestId('growth-node-name').fill(names[i]); await page.getByTestId('growth-node-name').press('Tab');
    console.log('Renamed node',i);
    ids.push(await page.locator('.growth-node.is-selected').getAttribute('data-node-id'));
  }
  // Locator.click owns scrolling and re-resolves nodes replaced by the store render.
  const clickNode=async id => { await page.getByTestId(`growth-node-${id}`).click(); };
  for(const [a,b] of [[0,1],[0,2],[1,3],[2,4],[3,5],[4,5]]) {
    console.log('Connecting',a,b);
    await clickNode(ids[a]); await page.getByTestId('growth-connect').click(); await clickNode(ids[b]);
  }
  // Illegal back-edge is refused visibly, not saved.
  await clickNode(ids[5]); await page.getByTestId('growth-connect').click(); await clickNode(ids[0]);
  assert.match(await page.getByTestId('growth-status').textContent(), /순환/);
  await page.getByTestId('growth-connect').click();
  await page.getByTestId('growth-arrange').click();
  await page.getByTestId('growth-zoom-out').click();
  console.log('Checking drag and keyboard movement');
  await clickNode(ids[0]);
  const node=page.getByTestId(`growth-node-${ids[0]}`);
  const initial=await node.evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)}));
  await node.press('Alt+ArrowDown');
  assert.equal(await node.evaluate(e=>parseFloat(e.style.top)),initial.y+24);
  const rect=await node.boundingBox();
  await page.mouse.move(rect.x+30,rect.y+30); await page.mouse.down(); await page.mouse.move(rect.x+60,rect.y+50,{steps:6}); await page.mouse.up();
  assert.notEqual(await node.evaluate(e=>parseFloat(e.style.left)),initial.x);
  await page.getByTestId('growth-arrange').click();
  await clickNode(ids[0]);
  await page.getByTestId('growth-preview-toggle').click();
  await page.getByTestId('growth-preview-learn').click();
  assert.match(await page.getByTestId('growth-status').textContent(),/습득/);
  await page.getByTestId('growth-preview-reset').click();
  assert.match(await page.getByTestId('growth-status').textContent(),/환급/);
  await page.getByTestId('growth-preview-toggle').click();
  const capture = async kind => {
    const counts = [['.growth-node img', await page.locator('.growth-node').count()], ['.growth-catalog-art img', await page.locator('.growth-catalog-item').count()], ['.growth-inspector-art img', await page.locator('.growth-inspector-title').count()]];
    for (const [selector, count] of counts) imageEvidence.push({ kind, width: page.viewportSize().width, ...await inspectGrowthImages(page, selector, count) });
    measurements.push({ kind, width: page.viewportSize().width, boxes: await inspectGrowthLayout(page, ['.growth-body', '.growth-catalog', '.growth-workspace', '.growth-canvas', '.growth-inspector', '.growth-toolbar', '.growth-canvas-controls']) });
    const path = `${out}/${kind}-${page.viewportSize().width}.png`;
    await page.screenshot({ path }); screenshots.push(path);
  };
  for (const [width,height] of growthViewports) {
    await page.setViewportSize({width,height});
    await clickNode(ids[0]);
    await page.locator('.growth-inspector').evaluate(e => { e.scrollTop = 0; });
    await capture('skill');
  }
  await page.setViewportSize({width:1600,height:1000});
  await switchTab('db-tab-promotion-tree');
  const classIds=await page.locator('.growth-node').evaluateAll(nodes=>nodes.map(n=>n.dataset.nodeId));
  if(classIds.length>=3) for(const to of classIds.slice(1,3)) { await clickNode(classIds[0]); await page.getByTestId('growth-connect').click(); await clickNode(to); }
  await page.getByTestId('growth-arrange').click(); await clickNode(classIds[0]);
  for (const [width, height] of growthViewports) {
    await page.setViewportSize({ width, height }); await clickNode(classIds[0]);
    await page.locator('.growth-inspector').evaluate(e => { e.scrollTop = 0; });
    await capture('promotion');
  }
  await page.getByTestId('database-modal-close').click();
  await page.getByTestId('database-dirty-prompt').waitFor();
  await page.getByTestId('database-dirty-keep-editing').click();
  await switchTab('db-tab-skill-trees');
  assert.equal(await page.locator('.growth-node').count(),6);
  // Complete CRUD on a disposable copy; original six-node graph must survive.
  await page.getByTestId('growth-duplicate-tree').click();
  assert.equal(await page.locator('.growth-catalog-item').count(), 2);
  await page.getByTestId('growth-delete-node').click();
  assert.equal(await page.locator('.growth-node').count(), 5);
  await page.getByTestId('growth-delete-tree').click();
  await page.getByTestId('growth-confirm-delete-tree').click();
  assert.equal(await page.locator('.growth-catalog-item').count(), 1);
  assert.equal(await page.locator('.growth-node').count(), 6);
  // Fault injection crosses the real image request boundary, not dispatchEvent('error').
  await clickNode(ids[0]);
  const failedUrl = await page.locator('.growth-node.is-selected img').getAttribute('src');
  const expectedFallbacks = await page.locator('.growth-studio img').evaluateAll((images, url) => images.filter(i => i.getAttribute('src') === url).length, failedUrl);
  const failImage = route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'QA missing image' });
  const missingUrl = `${base}/__growth-qa-missing.png`;
  await page.route(missingUrl, failImage);
  // A fresh URL avoids the browser's decoded-image cache, while exercising the
  // shipped resolver and real HTTP error event (not manually changing img.src).
  await page.evaluate(async ({ key, missingUrl }) => {
    const { registerInlineAssets } = await import('/src/assets/inlineAssetStore.ts');
    registerInlineAssets({ [key]: missingUrl });
  }, { key: new URL(failedUrl, base).pathname.slice(1), missingUrl });
  const missingResponse = page.waitForResponse(response => response.url() === missingUrl, { timeout: 15000 });
  await armDomState(page, expected => [...document.querySelectorAll('.growth-node-emblem, .growth-catalog-art, .growth-inspector-art')].filter(slot => !slot.querySelector('img') && slot.textContent.trim()).length === expected, expectedFallbacks);
  await clickNode(ids[0]);
  assert.equal((await missingResponse).status(), 404); await finishDomState(page);
  const fallbackSlots = await page.locator('.growth-node-emblem, .growth-catalog-art, .growth-inspector-art').evaluateAll(slots => slots.filter(s => !s.querySelector('img')).map(s => ({ class: s.className, badge: s.textContent })));
  assert.ok(fallbackSlots.some(s => s.class === 'growth-node-emblem'));
  assert.ok(fallbackSlots.some(s => s.class === 'growth-catalog-art'));
  assert.ok(fallbackSlots.some(s => s.class === 'growth-inspector-art'));
  imageEvidence.push({ kind: 'network-404-fallback', expectedFallbacks, fallbackSlots });
  const fallbackPath = `${out}/missing-assets-${page.viewportSize().width}.png`;
  await page.screenshot({ path: fallbackPath }); screenshots.push(fallbackPath);
  await page.unroute(missingUrl, failImage);
  await page.evaluate(async () => (await import('/src/assets/inlineAssetStore.ts')).registerInlineAssets(null));
  await clickNode(ids[0]);
  // Unknown names and dangling skill references use a semantic book without new schema.
  await page.evaluate(async ({ id }) => {
    const { store } = await import('/src/project/store.ts');
    store.update(p => { const n = p.growth.skillTrees[0].nodes.find(n => n.id === id); n.effect = { kind: 'skill', skillId: 'qa-missing-skill' }; n.maxRank = 1; }, { scope: 'database', label: 'QA missing skill reference', origin: 'system' });
  }, { id: ids[0] });
  await clickNode(ids[0]);
  assert.equal(await page.locator('.growth-node.is-selected.is-invalid').count(), 1);
  await page.locator('.growth-inspector').evaluate(e => { e.scrollTop = 0; });
  await capture('custom-missing-skill');
  await page.evaluate(async id => {
    const { store } = await import('/src/project/store.ts');
    store.update(p => { const c = p.database.classes.find(c => c.id === id); c.name = 'Zzq Custom'; c.learnedSkills = []; c.skillIds = []; c.options.mightyGuard = false; c.options.dualWield = false; }, { scope: 'database', label: 'QA custom class', origin: 'system' });
  }, classIds[0]);
  await switchTab('db-tab-promotion-tree'); await clickNode(classIds[0]);
  await page.locator('.growth-inspector').evaluate(e => { e.scrollTop = 0; });
  await capture('custom-class');
  assert.equal(remoteWrites.length, 0, JSON.stringify(remoteWrites));
  assert.equal(errors.length,0,errors.join('\n'));
  await writeFile(`${out}/editor-report.json`,JSON.stringify({base,errors,remoteWrites,imageEvidence,screenshots,measurements,nodeIds:ids,checks:['create','rename','connect','reject-cycle','arrange','keyboard-move','drag','invest-preview','reset-preview','dirty-close-guard','tab-return','responsive','duplicate','delete-node','delete-tree','loaded-art','404-fallback','custom-class','missing-skill']},null,2));
  console.log('Editor QA passed');
} catch(e) {
  console.log('FAILED',String(e));
  await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{});
  await writeFile(`${out}/partial-report.json`, JSON.stringify({ base, imageEvidence, measurements, screenshots, remoteWrites, errors }, null, 2));
  await writeFile(`${out}/failure.txt`,`${String(e)}\n${errors.join('\n')}\n${await page.locator('body').innerText({timeout:3000}).catch(()=>'(body unavailable)')}`);
  throw e;
} finally { await browser.close(); await writeFile(`${out}/cleanup.json`, JSON.stringify({ browserClosed: !browser.isConnected(), remoteWrites, persistentContentCreated: false })); }
