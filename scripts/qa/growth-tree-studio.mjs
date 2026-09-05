// Real editor interaction evidence; blank session is a test fixture, never shipped content.
import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.GROWTH_QA_BASE ?? 'http://127.0.0.1:54041';
const out = 'output/evidence/growth-tree';
await mkdir(out, { recursive: true });
console.log('Launching browser');
const browserType = process.env.GROWTH_QA_BROWSER === 'chromium' ? chromium : firefox;
const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
const errors = [];
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
  const clickNode=async id => { await page.getByTestId(`growth-node-${id}`).scrollIntoViewIfNeeded(); await page.getByTestId(`growth-node-${id}`).click(); };
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
  const measurements=[];
  for (const [width,height] of [[1600,1000],[1280,800],[1024,768]]) {
    await page.setViewportSize({width,height});
    await page.screenshot({path:`${out}/skill-${width}.png`});
    const m=await page.locator('.growth-studio').evaluate(e=>{
      const body=e.querySelector('.growth-body'), canvas=e.querySelector('.growth-canvas'), inspector=e.querySelector('.growth-inspector');
      return {width:innerWidth,body:body.getBoundingClientRect().toJSON(),canvas:canvas.getBoundingClientRect().toJSON(),inspector:inspector.getBoundingClientRect().toJSON(),overflow:body.scrollWidth-body.clientWidth};
    }); measurements.push(m); assert.ok(m.overflow<=1,`horizontal overflow at ${width}: ${m.overflow}`); assert.ok(m.canvas.width>=200);
  }
  await page.setViewportSize({width:1600,height:1000});
  await switchTab('db-tab-promotion-tree');
  const classIds=await page.locator('.growth-node').evaluateAll(nodes=>nodes.map(n=>n.dataset.nodeId));
  if(classIds.length>=3) for(const to of classIds.slice(1,3)) { await clickNode(classIds[0]); await page.getByTestId('growth-connect').click(); await clickNode(to); }
  await page.getByTestId('growth-arrange').click(); await clickNode(classIds[0]);
  await page.screenshot({path:`${out}/promotion-1600.png`});
  await page.getByTestId('database-modal-close').click();
  await page.getByTestId('database-dirty-prompt').waitFor();
  await page.getByTestId('database-dirty-keep-editing').click();
  await switchTab('db-tab-skill-trees');
  assert.equal(await page.locator('.growth-node').count(),6);
  assert.equal(errors.length,0,errors.join('\n'));
  await writeFile(`${out}/editor-report.json`,JSON.stringify({errors,measurements,nodeIds:ids,checks:['create','rename','connect','reject-cycle','arrange','keyboard-move','drag','invest-preview','reset-preview','dirty-close-guard','tab-return','responsive']},null,2));
  console.log('Editor QA passed');
} catch(e) {
  console.log('FAILED',String(e));
  await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{});
  await writeFile(`${out}/failure.txt`,`${String(e)}\n${errors.join('\n')}\n${await page.locator('body').innerText({timeout:3000}).catch(()=>'(body unavailable)')}`);
  throw e;
} finally { await browser.close(); }
