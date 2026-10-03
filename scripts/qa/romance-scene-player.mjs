// Dedicated shipped player path; actual input, no state injection or editor play shell.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { chromium } from 'playwright';
import { startPlayerQaServer, runRuntimeQa, performObservedAction } from '../lib/runtimeQaRun.mjs';
import { startPackagedPlayerQaServer } from '../lib/packagedPlayerQaServer.mjs';
import { withTsModule } from '../ontology-ts-loader.mjs';
const [file, out = 'verify-shots/romance-scene-player'] = process.argv.slice(2);
if (!file) throw Error('Usage: node scripts/qa/romance-scene-player.mjs <project.json> [out]');
const project = JSON.parse(fs.readFileSync(file)), map = project.maps[project.startMapId];
const npc = map.events.find(e => e.id === 'ev_romance_partner');assert(npc);
const proof = {project:resolve(file),playerRoute:true,packaged:process.env.ROMANCE_QA_PACKAGED==='1',noStateInjection:true,branches:[],errors:[],warnings:[]};
let route;let activePage;let diagnosticTimer;
await withTsModule('src/project/collision.ts','collision.mjs',async ({canMove})=>{
 const q=[{...project.startPos,path:[]}],seen=new Set();
 while(q.length){const at=q.shift(),k=at.x+','+at.y;if(seen.has(k))continue;seen.add(k);
 if(Math.abs(at.x-npc.x)+Math.abs(at.y-npc.y)===1){route=at;break;}
 for(const [dir,dx,dy] of [['right',1,0],['left',-1,0],['up',0,-1],['down',0,1]]){const x=at.x+dx,y=at.y+dy;if(!canMove(project,map,at.x,at.y,x,y))continue;if(map.events.some(e=>e.x===x&&e.y===y&&e.pages?.some(p=>p.priority==='same')))continue;q.push({x,y,path:[...at.path,{dir,x,y}]});}}
 assert(route,'No physical approach route');
});
const qaProject=structuredClone(project);qaProject.system.opening={...project.system.opening,enabled:false};
const server=await (proof.packaged?startPackagedPlayerQaServer({projectJson:JSON.stringify(qaProject)}):startPlayerQaServer());const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--disable-gpu','--js-flags=--max-old-space-size=16384']});
try {
 for (let branch=0;branch<2;branch++) {
  const page=activePage=await browser.newPage({reducedMotion:'reduce'});
  let closingPage=false;
  const network=[];page.on('response',r=>{if(network.length<30)network.push({path:new URL(r.url()).pathname,status:r.status()});});page.on('requestfailed',r=>{const path=new URL(r.url()).pathname;const message='network: '+path+': '+r.failure()?.errorText;const expectedCancellation=r.failure()?.errorText==='net::ERR_ABORTED'&&(closingPage||path.startsWith('/assets/cc0/audio/'));(expectedCancellation?proof.warnings:proof.errors).push(message);});proof.network=network;
  fs.mkdirSync(out,{recursive:true});diagnosticTimer=setInterval(()=>{void page.screenshot({path:resolve(out,'current.png')}).catch(()=>{});void page.locator('body').innerText().then(t=>fs.writeFileSync(resolve(out,'current-ui.txt'),t)).catch(()=>{});},15000);
  // Opening is outside this scene-only audit; override only on the QA copy.
  const boot=await runRuntimeQa(page,{id:'romance-'+branch,projectFixture:resolve(file),viewport:{width:960,height:720},systemPatch:{opening:{...project.system.opening,enabled:false}},beats:[{id:'field',ops:[{kind:'key',key:'Enter'},{kind:'waitFor',testid:'title-screen',state:'absent'},{kind:'waitForRuntime'}],expect:{mapId:map.id},shot:true}]},{serverUrl:server.url,outDir:resolve(out,'branch-'+branch),...(proof.packaged?{projectUrl:server.url+'/__runtime-qa/project.json'}:{})});
  assert(!boot.errors.length && !boot.beats.some(b=>b.failures.length),JSON.stringify(boot));
  for(const step of route.path){await page.evaluate(d=>window.__oprnInput.dir(d),step.dir);await page.waitForFunction(([x,y])=>{const s=window.__oprnDebug.readState();return s.x===x&&s.y===y;},[step.x,step.y]);await page.evaluate(()=>window.__oprnInput.dir(null));}
  await page.evaluate(d=>window.__oprnInput.face(d),route.x<npc.x?'right':route.x>npc.x?'left':route.y<npc.y?'down':'up');
  const shot=async name=>{if(await page.getByTestId('dialogue-box').count()&&!await page.getByTestId('runtime-choices').count()){await page.getByTestId('dialogue-box').waitFor();const box=page.getByTestId('dialogue-box');if(!await box.evaluate(n=>n.classList.contains('page-ready')))await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[data-testid="dialogue-box"]')?.classList.contains('page-ready'));}await page.screenshot({path:resolve(out,'branch-'+branch,name+'.png')});};
  const action=async()=>{await performObservedAction(page,()=>page.evaluate(()=>window.__oprnInput.action()),90000);};
  const toChoices=async()=>{for(let i=0;i<16;i++){if(await page.getByTestId('runtime-choices').count())return;await page.keyboard.press('Enter');await page.waitForTimeout(160);}throw Error('No choices');};
  const closeText=async()=>{for(let i=0;i<16;i++){if(!await page.getByTestId('dialogue-box').count())return;await page.keyboard.press('Enter');await page.waitForTimeout(160);}throw Error('Dialogue never closed');};
  const state=()=>page.evaluate(()=>window.__oprnDebug.readState());
  // Input action returns only after dialogue resolves; do not await its receipt before answering.
  let pending=action();await page.getByTestId('dialogue-box').waitFor();await toChoices();await shot('choices');
  // First prove cancellation in both independent fresh sessions.
  await page.keyboard.press('Escape');await closeText();await pending;let cancelled=await state();assert(!cancelled.switches.sw_romance_met);assert.equal(cancelled.variables.var_romance_relation??0,0);
  pending=action();await page.getByTestId('dialogue-box').waitFor();await toChoices();await page.getByTestId('runtime-choices').locator('button').nth(branch).click();await page.waitForFunction(()=>{const n=document.querySelector('[data-testid="dialogue-box"]');return n&&!document.querySelector('[data-testid="runtime-choices"]');});await shot('reaction');const reaction=await page.getByTestId('dialogue-box').innerText();const expectedReaction=npc.pages[0].commands.find(c=>c.kind==='choices').options[branch].branch.find(c=>c.kind==='text').body;assert(reaction.replace(/\s/g,'').includes(expectedReaction.slice(0,15).replace(/\s/g,'')),reaction);await closeText();await pending;
  let chosen=await state();assert.equal(chosen.variables.var_romance_choice,branch+1);assert.equal(chosen.variables.var_romance_relation,branch+1);
  pending=action();await page.getByTestId('dialogue-box').waitFor();await shot('remembered');const remembered=await page.getByTestId('dialogue-box').innerText();const expectedMemory=npc.pages[branch+1].commands.find(c=>c.kind==='text').body;assert(remembered.replace(/\s/g,'').includes(expectedMemory.slice(0,15).replace(/\s/g,'')),remembered);await toChoices();await page.getByTestId('runtime-choices').locator('button').nth(0).click();await closeText();await pending;
  let repeated=await state();assert.equal(repeated.variables.var_romance_relation,branch+1);
  pending=action();await page.getByTestId('dialogue-box').waitFor();await toChoices();await page.getByTestId('runtime-choices').locator('button').nth(1).click();await closeText();await pending;await page.getByTestId('ending-screen').waitFor();await page.locator('.ending-heading').waitFor();assert.equal(await page.locator('.ending-heading').innerText(),'첫 만남');await page.locator('.game-over-hint').waitFor();await shot('ended');
  proof.branches.push({branch:branch+1,reaction,remembered,cancelOk:true,choiceValue:chosen.variables.var_romance_choice,relationshipAfterRepeat:repeated.variables.var_romance_relation,endingBody:(await page.locator('body').innerText()).slice(-1200)});
  clearInterval(diagnosticTimer);closingPage=true;await page.close();
 }
 assert.notEqual(proof.branches[0].reaction,proof.branches[1].reaction);assert.notEqual(proof.branches[0].remembered,proof.branches[1].remembered);assert.equal(proof.errors.length,0,proof.errors.join('\n'));proof.ok=true;
} catch(error) {proof.ok=false;proof.errors.push(String(error));if(activePage){proof.lastUi=await activePage.locator('body').innerText().catch(()=>null);await activePage.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}throw error;}
finally {clearInterval(diagnosticTimer);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));fs.writeFileSync(resolve(out,'SUMMARY.md'),'# First conversation player QA\n\n'+(proof.ok?'PASS':'FAIL')+' — dedicated player.html; opening disabled on QA copy; both choices/cancel/repeat use real input.\n\nImmediately inspect branch-0/choices.png, branch-0/reaction.png, branch-1/reaction.png and branch-1/remembered.png.\n\n'+proof.errors.join('\n'));await browser.close();await server.close();}
