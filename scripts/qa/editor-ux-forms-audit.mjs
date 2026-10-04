// Native editor UI fixture; no model requests or canonical content writes.
// LABEL=before|after BASE=http://127.0.0.1:9911 node scripts/qa/right-region-drag-perf.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const label = 'audit';
const out = 'verify-shots/editor-ux-audit-20261004/forms';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--disable-background-networking'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const watchdog = setTimeout(() => { console.error('QA wall timeout'); void browser.close(); },480000);
const errors = [];
let consoleErrors=0;page.on('console',m=>{if(m.type()==='error' && consoleErrors++<6) console.log('browser: '+m.text().slice(0,240));});
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(fixture => {
  window.__OPRN_E2E_PROJECT__ = fixture;
  localStorage.setItem('oprn:editor-ui-mode', 'expert');
  for (const key of ['oprn:editor-welcome-dismissed','oprn:standard-welcome-seen','oprn:coachmarks-basic-v1','oprn:hint-selection-chips-v1']) localStorage.setItem(key, '1');
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/__oprn/shared-tile-references')) return Promise.resolve(new Response(JSON.stringify({revision:'qa',entries:[]})));
    if (url.includes('/__oprn/shared-content')) return Promise.resolve(new Response(JSON.stringify({revision:'qa',libraries:{}})));
    if ((init?.method ?? 'GET').toUpperCase() === 'POST' && /chat\/completions|\/responses|\/api\/ai/.test(url)) throw Error('No live model in UI QA');
    return original(input, init);
  };
}, JSON.parse(readFileSync('test/fixtures/projects/event-pages-v3.json','utf8')));
const assert = (value, message) => { if (!value) throw Error(message); };
try {
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:9911') + '/?blankProject=1', {waitUntil:'domcontentloaded'});
  await page.getByTestId('ai-input').waitFor({timeout:90000});
  await page.waitForFunction(() => !!window.__oprnEditCamera?.(), null, {timeout:45000});
  console.log(label + ' editor ready');
  await page.evaluate(async () => {
    const {store} = await import('/src/project/store.ts');
    const {editorState} = await import('/src/editor/editorState.ts');
    const {normalizeDatabaseRecords} = await import('/src/project/databaseRecordModel.ts');
    const {requestEditorCameraFocus} = await import('/src/editor/editorCameraFocus.ts');
    const current = store.getCurrent(), mapId = current.startMapId, original = current.maps[mapId];
    const map = {...original,width:32,height:24,lowerTiles:Array(768).fill(16),upperTiles:Array(768).fill(-1),events:[]};
    store.replace({...current,maps:{[mapId]:map},database:normalizeDatabaseRecords(current.database),tilesets:{[map.tilesetId]:{...current.tilesets[map.tilesetId],referenceDocuments:[]}},assets:window.__OPRN_E2E_PROJECT__.assets}, {change:{origin:'system',label:'right-drag UI QA fixture'}});
    editorState.set({currentMapId:mapId,zoom:1,selection:null,tool:'paint',layer:'lower',selectedTile:23,autoConnectMode:false,clusterAssistMode:false});
    requestEditorCameraFocus({mapId,tileX:16,tileY:12,immediate:true});
    const qa = window.qa = {editorState,store,mapId,measuring:false,sets:[],moves:[],longTasks:[],mutations:0,selectionChanges:0};
    const originalSet = editorState.set.bind(editorState);
    editorState.set = (...args) => { const t = performance.now(); const value = originalSet(...args); if(qa.measuring) qa.sets.push(performance.now()-t); return value; };
    let previous = editorState.get().selection;
    editorState.subscribe(state => { if(qa.measuring && state.selection !== previous) qa.selectionChanges++; previous=state.selection; });
    new MutationObserver(records => {if(qa.measuring) qa.mutations += records.length;}).observe(document.body,{childList:true,subtree:true});
    new PerformanceObserver(list => { if(qa.measuring) for(const entry of list.getEntries()) qa.longTasks.push(entry.duration); }).observe({type:'longtask'});
    document.addEventListener('pointermove', e => { if(!qa.measuring || !(e.buttons & 2)) return; const t=performance.now(); requestAnimationFrame(() => qa.moves.push(performance.now()-t)); },true);
  });
  await page.waitForTimeout(1800);
  const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),viewport:'1440×900',conditions:'native database and event modal; disposable fixture; no model/host saves; inputToTwoRafMs includes automation and two rAF waits',errors,rows:[]};
  const frame2=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.evaluate(()=>{
    qa.template=qa.store.getCurrent();qa.addedRows=0;qa.removedRows=0;
    const obs=new MutationObserver(records=>{if(!qa.measuring)return;for(const r of records){if(r.target instanceof Element&&r.target.matches('[data-testid=db-catalog-rows]')) {qa.addedRows+=r.addedNodes.length;qa.removedRows+=r.removedNodes.length;}}});
    obs.observe(document.body,{childList:true,subtree:true});
  });
  async function measure(name, action) {
    await page.evaluate(()=>{qa.measuring=true;qa.longTasks=[];qa.addedRows=0;qa.removedRows=0;});
    const start=Date.now();await action();await frame2();const inputToTwoRafMs=Date.now()-start;await page.waitForTimeout(120);
    const result=await page.evaluate(()=>{qa.measuring=false;return {longTasks:qa.longTasks,addedRows:qa.addedRows,removedRows:qa.removedRows,catalogRows:document.querySelector('[data-testid=db-catalog-rows]')?.children.length??0,focused:document.activeElement?.getAttribute('data-testid')};});
    const row={name,inputToTwoRafMs,...result};report.rows.push(row);writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify(row));
  }
  for(const count of [25,250,1000]) {
    await page.evaluate(count=>{
      const t=qa.template,original=window.__OPRN_E2E_PROJECT__.database.items[0];
      const items=Array.from({length:count},(_,i)=>({...original,id:i===0?original.id:'item_audit_'+i,name:'Item '+String(i).padStart(4,'0'),description:'description'}));
      qa.store.replace({...t,database:{...t.database,items}},{change:{origin:'system',label:'database UX audit fixture'}});
    },count);
    await page.getByTestId('toolbar-database').click();
    const group=page.getByTestId('db-tab-group-party');
    if(await group.count()) await group.click();
    await page.getByTestId('db-tab-items').click();
    await page.getByTestId('db-field-item-description').waitFor({state:'visible',timeout:20000});
    await page.getByTestId('db-catalog-filter-items').click();
    await page.getByTestId('db-view-toggle-list').click();
    const input=page.getByTestId('db-field-item-description');await input.click();await input.press('End');await page.waitForTimeout(300);
    for(let i=0;i<3;i++) await measure(`items:${count}:description:${i}`,()=>input.pressSequentially('a'));
    const value=await page.evaluate(()=>qa.store.getCurrent().database.items[0].description);
    assert(value==='descriptionaaa','Native description edit did not apply: '+value);
    await measure(`items:${count}:search`,()=>page.getByTestId('db-catalog-search').fill('Item 000'));
    await page.screenshot({path:`${out}/items-${count}.png`});
    await page.getByTestId('database-modal-close').click();await page.waitForTimeout(250);
  }
  for(const count of [100,1000]) {
    await page.evaluate(count=>{
      const t=qa.template,m=t.maps[qa.mapId],original=window.__OPRN_E2E_PROJECT__.maps[qa.mapId].events[0];
      const page={...original.pages[0],commands:Array.from({length:count},(_,i)=>({kind:'text',body:'Command '+i}))};
      const event={...original,pages:[page],commands:page.commands};
      qa.store.replace({...t,maps:{[qa.mapId]:{...m,events:[event]}}},{change:{origin:'system',label:'event command UI audit fixture'}});
      qa.editorState.set({tool:'event',layer:'event',selectedEventId:original.id});
    },count);
    await page.waitForTimeout(300);
    await measure(`event:${count}:open`,()=>page.evaluate(async()=>{const {openEventEditorModal}=await import('/src/editor/panels/eventEditor/modal.ts');openEventEditorModal(qa.mapId,qa.store.getCurrent().maps[qa.mapId].events[0].id);}));
    await page.getByTestId('event-editor-modal').waitFor({state:'visible',timeout:20000});
    const dom=await page.evaluate(()=>({commands:document.querySelectorAll('[data-command-path]').length,totalNodes:document.querySelectorAll('*').length,count:document.querySelector('[data-testid=event-editor-command-count]')?.textContent}));
    report.rows.at(-1).dom=dom;console.log(JSON.stringify({eventCount:count,dom}));
    await page.screenshot({path:`${out}/events-${count}.png`});
    await page.keyboard.press('Escape');await page.waitForTimeout(200);
  }
  writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));console.log('Forms audit complete; errors='+errors.length);
} catch(error) {
  await page.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{});
  console.error((await page.locator('body').innerText({timeout:1000}).catch(()=>'')).slice(0,2500));throw error;
} finally {clearTimeout(watchdog);await browser.close();}
