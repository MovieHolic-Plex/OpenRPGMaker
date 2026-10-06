// Native editor UI fixture; no model requests or canonical content writes.
// OUT=<evidence directory> BASE=http://127.0.0.1:9911 node scripts/qa/editor-ux-animation-capture.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const label = process.env.LABEL ?? 'audit';
const out = process.env.OUT ?? 'verify-shots/editor-ux-fixes-round2-20261004/animation';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--disable-background-networking'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const watchdog = setTimeout(() => { console.error('QA wall timeout'); void browser.close(); },480000);
const errors = [];
let consoleErrors=0;page.on('console',m=>{if(m.type()==='error' && consoleErrors++<6) console.log('browser: '+m.text().slice(0,240));});
page.on('pageerror', e => {errors.push(e.message);console.log('pageerror: '+e.message);});
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

  const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),conditions:'Native Chromium preview fixture, normal motion, no host save/model calls',errors,checks:[],rows:[]};
  const result=await page.evaluate(async()=>{
    const assert=(v,m)=>{if(!v)throw Error(m)},preview=await import('/src/editor/panels/databaseAnimationPreview.ts'),life=await import('/src/editor/panels/databasePreviewLifecycle.ts');
    const c=document.createElement('canvas');c.width=64;c.height=64;const cx=c.getContext('2d');cx.fillStyle='#339966';cx.fillRect(0,0,64,64);const t=qa.store.getCurrent(),project={...t,assets:{...t.assets,uploaded:{...t.assets.uploaded,qa_sheet:{id:'qa_sheet',name:'QA animation',kind:'animation',dataUrl:c.toDataURL(),meta:{}}}}};
    const cell={visible:true,pattern:0,x:0,y:0,zoom:100,opacity:255,rotation:0,mirror:false,blend:'normal'},frames=[{cells:[cell]},{cells:[cell,{...cell,pattern:1,x:16}]},{cells:[{...cell,x:8}]}];const context={animation:{id:'qa_anim',name:'QA animation',resourceId:'qa_sheet'},sheet:{frameWidth:16,frameHeight:16,columns:4},frames,selectedFrameIndex:0,selectedFrame:frames[0],project,currentSelectedFrameCells:()=>frames[0].cells,duplicateLastFrame(){},updateSelectedFrameCells(){}};
    const Native=MutationObserver;let bodyObservers=0;window.MutationObserver=class extends Native{observe(target,...args){if(target===document.body)bodyObservers++;return super.observe(target,...args)}};
    const surface=document.createElement('div');surface.style.cssText='position:fixed;inset:100px 20px auto auto;width:360px;height:360px;z-index:9999;background:white';document.body.append(surface);life.setDatabasePreviewSurfaceActive(surface,false);const panel=preview.renderAnimationStagePanel(context);surface.append(panel);await new Promise(r=>setTimeout(r,500));assert(panel.querySelector('[data-testid=db-animation-play]').getAttribute('aria-pressed')==='false','Parked actual animation autoplays');life.setDatabasePreviewSurfaceActive(surface,true);await new Promise(r=>setTimeout(r,500));const layer=panel.querySelector('.db-animation-stage-cells'),nodes=[...layer.children];assert(nodes.length===2&&panel.querySelector('[data-testid=db-animation-play]').getAttribute('aria-pressed')==='true','Animation did not start/pool two cells');let mutations=0;const observer=new Native(rs=>{mutations+=rs.filter(r=>r.type==='childList').length});observer.observe(layer,{childList:true});await new Promise(r=>setTimeout(r,1000));assert(nodes.every((n,i)=>layer.children[i]===n)&&mutations===0,'Animation replaces cell DOM per frame');panel.querySelector('[data-testid=db-animation-play]').click();life.setDatabasePreviewSurfaceActive(surface,false);life.setDatabasePreviewSurfaceActive(surface,true);await new Promise(r=>setTimeout(r,250));assert(panel.querySelector('[data-testid=db-animation-play]').getAttribute('aria-pressed')==='false','Hide/reveal erased Stop intent');assert(bodyObservers===0,'Animation observed unrelated body mutations');observer.disconnect();life.disposeDatabasePreviewsIn(surface);surface.remove();window.MutationObserver=Native;return {poolNodes:nodes.length,childListMutations:mutations,bodyObservers,parkedStatic:true,userStopRetained:true};
  });report.rows.push(result);report.checks.push('Actual battle preview starts only on active surface, reuses high-water cell DOM, has no body observer, and preserves user Stop on hide/reveal');report.productionSources=Object.fromEntries(['src/editor/panels/databaseAnimationPreview.ts','src/editor/panels/databasePreviewLifecycle.ts'].map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.error(e);throw e;}finally{clearTimeout(watchdog);await browser.close();}
