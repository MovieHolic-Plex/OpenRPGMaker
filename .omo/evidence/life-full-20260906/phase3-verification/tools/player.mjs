import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { firefox } from '@playwright/test';
import { startPlayerQaServer, performObservedAction } from '../../../../../scripts/lib/runtimeQaRun.mjs';
const root=process.cwd(), out=`${root}/.omo/evidence/life-full-20260906/phase3-verification/tools`;
const cache=`${root}/.vite-cache/st_01a076ed-player`;
process.env.VITE_CACHE_DIR=cache;
const base=JSON.parse(await readFile(`${root}/.omo/evidence/life-full-20260906/5/project.json`,'utf8'));
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),cwd:root,port:35219,surface:'native Firefox, dedicated player.html, exportProjectStoreShim',runs:[],remoteWrites:[]};
let server,browser;
async function dom(page,kind,trigger=async()=>{}) {
 const pending=await page.evaluateHandle(kind=>{
  let cancel;
  const promise=new Promise(resolve=>{
   const finish=value=>{observer.disconnect();clearTimeout(timer);resolve(value);};
   const check=()=>{
    const ok=kind==='title'?document.querySelector('[data-testid="title-screen"]'):kind==='ready'?document.querySelector('[data-testid="runtime-state-json"]')&&!document.querySelector('[data-testid="play-loading-overlay"]'):document.querySelector('[data-testid="hand-slot-label"]')?.textContent.includes(kind);
    if(ok)finish({ok:true});
   };
   const observer=new MutationObserver(check), timer=setTimeout(()=>finish({error:`Missing DOM signal ${kind}`}),120000);
   cancel=()=>finish({error:'cancelled'});observer.observe(document,{childList:true,subtree:true,attributes:true,characterData:true});check();
  });return {promise,cancel:()=>cancel()};
 },kind);
 try{await trigger();const result=await pending.evaluate(x=>x.promise);assert.equal(result.error,undefined);}finally{await pending.evaluate(x=>x.cancel());await pending.dispose();}
}
const state=page=>page.evaluate(()=>window.__oprnDebug.readState());
const withoutReceipt=({actionReceipt,...rest})=>rest;
try {
 server=await startPlayerQaServer({port:35219});
 browser=await firefox.launch({headless:true});receipt.browserVersion=browser.version();
 for(const scenario of ['outside-held-hoe','conditionless-seed-refused','wall-protected','existing-fish-only']) {
  const project=structuredClone(base), map=project.maps[project.startMapId];
  project.meta.title=`st_01a076ed ${scenario}`;
  project.system.energy={max:10,initial:10,restorePerDay:0};
  project.system.skillSystem={enabled:false};
  map.farmableArea=[];
  const hoe=project.database.items.find(x=>x.id==='qa-hoe');assert.ok(hoe);
  hoe.name='Verify Hoe';hoe.consumable=false;
  const seed={...hoe,id:'verify-seed',name:'Verify Seed',type:'seed',consumable:true};delete seed.farmTool;
  project.database.items.push(seed);project.session.inventory['verify-seed']=3;
  project.database.crops=[{id:'verify-crop',name:'Verify Crop',seedItemId:'verify-seed',harvestItemId:'verify-seed',harvestCount:1,stages:[{days:1}],seasons:['spring','summer','autumn','winter']}];
  project.system.toolActions=scenario==='outside-held-hoe'?[
   {id:'special',action:'till',itemId:'qa-hoe',farmTool:'axe',requiresFarmable:false},
   {id:'legacy-hoe-till',farmTool:'hoe',requiresFarmable:true,action:'till'},
   {id:'legacy-can-water',farmTool:'wateringCan',requiresFarmable:true,action:'water'},
   {id:'legacy-axe-chop',farmTool:'axe',requiresFarmable:false,targetPlaceableKind:'tree',action:'chop'},
   {id:'legacy-pick-mine',farmTool:'pickaxe',requiresFarmable:false,targetPlaceableKind:'rock',action:'mine'},
  ]:scenario==='existing-fish-only'?[{id:'only-fish',action:'fish'}]:[{id:'any-tool',action:'till',requiresFarmable:false}];
  if(scenario==='wall-protected')map.lowerTiles[3*map.width+2]=-1;
  const wire=JSON.stringify(project), run={scenario,fixtureSha256:createHash('sha256').update(wire).digest('hex'),rules:project.system.toolActions,errors:[],failedRequests:[],actions:[]};receipt.runs.push(run);
  const context=await browser.newContext({viewport:{width:1280,height:960}}),page=await context.newPage();
  page.on('pageerror',error=>run.errors.push(error.message));page.on('requestfailed',request=>run.failedRequests.push({url:request.url(),error:request.failure()}));
  await page.route('**/*',route=>{
   const request=route.request();
   if(new URL(request.url()).pathname==='/__verify/project.json')return route.fulfill({status:200,contentType:'application/json',body:wire});
   if(!['GET','HEAD','OPTIONS'].includes(request.method())){receipt.remoteWrites.push({method:request.method(),url:request.url()});return route.abort();}
   return route.continue();
  });
  await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__verify/project.json',saveNamespace:'st_01a076ed-task8',qaInstrumentation:true};});
  try {
   await page.goto(`${server.url}/player.html`,{waitUntil:'domcontentloaded'});
   await dom(page,'title');await dom(page,'ready',()=>page.keyboard.press('Enter'));
   assert.equal(await page.getByTestId('toolbar-database').count(),0);
   await dom(page,scenario==='conditionless-seed-refused'?'Verify Seed':'Verify Hoe',()=>page.keyboard.press(scenario==='conditionless-seed-refused'?'2':'1'));
   run.initial=await state(page);assert.equal(run.initial.x,2);assert.equal(run.initial.y,2);
   const first=await performObservedAction(page,()=>page.keyboard.press('z'));run.actions.push(first);
   if(scenario==='outside-held-hoe') {
    assert.equal(first.receipt.farmAttempts[0].kind,'tilled');assert.equal(first.state.farmPlots[map.id]['2,3'].tilled,true);assert.equal(first.state.energy,9);
    const second=await performObservedAction(page,()=>page.keyboard.press('z'));run.actions.push(second);
    assert.equal(second.receipt.farmAttempts[0].reason,'wrong-tool-for-plot');assert.equal(second.state.inventory['verify-seed'],3);assert.equal(second.state.farmPlots[map.id]['2,3'].cropId,undefined);
    const third=await performObservedAction(page,()=>page.keyboard.press('z'));run.actions.push(third);
    assert.equal(third.receipt.handled,false);assert.deepEqual(withoutReceipt(third.state),withoutReceipt(second.state));
   } else if(scenario==='wall-protected') {
    assert.equal(first.receipt.farmAttempts[0].reason,'not-farmable');assert.equal(first.state.farmPlots[map.id]['2,3'],undefined);
    assert.equal(first.receipt.farmAttempts[1].kind,'tilled');assert.equal(first.state.energy,9);
   } else {
    assert.equal(first.receipt.handled,false);assert.deepEqual(withoutReceipt(first.state),withoutReceipt(run.initial));
   }
   assert.deepEqual(run.errors,[]);assert.deepEqual(run.failedRequests,[]);
   await page.screenshot({path:`${out}/player-${scenario}.png`});run.pass=true;
  }catch(error){run.failure=String(error.stack??error);run.html=await page.content();await page.screenshot({path:`${out}/player-${scenario}-failure.png`});throw error;}
  finally{await context.close();run.contextClosed=true;}
 }
 assert.deepEqual(receipt.remoteWrites,[]);receipt.pass=true;
}finally{
 await browser?.close();await server?.close();await rm(cache,{recursive:true,force:true});
 receipt.cleanup={browserClosed:true,contextsClosed:receipt.runs.every(x=>x.contextClosed),serverClosed:true,ownedCacheRemoved:cache};
 await writeFile(`${out}/player-state.json`,JSON.stringify(receipt,null,2)+'\n');
}
