import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {Window} from 'happy-dom';
import {writeFile,rm} from 'node:fs/promises';
const out=new URL('./',import.meta.url), root=process.cwd(), win=new Window(), prior=new Map();
for(const key of ['window','document','Node','HTMLElement','HTMLButtonElement','CustomEvent','MutationObserver','KeyboardEvent']){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='window'?win:win[key]});}
const server=await createServer({configFile:false,envFile:false,root,cacheDir:new URL('priority-cache',out).pathname,resolve:{alias:[{find:/^@\/project\/store$/,replacement:`${root}/src/player/exportProjectStoreShim.ts`},{find:'@',replacement:`${root}/src`}]},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
const report={surface:'Real handleAction, chest DOM and life authorities via Vite SSR/HappyDOM; not native keyboard gameplay',substitutes:['event execution endpoint records dispatch only','scene render/sync endpoints count calls'],rows:[]};
try{
 const load=p=>server.ssrLoadModule(p);
 const {createBlankProject}=await load('/src/project/defaults.ts');
 const {normalizeItemRecord}=await load('/src/project/databaseRecordModel.ts');
 const {startSession}=await load('/src/project/session.ts');
 const {setExportedProject}=await load('/src/player/exportProjectStoreShim.ts');
 const {handleAction}=await load('/src/player/playSceneMovement.ts');
 const {advanceSeasonalForage}=await load('/src/project/seasonalForage.ts');
 const {ensureChest}=await load('/src/project/placeables.ts');
 const {transitionToNextDay}=await load('/src/player/dayTransition.ts');
 function fixture(y){
  const project=createBlankProject(), map=project.maps[project.startMapId];map.events=[];map.lowerTiles.fill(0);map.upperTiles.fill(-1);project.tilesets[map.tilesetId].passability[0]={up:true,down:true,left:true,right:true};map.farmableArea=[{x:2,y,w:1,h:1}];
  project.database.items.push(...[{id:'priority-hoe',name:'Hoe',farmTool:'hoe',consumable:false},{id:'priority-fish',name:'Fish'},{id:'priority-berry',name:'Berry'}].map(item=>normalizeItemRecord({...item,scope:'none'})));
  project.system.skillSystem={enabled:false};project.system.energy={max:20,initial:20,restorePerDay:20};project.system.timeSystem={enabled:true,dayStartHour:12,dayEndHour:26,daysPerSeason:28};
  project.system.collections={enabled:true,trackedItemIds:['priority-fish','priority-berry']};project.database.fishSpecies=[{id:'fish',name:'Fish',itemId:'priority-fish'}];project.system.fishing={enabled:true,energyCost:3,spots:[{id:'pond',mapId:map.id,area:{x:2,y,w:1,h:1},catches:[{fishId:'fish',weight:1}]}]};
  project.system.seasonalForage={enabled:true,areas:[{id:'meadow',mapId:map.id,area:{x:2,y,w:1,h:1},dailySpawnCount:1,maxActive:1,despawnAfterDays:2,entries:[{id:'berry',itemId:'priority-berry',weight:1}]}]};
  project.session.inventory={'priority-hoe':1};const session=startSession(project,748);session.equippedToolItemId='priority-hoe';setExportedProject(project);
  const host=document.createElement('div');host.className='play-viewport';document.body.append(host);let events=[],refresh=0,sync=0;
  const scene={map,session,tileX:2,tileY:2,facing:'down',lastActionTargetKey:'',eventPositions:{},autonomousNPCs:new Map(),eventSprites:new Map(),game:{registry:{get:key=>key==='dialogueHost'?host:undefined}},runEvent:async id=>{events.push(id);},refreshRuntimeSurfaces:()=>{refresh++;},syncRuntimeState:()=>{sync++;}};
  return {project,map,session,host,scene,events,counts:()=>({refresh,sync})};
 }
 const event=(id,y)=>({id,x:2,y,trigger:{kind:'action'},commands:[],pages:[{id:`${id}-page`,name:id,conditions:[],graphic:{transparent:true},trigger:{kind:'action'},priority:y===2?'below':'same',overlapForbidden:false,movement:{type:'fixed',speed:3,frequency:3},commands:[]}]});
 for(const y of [3,2]){
  const f=fixture(y), row={coordinate:y===3?'front':'feet',steps:[]};report.rows.push(row);
  assert.equal(transitionToNextDay(f.project,f.session,'1:spring:1').ok,true);assert.equal(Object.values(f.session.placeables).filter(p=>p.forageSpawn).length,1);
  ensureChest(f.session,{id:'priority-chest',mapId:f.map.id,x:2,y});f.map.events.push(event('priority-event',y));
  let before=structuredClone(f.session);assert.equal(handleAction(f.scene),true);assert.deepEqual(f.events,['priority-event']);assert.deepEqual(structuredClone(f.session),before);assert.equal(document.querySelector('[data-testid="chest-scene"]'),null);row.steps.push({winner:'event',fullStatePreserved:true});
  f.map.events=[];assert.equal(handleAction(f.scene),true);assert.ok(document.querySelector('[data-testid="chest-scene"]'));assert.deepEqual(structuredClone(f.session),before);row.steps.push({winner:'actual chest DOM',fullStatePreserved:true});
  // Subscribe to the exact continuation before closing the real chest surface.
  const originalSync=f.scene.syncRuntimeState;let cancel;
  const closed=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Chest completion signal missing')),1000);cancel=()=>clearTimeout(timer);f.scene.syncRuntimeState=()=>{originalSync();clearTimeout(timer);resolve();};});
  document.querySelector('[data-testid="chest-close"]').click();try{await closed;}finally{cancel();f.scene.syncRuntimeState=originalSync;}assert.equal(document.querySelector('[data-testid="chest-scene"]'),null);
  delete f.session.chests['priority-chest'];before=structuredClone(f.session);assert.equal(handleAction(f.scene),true);assert.equal(f.session.inventory['priority-berry'],1);assert.equal(f.session.inventory['priority-fish'],undefined);assert.deepEqual(f.session.rng,before.rng);row.steps.push({winner:'generated forage',berry:1,rngPreserved:true});
  const plots=structuredClone(f.session.farmPlots);assert.equal(handleAction(f.scene),true);assert.equal(f.session.inventory['priority-fish'],1);assert.deepEqual(f.session.farmPlots,plots);row.steps.push({winner:'fish before farm',fish:1,plotsPreserved:true});
  f.project.system.fishing.spots=[];assert.equal(handleAction(f.scene),true);assert.equal(f.session.farmPlots[f.map.id][`2,${y}`].tilled,true);row.steps.push({winner:'farm after no higher target',counts:f.counts()});f.host.remove();
 }
 {
  const f=fixture(3);f.project.system.fishing.spots=[];f.project.system.seasonalForage.enabled=false;f.map.events.push(event('feet-event',2));
  assert.equal(handleAction(f.scene),true);assert.equal(f.session.farmPlots[f.map.id]['2,3'].tilled,true);assert.deepEqual(f.events,[]);
  report.rows.push({scenario:'front farm precedes feet event',pass:true});f.host.remove();
 }
 // Additional accepted-date controls independent of the inherited regression fixture.
 for(const year of [1,Number.MAX_SAFE_INTEGER])for(const liveDay of [1,2,3]){
  const f=fixture(3);f.session.gameTime={year,season:'spring',day:1,hour:12,minute:0};assert.equal(advanceSeasonalForage(f.project,f.session,f.session.gameTime).spawned,1);f.session.gameTime={...f.session.gameTime,day:liveDay};const before=structuredClone(f.session);assert.equal(handleAction(f.scene),true);
  if(liveDay<3){assert.equal(f.session.inventory['priority-berry'],1);assert.deepEqual(f.session.rng,before.rng);}else assert.deepEqual(structuredClone(f.session),before);
  assert.equal(f.session.inventory['priority-fish'],undefined);report.rows.push({scenario:'accepted-date real handleAction',year,liveDay,lifetime:2,berry:f.session.inventory['priority-berry']??0,expired:liveDay===3,fullRefusalPreserved:liveDay===3});f.host.remove();
 }
 report.pass=true;
}finally{await server.close();await win.happyDOM.close();await rm(new URL('priority-cache',out),{recursive:true,force:true});for(const [key,d]of prior){if(d)Object.defineProperty(globalThis,key,d);else Reflect.deleteProperty(globalThis,key);}report.cleanup={serverClosed:true,windowClosed:true,globalsRestored:true};await writeFile(new URL('priority-state.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
