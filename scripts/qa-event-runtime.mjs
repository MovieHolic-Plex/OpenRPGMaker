import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {startPlayerQaServer,runRuntimeQa} from './lib/runtimeQaRun.mjs';
const id='event-runtime-commands',out=`verify-shots/runtime-qa/${id}`;
const fixture='.omo/evidence/event-runtime-audit/runtime-project.json';
const server=await startPlayerQaServer();
const browser=await chromium.launch({headless:process.env.RUNTIME_QA_HEADED !== "1",args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu','--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebRTC']});
const context=await browser.newContext({recordVideo:{dir:'.omo/evidence/event-runtime-audit/videos',size:{width:1024,height:768}}});
const page=await context.newPage(); const errors=[]; const checks=[]; const browserWarnings=[];
const state=()=>page.evaluate(()=>window.__oprnDebug.readState());
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
async function line(text) {
 await page.waitForFunction(t=>document.querySelector('[data-testid="dialogue-box"].page-ready .body')?.textContent.includes(t),text,{timeout:20000});
 checks.push(text); console.log(text);
}
try {
 await fs.mkdir(out,{recursive:true});
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{
   if(m.type()==="warning" && /GL Driver Message.*GPU stall due to ReadPixels/.test(m.text())) browserWarnings.push(m.text());
   else if(["error","warning"].includes(m.type())) errors.push(m.text());
 });
 const save=JSON.parse(await fs.readFile(".omo/evidence/event-runtime-audit/load-slot.json","utf8"));
 console.log("booting shipping player");
 await page.route(url=>url.origin===new URL(server.url).origin&&!url.pathname.startsWith('/api/'),async r=>{try{await r.fulfill({response:await r.fetch({maxRetries:3})});}catch(e){errors.push(String(e));await r.abort().catch(()=>{});}});
 await page.routeWebSocket(url=>url.host===new URL(server.url).host,()=>{});
 await page.route('**/assets/movies/qa-event-runtime.webm',r=>r.fulfill({path:'.omo/evidence/event-runtime-audit/qa-event-runtime.webm',contentType:'video/webm'}));
 await page.addInitScript(()=>{
   window.__qaVideoEvents=[];
   for(const name of ['playing','ended','error']) document.addEventListener(name,e=>{
     if(e.target instanceof HTMLVideoElement) window.__qaVideoEvents.push({name,time:e.target.currentTime});
   },true);
 });
 const boot=await runRuntimeQa(page,{id,projectFixture:fixture,beats:[{id:'title',expect:{visibleText:{'title-screen':'Event runtime contract'}},shot:true}]},{serverUrl:server.url});
 assert.deepEqual(boot.errors,[]);assert.deepEqual(boot.beats[0].failures,[]);
 // The boot harness clears storage; install the test save only after title boot.
 await page.evaluate(snapshot=>localStorage.setItem("runtime-qa:event-runtime-commands:save-slot:1",JSON.stringify(snapshot)),save);
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>!!window.__oprnDebug?.readState().currentMapId,null,{timeout:120000});
 await line('CONDITION READY');assert.equal((await state()).switches.ready,true);
 await page.evaluate(()=>{
   window.__qaPositions=[];
   window.__qaPositionTimer=setInterval(()=>{const s=window.__oprnDebug.readState();window.__qaPositions.push({x:s.x,y:s.y,done:s.switches.path_done===true});},50);
 });
 await page.keyboard.press('Enter');await line('PATH COMPLETE');
 await page.evaluate(()=>clearInterval(window.__qaPositionTimer));
 const s=await state();assert.equal(s.x,7);assert.equal(s.y,6);assert.equal(s.variables.terrain_result,9);assert.equal(s.variables.event_result,1);
 const positions=await page.evaluate(()=>window.__qaPositions);
 assert(positions.some(p=>p.x!==3&&p.x!==7&&!p.done),'must observe intermediate walking before completion');
 assert(!positions.some(p=>p.x===5&&p.y===6),'must avoid blocker');
 await shot('01-path');
 await page.keyboard.press('Enter');await page.waitForSelector('[data-testid="main-menu"]');
 assert.equal(await page.locator('[data-testid="player-load-window"]').count(),0);
 assert.notEqual((await state()).switches.menu_done,true);
 await shot('02-menu');await page.keyboard.press('Escape');await line('MENU CLOSED');
 await page.keyboard.press('Enter');await page.waitForSelector('[data-testid="player-load-window"]');
 assert.notEqual((await state()).switches.load_done,true);
 const loadBounds=await page.evaluate(()=>{
   const panel=document.querySelector('[data-testid="player-load-window"]').getBoundingClientRect();
   const stage=document.querySelector('.play-stage').getBoundingClientRect();
   return {panel:{left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom},stage:{left:stage.left,top:stage.top,right:stage.right,bottom:stage.bottom}};
 });
 assert(loadBounds.panel.top>=loadBounds.stage.top && loadBounds.panel.bottom<=loadBounds.stage.bottom,'load window must fit the play stage');
 assert(loadBounds.panel.left>=loadBounds.stage.left && loadBounds.panel.right<=loadBounds.stage.right);
 await shot('03-load');await page.keyboard.press('Escape');await line('LOAD CLOSED');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0.1,null,{timeout:20000});
 assert.notEqual((await state()).switches.movie_done,true);
 await shot('04-movie');
 await line('MOVIE ENDED');assert.equal((await state()).switches.movie_done,true);
 const media=await page.evaluate(()=>window.__qaVideoEvents);
 assert(media.some(e=>e.name==='playing'));assert(media.some(e=>e.name==='ended'));assert(!media.some(e=>e.name==='error'));
 await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('[data-testid="dialogue-box"]'));
 await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>window.__oprnDebug.readState().y===7);
 checks.push('keyboard movement restored');await shot('05-finished');
 await page.keyboard.press('Enter');await page.waitForSelector('[data-testid="player-load-window"]');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__oprnDebug.readState().y===9,null,{timeout:20000});
 assert.equal((await state()).x,3);
 assert.equal(await page.locator('[data-testid="player-load-window"]').count(),0);
 assert.equal(await page.locator('[data-testid="dialogue-box"]').count(),0);
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.__oprnDebug.readState().x===4);
 checks.push('loaded saved session; old event abandoned; keyboard restored');await shot('06-loaded');
 assert.deepEqual(errors,[]);
} catch(e) {errors.push(e.stack||e.message);process.exitCode=1;await shot('failure').catch(()=>{});console.error(e.message);}
finally {
 const observations=await page.evaluate(()=>({positions:window.__qaPositions,media:window.__qaVideoEvents})).catch(()=>null);
 const finalState=await state().catch(()=>null);
 await fs.mkdir(out,{recursive:true});await context.close();const video=await page.video()?.path();
 await fs.writeFile(`${out}/report.json`,JSON.stringify({checks,errors,browserWarnings,observations,finalState,video},null,2));
 await fs.writeFile(`${out}/SUMMARY.md`,`# Event command shipping-player QA\n\nResult: ${errors.length?'FAIL':'PASS'}\n\nKeyboard input only; runtime hooks used for observation; preset save installed after title boot.\nChecks: ${checks.join(', ')}\n\n즉시 확인: ${errors.length?'failure.png':'01-path.png, 02-menu.png, 03-load.png, 04-movie.png, 05-finished.png, 06-loaded.png'}\nVideo: ${video}\nChromium GPU ReadPixels telemetry: ${browserWarnings.length} (retained in report.json).\n\n${errors.join('\n')}\n`);
 await browser.close();await server.close();
}
