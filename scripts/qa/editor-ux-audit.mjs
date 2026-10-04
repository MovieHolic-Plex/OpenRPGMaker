// Native editor UI fixture; no model requests or canonical content writes.
// OUT=<evidence directory> BASE=http://127.0.0.1:9911 node scripts/qa/editor-ux-audit.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const label = process.env.LABEL ?? 'audit';
const out = process.env.OUT ?? 'verify-shots/editor-ux-current';
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
  const cdp = await page.context().newCDPSession(page), events=[];
  cdp.on('Tracing.dataCollected',({value})=>events.push(...value));
  await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing',options:'record-as-much-as-possible'});
  await page.evaluate(()=>{
    qa.tag=null;qa.mutationCalls=[];qa.changes=[];
    qa.store.subscribe((_project,change)=>{if(qa.tag)qa.changes.push({tag:qa.tag,scope:change.scope,cells:change.cells?.length??0});});
    const original=qa.store.updateMapTiles.bind(qa.store);
    qa.store.updateMapTiles=(...args)=>{const t=performance.now();const result=original(...args);if(qa.tag)qa.mutationCalls.push({tag:qa.tag,ms:performance.now()-t});return result;};
    qa.template=qa.store.getCurrent();
  });
  const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),viewport:'1440×900',conditions:'native editor; UI-only synthetic fixture; no model or canonical host; no CPU throttle; one browser; inputToTwoRafMs includes Playwright roundtrips and two animation frame waits, not pixel latency',errors,rows:[],checks:[]};
  const frame2=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  async function measure(name, action) {
    await page.evaluate(name=>{qa.tag=name;qa.longTasks=[];qa.measuring=true;performance.mark('ux-start:'+name);},name);
    const t=Date.now();await action();await frame2();const inputToTwoRafMs=Date.now()-t;
    await page.waitForTimeout(120);
    const data=await page.evaluate(name=>{performance.mark('ux-end:'+name);qa.measuring=false;qa.tag=null;return {calls:qa.mutationCalls.filter(c=>c.tag===name),changes:qa.changes.filter(c=>c.tag===name),longTasks:qa.longTasks};},name);
    const row={name,inputToTwoRafMs,...data};report.rows.push(row);
    writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify(row));
  }
  async function resetView() {
    await page.evaluate(async()=>{qa.editorState.set({selection:null,zoom:1,tool:'paint',layer:'lower',selectedTile:23});const {requestEditorCameraFocus}=await import('/src/editor/editorCameraFocus.ts');requestEditorCameraFocus({mapId:qa.mapId,tileX:16,tileY:12,immediate:true});});
    await frame2();
  }
  async function client(x,y){return page.evaluate(([x,y])=>window.__oprnEditWorldToClient(x*16+8,y*16+8),[x,y]);}
  for(const size of [32,128,512]) {
    await page.evaluate(size=>{
      const t=qa.template,m=t.maps[qa.mapId],height=size===32?24:size;
      qa.store.replace({...t,maps:{[qa.mapId]:{...m,width:size,height,lowerTiles:Array(size*height).fill(16),upperTiles:Array(size*height).fill(-1),events:[]}}},{change:{origin:'system',label:'UX audit code fixture'}});
    },size);
    await resetView();await page.waitForTimeout(1800);
    for(let i=0;i<3;i++) {
      const point=await client(4+i,4);
      await measure(`${size}:paint:${i}`,()=>page.mouse.click(point.x,point.y));
      const actual=await page.evaluate(({size,i})=>qa.store.getCurrent().maps[qa.mapId].lowerTiles[4*size+4+i],{size,i});
      assert(actual===23,`Native paint did not apply: ${size} ${i} ${actual}`);
    }
    for(let i=0;i<3;i++) {
      await measure(`${size}:undo:${i}`,()=>page.keyboard.press('Control+z'));
      const actual=await page.evaluate(({size,i})=>qa.store.getCurrent().maps[qa.mapId].lowerTiles[4*size+6-i],{size,i});
      assert(actual===16,`Native undo did not restore: ${size} ${i} ${actual}`);
    }
    for(let i=0;i<3;i++) {
      await page.keyboard.press('Control+y');await frame2();
      const actual=await page.evaluate(({size,i})=>qa.store.getCurrent().maps[qa.mapId].lowerTiles[4*size+4+i],{size,i});
      assert(actual===23,`Native redo did not restore: ${size} ${i} ${actual}`);
    }
    for(let i=0;i<3;i++) {await page.keyboard.press('Control+z');await frame2();}
    await resetView();
    for(let i=0;i<3;i++) {
      await measure(`${size}:layer:${i}`,()=>page.getByTestId(i%2?'layer-lower':'layer-upper').click());
    }
    for(let i=0;i<3;i++) await measure(`${size}:zoom:${i}`,()=>page.getByTestId(i%2?'editor-zoom-prev':'editor-zoom-next').click());
    await resetView();
    const a=await client(3,8),b=await client(21,8);
    await measure(`${size}:paint-drag`,async()=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:30});await page.mouse.up();});
    await resetView();
    await measure(`${size}:pan`,async()=>{await page.mouse.move(700,480);await page.mouse.down({button:'middle'});await page.mouse.move(780,520,{steps:20});await page.mouse.up({button:'middle'});});
    report.checks.push({mapSize:size,nativePaintVerified:true,nativeUndoRedoVerified:true});
    await page.screenshot({path:`${out}/map-${size}.png`});
  }
  await resetView();
  // Cold open the native database modal. No canonical database edit.
  await measure('database:cold-open',()=>page.getByTestId('toolbar-database').click());
  await page.screenshot({path:`${out}/database-open.png`});
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  await measure('database:warm-open',()=>page.getByTestId('toolbar-database').click());
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  await measure('resources:cold-open',()=>page.getByTestId('toolbar-resource-manager').click());
  await page.screenshot({path:`${out}/resources-open.png`});
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  report.checks.push(...await page.evaluate(async()=>{
    const history=await import('/src/editor/mapEditHistory.ts');
    const {clearEventDraftVault}=await import('/src/project/eventDraftVault.ts');
    const {createEventDraft}=await import('/src/editor/eventDraftActions.ts');
    const {setEventPageTextCommand}=await import('/src/editor/eventPages.ts');
    const checks=[],assert=(value,message)=>{if(!value)throw Error(message);};
    const id=qa.mapId,t=qa.template,m=t.maps[id];
    const reset=()=>{clearEventDraftVault();qa.store.replaceProject({...t,maps:{[id]:{...m,lowerTiles:m.lowerTiles.slice(),upperTiles:m.upperTiles.slice(),events:[]},qa_other:{...m,id:'qa_other',lowerTiles:m.lowerTiles.slice(),upperTiles:m.upperTiles.slice(),events:[]}}});history.resetMapEditHistory();};
    let lastChange;
    const unsubscribe=qa.store.subscribe((_p,c)=>{lastChange=c;});
    try {
      reset();
      const unrelated=qa.store.getCurrent().maps.qa_other;
      history.recordMapEditIfChanged(id,()=>qa.store.updateMapTiles(id,map=>{map.lowerTiles[0]=23;map.upperTiles[1]=24;}));
      assert(history.undoMapEdit(),'two-layer undo rejected');
      assert(qa.store.getCurrent().maps[id].lowerTiles[0]===16&&qa.store.getCurrent().maps[id].upperTiles[1]===-1,'two-layer undo values');
      assert(lastChange.scope==='map'&&lastChange.cells.length===2,'two-layer undo did not use exact cells');
      assert(qa.store.getCurrent().maps.qa_other===unrelated,'unrelated map was copied');
      assert(history.redoMapEdit()&&qa.store.getCurrent().maps[id].upperTiles[1]===24,'two-layer redo');
      checks.push({name:'dense layers and unrelated map identity',passed:true});

      reset();
      history.recordMapEditIfChanged(id,()=>qa.store.updateMap(id,map=>{map.lowerOverlayTiles=Array(768).fill(-1);map.lowerOverlayTiles[2]=23;map.shadowBits=Array(768).fill(0);map.shadowBits[3]=5;map.lowerTileStacks={4:[16,23]};}));
      assert(history.undoMapEdit()&&!qa.store.getCurrent().maps[id].lowerOverlayTiles&&lastChange.scope==='project','extra layers fallback undo');
      assert(history.redoMapEdit()&&qa.store.getCurrent().maps[id].shadowBits[3]===5&&qa.store.getCurrent().maps[id].lowerTileStacks[4][1]===23,'extra layers redo');
      checks.push({name:'overlay shadow and stack restoration fallback',passed:true});

      reset();
      history.recordMapEditIfChanged(id,()=>qa.store.updateMap(id,map=>{map.width=16;map.height=16;map.lowerTiles=Array(256).fill(23);map.upperTiles=Array(256).fill(-1);}));
      assert(history.undoMapEdit()&&qa.store.getCurrent().maps[id].width===32&&lastChange.scope==='project','resize undo');
      assert(history.redoMapEdit()&&qa.store.getCurrent().maps[id].lowerTiles.length===256,'resize redo');
      checks.push({name:'map resize restoration fallback',passed:true});

      reset();
      const original=structuredClone(window.__OPRN_E2E_PROJECT__.maps[id].events[0]);
      qa.store.updateMap(id,map=>{map.events=[original];});history.resetMapEditHistory();
      const before=qa.store.getCurrent().maps[id].events[0].name;
      history.recordMapEditIfChanged(id,()=>qa.store.updateMap(id,map=>{map.events[0].name='QA event rename';}));
      assert(history.undoMapEdit()&&qa.store.getCurrent().maps[id].events[0].name===before&&lastChange.scope==='project','event undo');
      assert(history.redoMapEdit()&&qa.store.getCurrent().maps[id].events[0].name==='QA event rename','event redo');
      checks.push({name:'event metadata restoration fallback',passed:true});

      reset();
      const eventId=createEventDraft(id,2,2),pageId=qa.store.getCurrent().maps[id].events.find(e=>e.id===eventId).pages[0].id;
      setEventPageTextCommand(id,eventId,pageId,undefined,'Uncommitted QA text');history.resetMapEditHistory();
      history.recordMapEditIfChanged(id,()=>qa.store.updateMapTiles(id,map=>{map.lowerTiles[0]=23;}));
      for(const restore of [history.undoMapEdit,history.redoMapEdit,history.undoMapEdit]) {
        assert(restore(),'draft paint history rejected');
        const event=qa.store.getCurrent().maps[id].events.find(e=>e.id===eventId);
        assert(event?.draft?.kind==='new'&&event.pages[0].commands[0].body==='Uncommitted QA text','working draft lost during restore');
      }
      checks.push({name:'new event working draft survives undo redo undo',passed:true});

      // Simulate an event missing from live state but still kept in the draft vault.
      qa.store.updateMap(id,map=>{map.events=[];});history.resetMapEditHistory();
      history.recordMapEditIfChanged(id,()=>qa.store.updateMapTiles(id,map=>{map.lowerTiles[0]=23;}));
      assert(history.undoMapEdit()&&lastChange.scope==='project','vault-only undo emitted tile-only change');
      assert(qa.store.getCurrent().maps[id].events.some(e=>e.id===eventId&&e.draft?.kind==='new'),'vault-only draft not restored');
      checks.push({name:'vault-only draft restores with full project notification',passed:true});

      reset();
      qa.store.updateMap(id,map=>{map.terrainDesign={lockedCells:[0]};});history.resetMapEditHistory();
      history.recordMapEditIfChanged(id,()=>qa.store.updateMap(id,map=>{map.lowerTiles[0]=23;}));
      assert(history.undoMapEdit()&&qa.store.getCurrent().maps[id].lowerTiles[0]===16&&lastChange.scope==='project','locked terrain undo was filtered');
      assert(history.redoMapEdit()&&qa.store.getCurrent().maps[id].lowerTiles[0]===23,'locked terrain redo was filtered');
      checks.push({name:'locked terrain restoration bypasses painting lock enforcement',passed:true});

      reset();
      history.recordProjectSnapshot('QA title');qa.store.update(p=>{p.meta.title='QA changed title';},{scope:'project'});
      assert(history.undoMapEdit()&&qa.store.getCurrent().meta.title===t.meta.title,'project snapshot undo');
      assert(history.redoMapEdit()&&qa.store.getCurrent().meta.title==='QA changed title','project snapshot redo');
      checks.push({name:'project snapshot restoration',passed:true});
    } finally {unsubscribe();reset();}
    return checks;
  }));
  const completed=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');await completed;
  const main=events.find(e=>e.name==='thread_name'&&e.args.name==='CrRendererMain');
  for(const row of report.rows) {
    const start=events.find(e=>e.name==='ux-start:'+row.name),end=events.find(e=>e.name==='ux-end:'+row.name);
    row.trace={};
    if(!start||!end){row.traceMissingMarks=true;continue;}
    for(const e of events)if(e.pid===main?.pid&&e.tid===main?.tid&&e.ph==='X'&&e.ts>=start.ts&&e.ts<end.ts&&['UpdateLayoutTree','Layout','Paint','PrePaint'].includes(e.name))row.trace[e.name]=(row.trace[e.name]??0)+(e.dur??0)/1000;
  }
  report.productionSources=Object.fromEntries(['src/editor/mapEditHistory.ts','src/project/eventDraftVault.ts'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
  writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));
  const compact=events.filter(e=>e.pid===main?.pid&&e.tid===main?.tid&&(e.name.startsWith('ux-')||['UpdateLayoutTree','Layout','Paint','PrePaint'].includes(e.name))).map(e=>({name:e.name,ts:e.ts,durationMs:(e.dur??0)/1000}));
  writeFileSync(out+'/trace-costs.json','[\n'+compact.map(entry=>'  '+JSON.stringify(entry)).join(',\n')+'\n]\n');
  console.log('Audit complete; native checks='+report.checks.length+' pageerrors='+errors.length);
} catch(error) {
  await page.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{});
  console.error(await page.locator('body').innerText({timeout:1000}).catch(()=>''));throw error;
} finally {clearTimeout(watchdog);await browser.close();}

