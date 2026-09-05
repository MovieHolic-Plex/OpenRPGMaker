import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {startPlayerQaServer,runRuntimeQa} from '../../../scripts/lib/runtimeQaRun.mjs';
const root=new URL('./',import.meta.url).pathname;
const fixture=process.argv[2]??root+'final/project.json';
const project=JSON.parse(fs.readFileSync(fixture));
const label=process.env.JRPG_RUN??'final';
const out=root+'journey-'+label;fs.mkdirSync(out,{recursive:true});
const server=await startPlayerQaServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu','--disable-features=LocalNetworkAccessChecks']});
const context=await browser.newContext({viewport:{width:1280,height:900}});
let page=await context.newPage();
const errors=[],beats=[],routes=[];
async function transport(p){
 await p.route(`${server.url}/**`,async route=>{try{const r=await fetch(route.request().url());const h=Object.fromEntries(r.headers);for(const k of ['content-encoding','content-length','transfer-encoding'])delete h[k];await route.fulfill({status:r.status,headers:h,body:Buffer.from(await r.arrayBuffer())});}catch{await route.abort();}});
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
}
const state=()=>page.evaluate(()=>window.__oprnDebug.readState());
async function snap(id,check=()=>{}) {await page.waitForTimeout(500);const s=await state();check(s);assert.equal(await page.getByTestId('missing-resource-error').count(),0,'missing field resource');await page.screenshot({path:out+'/'+id+'.png'});beats.push({id,state:s});fs.writeFileSync(out+'/progress.json',JSON.stringify({beats,errors,routes},null,2));console.log('PASS',id,s.currentMapId,s.x,s.y,s.gold);}
async function closeDialogue(){for(let i=0;i<16&&await page.getByTestId('dialogue-box').count();i++){await page.keyboard.press('Enter');await page.waitForTimeout(180);}assert.equal(await page.getByTestId('dialogue-box').count(),0,'dialogue must close');}
async function interact(dir){
 for(let attempt=0;attempt<6;attempt++){
  await page.waitForFunction(()=>!window.__oprnPlayerSprite?.()?.moving,undefined,{timeout:30000});
  await page.waitForTimeout(350);
  if(await page.getByTestId('battle-scene').count()||await page.getByTestId('battle-transition-overlay').count()){await battle();continue;}
  await page.evaluate(d=>{window.__oprnInput.face(d);window.__oprnInput.action();},dir);
  // Encounters load their battle resources after the field step is committed.
  // A late random battle can consume the action edge; fight it, then talk again.
  await page.waitForFunction(()=>document.querySelector('[data-testid="dialogue-box"], [data-testid="battle-scene"], [data-testid="battle-transition-overlay"]'),undefined,{timeout:15000});
  if(await page.getByTestId('dialogue-box').count())return;
  await battle();
 }
 throw Error('Interaction repeatedly interrupted by battle');
}
async function battle(){
 await page.evaluate(()=>window.__oprnInput.dir(null));
 await page.getByTestId('battle-scene').waitFor({timeout:15000});
 const before=await state();await snap('battle-'+beats.length);
 for(let i=0;i<400 && await page.getByTestId('battle-scene').count();i++){await page.keyboard.press('z');await page.waitForTimeout(200);}
 assert.equal(await page.getByTestId('battle-scene').count(),0,'battle finishes using attack inputs');
 await page.waitForFunction(gold=>{const s=window.__oprnDebug.readState();return s.battleResult!==undefined&&s.gold>gold;},before.gold,{timeout:15000});
 await page.getByTestId('battle-transition-overlay').waitFor({state:'detached',timeout:15000});await page.waitForTimeout(350);
 await snap('victory-'+beats.length,s=>{assert.equal(s.battleResult,'victory');assert(s.gold>before.gold,'battle pays reward');});
}
async function walkTo(x,y,{targetMap}={}){
 const start=await state();const steps=[];const avoided=[];
 for(let attempt=0;attempt<300;attempt++){
  await page.waitForFunction(()=>!window.__oprnPlayerSprite?.()?.moving,undefined,{timeout:30000});
  const here=await state();
  if((targetMap&&here.currentMapId===targetMap)||(!targetMap&&here.currentMapId===start.currentMapId&&here.x===x&&here.y===y)){
   routes.push({map:start.currentMapId,from:{x:start.x,y:start.y},to:{x,y},steps});return;
  }
  assert.equal(here.currentMapId,start.currentMapId,'unexpected map while walking');
  const route=await page.evaluate(async({x,y,avoided})=>{
   const project=window.__jrpgJourneyProject;
   const {canMove}=await import('/src/project/collision.ts');
   const {TILE_SIZE}=await import('/src/assets/bundled.ts');
   const s=window.__oprnDebug.readState(),map=project.maps[s.currentMapId];
   const sprites=window.__oprnCharacterSprites?.()?.events??{};
   const blocked=new Set(avoided);
   for(const e of map.events.filter(e=>e.pages.some(p=>p.priority==='same'))){
    const sprite=sprites[e.id],pos=s.eventLocations?.[e.id];
    const ex=sprite?Math.round(sprite.x/TILE_SIZE-.5):(pos?.x??e.x);
    const ey=sprite?Math.round(sprite.y/TILE_SIZE-1):(pos?.y??e.y);
    blocked.add(`${ex},${ey}`);
   }
   const queue=[{x:s.x,y:s.y,path:[]}],seen=new Set([`${s.x},${s.y}`]);
   for(let i=0;i<queue.length;i++){
    const n=queue[i];if(n.x===x&&n.y===y)return n.path;
    for(const [dx,dy,dir]of[[1,0,'right'],[-1,0,'left'],[0,1,'down'],[0,-1,'up']]){
     const nx=n.x+dx,ny=n.y+dy,k=`${nx},${ny}`;
     if(seen.has(k)||blocked.has(k)||!canMove(project,map,n.x,n.y,nx,ny))continue;
     seen.add(k);queue.push({x:nx,y:ny,path:[...n.path,{x:nx,y:ny,dir}]});
    }
   }
   throw Error(`No walkable route ${s.currentMapId}:${s.x},${s.y} -> ${x},${y}`);
  },{x,y,avoided:avoided.filter(v=>v.until>attempt).map(v=>v.tile)});
  if(route.length===0&&targetMap){
   // Door animation finishes after the step onto its trigger pad.
   await page.waitForFunction(map=>window.__oprnDebug.readState().currentMapId===map,targetMap,{timeout:15000});
   continue;
  }
  const step=route[0];assert(step,'missing next step');
  const result=await page.evaluate(({step,here})=>new Promise((resolve,reject)=>{
   const started=performance.now();let movingSeen=false;
   window.__oprnInput.dir(step.dir);window.__oprnInput.dir(null);
   function tick(){
    const s=window.__oprnDebug.readState(),sprite=window.__oprnPlayerSprite?.();
    movingSeen ||= sprite?.moving===true;
    const inBattle=!!document.querySelector('[data-testid="battle-scene"], [data-testid="battle-transition-overlay"]');
    if(inBattle||s.currentMapId!==here.currentMapId||(!sprite?.moving&&(s.x!==here.x||s.y!==here.y))){resolve({kind:inBattle?'battle':'moved',x:s.x,y:s.y,map:s.currentMapId});return;}
    if(performance.now()-started>1200&&!sprite?.moving){resolve({kind:'blocked',movingSeen,events:window.__oprnCharacterSprites?.()?.events});return;}
    if(performance.now()-started>30000){reject(Error('Movement never settled'));return;}
    requestAnimationFrame(tick);
   }requestAnimationFrame(tick);
  }),{step,here});
  steps.push({from:{x:here.x,y:here.y},...step,result});
  if(result.kind==='battle'){await battle();continue;}
  if(result.kind==='blocked'){
   // Moving NPCs and input locks can change after BFS. Observe and walk around;
   // never teleport, change collisions, or advance game state to satisfy QA.
   avoided.push({tile:`${step.x},${step.y}`,until:attempt+5});
  }
  await page.waitForTimeout(80);
 }
 throw Error(`Walk exceeded step budget ${start.currentMapId} -> ${x},${y}`);
}

try{
 await transport(page);
 const boot=await runRuntimeQa(page,{id:'jrpg-journey-'+label,projectFixture:fixture,viewport:{width:1280,height:900},beats:[{id:'title',expect:{testidPresent:['title-screen']},shot:true},{id:'start',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'},{kind:'seed',seed:1}],expect:{mapId:project.startMapId,...project.startPos,playerSpriteTextureLoaded:true},shot:true}]},{serverUrl:server.url,outDir:out+'/boot'});
 await page.evaluate(p=>{window.__jrpgJourneyProject=p;},project);
 assert.equal(boot.errors.length,0);assert(boot.beats.every(b=>b.failures.length===0));
 await snap('start',s=>{assert.equal(s.partyActorIds.length,3);assert.equal(s.gold,200);assert.equal(s.inventory.item_potion,3);});
 await interact('up');await page.getByTestId('dialogue-box').waitFor();await snap('guide');await closeDialogue();
 await walkTo(16,16);await interact('left');await page.getByTestId('dialogue-box').waitFor();await closeDialogue();await page.getByTestId('shop-scene').waitFor();await snap('shop');
 await page.getByTestId('shop-mode-buy').focus();await page.keyboard.press('Enter');await page.getByTestId('shop-buy-item_potion').waitFor();
 // Keyboard focus selects a visible row without bypassing the activation handler.
 await page.getByTestId('shop-buy-item_potion').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__oprnDebug.readState().inventory.item_potion===4,{},{timeout:10000});
 await snap('purchase',s=>{assert.equal(s.gold,150);assert.equal(s.inventory.item_potion,4);});
 for(let i=0;i<4&&await page.getByTestId('shop-scene').count();i++){await page.keyboard.press('Escape');await page.waitForTimeout(200);}
 for(const [n,door]of project.maps[project.startMapId].events.filter(e=>e.id.includes('house_door')&&e.id.endsWith('_step')).entries()){
  const source=project.maps[project.startMapId].events.find(e=>e.id===door.pages[0].commands.find(c=>c.kind==='callMapEvent').eventId);
  const destination=source.pages[0].commands.find(c=>c.kind==='transfer');
  await walkTo(door.x,door.y,{targetMap:destination.mapId});await snap('house-'+(n+1)+'-entry',s=>assert.equal(s.currentMapId,destination.mapId));
  const exit=project.maps[destination.mapId].events.find(e=>e.pages.some(p=>p.commands.some(c=>c.kind==='transfer'&&c.mapId===project.startMapId)));
  await walkTo(exit.x,exit.y,{targetMap:project.startMapId});await snap('house-'+(n+1)+'-return',s=>assert.equal(s.currentMapId,project.startMapId));
 }
 if(process.env.JRPG_PROBE==='houses'){await snap('houses-probe-complete');throw {qaProbeComplete:true};}
 await walkTo(16,0,{targetMap:'map_forest_dungeon'});await snap('dungeon-entry',s=>assert.equal(s.currentMapId,'map_forest_dungeon'));
 await walkTo(6,6);await interact('up');await page.getByTestId('dialogue-box').waitFor();
 const beforeChest=beats.at(-1).state.gold;await snap('chest-open',s=>assert(s.gold>=beforeChest+100));const chestState=await state();await closeDialogue();await interact('up');await page.getByTestId('dialogue-box').waitFor();await snap('chest-repeat',s=>{assert.equal(s.gold,chestState.gold);assert.deepEqual(s.inventory,chestState.inventory);});await closeDialogue();
 await walkTo(20,7);const eastBefore=await state();await interact('up');await page.getByTestId('dialogue-box').waitFor();await snap('east-chest-open',s=>{assert.equal(s.gold,eastBefore.gold+100);assert.equal(s.inventory.item_forest_dew,(eastBefore.inventory.item_forest_dew??0)+1);});const eastState=await state();await closeDialogue();await interact('up');await page.getByTestId('dialogue-box').waitFor();await snap('east-chest-repeat',s=>{assert.equal(s.gold,eastState.gold);assert.deepEqual(s.inventory,eastState.inventory);});await closeDialogue();
 await walkTo(12,9);await interact('up');await page.getByTestId('dialogue-box').waitFor();await page.waitForFunction(()=>document.querySelector('[data-testid="dialogue-box"]')?.textContent?.includes('크르르'),undefined,{timeout:15000});await snap('boss-introduction');for(let i=0;i<16&&!await page.getByTestId('battle-scene').count();i++){await page.keyboard.press('Enter');await page.waitForTimeout(200);}await battle();await closeDialogue();await page.waitForFunction(()=>window.__oprnDebug.readState().switches.sw_0001===true,{},{timeout:15000});await snap('boss-cleared');
 await walkTo(10,17);await interact('down');await page.getByTestId('dialogue-box').waitFor();await closeDialogue();await page.getByTestId('save-slot-1').waitFor();await snap('save-menu');
 await page.getByTestId('save-slot-1').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>Object.entries(localStorage).some(([k,v])=>k.endsWith(':save-slot:1')&&v.includes('map_forest_dungeon')));
 const savedState=await state();await snap('saved');
 // A fresh player page uses the same real storage and export entry, without the harness's fresh-run clear.
 const oldPage=page;page=await context.newPage();await transport(page);
 await page.route('**/__runtime-qa/project.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(project)}));
 await page.addInitScript(namespace=>{window.__OPENRPG_BOOT__={projectUrl:'/__runtime-qa/project.json',saveNamespace:namespace,qaInstrumentation:true};},'runtime-qa:jrpg-journey-'+label);
 await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});await page.getByTestId('title-screen').waitFor({timeout:120000});
 // The autosave Resume option appears only after a longer play session.
 // Select Load by its observed roving state, never by a fixed menu index.
 for(let n=0;n<5&&await page.getByTestId('title-load-game').getAttribute('aria-selected')!=='true';n++){
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(80);
 }
 assert.equal(await page.getByTestId('title-load-game').getAttribute('aria-selected'),'true');
 await page.screenshot({path:out+'/load-title.png'});
 await page.keyboard.press('Enter');await page.getByTestId('save-slot-1').waitFor();await page.getByTestId('save-slot-1').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__oprnDebug?.readState().currentMapId==='map_forest_dungeon',undefined,{timeout:30000});
 await snap('loaded',s=>{assert.equal(s.gold,savedState.gold);assert.deepEqual(s.inventory,savedState.inventory);assert.deepEqual(s.selfSwitches,savedState.selfSwitches);assert.deepEqual(s.switches,savedState.switches);assert.equal(s.partyActorIds.length,3);});await oldPage.close();
 await page.evaluate(p=>{window.__jrpgJourneyProject=p;},project);
 await walkTo(12,18,{targetMap:project.startMapId});await snap('returned',s=>assert.equal(s.currentMapId,project.startMapId));
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync(out+'/SUMMARY.md',`# JRPG 실제 플레이 QA\n\n통과 ${beats.length}개, 오류 ${errors.length}개.\n\n`+beats.map(b=>`- ${b.id}: ${b.state.currentMapId} (${b.state.x},${b.state.y}), ${b.state.gold}G`).join('\n'));
}catch(e){if(e.qaProbeComplete){fs.writeFileSync(out+'/SUMMARY.md','House traversal probe passed.');}else{console.error(e);fs.writeFileSync(out+'/exception.txt',String(e));await page.screenshot({path:out+'/exception.png'});fs.writeFileSync(out+'/exception-state.json',JSON.stringify(await state(),null,2));fs.writeFileSync(out+'/dom.txt',await page.locator('body').innerText());process.exitCode=1;}}
finally{fs.writeFileSync(out+'/journey.json',JSON.stringify({beats,errors,routes},null,2));await browser.close();await server.close();}
