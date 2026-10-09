// Real exported player, isolated predecessor save, genuine input across entrances.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const [base,slotPath,preparedDir,out]=process.argv.slice(2);
if(!out)throw Error('Usage: npc-wayfinding-native.probe.mjs player-base old-slot prepared-directory output');
await fs.mkdir(out,{recursive:true});
const slot=await fs.readFile(slotPath,'utf8'),expected=JSON.parse(slot).session;
const adoption=JSON.parse(await fs.readFile(join(preparedDir,'adoption.json'),'utf8'));
const project=JSON.parse(await fs.readFile(join(preparedDir,'prepared-canonical.json'),'utf8'));
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});
page.on('requestfailed',r=>{if(!r.url().endsWith('/favicon.ico'))errors.push(r.failure()?.errorText+' '+r.url());});
const report={scope:'Actual exported player. Isolated genuine predecessor slot. QA teleports only for setup; keyboard inputs own the door/dock/stairs transitions. A separate runtime phase unlocks progression switches only to exercise conditional exits; no user saves or canonical writes.',errors,transfers:[],maps:[]};
await page.addInitScript(raw=>localStorage.setItem('starlight-islands-v1:save-slot:v5:1',raw),slot);
await page.route('**/player.html',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('saveNamespace:"starlight-islands-v1"','saveNamespace:"starlight-islands-v1",qaInstrumentation:true')});});
const key=async k=>{await page.keyboard.down(k);await page.waitForTimeout(70);await page.keyboard.up(k);await page.waitForTimeout(180);};
const state=()=>page.evaluate(()=>window.__oprnDebug.readState());
const shot=async name=>page.screenshot({path:resolve(out,name+'.png')});
async function choose(id){const row=page.getByTestId(id);await row.waitFor();for(let n=0;n<30;n++){if((await row.getAttribute('class'))?.includes('selected')){await key('Enter');return;}await key('ArrowDown');}throw Error('No selected row '+id);}
async function drain(){for(let n=0;n<30;n++){if(!await page.getByTestId('dialogue-box').count())return;await key('Enter');}throw Error('Dialogue remains');}
let observeOnly=false;
const idle=()=>page.waitForFunction(()=>{const s=window.__oprnHooksScene;return s&&s.inputEnabled&&!s.running&&!s.moving;},undefined,{timeout:15000});
async function teleport(map,x,y){if(!observeOnly)await idle();await page.evaluate(({map,x,y})=>window.__oprnDebug.teleport(map,x,y),{map,x,y});await page.waitForTimeout(1000);await drain();if(!observeOnly)await idle();}
try{
 await page.goto(base+'/player.html');await page.getByTestId('title-screen').waitFor({timeout:90000});
 console.log('native title loaded');
 await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done');
 for(let n=0;n<8&&(await page.getByTestId('title-load-game').getAttribute('aria-selected'))!=='true';n++)await key('ArrowDown');
 await key('Enter');await choose('save-slot-1');await page.waitForFunction(()=>window.__oprnDebug?.readState().currentMapId,undefined,{timeout:90000});
 await page.getByTestId('play-loading-overlay').waitFor({state:'detached',timeout:90000});
 const loaded=await state();for(const k of ['gold','inventory','monsterParty','monsterInstances'])assert.deepEqual(JSON.parse(JSON.stringify(loaded[k])),expected[k],k);
 report.predecessorPreserved=true;
 console.log('predecessor loaded');
 await teleport('mx_map_home',10,10);await shot('01-home');
 const school=adoption.relocations.find(r=>r.target==='mx_map_school');
 await teleport(school.map,school.landing.x,school.landing.y);await shot('02-school-door');await key('ArrowUp');
 await page.waitForFunction(()=>window.__oprnDebug.readState().currentMapId==='mx_map_school');await page.waitForTimeout(750);await shot('03-school');
 report.transfers.push({from:'mx_map_home',to:'mx_map_school',input:'ArrowUp',native:true});
 await teleport('mx_map_school',7,8);await key('ArrowDown');await page.waitForFunction(()=>window.__oprnDebug.readState().currentMapId==='mx_map_home');await page.waitForTimeout(700);
 let returned=await state();assert.equal(returned.x,school.landing.x);assert.equal(returned.y,school.landing.y);report.schoolReturn={x:returned.x,y:returned.y};
 const mart=project.maps.mx_map_home.events.find(e=>e.id==='mx_map_home_to_mx_map_home_mart');
 await teleport('mx_map_home',mart.x,mart.y+1);await key('ArrowUp');await page.waitForFunction(()=>window.__oprnDebug.readState().currentMapId==='mx_map_home_mart');await page.waitForTimeout(800);await shot('04-merchant');
 await teleport('mx_map_home_center',7,8);await shot('05-nurse');
 // View every authored map in the shipping runtime, including inactive story pages.
 observeOnly=true;
 for(const map of Object.values(project.maps)){
  const anchor=map.events.find(e=>e.pages.some(p=>/^oprn_emerald_field_cast_/.test(p.graphic?.sprite?.id??'')));
  await teleport(map.id,anchor?.x??Math.floor(map.width/2),Math.min(map.height-1,(anchor?.y??Math.floor(map.height/2))+1));
  const observation=await page.evaluate(()=>{
   const s=window.__oprnHooksScene;return [...s.eventSprites.entries()].map(([id,p])=>({id,texture:p.texture.key,width:p.frame.width,height:p.frame.height,scale:p.scaleX,alpha:p.alpha,visible:p.visible}));
  });
  assert(!observation.some(s=>s.texture==='mx_marker_exit'&&s.visible&&s.alpha>0),'Visible portal arrow '+map.id);
  const humans=observation.filter(s=>/^oprn_emerald_field_cast_/.test(s.texture));
  assert(humans.every(s=>s.width===24&&s.height===32&&s.scale===1),'NPC resized '+map.id);
  report.maps.push({id:map.id,nativeNpcSprites:humans.length,noArrow:true});
  if(report.maps.length%10===0)console.log('maps observed '+report.maps.length);
 }
 // Reload the genuine slot before input checks. Viewing the ending map in the
 // observation pass can start its interpreter; QA teleports do not cancel it.
 await page.reload();await page.getByTestId('title-screen').waitFor({timeout:90000});
 await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done');
 for(let n=0;n<8&&(await page.getByTestId('title-load-game').getAttribute('aria-selected'))!=='true';n++)await key('ArrowDown');
 await key('Enter');await choose('save-slot-1');await page.getByTestId('play-loading-overlay').waitFor({state:'detached',timeout:90000});
 await page.waitForFunction(()=>window.__oprnDebug?.readState().currentMapId,undefined,{timeout:90000});
 observeOnly=false;
 // Explicit temporary progression setup for relocated conditional links only.
 // Existing authored conditions are left intact.
 const flags=new Set();
 const visitCondition=c=>{if(!c||typeof c!=='object')return;if(c.kind==='switch'&&c.value===true)flags.add(c.switchId);for(const v of Object.values(c))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(visitCondition):visitCondition(v);};
 const visitCommands=items=>{for(const c of items??[]){if(c.kind==='fork')visitCondition(c.condition);for(const key of ['then','else','commands'])if(Array.isArray(c[key]))visitCommands(c[key]);}};
 for(const r of adoption.relocations){const e=project.maps[r.map].events.find(e=>e.id===r.map+'_to_'+r.target);for(const pg of e.pages)visitCommands(pg.commands);}
 report.qaProgressionFlags=[...flags];
 await page.evaluate(flags=>{const s=window.__oprnHooksScene.getSession();for(const k of flags)s.switches[k]=true;},[...flags]);
 const keys={'0,-1':'ArrowUp','0,1':'ArrowDown','-1,0':'ArrowLeft','1,0':'ArrowRight'};
 for(const r of adoption.relocations){
  console.log('entrance '+r.map+' -> '+r.target);
  await teleport(r.map,r.landing.x,r.landing.y);
  const dx=r.source.x-r.landing.x,dy=r.source.y-r.landing.y;assert.equal(Math.abs(dx)+Math.abs(dy),1);
  const k=keys[`${dx},${dy}`];await page.keyboard.down(k);await page.waitForTimeout(170);await page.keyboard.up(k);await page.waitForTimeout(300);
  await page.waitForFunction(target=>window.__oprnDebug.readState().currentMapId===target,r.target,{timeout:12000});
  await page.waitForTimeout(500);report.transfers.push({from:r.map,to:r.target,input:keys[`${dx},${dy}`],native:true,qaProgressionSetup:true});
 }
 await teleport('mx_map_harbor',18,9);await shot('06-harbor');
 await teleport('mx_map_harbor',28,5);await shot('07-pier');
 await teleport('mx_map_prism',19,11);await shot('08-city-doors');
 await teleport('mx_map_frost',16,8);await shot('09-frost-gate');
 await teleport('mx_map_home',10,10);await key('Escape');await page.getByTestId('status-menu-command-monsters').waitFor();await shot('10-menu');await key('Escape');
 const mover=Object.values(project.maps.mx_map_home.events).find(e=>e.pages.some(p=>p.movement?.type==='custom'&&/^oprn_emerald_field_cast_/.test(p.graphic?.sprite?.id??'')));
 assert(mover,'No human mover');
 report.walk=await page.evaluate(async id=>{const samples=[];for(let n=0;n<80;n++){const p=window.__oprnHooksScene.eventSprites.get(id);if(p)samples.push({x:p.x,y:p.y,frame:Number(p.frame.name),scale:p.scaleX,width:p.frame.width,height:p.frame.height});await new Promise(r=>setTimeout(r,50));}return samples;},mover.id);
 assert(new Set(report.walk.map(s=>`${s.x},${s.y}`)).size>3,'Human NPC does not walk');
 assert(new Set(report.walk.map(s=>s.frame)).size>=3,'Human NPC does not animate');
 assert.deepEqual(errors,[]);report.completed=true;
}catch(e){report.failure=String(e);report.failureState=await state().catch(()=>null);report.scene=await page.evaluate(()=>{const s=window.__oprnHooksScene;return s?{map:s.map?.id,inputEnabled:s.inputEnabled,running:s.running,moving:s.moving}:null;}).catch(()=>null);report.failureUi=(await page.locator('body').innerText()).slice(0,1800);await shot('failure');throw e;}
finally{await fs.writeFile(join(out,'report.json'),JSON.stringify(report,null,2));await fs.writeFile(join(out,'SUMMARY.md'),`# NPC and entrances\n\nCompleted: ${report.completed===true}.\n\n${report.scope}\n\nImmediate review: 01-home.png,02-school-door.png,04-merchant.png,06-harbor.png,07-pier.png,08-city-doors.png.\n`);await browser.close();}
console.log(JSON.stringify({completed:report.completed,maps:report.maps.length,nativeTransfers:report.transfers.length,errors}));
