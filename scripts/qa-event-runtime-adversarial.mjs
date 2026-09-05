import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {startPlayerQaServer,runRuntimeQa} from './lib/runtimeQaRun.mjs';
const root='.omo/evidence/event-runtime-adversarial';
const source=JSON.parse(await fs.readFile('.omo/evidence/event-runtime-audit/runtime-project.json','utf8'));
const m2=(commandId,fields)=>({kind:'m2Command',commandId,fields});
const path=(x,y,wait=true,speed=3)=>m2('m2-205-pathfind-move',{target:'player',x,y,speed,wait});
const scenarios=[
 {id:'retarget-player',commands:[path(7,6,false,2),{kind:'wait',ms:100},path(3,9,true,5)],expect:{x:3,y:9}},
 {id:'landing-player',commands:[path(7,6,false,2),{kind:'wait',ms:100},path(4,6,true,5)],expect:{x:4,y:6}},
 {id:'queued-player',commands:[path(7,6,false,2),path(3,6,true,5),{kind:'wait',ms:600}],expect:{x:3,y:6}},
 {id:'stop-player',commands:[path(10,6,false,2),{kind:'wait',ms:100},m2('m2-059-stop-all-movement',{}),{kind:'wait',ms:600}],expect:{stoppedBefore:10}},
 {id:'landing-npc',npc:true,commands:[m2('m2-205-pathfind-move',{target:'walker',x:9,y:6,speed:2,wait:false}),{kind:'wait',ms:100},m2('m2-205-pathfind-move',{target:'walker',x:6,y:6,speed:5,wait:true})],expect:{x:6,y:6}},
 {id:'unreachable-player',commands:[path(-1,6)],expect:{x:3,y:6,warning:true}},
];
const server=await startPlayerQaServer();
const browser=await chromium.launch({headless:process.env.RUNTIME_QA_HEADED !== '1',args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu','--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebRTC']});
const reports=[];
try {
 for(const scenario of scenarios) {
  const id='adversarial-'+scenario.id,out=`verify-shots/runtime-qa/${id}`;
  await fs.mkdir(out,{recursive:true});
  const p=structuredClone(source),map=p.maps[p.startMapId];
  const event=map.events.find(e=>e.id==='contract');
  event.pages[0].commands=[...scenario.commands,{kind:'text',body:'BOUNDARY FINISHED'},{kind:'setSwitch',switchId:'movie_done',value:true}];
  const walker=structuredClone(map.events.find(e=>e.id==='blocker'));
  walker.id='walker';
  map.events=scenario.npc?[event,walker]:[event];
  const fixture=`${root}/${scenario.id}.json`;await fs.writeFile(fixture,JSON.stringify(p));
  const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:`${root}/videos`,size:{width:1280,height:720}}});
  const page=await context.newPage(),errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  const report={id,errors,warnings,passed:false};
  try {
   await page.route(url=>url.origin===new URL(server.url).origin&&!url.pathname.startsWith('/api/'),async r=>r.fulfill({response:await r.fetch({maxRetries:3})}));
   await page.routeWebSocket(url=>url.host===new URL(server.url).host,()=>{});
   const boot=await runRuntimeQa(page,{id,viewport:{width:1280,height:720},projectFixture:fixture,beats:[{id:'title',expect:{visibleText:{'title-screen':'Event runtime contract'}},shot:true}]},{serverUrl:server.url});
   assert.deepEqual(boot.errors,[]);assert.deepEqual(boot.beats.flatMap(beat=>beat.failures),[]);
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('[data-testid="dialogue-box"].page-ready .body')?.textContent==='BOUNDARY FINISHED',null,{timeout:15000});
   const state=await page.evaluate(()=>window.__oprnDebug.readState());report.state=state;
   const position=scenario.npc?await page.evaluate(()=>JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent).events.walker):state;
   if(scenario.npc) {
    report.sprite=await page.evaluate(()=>window.__oprnCharacterSprites().events.walker);
    assert.equal(report.sprite.x,scenario.expect.x*16+8,'NPC must finish its visual landing before continuing');
   }
   await page.screenshot({path:`${out}/finished.png`});
   if(scenario.expect.x!==undefined)assert.equal(position.x,scenario.expect.x);
   if(scenario.expect.y!==undefined)assert.equal(position.y,scenario.expect.y);
   if(scenario.expect.stoppedBefore!==undefined)assert(state.x<scenario.expect.stoppedBefore);
   if(scenario.expect.warning)assert(warnings.some(w=>w.includes('unreachable')));
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>!document.querySelector('[data-testid="dialogue-box"]'));
   await page.keyboard.press('ArrowRight');
   await page.waitForFunction(x=>window.__oprnDebug.readState().x!==x,state.x);
   assert.deepEqual(errors,[]);report.passed=true;
  } catch(e) {report.failure=e.stack||String(e);process.exitCode=1;await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
  await context.close();report.video=await page.video()?.path();reports.push(report);
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
  await fs.writeFile(`${out}/SUMMARY.md`,`# ${id}\n\n${report.passed?'PASS':'FAIL'}\n\n즉시 확인: ${report.passed?'finished.png':'failure.png'}\n\n${report.failure||''}\n`);
  console.log(JSON.stringify({id,passed:report.passed,x:report.state?.x,y:report.state?.y,failure:report.failure?.split('\n')[0]}));
 }
} finally {await fs.writeFile(`${root}/boundary-report.json`,JSON.stringify(reports,null,2)+'\n');await browser.close();await server.close();}
