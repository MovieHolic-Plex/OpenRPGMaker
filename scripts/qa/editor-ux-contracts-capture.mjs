// Native editor UI fixture; no model requests or canonical content writes.
// OUT=<evidence directory> BASE=http://127.0.0.1:9911 node scripts/qa/editor-ux-contracts-capture.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const label = process.env.LABEL ?? 'audit';
const out = process.env.OUT ?? 'verify-shots/editor-ux-fixes-round2-20261004/contracts';
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

  const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),conditions:'Native Chromium, synthetic UI fixtures only, no host save/model calls. Pixel comparisons use independent full relief raster <=96x96. Retained byte counts cover page arrays, not process heap.',errors,checks:[],rows:[]};
  const data=await page.evaluate(async()=>{
    const checks=[],rows=[];const assert=(v,m)=>{if(!v)throw Error(m)};
    const edit=await import('/src/project/relief/edit.ts'),screen=await import('/src/project/relief/screen.ts'),render=await import('/src/project/relief/render.ts'),windowing=await import('/src/project/relief/window.ts'),revision=await import('/src/project/relief/revision.ts');
    const {ReliefPagedImage,RELIEF_PAGE}=await import('/src/project/relief/paged.ts');
    const sceneOf=(r,ground)=>({grids:windowing.reliefGrids(r),opts:screen.reliefRenderOptions(r,ground)});
    const ground={cells:new Int32Array(48*48),signature:1,sample(x,y,out,i){out[i]=x%251;out[i+1]=y%239;out[i+2]=(x+y)%233;out[i+3]=255;return true;}};
    const parity=(image,scene,view)=>{
      const full=windowing.reliefImageFromRender(render.renderRelief(scene.grids.eff,scene.opts),image.W,image.H);assert(image.pad===full.pad,'Relief pad mismatch');
      const x0=Math.max(0,view.x),x1=Math.min(image.PW,view.x+view.width),y0=Math.max(0,view.y+image.pad),y1=Math.min(image.SH,view.y+view.height+image.pad),w=x1-x0,n=w*(y1-y0);
      const owners=new Int16Array(n).fill(-1),parts=new Uint8Array(n),colors=new Uint32Array(n),reference=new Uint32Array(full.rgba.buffer);
      image.visit({x0,x1,y0,y1},(x,y,row,part,rgba)=>{const i=(y-y0)*w+x-x0;owners[i]=row;parts[i]=part;colors[i]=rgba;});
      let differences=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y-y0)*w+x-x0,j=y*full.PW+x;if(owners[i]!==full.owner[j]||parts[i]!==full.part[j]||colors[i] !== (full.part[j]?reference[j]:0))differences++;}
      assert(differences===0,'Paged relief differs in '+differences+' visible pixels');return n;
    };
    for(const style of [undefined,'grass-cliff','tundra-snow']){
      let r=edit.emptyRelief(48,48);r.style=style;r.ramps=r.levels.slice();for(let y=8;y<16;y++)for(let x=10;x<26;x++)r.levels[y*48+x]=2;for(let y=16;y<18;y++)for(let x=15;x<17;x++)r.ramps[y*48+x]=1;for(let x=30;x<38;x++){r.levels[24*48+x]=1;r.ramps[24*48+x]=9;}
      let scene=sceneOf(r,ground);const image=new ReliefPagedImage(48,48),view={x:232,y:216,width:192,height:224};image.sync(scene,'first',view);const pixels=parity(image,scene,view);
      const lift=screen.reliefLiftField(r).elevation[16*48+15];const pick=screen.reliefPickPoint(r,15.5*16,(16.5-lift)*16,16);assert(pick?.x===15&&pick?.y===16&&pick?.face==='top','Ramp pick mismatch');
      for(const kind of ['stairs','pad-up','pad-down']){const next=edit.copyRelief(r);if(kind==='stairs'){for(let y=16;y<18;y++)for(let x=15;x<17;x++)next.ramps[y*48+x]=5;}else for(let y=0;y<6;y++)for(let x=0;x<6;x++)next.levels[y*48+x]=kind==='pad-up'?4:1;const ns=sceneOf(next,ground),plan=windowing.planReliefPatch(scene,ns,image);image.sync(ns,kind,view,undefined,plan==='same'?[]:plan?.windows);parity(image,ns,view);r=next;scene=ns;}
      rows.push({case:'relief-pixel-parity',style:style??'default',visiblePixels:pixels,states:4,differences:0,...image.stats});
    }
    checks.push('Relief page seams, world patterns, ramps/stairs, bridges and changed pad: RGBA+owner+under/over match independent full bake');
    const large=edit.emptyRelief(96,96);for(let y=0;y<6;y++)for(let x=0;x<96;x++)large.levels[y*96+x]=2;const image=new ReliefPagedImage(96,96),scene=sceneOf(large);let maxPages=0;
    for(let lap=0;lap<3;lap++)for(const x of [64,400,768,1120,1400,64]){image.sync(scene,'resident',{x,y:64,width:64,height:64});maxPages=Math.max(maxPages,image.stats.pages);assert(image.stats.pages<=16,'Exploration retains offscreen relief pages');assert(image.stats.bytes===image.stats.pages*RELIEF_PAGE**2*7,'Page byte accounting differs');}
    parity(image,scene,{x:64,y:64,width:64,height:64});rows.push({case:'relief-pan-pages',laps:3,maxPages,...image.stats});checks.push('Repeated pan evicts and reconstructs pages on return');
    const r=edit.emptyRelief(48,48);let reads=0,generation=0;r.levels=new Proxy(r.levels,{get(t,k,receiver){if(/^\d+$/.test(String(k)))reads++;return Reflect.get(t,k,receiver)}});revision.bindReliefRevision(r,()=>String(generation));const sig=screen.reliefReadSignature(r);reads=0;for(let i=0;i<100;i++)screen.reliefReadSignature(r);assert(reads===0,'Warm relief reads scan arrays');const warmReads=reads;r.levels[0]=4;revision.invalidateReliefRevision(r);assert(screen.reliefReadSignature(r)!==sig,'Writer invalidation missed');const draft=edit.emptyRelief(48,48),before=screen.reliefSignature(draft);draft.levels[0]=3;assert(screen.reliefSignature(draft)!==before,'Unversioned in-place mutation hidden');rows.push({case:'warm-relief-signature',calls:100,arrayReads:warmReads,arrayReadsIncludingInvalidation:reads});checks.push('Versioned warm reads avoid scans; draft in-place writes remain detectable');
    const {changedAssistantMapCells}=await import('/src/editor/assistantHumanEdits.ts');const m=qa.store.getCurrent().maps[qa.mapId];const a={...m,lowerTileStacks:{1:[16,23]},relief:edit.emptyRelief(m.width,m.height),terrainDesign:{lockedCells:[2],waterDepth:Array(m.width*m.height).fill(0)},doodadGroups:[{id:'g',label:'G',cells:[{index:3,tile:16}]}]};const b={...a,relief:{...a.relief,levels:[...a.relief.levels]},terrainDesign:{...a.terrainDesign,lockedCells:[2,5]},doodadGroups:[{...a.doodadGroups[0],label:'Changed'}]};b.relief.levels[4]=1;const changed=[...changedAssistantMapCells(a,b)].sort((a,b)=>a-b);assert(JSON.stringify(changed)===JSON.stringify([3,4,5]),'Human cell metadata comparison differs: '+changed);checks.push('Sparse metadata and descriptor-free relief protection retain exact affected cells');
    const {createAssistantHumanEdits}=await import('/src/editor/assistantHumanEdits.ts');const base=qa.store.getCurrent(),bm=base.maps[qa.mapId];const guard=createAssistantHumanEdits();qa.store.updateMapTiles(qa.mapId,d=>{d.lowerTiles[0]=1;d.relief=edit.emptyRelief(d.width,d.height);d.relief.levels[1]=3;},{origin:'human',cells:[{x:0,y:0,layer:'lower'}],relief:true,reliefCells:[{x:1,y:0}]});const live=qa.store.getCurrent(),proposal={...live,maps:{...live.maps,[qa.mapId]:{...live.maps[qa.mapId],relief:edit.copyRelief(live.maps[qa.mapId].relief)}}};proposal.maps[qa.mapId].relief.levels[1]=1;assert(guard.protect(proposal,live).project.maps[qa.mapId].relief.levels[1]===3,'Mixed height intent lost');guard.dispose();qa.store.replace(base,{change:{origin:'system',label:'restore contracts fixture'}});checks.push('Assistant protects authored heights independently of mixed tile descriptors');
    return {rows,checks};
  });Object.assign(report,data);
  // Real Phaser editor pan observes retained pages, destroyed tracking and empty chunks.
  await page.evaluate(async()=>{const edit=await import('/src/project/relief/edit.ts');const t=qa.store.getCurrent(),m=t.maps[qa.mapId],r=edit.emptyRelief(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++)if((x+y)%24<8)r.levels[y*128+x]=2;qa.store.replace({...t,maps:{[qa.mapId]:{...m,width:128,height:128,lowerTiles:Array(16384).fill(0),upperTiles:Array(16384).fill(1),relief:r}}},{change:{origin:'system',label:'native relief pan fixture'}});qa.editorState.set({currentMapId:qa.mapId,zoom:1,layer:'lower',tool:'relief'});});
  for(const [x,y] of [[20,20],[64,64],[105,105],[20,20],[64,64],[20,20]]){await page.evaluate(async([x,y])=>{const {requestEditorCameraFocus}=await import('/src/editor/editorCameraFocus.ts');requestEditorCameraFocus({mapId:qa.mapId,tileX:x,tileY:y,immediate:true});},[x,y]);await page.waitForTimeout(700);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const stats=await page.evaluate(()=>window.__oprnEditReliefStats?.());assert(stats,'Native editor relief statistics missing');assert(stats.residentTileObjects>0,'No visible tile objects to exercise culling');assert(stats.culling.destroyed===0,'Destroyed culling references remain');assert(stats.emptyChunks===0,'Empty tile chunks remain');assert(stats.culling.tracked<=stats.residentTileObjects,'Culling references exceed resident objects');assert(stats.backing.pages<64,'Relief retained whole 128x128 pixel backing');report.rows.push({case:'native-editor-pan',x,y,...stats});}
  report.checks.push('Actual editor pan has no destroyed tracking/empty chunks and retains viewport relief pages');await page.screenshot({path:out+'/relief-editor.png'});
  report.productionSources=Object.fromEntries(['src/project/relief/paged.ts','src/project/relief/revision.ts','src/project/relief/render.ts','src/editor/reliefLiveStrips.ts','src/editor/reliefGroundSurface.ts','src/player/playSceneTileCulling.ts','src/editor/assistantHumanEdits.ts'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));writeFileSync(out+'/measurements.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(e);throw e;}finally{clearTimeout(watchdog);await browser.close();}
