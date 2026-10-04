// Native editor UI fixture; no model requests or canonical content writes.
// OUT=<evidence directory> BASE=http://127.0.0.1:9911 node scripts/qa/editor-ux-forms-audit.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const label = process.env.LABEL ?? 'audit';
const out = process.env.OUT ?? 'verify-shots/editor-ux-audit-round2-20261004';
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
  const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),conditions:'Native editor, 1440x900, reduced motion, synthetic fixtures, no host saves/model calls; wallMs includes automation and a fixed 250ms settling period; longTasks are browser tasks >=50ms. Shared host load is uncontrolled.',errors,rows:[]};
  await page.evaluate(()=>{qa.template=qa.store.getCurrent();qa.removed=0;qa.added=0;qa.treeReplacements=0;new MutationObserver(rs=>{if(!qa.measuring)return;for(const r of rs){qa.removed+=r.removedNodes.length;qa.added+=r.addedNodes.length;if(r.target instanceof Element&&r.target.matches('[data-testid=map-sidebar-list]'))qa.treeReplacements++;}}).observe(document.body,{childList:true,subtree:true});});
  const frame2=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  async function measure(name,action){
    await page.evaluate(()=>{qa.measuring=true;qa.longTasks=[];qa.added=0;qa.removed=0;qa.treeReplacements=0;});
    const t=Date.now();await action();await page.waitForTimeout(250);await frame2();const wallMs=Date.now()-t;
    const detail=await page.evaluate(()=>{qa.measuring=false;const life=document.querySelector('[data-testid=db-life-collections-detail-pane]');return{longTasks:qa.longTasks,addedNodes:qa.added,removedNodes:qa.removed,treeReplacements:qa.treeReplacements,totalNodes:document.querySelectorAll('*').length,lifeOptions:life?.querySelectorAll('option').length??0,hiddenFishPanels:life?.querySelectorAll('[data-testid^=db-life-collections-panel-fish-][hidden]').length??0,focused:document.activeElement?.getAttribute('data-testid'),currentMapId:qa.editorState.get().currentMapId};});
    const r={name,wallMs,...detail};report.rows.push(r);writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify(r));
  }
  for(const [fishCount,itemCount] of (process.env.MODE?[]:[[10,100],[50,500],[100,1000]])){
    await page.evaluate(({fishCount,itemCount})=>{const t=qa.template,original=t.database.items[0];const items=Array.from({length:itemCount},(_,i)=>({...original,id:'ux_item_'+i,name:'Item '+i}));const fishSpecies=Array.from({length:fishCount},(_,i)=>({id:'ux_fish_'+i,name:'Fish '+i,itemId:items[i%itemCount].id,skillXp:1}));qa.store.replace({...t,database:{...t.database,items,fishSpecies}},{change:{origin:'system',label:'round2 UI fixture'}});},{fishCount,itemCount});
    await page.getByTestId('toolbar-database').click();
    await page.getByTestId('db-group-strip-life').click();
    await measure(`life:${fishCount}:${itemCount}:open`,()=>page.getByTestId('db-tab-life-collections').click());
    await page.getByTestId('db-life-collections-search').waitFor({state:'visible'});
    for(let i=0;i<3;i++){
      await measure(`life:${fishCount}:${itemCount}:zero-match:${i}`,()=>page.getByTestId('db-life-collections-search').fill('zz_missing_'+i));
      if(await page.getByTestId('db-life-collections-search').inputValue()!=='zz_missing_'+i)throw Error('Search state lost');
    }
    await page.screenshot({path:out+`/life-${fishCount}-${itemCount}.png`});
    await page.getByTestId('db-life-collections-search').fill('');await page.waitForTimeout(300);
    await page.getByTestId('database-modal-close').click();await page.waitForTimeout(200);
  }
  if(process.env.MODE==='extras'){
    for(const count of [10,100,300]){
      await page.evaluate(count=>{const t=qa.template,m=t.maps[qa.mapId],maps={},nodes=[];for(let i=0;i<count;i++){const id=i===0?qa.mapId:'ux_map_'+i;maps[id]={...m,id,name:'Map '+i,lowerTiles:[...m.lowerTiles],upperTiles:[...m.upperTiles]};nodes.push({mapId:id,children:[]});}qa.store.replace({...t,maps,mapTree:{mapId:qa.mapId,children:nodes.slice(1)}},{change:{origin:'system',label:'map tree UI fixture'}});qa.editorState.set({currentMapId:qa.mapId});},count);
      if(await page.getByTestId('editor-ai-sidebar').getAttribute('data-pane')!=='maps')await page.getByTestId('sidebar-maps').click();
      await page.getByTestId('map-tree-node-ux_map_1').waitFor({state:'visible'});await page.waitForTimeout(800);
      for(let i=0;i<3;i++){
        const id=i%2===0?'ux_map_1':'map_page';
        await measure(`maps:${count}:switch:${i}`,()=>page.getByTestId('map-tree-node-'+id).click({position:{x:110,y:15}}));
        if(report.rows.at(-1).currentMapId!==id)throw Error('Native map switch failed');
      }
      await page.screenshot({path:out+`/maps-${count}.png`});
    }
    await page.getByTestId('sidebar-tools').click();
    await page.evaluate(()=>qa.store.replace(qa.template,{change:{origin:'system',label:'restore UI fixture'}}));
    await page.evaluate(async()=>{const {openResourceModal}=await import('/src/editor/panels/resourceModal.ts');openResourceModal('charset');});
    await page.getByTestId('resource-modal').waitFor({state:'visible'});await page.waitForTimeout(2500);
    await page.evaluate(()=>{qa.canvasDraws={visible:0,offscreen:0,other:0};const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...args){const card=this.canvas.closest('[data-testid=resource-profile-charset]');if(card){const r=this.canvas.getBoundingClientRect(),parent=document.querySelector('[data-testid=resource-entry-list]')?.getBoundingClientRect();const visible=r.width>0&&r.height>0&&r.bottom>Math.max(0,parent?.top??0)&&r.top<Math.min(innerHeight,parent?.bottom??innerHeight);qa.canvasDraws[visible?'visible':'offscreen']++;}else qa.canvasDraws.other++;return original.apply(this,args);};});
    await page.waitForTimeout(2000);
    const draws=await page.evaluate(()=>({...qa.canvasDraws,cards:document.querySelectorAll('[data-testid=resource-profile-charset]').length}));report.rows.push({name:'charset:idle:2000ms',...draws});console.log(JSON.stringify(report.rows.at(-1)));await page.screenshot({path:out+'/charset-idle.png'});
    await page.getByTestId('resource-modal-close').click();await page.waitForTimeout(1200);await page.evaluate(()=>qa.canvasDraws={visible:0,offscreen:0,other:0});await page.waitForTimeout(1200);const closed=await page.evaluate(()=>qa.canvasDraws);report.rows.push({name:'charset:closed:1200ms',...closed});console.log(JSON.stringify(report.rows.at(-1)));
    // Slow native typing reveals whether the debounced rebuild retains the search input.
    await page.evaluate(()=>{const t=qa.template;const fishSpecies=Array.from({length:10},(_,i)=>({id:'ux_fish_'+i,name:'Fish '+i,itemId:t.database.items[0].id}));qa.store.replace({...t,database:{...t.database,fishSpecies}},{change:{origin:'system',label:'search focus UI fixture'}});});
    await page.getByTestId('toolbar-database').click();await page.getByTestId('db-group-strip-life').click();await page.getByTestId('db-tab-life-collections').click();
    const search=page.getByTestId('db-life-collections-search');await search.fill('');await page.waitForTimeout(250);await search.click();await page.keyboard.type('abc',{delay:180});await page.waitForTimeout(250);
    const focus=await page.evaluate(()=>({value:document.querySelector('[data-testid=db-life-collections-search]').value,focused:document.activeElement?.getAttribute('data-testid'),activeTag:document.activeElement?.tagName}));report.rows.push({name:'life:slow-native-typing',...focus});console.log(JSON.stringify(report.rows.at(-1)));await page.screenshot({path:out+'/life-search-focus.png'});
    await page.getByTestId('database-modal-close').click();
  }
  if(process.env.MODE==='progress-events'){
    await page.evaluate(()=>{const t=qa.template,m=t.maps[qa.mapId],original=window.__OPRN_E2E_PROJECT__.maps[qa.mapId].events[0];const commands=Array.from({length:100},(_,i)=>({kind:'text',body:'Command '+i}));const events=Array.from({length:500},(_,i)=>({...original,id:'ux_event_'+i,x:i%128,y:Math.floor(i/128),commands,pages:[{...original.pages[0],commands}]}));const aux={...m,id:'ux_aux',width:128,height:128,lowerTiles:Array(16384).fill(16),upperTiles:Array(16384).fill(-1),events};qa.store.replace({...t,maps:{...t.maps,ux_aux:aux},mapTree:{mapId:qa.mapId,children:[{mapId:'ux_aux',children:[]}]}},{change:{origin:'system',label:'progress UI fixture'}});const clone=window.structuredClone;qa.eventClones=0;window.structuredClone=function(value,...args){if(qa.measuring&&value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.pages)&&value.id)qa.eventClones++;return clone(value,...args);};qa.progressMutations=0;new MutationObserver(rs=>{if(qa.measuring)qa.progressMutations+=rs.length;}).observe(document.querySelector('[data-testid=left-progress-pane]'),{childList:true,subtree:true});});
    for(const state of ['visible','collapsed','tools']){
      if(state==='visible'||state==='collapsed')await page.getByTestId('sidebar-progress').click();else await page.getByTestId('sidebar-tools').click();
      await page.evaluate(async()=>{qa.editorState.set({tool:'paint',layer:'lower',selectedTile:23});const {requestEditorCameraFocus}=await import('/src/editor/editorCameraFocus.ts');requestEditorCameraFocus({mapId:qa.mapId,tileX:16,tileY:12,immediate:true});});await page.waitForTimeout(300);
      for(let i=0;i<3;i++){
        await page.evaluate(()=>{qa.eventClones=0;qa.progressMutations=0;});
        const point=await page.evaluate(([x,y])=>window.__oprnEditWorldToClient(x*16+8,y*16+8),[4+i,state==='visible'?4:state==='collapsed'?5:6]);
        await measure(`progress:${state}:paint:${i}`,()=>page.mouse.click(point.x,point.y));
        const detail=await page.evaluate(()=>({eventClones:qa.eventClones,progressMutations:qa.progressMutations,rootHidden:document.querySelector('[data-testid=left-progress-pane]').hidden,ancestorHidden:document.querySelector('.ai-chat-sidebar-content').hidden}));Object.assign(report.rows.at(-1),detail);console.log(JSON.stringify(detail));
      }
      await page.screenshot({path:out+'/progress-'+state+'.png'});
    }
    await page.evaluate(()=>qa.store.replace(qa.template,{change:{origin:'system',label:'restore UI fixture'}}));
    for(const count of [100,1000]){
      await page.evaluate(count=>{const t=qa.template,m=t.maps[qa.mapId],original=window.__OPRN_E2E_PROJECT__.maps[qa.mapId].events[0],commands=Array.from({length:count},(_,i)=>({kind:'text',body:'Command '+i}));qa.store.replace({...t,maps:{[qa.mapId]:{...m,events:[{...original,commands,pages:[{...original.pages[0],commands}]}]}}},{change:{origin:'system',label:'event Tab UI fixture'}});qa.editorState.set({tool:'event',layer:'event',selectedEventId:original.id});localStorage.setItem('oprn:storyboard-mode','list');},count);
      await page.evaluate(async()=>{const {openEventEditorModal}=await import('/src/editor/panels/eventEditor/modal.ts');openEventEditorModal(qa.mapId,qa.store.getCurrent().maps[qa.mapId].events[0].id);});await page.getByTestId('event-editor-modal').waitFor({state:'visible'});await page.waitForTimeout(500);
      const candidates=await page.getByTestId('event-editor-modal').evaluate(root=>root.querySelectorAll("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])").length);
      for(let i=0;i<3;i++){await measure(`event:${count}:Tab:${i}`,()=>page.keyboard.press('Tab'));report.rows.at(-1).focusCandidates=candidates;}
      await page.screenshot({path:out+'/event-Tab-'+count+'.png'});await page.keyboard.press('Escape');await page.waitForTimeout(200);
    }
  }
  if(process.env.MODE==='selection'){
    for(const count of [100,1000]){
      await page.evaluate(count=>{const t=qa.template,m=t.maps[qa.mapId],original=window.__OPRN_E2E_PROJECT__.maps[qa.mapId].events[0],commands=Array.from({length:count},(_,i)=>({kind:'text',body:'Command '+i}));qa.store.replace({...t,maps:{[qa.mapId]:{...m,events:[{...original,commands,pages:[{...original.pages[0],commands}]}]}}},{change:{origin:'system',label:'event selection UI fixture'}});qa.editorState.set({tool:'event',layer:'event',selectedEventId:original.id});localStorage.setItem('oprn:storyboard-mode','list');},count);
      await page.evaluate(async()=>{const {openEventEditorModal}=await import('/src/editor/panels/eventEditor/modal.ts');openEventEditorModal(qa.mapId,qa.store.getCurrent().maps[qa.mapId].events[0].id);});await page.getByTestId('event-editor-modal').waitFor({state:'visible'});await page.waitForTimeout(500);
      const first=page.locator('.cmd-list .cmd-item[data-cmd-path="[0]"] .cmd-head');
      for(let i=0;i<3;i++){
        await first.click();await page.waitForTimeout(120);
        await measure(`event:${count}:CtrlA:${i}`,()=>first.press('Control+a'));
        const detail=await page.evaluate(async()=>({selected:(await import('/src/editor/panels/eventEditor/commandInspector.ts')).selectedCommandPaths().length,selectedRows:document.querySelectorAll('.cmd-list .cmd-item.selected').length}));if(detail.selected!==count||detail.selectedRows!==count)throw Error('Native Ctrl+A did not select authored commands');Object.assign(report.rows.at(-1),detail);console.log(JSON.stringify(detail));
      }
      await page.screenshot({path:out+'/event-selection-'+count+'.png'});await page.keyboard.press('Escape');await page.waitForTimeout(200);
    }
  }
  report.productionSources=Object.fromEntries(['src/editor/panels/databaseLifeCollectionsView.ts','src/editor/panels/database.ts','src/editor/panels/mapList.ts','src/editor/panels/mapSidebarSection.ts','src/editor/panels/resourceManagerViews.ts','src/editor/panels/leftProgressPane.ts','src/editor/panels/aiSidebarWorkspace.ts','src/editor/panels/eventEditor/modal.ts'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
  writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error((await page.locator('body').innerText()).slice(-3500));throw e;}finally{clearTimeout(watchdog);await browser.close();}
