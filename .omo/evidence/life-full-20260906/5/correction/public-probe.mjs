import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { createServer } from 'vite';
import { Window } from 'happy-dom';
const window = new Window();
const previous = new Map();
for (const [key,value] of Object.entries({window,document:window.document,HTMLElement:window.HTMLElement,CustomEvent:window.CustomEvent,localStorage:window.localStorage})) {
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
  Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
}
const server = await createServer({configFile:false,cacheDir:'.omo/evidence/life-full-20260906/5/correction/module-cache',resolve:{alias:[{find:/^@\/project\/store$/,replacement:process.cwd()+'/src/player/exportProjectStoreShim.ts'},{find:'@',replacement:process.cwd()+'/src'}]},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try {
  const load = path => server.ssrLoadModule(path);
  const { lifeQaProject } = await load('/test/fixtures/life-full/qaObservability.ts');
  const { startSession } = await load('/src/project/session.ts');
  const { setExportedProject } = await load('/src/player/exportProjectStoreShim.ts');
  const { RuntimeDomOverlay, buildLifeRuntimeSnapshot } = await load('/src/player/runtimeDom.ts');
  const { syncRuntimeState } = await load('/src/player/playSceneMapRuntime.ts');
  const { handleAction } = await load('/src/player/playSceneMovement.ts');
  const { installPlaySceneTestHooks } = await load('/src/player/playSceneTestHooks.ts');
  const { createSaveSnapshot } = await load('/src/player/saveSlots.ts');
  const project = lifeQaProject(); setExportedProject(project);
  await writeFile(new URL('project.json',import.meta.url),JSON.stringify(project,null,2)+'\n');
  const session = startSession(project,5);
  const host=document.createElement('div'); document.body.append(host);
  const overlay=new RuntimeDomOverlay(()=>host,{qaInstrumentation:true});
  const scene={session,map:project.maps[project.startMapId],tileX:2,tileY:2,facing:'down',lastActionTargetKey:'',eventPositions:{},autonomousNPCs:new Map(),eventSprites:new Map(),runtimeTimers:new Map(),runtimeDom:overlay,inputEnabled:true,running:false,runEvent:async()=>{},events:new EventEmitter(),game:{registry:{get:()=>host}},getMapId:()=>session.currentMapId,syncRuntimeState:()=>syncRuntimeState(scene)};
  installPlaySceneTestHooks(scene,{},()=>session,scene.syncRuntimeState);
  scene.syncRuntimeState();
  const observe = () => new Promise((resolve,reject)=>{
    const observed=event=>{clearTimeout(deadline);host.removeEventListener('oprn:action',observed);resolve({receipt:event.detail,state:window.__oprnDebug.readState(),mirror:JSON.parse(host.querySelector('[data-testid=runtime-state-json]').textContent)});};
    const deadline=setTimeout(()=>{host.removeEventListener('oprn:action',observed);reject(new Error('missing receipt'));},1000);
    host.addEventListener('oprn:action',observed);
  });
  const accepted=observe(); assert.equal(handleAction(scene),true); const first=await accepted;
  assert.equal(first.receipt.sequence,1);assert.equal(first.receipt.farmAttempts[0].kind,'tilled');assert.equal(first.state.energy,0);
  assert.deepEqual(first.mirror.farmPlots,session.farmPlots);assert.deepEqual(first.mirror.actionReceipt,first.receipt);
  scene.facing='right'; const before=structuredClone(session); const rejected=observe();assert.equal(handleAction(scene),false);const second=await rejected;
  assert.equal(second.receipt.sequence,2);assert.equal(second.receipt.farmAttempts[0].reason,'insufficient-energy');assert.deepEqual(session,before);
  assert.deepEqual(second.mirror.actionReceipt,second.receipt);assert.deepEqual(second.state.actionReceipt,second.receipt);
  const life=buildLifeRuntimeSnapshot(session);assert.deepEqual(life.farmPlots,session.farmPlots);life.farmPlots[scene.map.id]['2,3'].tilled=false;assert.equal(session.farmPlots[scene.map.id]['2,3'].tilled,true);
  const disk=createSaveSnapshot(project,session);assert.equal('actionReceipt' in disk,false);assert.equal('actionReceipt' in session,false);
  assert.equal('lifeRecovery' in buildLifeRuntimeSnapshot(session),false);
  const output={surface:'public modules, not player gameplay',project:project.meta.title,first,second,rejectedSessionUnchanged:true,observationDetached:true,receiptNotSaved:true};
  await writeFile(new URL('instrumentation.json',import.meta.url),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
  scene.events.emit('shutdown');assert.equal(window.__oprnDebug,undefined);assert.equal(window.__oprnInput,undefined);
  const offHost=document.createElement('div');const off=new RuntimeDomOverlay(()=>offHost);scene.runtimeDom=off;scene.game.registry.get=()=>offHost;
  const events=[];offHost.addEventListener('oprn:action',e=>events.push(e));handleAction(scene);scene.syncRuntimeState();
  assert.equal(off.actionReceipt,undefined);assert.equal(events.length,0);assert.equal(offHost.querySelector('[data-testid=runtime-state-json]'),null);
  console.log(JSON.stringify({off:{receipt:null,events:0,mirror:null},shutdownGlobalsRemoved:true}));
} finally {
  window.localStorage.clear();window.close();await server.close();
  for(const [key,descriptor] of previous) {if(descriptor) Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  console.log(JSON.stringify({cleanup:'happy-dom, Storage, SSR server, globals closed/restored'}));
}
