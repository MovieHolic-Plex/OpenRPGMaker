import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const out = 'output/evidence/forest-places-publish';
const mapId = 'map_cliff_forest_bridge';
const origin = 'http://127.0.0.1:9825';
const read = () => JSON.parse(execFileSync('python3', ['-c', "import sqlite3;from pathlib import Path;c=sqlite3.connect(Path('.oprn-projects/oprn-hill-forest-harmony-20260918-a4e1/project.sqlite').resolve().as_uri()+'?mode=ro',uri=True);t=c.execute('select current_json from project').fetchone()[0];m='{\"$blob\":\"';p=t.split(m);b=dict(c.execute('select sha256,body from tileset_blobs').fetchall()) if len(p)>1 else {};print(p[0]+''.join(b[s[:64]]+s[66:] for s in p[1:]))"], { maxBuffer: 100 * 1024 * 1024 }));
const before = read();
const entries=JSON.parse(fs.readFileSync(`${out}/entries.json`));
const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
try {
  const page = await browser.newPage({ viewport: { width: 2100, height: 2000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:ai-panel-collapsed', '1');
    for (const key of ['oprn:editor-welcome-dismissed', 'oprn:standard-welcome-seen', 'oprn:coachmarks-basic-v1']) localStorage.setItem(key, '1');
  });
  await page.goto(`${origin}/?map=${mapId}&mapOnlyCapture=1`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('edit-canvas').waitFor({ timeout: 90000 });
  await page.waitForFunction(id => document.querySelector(`[data-testid="map-tree-node-${id}"]`)?.getAttribute('aria-selected') === 'true', mapId, { timeout: 60000 });
  const captures=[];
  for(const entry of entries){
    await page.getByPlaceholder('이름 또는 id',{exact:true}).fill(entry.mapId);
    const row=page.getByTestId(`map-tree-node-${entry.mapId}`);await row.click();
    await page.waitForFunction(id=>document.querySelector(`[data-testid="map-tree-node-${id}"]`)?.getAttribute('aria-selected')==='true',entry.mapId);
    await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-1').click();await page.mouse.move(10,10);await page.waitForTimeout(1400);
    const bounds=await page.evaluate(({width,height})=>{const a=window.__oprnEditWorldToClient(0,0),b=window.__oprnEditWorldToClient(width*16,height*16);return{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y};},entry);
    await page.screenshot({path:`public/assets/region-references/${entry.slug}.png`,clip:bounds});captures.push({id:entry.id,bounds});console.log('Captured',entry.id);
  }
  assert.deepEqual(errors, []);
  const after = read();
  assert.deepEqual(after.maps, before.maps);
  assert.deepEqual(after.tilesets, before.tilesets);
  const proof = {sourceProjectId:'oprn-hill-forest-harmony-20260918-a4e1',captures,contentUnchanged:true,errors};
  fs.writeFileSync(`${out}/preview-proof.json`,JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: `${out}/host-failure.png` });
    console.log((await page.locator('body').innerText()).slice(-3500));
  }
  throw error;
} finally {
  await browser.close();
}
