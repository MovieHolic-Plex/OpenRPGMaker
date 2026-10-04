// Native editor UI fixture; no model requests or canonical content writes.
// LABEL=before|after BASE=http://127.0.0.1:9911 node scripts/qa/right-region-drag-perf.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const label = process.env.LABEL ?? 'run';
const out = 'verify-shots/right-region-drag';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--disable-background-networking'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const watchdog = setTimeout(() => { console.error('QA wall timeout'); void browser.close(); },240000);
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
  const points = await page.evaluate(() => [window.__oprnEditWorldToClient(2*16+8,2*16+8),window.__oprnEditWorldToClient(27*16+8,18*16+8)]);
  console.log(JSON.stringify({points}));
  const drag = async (record = false) => {
    const [a,b] = points;
    await page.mouse.move(a.x,a.y); await page.mouse.down({button:'right'});
    for(let i=1;i<=40;i++) {
      await page.mouse.move(a.x+(b.x-a.x)*i/40,a.y+(b.y-a.y)*i/40);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
      if(record && i%5===0) await page.screenshot({path:`${out}/${label}-${String(i).padStart(2,'0')}.png`});
    }
    await page.mouse.up({button:'right'});
    await page.getByTestId('selection-chip-prompt').waitFor({state:'visible',timeout:15000});
    await page.waitForTimeout(100);
    const state = await page.evaluate(() => ({selection:qa.editorState.get().selection, badge:document.querySelector('[data-testid=region-size-badge]')?.textContent,scope:document.querySelector('[data-testid=ai-context-chips]')?.textContent}));
    assert(state.selection?.x===2 && state.selection?.y===2 && state.selection?.width===26 && state.selection?.height===17, 'Wrong native drag endpoint '+JSON.stringify(state));
    assert(state.badge==='26×17', 'Wrong size badge');
    return state;
  };
  await drag();
  const cdpTrace = await page.context().newCDPSession(page);
  const traceEvents=[];
  cdpTrace.on('Tracing.dataCollected', ({value}) => traceEvents.push(...value));
  if(process.env.TRACE==='1') await cdpTrace.send('Tracing.start',{categories:'devtools.timeline',options:'record-as-much-as-possible'});
  const runs=[];
  for(let i=0;i<3;i++) {
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await page.evaluate(() => {qa.sets=[];qa.moves=[];qa.longTasks=[];qa.mutations=0;qa.selectionChanges=0;qa.measuring=true;});
    const start=Date.now(); const state=await drag(); const wallMs=Date.now()-start;
    runs.push(await page.evaluate(({wallMs,state}) => {qa.measuring=false;return {wallMs,state,sets:qa.sets,moves:qa.moves,longTasks:qa.longTasks,mutations:qa.mutations,selectionChanges:qa.selectionChanges};},{wallMs,state}));
    console.log(label+' measured '+(i+1));
  }
  let traceSummary;
  if(process.env.TRACE==='1') {
    const complete=new Promise(resolve=>cdpTrace.once('Tracing.tracingComplete',resolve));
    await cdpTrace.send('Tracing.end');await complete;
    writeFileSync(`/tmp/right-drag-${label}.trace.json`,JSON.stringify({traceEvents}));
    const main=traceEvents.find(e=>e.name==='thread_name'&&e.args.name==='CrRendererMain');
    const costs={};for(const e of traceEvents) if(e.pid===main?.pid&&e.tid===main?.tid&&e.ph==='X'&&['UpdateLayoutTree','Layout','Paint','PrePaint'].includes(e.name)) costs[e.name]=(costs[e.name]??0)+(e.dur??0)/1000;
    traceSummary={mainThreadMs:costs};
    const events=traceEvents.filter(e=>e.pid===main?.pid&&e.tid===main?.tid&&e.ph==='X'&&['UpdateLayoutTree','Layout','PrePaint','Paint'].includes(e.name)).map(e=>({name:e.name,durationMs:(e.dur??0)/1000}));
    writeFileSync(`${out}/${label}-trace-costs.json`,JSON.stringify({source:'Chrome DevTools Protocol devtools.timeline; CrRendererMain; three drag runs plus their Escape/reset pauses',events},null,2));
  }
  // CPU diagnosis separately from timed runs. Save profiles outside Git evidence.
  if(process.env.PROFILE==='1') {
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await drag();
    const {profile}=await cdp.send('Profiler.stop');
    writeFileSync(`/tmp/right-drag-${label}.cpuprofile`,JSON.stringify(profile));
  }
  await page.keyboard.press('Escape');await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/${label}-00.png`});
  const final = await drag(true);await page.screenshot({path:`${out}/${label}-final.png`});
  const checks=[];
  const check=(name,passed,detail)=>{checks.push({name,passed,detail});assert(passed,name+' '+JSON.stringify(detail));};
  const tile = (x,y) => page.evaluate(([x,y])=>window.__oprnEditWorldToClient(x*16+8,y*16+8),[x,y]);
  const regionDrag=async (from,to) => {const a=await tile(...from),b=await tile(...to);await page.mouse.move(a.x,a.y);await page.mouse.down({button:'right'});await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up({button:'right'});await page.waitForTimeout(150);return await page.evaluate(()=>qa.editorState.get().selection);};
  if(label==='after') {
    await page.keyboard.press('Escape');await page.waitForTimeout(200);
    const a=await tile(2,2),b=await tile(5,4);
    await page.mouse.move(a.x,a.y);await page.mouse.down({button:'right'});await page.mouse.move(b.x,b.y,{steps:8});await page.waitForTimeout(200);
    const during=await page.evaluate(()=>({selection:qa.editorState.get().selection,badge:document.querySelector('[data-testid=region-size-badge]')?.textContent,bar:!!document.querySelector('[data-testid=selection-chip-prompt]')}));
    check('live size and outline preview without publishing or opening action bar',during.selection===null&&during.badge==='4×3'&&!during.bar,during);
    await page.mouse.up({button:'right'});await page.waitForTimeout(200);
    check('release publishes preview and opens toolbar',await page.getByTestId('selection-chip-prompt').isVisible());
    const committed=await page.evaluate(()=>qa.editorState.get().selection);
    const c=await tile(10,10),d=await tile(13,12);
    await page.mouse.move(c.x,c.y);await page.mouse.down({button:'right'});await page.mouse.move(d.x,d.y,{steps:8});await page.waitForTimeout(100);
    await page.keyboard.press('Escape');await page.mouse.up({button:'right'});await page.waitForTimeout(200);
    check('Escape cancels preview and later release keeps previous selection',JSON.stringify(await page.evaluate(()=>qa.editorState.get().selection))===JSON.stringify(committed));
    await page.keyboard.press('Escape');await page.waitForTimeout(200);
    const reverse=await regionDrag([10,10],[5,6]);check('reverse drag normalizes bounds',reverse?.x===5&&reverse?.y===6&&reverse?.width===6&&reverse?.height===5,reverse);
    await page.keyboard.press('Escape');await page.waitForTimeout(200);
    const clipped=await regionDrag([2,2],[35,25]);check('map edge clips region',clipped?.x===2&&clipped?.y===2&&clipped?.width===30&&clipped?.height===22,clipped);
    await page.keyboard.press('Escape');await page.waitForTimeout(200);
    const pick=await tile(4,4);await page.mouse.click(pick.x,pick.y,{button:'right'});await page.waitForTimeout(150);
    const picked=await page.evaluate(()=>({tile:qa.editorState.get().selectedTile,selection:qa.editorState.get().selection,badge:!!document.querySelector('[data-testid=region-size-badge]')}));
    check('right click eyedropper leaves no preview',picked.tile===16&&picked.selection===null&&!picked.badge,picked);
    await page.evaluate(()=>qa.editorState.set({selectedTile:23}));
    const paste=await page.evaluate(()=>JSON.stringify(qa.store.getCurrent().maps[qa.mapId].lowerTiles));
    await page.mouse.click(pick.x,pick.y);await page.waitForTimeout(150);
    check('left painting remains available',await page.evaluate(old=>JSON.stringify(qa.store.getCurrent().maps[qa.mapId].lowerTiles)!==old,paste));
  }
  const percentile=(values,p) => {const xs=[...values].sort((a,b)=>a-b);return xs[Math.min(xs.length-1,Math.floor(xs.length*p))]??0;};
  const productionSources=Object.fromEntries(['src/editor/EditScene.ts','src/editor/editSceneRender.ts'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
  const productionChanges=!!execFileSync('git',['diff','HEAD','--','src/editor/EditScene.ts','src/editor/editSceneRender.ts'],{encoding:'utf8'}).trim();
  const report={label,productionSources,productionChanges,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),conditions:{viewport:'1440×900',map:'32×24',zoom:1,steps:40,repetitions:3,cpuThrottling:1,screenshotRunSeparate:true,tracing:process.env.TRACE==='1',measurement:'browser capture pointermove to next rAF; includes Phaser/update/layout until callback, not pixel presentation'},errors,final,checks,runs,traceSummary,summary:{frameMedianMs:percentile(runs.flatMap(r=>r.moves),.5),frameP95Ms:percentile(runs.flatMap(r=>r.moves),.95),setMedianMs:percentile(runs.flatMap(r=>r.sets),.5),setP95Ms:percentile(runs.flatMap(r=>r.sets),.95),wallMedianMs:percentile(runs.map(r=>r.wallMs),.5),childListMutationsMedian:percentile(runs.map(r=>r.mutations),.5),selectionChangesMedian:percentile(runs.map(r=>r.selectionChanges),.5),longTaskCount:runs.flatMap(r=>r.longTasks).length,longTaskMaxMs:Math.max(0,...runs.flatMap(r=>r.longTasks))}};
  assert(!errors.length,'Uncaught browser errors: '+errors.join(';'));
  writeFileSync(`${out}/${label}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
} catch(error) {await page.screenshot({path:`/tmp/right-drag-${label}-failure.png`,timeout:5000}).catch(()=>{});console.log(await page.locator('body').innerText({timeout:1000}).catch(()=>''));throw error;} finally {clearTimeout(watchdog);await browser.close();}
