// Native editor UI fixture; no model requests or canonical content writes.
// OUT=<evidence directory> BASE=http://127.0.0.1:9911 node scripts/qa/editor-ux-storage-capture.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { resolve } from 'node:path';
const baselineRevision = '7ce9a7655510e82360efe154bc888a0754e06d04';
const baselineDirectory = '.vite-cache/ux2-baseline';
mkdirSync(baselineDirectory, { recursive: true });
await build({ stdin: { contents: execFileSync('git',['show',baselineRevision+':src/project/persistence/core/projectPatch.ts'],{encoding:'utf8'}), resolveDir: resolve('src/project/persistence/core'), loader:'ts' }, bundle:true, format:'esm', platform:'browser', outfile:baselineDirectory+'/projectPatch.js' });
writeFileSync(baselineDirectory+'/mapEditHistory.ts',execFileSync('git',['show',baselineRevision+':src/editor/mapEditHistory.ts'],{encoding:'utf8'}));
const label = process.env.LABEL ?? 'audit';
const out = process.env.OUT ?? 'verify-shots/editor-ux-fixes-round2-20261004/storage';
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
  const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),conditions:'Same browser exports and current store, baseline modules from7ce9a76555; CPU durations are performance.now around functions, not canonical-save or host time; synthetic fixtures only.',errors,rows:[],checks:[]};
  await page.evaluate(async()=>{qa.template=qa.store.getCurrent();qa.beforePatch=await import('/.vite-cache/ux2-baseline/projectPatch.js');qa.afterPatch=await import('/src/project/persistence/core/projectPatch.ts');qa.beforeHistory=await import('/.vite-cache/ux2-baseline/mapEditHistory.ts');qa.afterHistory=await import('/src/editor/mapEditHistory.ts');qa.vault=await import('/src/project/eventDraftVault.ts');});
  const data=await page.evaluate(async contractOnly=>{
    const rows=[],checks=[];
    const assert=(v,m)=>{if(!v)throw Error(m);};
    const baseline=qa.beforePatch,current=qa.afterPatch;
    const examples=[
      [{a:1,b:[1,null]}, {b:[1,undefined],a:1}],
      [{a:undefined},{}], [{v:NaN},{v:Infinity}],
      [{v:1}, {v:2}], [{v:[1,2]},{v:[2,1]}],
      [{v:{b:2,a:1}},{v:{a:1,b:2}}],
      [{v:{b:2,a:1,missing:undefined}},{v:{a:1,b:2}}],
      [{v:[{b:2,a:1},undefined]},{v:[{a:1,b:2},null]}],
      [{v:new Date('2020-01-01')},{v:new Date('2021-01-01')}],
      [{v:{toJSON(){return {n:1}}}},{v:{toJSON(){return {n:2}}}}],
    ];
    for(const [a,b] of examples)assert(JSON.stringify(baseline.diffProjectDocuments(a,b))===JSON.stringify(current.diffProjectDocuments(a,b)),'Diff compatibility mismatch');
    for(const value of [{a:undefined,b:[undefined,NaN,Infinity,()=>1,Symbol('x')],c:1},new Date('2020-01-01'),{toJSON(key){return {key,n:1}}},JSON.parse('{"__proto__":{"x":1},"a":2}'),{nested:{toJSON(key){return key}}}]){
      const patch={maps:{set:{m:value}}};const old=baseline.withWirePatchValues(patch),next=current.withWirePatchValues(patch);assert(JSON.stringify(old)===JSON.stringify(next),'Wire semantics changed');
      const sliced=await current.withWirePatchValuesSliced(patch,()=>new Promise(r=>setTimeout(r,0)),0);assert(JSON.stringify(old)===JSON.stringify(sliced),'Sliced wire mismatch');
    }
    const omitted={toJSON(){return undefined}};for(const api of [baseline,current]){let threw=false;try{api.withWirePatchValues({maps:{set:{m:omitted}}});}catch{threw=true;}assert(threw,'Root toJSON undefined must retain error');}
    checks.push('Diff key order/omissions/nonfinite/exotic compatibility and sync/sliced wire parity');
    for(const size of (contractOnly?[]:[128,512]))for(const location of ['first','last','metadata']){
      const map={id:'m',name:'map',width:size,height:size,lowerTiles:Array(size*size).fill(16),upperTiles:Array(size*size).fill(-1),events:[]},base={maps:{m:map}},local={maps:{m:{...map,lowerTiles:location==='metadata'?map.lowerTiles:[...map.lowerTiles]}}};if(location==='metadata')local.maps.m.name='new';else local.maps.m.lowerTiles[location==='first'?0:size*size-1]=23;
      for(const [name,api] of [['before',baseline],['after',current]])for(let run=0;run<3;run++){
        let yields=0;const yieldToMain=()=>{yields++;return new Promise(r=>setTimeout(r,0));};const start=performance.now();const patch=await api.diffProjectDocumentsSliced(base,local,yieldToMain);const diffMs=performance.now()-start;const t=performance.now();const wire=api.withWirePatchValuesSliced?await api.withWirePatchValuesSliced(patch,yieldToMain):api.withWirePatchValues(patch);const wireMs=performance.now()-t;const result=api.applyProjectDocumentPatch(base,wire);assert(JSON.stringify(result)===JSON.stringify(local),'Applied wire differs from input');assert(wire.maps.set.m.lowerTiles!==local.maps.m.lowerTiles,'Submitted arrays alias mutable input');rows.push({case:'patch',name,size,location,run,diffMs,wireMs,yields});
      }
    }
    for(const count of (contractOnly?[]:[1,12]))for(const [name,history] of [['before',qa.beforeHistory],['after',qa.afterHistory]]){
      qa.vault.clearEventDraftVault();qa.afterHistory.resetMapEditHistory();qa.beforeHistory.resetMapEditHistory();const t=qa.template,m=t.maps[qa.mapId],maps={};for(let i=0;i<count;i++){const id=i===0?qa.mapId:'aux'+i;maps[id]={...m,id,width:128,height:128,lowerTiles:Array(16384).fill(16),upperTiles:Array(16384).fill(-1)};}qa.store.replace({...t,maps},{change:{origin:'system',label:'history jump fixture'}});qa.editorState.set({currentMapId:qa.mapId});history.resetMapEditHistory();
      for(let i=0;i<10;i++){history.recordProjectSnapshot('stroke '+i,qa.mapId,{kind:'map',mapId:qa.mapId});qa.store.updateMapTiles(qa.mapId,map=>{map.lowerTiles[i]=23;},{origin:'human',cells:[{x:i,y:0,layer:'lower'}]});}
      const start=performance.now();assert(history.revertToHistoryIndex(0),'Jump undo failed');const undoMs=performance.now()-start;assert(qa.store.getCurrent().maps[qa.mapId].lowerTiles.slice(0,10).every(x=>x===16),'Jump undo cells wrong '+name+','+count+' maps: '+qa.store.getCurrent().maps[qa.mapId].lowerTiles.slice(0,10).join(','));const t0=performance.now();assert(history.redoToHistoryIndex(0),'Jump redo failed');const redoMs=performance.now()-t0;assert(qa.store.getCurrent().maps[qa.mapId].lowerTiles.slice(0,10).every(x=>x===23),'Jump redo cells wrong');rows.push({case:'history-jump',name,mapCount:count,steps:10,undoMs,redoMs});checks.push(`10-step undo/redo preserves cells: ${name},${count}maps`);
    }
    // The yielded submission stays immutable while a newer native store edit arrives.
    qa.vault.clearEventDraftVault();qa.afterHistory.resetMapEditHistory();qa.store.replace(qa.template,{change:{origin:'system',label:'wire flight fixture'}});const flight=qa.store.getCurrent(),flightMap=flight.maps[qa.mapId];let resumed=0;
    const prepared=await current.withWirePatchValuesSliced({maps:{set:{[qa.mapId]:flightMap}}},async()=>{if(resumed++===0)qa.store.updateMapTiles(qa.mapId,map=>{map.lowerTiles[0]=23;},{origin:'human',cells:[{x:0,y:0,layer:'lower'}]});await new Promise(r=>setTimeout(r,0));},0);
    assert(resumed>0&&prepared.maps.set[qa.mapId].lowerTiles[0]===16&&qa.store.getCurrent().maps[qa.mapId].lowerTiles[0]===23,'A newer edit mutated yielded submission');checks.push('Wire preparation yields inside a map and preserves newer COW edit');
    // Actual brush and stamp writers must preserve terrain metadata mid-flight.
    const brush = await import('/src/editor/terrainBrush.ts');
    const t = qa.template, m = t.maps[qa.mapId], ts = t.tilesets[m.tilesetId];
    const tileMeta = [...(ts.tileMeta ?? [])]; tileMeta[1] = { role: 'ground', label: 'stone ground', defaultLayer: 'lower' };
    qa.store.replace({...t,tilesets:{...t.tilesets,qa_terrain_wire:{...ts,id:'qa_terrain_wire',kind:'custom',autotileGroups:[],tileMeta}},maps:{[qa.mapId]:{...m,tilesetId:'qa_terrain_wire',lowerTiles:Array(m.width*m.height).fill(0),upperTiles:Array(m.width*m.height).fill(-1),terrainDesign:{waterDepth:Array(m.width*m.height).fill(1)}}}},{change:{origin:'system',label:'terrain wire fixture'}});
    const submitted=qa.store.getCurrent().maps[qa.mapId];let strokes=0;
    const waterWire=await current.withWirePatchValuesSliced({maps:{set:{[qa.mapId]:submitted}}},async()=>{if(strokes++===0)brush.paintTerrainBrush(qa.mapId,4,4,'stone',1,0);await new Promise(r=>setTimeout(r,0));},0);
    const at=4*m.width+4,live=qa.store.getCurrent().maps[qa.mapId];assert(live.lowerTiles[at]!==submitted.lowerTiles[at] && live.terrainDesign.waterDepth[at]===0,'Actual surface brush did not write fixture: '+live.lowerTiles[at]+','+live.terrainDesign?.waterDepth?.[at]+',submitted:'+submitted.lowerTiles[at]);assert(waterWire.maps.set[qa.mapId].lowerTiles[at]===0&&waterWire.maps.set[qa.mapId].terrainDesign.waterDepth[at]===1,'Terrain wire mixed submitted/live revisions');checks.push('Actual surface brush during wire yields preserves submitted tiles and water depth');
    let eventReads=0;const authored=window.__OPRN_E2E_PROJECT__.maps[qa.mapId].events[0];const events=new Proxy(Array.from({length:1000},(_,i)=>({...authored,id:'plain_'+i})),{get(a,k,r){if(/^\d+$/.test(String(k)))eventReads++;return Reflect.get(a,k,r);}});const vaultProject={maps:{m:{events}}};qa.vault.syncEventDraftVaultFromProject(vaultProject);eventReads=0;for(let i=0;i<100;i++)qa.vault.syncEventDraftVaultFromProject(vaultProject);assert(eventReads===0,'Warm vault rescan walks ordinary events');rows.push({case:'vault-warm-event-lists',events:1000,calls:100,eventReads});checks.push('Warm vault sync skips immutable non-draft event arrays');
    // A project snapshot resets earlier map restores; later tile/tileset snapshots retain order.
    qa.store.replace(qa.template,{change:{origin:'system',label:'mixed history fixture'}});const hist=qa.afterHistory;hist.resetMapEditHistory();const mapId=qa.mapId,tilesetId=qa.store.getCurrent().maps[mapId].tilesetId,oldTitle=qa.store.getCurrent().meta.title,oldName=qa.store.getCurrent().tilesets[tilesetId].name;
    hist.recordProjectSnapshot('map first',mapId,{kind:'map',mapId});qa.store.updateMapTiles(mapId,map=>{map.lowerTiles[0]=23;},{origin:'human',cells:[{x:0,y:0,layer:'lower'}]});hist.recordProjectSnapshot('title',mapId);qa.store.update(p=>{p.meta.title='mixed title';},{scope:'project'});hist.recordProjectSnapshot('tileset',mapId,{kind:'map',mapId,includeTilesets:true});qa.store.update(p=>{p.tilesets[tilesetId].name='mixed tileset';p.maps[mapId].lowerTiles[1]=23;},{scope:'project'});
    assert(hist.revertToHistoryIndex(0),'Mixed jump undo failed');assert(qa.store.getCurrent().meta.title===oldTitle&&qa.store.getCurrent().tilesets[tilesetId].name===oldName&&qa.store.getCurrent().maps[mapId].lowerTiles[0]===16,'Mixed jump lost restoration order');assert(hist.redoToHistoryIndex(0),'Mixed jump redo failed');assert(qa.store.getCurrent().meta.title==='mixed title'&&qa.store.getCurrent().tilesets[tilesetId].name==='mixed tileset'&&qa.store.getCurrent().maps[mapId].lowerTiles[0]===23&&qa.store.getCurrent().maps[mapId].lowerTiles[1]===23,'Mixed jump redo wrong');checks.push('Mixed project/map/tileset history restoration order');
    qa.vault.clearEventDraftVault();qa.store.replace(qa.template,{change:{origin:'system',label:'restore UI fixture'}});
    const event=window.__OPRN_E2E_PROJECT__.maps[qa.mapId].events[0];for(let i=0;i<10;i++)qa.vault.rememberEventDraftVaultEntry(qa.mapId,{...event,id:'vault_'+i,commands:Array.from({length:1000},(_,j)=>({kind:'text',body:'draft '+j})),draft:{kind:'new'}});
    qa.vault.persistEventDraftVaultNow('ux2-capture');const clone=window.structuredClone,stringify=JSON.stringify;let cloneCalls=0,stringifyCalls=0;window.structuredClone=function(...args){cloneCalls++;return clone(...args)};JSON.stringify=function(...args){stringifyCalls++;return stringify(...args)};
    const start=performance.now();for(let i=0;i<3;i++)qa.vault.persistEventDraftVaultNow('ux2-capture');const persistMs=performance.now()-start;window.structuredClone=clone;JSON.stringify=stringify;const saved=JSON.parse(localStorage.getItem(qa.vault.eventDraftVaultStorageKey('ux2-capture')));assert(saved.entries.length===10&&saved.entries[0].event.commands[999].body==='draft 999','Vault persistence lost commands');const read=qa.vault.listEventDraftVaultEntries();read[0].event.commands[0].body='external mutation';assert(qa.vault.listEventDraftVaultEntries()[0].event.commands[0].body==='draft 0','Vault public read aliases owned entry');rows.push({case:'vault-repeat',entries:10,commandsPerEntry:1000,repeats:3,persistMs,cloneCalls,stringifyCalls});checks.push('Vault repeated save and public clone isolation');qa.vault.clearEventDraftVault();qa.vault.persistEventDraftVaultNow('ux2-capture');
    return {rows,checks};
  },process.env.CONTRACT_ONLY==='1');
  Object.assign(report,data);report.productionSources=Object.fromEntries(['src/editor/mapEditHistory.ts','src/project/eventDraftVault.ts','src/project/persistence/core/projectPatch.ts','src/project/persistence/electronRepository.ts','src/editor/terrainBrush.ts','src/editor/terrainStamps.ts'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
  writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.error(e);throw e;}finally{clearTimeout(watchdog);await browser.close();}
