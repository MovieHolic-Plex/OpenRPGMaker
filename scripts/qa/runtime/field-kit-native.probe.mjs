// Actual compiled player and genuine predecessor slot in a private browser.
// Observation and teleports only, except a temporary HP deficit to exercise native medicine.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [base,slotPath,outArg]=process.argv.slice(2);
if(!outArg)throw Error('Usage: field-kit-native.probe.mjs compiled-player-base genuine-slot.json output');
const out=resolve(outArg);await fs.mkdir(out,{recursive:true});
const slotBytes=await fs.readFile(slotPath,'utf8'),expected=JSON.parse(slotBytes).session;
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
const report={scope:'Compiled exported player with its own project.json. Genuine predecessor slot in isolated browser. QA teleports, one temporary HP deficit and one paused NPC mover for collision observation. Native menu/item/shop/save behavior; no user-save or canonical writes.',slotSha256:createHash('sha256').update(slotBytes).digest('hex'),errors};
await page.addInitScript(slot=>{
 localStorage.setItem('starlight-islands-v1:save-slot:v5:1',slot);
 const play=HTMLMediaElement.prototype.play,ids=new WeakMap();let serial=0;window.__fieldKitMedia=new Map();window.__fieldKitPlays=[];
 HTMLMediaElement.prototype.play=function(){if(!ids.has(this)){ids.set(this,++serial);window.__fieldKitMedia.set(serial,this);}window.__fieldKitPlays.push({id:ids.get(this),loop:this.loop,time:this.currentTime});return play.call(this);};
},slotBytes);
await page.route('**/player.html',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('saveNamespace:"starlight-islands-v1"','saveNamespace:"starlight-islands-v1",qaInstrumentation:true')});});
const key=async k=>{await page.keyboard.down(k);await page.waitForTimeout(70);await page.keyboard.up(k);await page.waitForTimeout(130);};
const shot=async name=>page.screenshot({path:resolve(out,name+'.png')});
const state=()=>page.evaluate(()=>window.__oprnDebug.readState());
const sound=()=>page.evaluate(()=>({observed:[...window.__oprnAudioObserved],plays:window.__fieldKitPlays.filter(x=>x.loop),live:[...window.__fieldKitMedia].filter(([,a])=>a.loop&&!a.paused).map(([id,a])=>({id,time:a.currentTime,duration:a.duration,ready:a.readyState,volume:a.volume})),juice:window.__oprnJuiceLog?.().map(e=>({event:e.event,soundResourceId:e.soundResourceId}))??[]}));
async function choose(testId){const row=page.getByTestId(testId);await row.waitFor();for(let n=0;n<30;n++){if((await row.getAttribute('class'))?.includes('selected')){await key('Enter');return;}await key('ArrowDown');}throw Error('Cursor never reached '+testId);}
async function drain(){for(let n=0;n<25;n++){if(!await page.getByTestId('dialogue-box').count())return;await key('Enter');}throw Error('Dialogue still open');}
try{
 await page.goto(base+'/player.html');await page.getByTestId('title-screen').waitFor({timeout:90000});await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done');
 for(let n=0;n<8&&(await page.getByTestId('title-load-game').getAttribute('aria-selected'))!=='true';n++)await key('ArrowDown');
 await key('Enter');await page.getByTestId('save-slot-1').waitFor();await choose('save-slot-1');
 await page.waitForFunction(()=>window.__oprnDebug?.readState().currentMapId,undefined,{timeout:90000});await page.getByTestId('play-loading-overlay').waitFor({state:'detached',timeout:90000});
 const loaded=await state();for(const k of ['currentMapId','x','y','gold','inventory','monsterParty','monsterBox','monsterInstances'])assert.deepEqual(JSON.parse(JSON.stringify(loaded[k])),expected[k],k);report.predecessorPreserved=true;console.log('predecessor loaded');
 await page.evaluate(()=>window.__oprnDebug.teleport('mx_map_home',10,10));await page.waitForTimeout(800);await drain();
 await page.waitForFunction(()=>window.__oprnHooksScene.eventSprites.has('mx_map_home_field_flurrykit'));
 await shot('01-field');
 report.walk=await page.evaluate(async()=>{
  const scene=window.__oprnHooksScene,id='mx_map_home_field_flurrykit',samples=[],start=performance.now();
  for(let i=0;i<150;i++){const s=scene.eventSprites.get(id);samples.push({ms:Math.round(performance.now()-start),x:s.x,y:s.y,frame:Number(s.frame.name),width:s.frame.width,height:s.frame.height,scale:s.scaleX});await new Promise(r=>setTimeout(r,50));}
  return samples;
 });
 assert(report.walk.every(s=>s.width===24&&s.height===32&&s.scale===1),'Native sprite dimensions');assert(new Set(report.walk.map(s=>s.frame)).size>=8,'Four-direction motion frames');
 const visited=new Set(report.walk.map(s=>`${s.x},${s.y}`));assert(visited.size>8,'Monster actually moves');
 // Temporarily freeze just this mover at an authored idle tile; no graphic/page/collision edits.
 await page.waitForFunction(()=>!window.__oprnHooksScene.autonomousNPCs.get('mx_map_home_field_flurrykit')?.activeMove);
 report.collision=await page.evaluate(()=>{
  const s=window.__oprnHooksScene,id='mx_map_home_field_flurrykit';window.__fieldKitMover=s.autonomousNPCs.get(id);s.autonomousNPCs.delete(id);
  const p=s.eventPositions[id]??{x:11,y:10};window.__fieldKitNpcTile={x:Math.round(p.x),y:Math.round(p.y)};
  const at=window.__fieldKitNpcTile;window.__oprnDebug.teleport('mx_map_home',at.x-1,at.y);return {npc:at};
 });
 await page.waitForTimeout(300);const beforeCollision=await state();await page.keyboard.down('ArrowRight');await page.waitForTimeout(350);await page.keyboard.up('ArrowRight');
 const afterCollision=await state();report.collision.playerBefore={x:beforeCollision.x,y:beforeCollision.y};report.collision.playerAfter={x:afterCollision.x,y:afterCollision.y};assert.equal(afterCollision.x,beforeCollision.x);assert.equal(afterCollision.y,beforeCollision.y);
 await key('Enter');await page.getByTestId('dialogue-box').waitFor();await page.waitForFunction(()=>document.querySelector('[data-testid="dialogue-box"]')?.innerText.includes('눈송냥'));report.dialogue=await page.getByTestId('dialogue-box').innerText();assert.match(report.dialogue,/눈송냥|차가운/);await shot('02-monster-dialogue');await drain();
 await page.evaluate(()=>{if(window.__fieldKitMover)window.__oprnHooksScene.autonomousNPCs.set('mx_map_home_field_flurrykit',window.__fieldKitMover);});
 await page.evaluate(()=>window.__oprnDebug.teleport('mx_map_home',10,10));await page.waitForTimeout(500);
 report.audioBefore=await sound();assert(report.audioBefore.observed.includes('composed_music_fieldkit_town_v1'));
 await key('Escape');await page.getByTestId('status-menu-command-monsters').waitFor();assert.equal(await page.getByTestId('status-menu-command-monsters').innerText(),'파티');await shot('03-menu');
 await choose('status-menu-command-monsters');await page.locator('[data-party-slot]').first().waitFor();assert.equal(await page.locator('[data-party-slot]').count(),6);await shot('04-party');
 await key('Enter');await shot('05-summary');await key('Escape');await key('Escape');
 await choose('status-menu-command-items');await shot('06-bag');
 // Private runtime HP deficit; the native item controller must own consumption/healing.
 report.medicineBefore=await page.evaluate(()=>{const s=window.__oprnHooksScene.getSession(),id=s.monsterParty[0];s.monsterInstances[id].currentHp=1;return {id,hp:1,count:s.inventory.item_potion};});
 await choose('status-menu-item-item_potion');await choose('status-menu-item-use-item_potion');await choose('status-menu-monster-'+report.medicineBefore.id);
 const healed=await state();report.medicineAfter={hp:healed.monsterInstances[report.medicineBefore.id].currentHp,count:healed.inventory.item_potion};assert(report.medicineAfter.hp>1);assert.equal(report.medicineAfter.count,report.medicineBefore.count-1);await shot('07-native-medicine');
 await key('Escape');await key('Escape');if(await page.getByTestId('main-menu').count())await key('Escape');await drain();
 report.audioAfter=await sound();const continuous=report.audioBefore.live.find(a=>report.audioAfter.live.some(b=>b.id===a.id&&b.time>a.time));assert(continuous,'Menus restarted BGM');assert.equal(report.audioAfter.plays.length,report.audioBefore.plays.length,'Extra looping source');
 assert(report.audioAfter.juice.some(e=>e.soundResourceId==='mx_fieldkit_cursor_v1'));assert(report.audioAfter.juice.some(e=>e.soundResourceId==='mx_fieldkit_confirm_v1'));assert(report.audioAfter.juice.some(e=>e.soundResourceId==='mx_fieldkit_cancel_v1'));
 await page.evaluate(()=>window.__oprnDebug.teleport('mx_map_home',5,16));await key('ArrowUp');await page.waitForFunction(()=>window.__oprnDebug.readState().currentMapId==='mx_map_home_mart');await drain();
 // Genuine stock counter; only setup positioning is teleported.
 await page.waitForTimeout(1000);await page.evaluate(()=>window.__oprnDebug.teleport('mx_map_home_mart',6,7));await page.waitForTimeout(350);await key('ArrowUp');await page.waitForTimeout(450);await key('Enter');await drain();
 await page.getByTestId('shop-mode-buy').waitFor({timeout:15000});await key('Enter');await page.locator('[data-testid^="shop-buy-"]').first().waitFor();await shot('08-shop');
 report.shopBefore={gold:(await state()).gold,inventory:(await state()).inventory};
 await key('Enter');await page.locator('.emerald-shop-shell[data-shop-phase="quantity"]').waitFor();await key('Enter');await page.locator('.emerald-shop-shell[data-shop-phase="confirm"]').waitFor();await shot('09-shop-confirm');await key('Enter');await page.locator('.emerald-shop-shell[data-shop-phase="receipt"]').waitFor();
 report.shopAfter={gold:(await state()).gold,inventory:(await state()).inventory};assert(report.shopAfter.gold<report.shopBefore.gold);assert.notDeepEqual(report.shopAfter.inventory,report.shopBefore.inventory);
 await key('Enter');await key('Escape');await key('Escape');await drain();
 await page.evaluate(()=>window.__oprnDebug.teleport('mx_map_meadow',5,10));await page.waitForTimeout(800);report.routeAudio=await sound();assert(report.routeAudio.observed.includes('composed_music_fieldkit_route_v1'));
 await page.evaluate(()=>window.__oprnDebug.teleport('mx_map_frost',7,8));await page.waitForTimeout(700);await shot('10-frost');assert(await page.evaluate(()=>window.__oprnHooksScene.eventSprites.has('mx_map_frost_field_flurrykit')));
 await page.evaluate(()=>window.__oprnDebug.teleport('mx_map_home',10,10));await page.waitForTimeout(400);await key('Escape');await choose('status-menu-command-save');await page.getByTestId('save-slot-2').waitFor();await key('ArrowDown');await key('Enter');
 await page.waitForFunction(()=>localStorage.getItem('starlight-islands-v1:save-slot:v5:2'));
 report.saved=await page.evaluate(()=>{const raw=localStorage.getItem('starlight-islands-v1:save-slot:v5:2'),s=JSON.parse(raw).session;return {currentMapId:s.currentMapId,gold:s.gold,inventory:s.inventory,monsterParty:s.monsterParty};});
 assert.deepEqual(report.saved.inventory,report.shopAfter.inventory);assert.equal(report.saved.gold,report.shopAfter.gold);

 await page.reload();await page.getByTestId('title-screen').waitFor({timeout:90000});await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done');
 for(let n=0;n<8&&(await page.getByTestId('title-load-game').getAttribute('aria-selected'))!=='true';n++)await key('ArrowDown');
 await key('Enter');await page.getByTestId('save-slot-2').waitFor();await choose('save-slot-2');await page.getByTestId('play-loading-overlay').waitFor({state:'detached',timeout:90000});await page.waitForFunction(()=>window.__oprnDebug?.readState().currentMapId==='mx_map_home');
 const resumed=await state();for(const k of ['gold','inventory','monsterParty'])assert.deepEqual(resumed[k],report.saved[k]);report.nativeSaveReload=true;console.log('native slot 2 reloaded');
 await page.setViewportSize({width:390,height:844});await shot('11-narrow');
 // Separate derived slot: snow-cat species only, to exercise the real follower loader.
 const followerSlot=JSON.parse(slotBytes);followerSlot.session.monsterInstances[followerSlot.session.monsterParty[0]].speciesId='mx_species_flurrykit';
 await page.evaluate(raw=>localStorage.setItem('starlight-islands-v1:save-slot:v5:3',raw),JSON.stringify(followerSlot));
 await page.setViewportSize({width:960,height:720});await page.reload();await page.getByTestId('title-screen').waitFor({timeout:90000});await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done');
 for(let n=0;n<8&&(await page.getByTestId('title-load-game').getAttribute('aria-selected'))!=='true';n++)await key('ArrowDown');
 await key('Enter');await page.getByTestId('save-slot-3').waitFor();await choose('save-slot-3');await page.waitForFunction(()=>window.__oprnHooksScene?.followerSprites?.size>0,undefined,{timeout:90000});
 await page.evaluate(()=>window.__oprnDebug.teleport('mx_map_home',10,10));await page.waitForTimeout(700);await drain();
 report.follower=await page.evaluate(()=>[...window.__oprnHooksScene.followerSprites.values()].map(s=>({texture:s.texture.key,width:s.frame.width,height:s.frame.height,scale:s.scaleX})));
 assert(report.follower.some(s=>s.texture==='mx_field_flurrykit_approved_v1'&&s.width===24&&s.height===32&&s.scale===1));
 await key('ArrowDown');await key('ArrowDown');await shot('12-species-follower');report.followerFixture='Private copy of predecessor slot; only first monster species changed to flurrykit. No canonical/user-save writes.';
 report.editorChrome=await page.locator('.editor-shell,.workspace-topbar').count();assert.equal(report.editorChrome,0);assert.deepEqual(errors,[]);report.completed=true;
}catch(e){report.failure=String(e);report.body=(await page.locator('body').innerText()).slice(0,2000);await shot('failure');throw e;}
finally{await fs.writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await fs.writeFile(resolve(out,'SUMMARY.md'),`# Field kit native adoption\n\nCompleted: ${report.completed===true}.\n\n${report.scope}\n\nImmediate review: 01-field.png,02-monster-dialogue.png,03-menu.png,04-party.png,06-bag.png,08-shop.png,10-frost.png.\n`);await browser.close();}
console.log(JSON.stringify({completed:report.completed,predecessorPreserved:report.predecessorPreserved,medicine:report.medicineAfter,shop:report.shopAfter,saved:report.saved,errors}));
