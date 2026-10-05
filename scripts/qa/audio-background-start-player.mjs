// Explicit shipping-player fixtures; does not mutate the canonical game.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.env.LIVE_GAME_PACKAGE_OUT ?? 'output/qa/audio-background-start', 'game-web');
const out = resolve('verify-shots/audio-background-start/edges'); await mkdir(out,{recursive:true});
const original = JSON.parse(await readFile(root+'/project.json','utf8'));
const fixture = structuredClone(original);
fixture.system.titleScreen.effects = []; delete fixture.system.titleScreen.sequence;
fixture.system.opening.scenes = original.system.opening.scenes.filter(s=>s.kind==='image').slice(0,2).map((s,i)=>({...s,id:'prepared-'+i,durationMs:4000, presentation:{preset:'subtitle',text:{animation:'fade',revealMs:100,exitMs:100},transition:{enter:'cut',enterMs:0,exitMs:500}}}));
const recoveryOnly=process.env.LIVE_BACKGROUND_CASE==='recovery';
const previous=recoveryOnly?await readFile(out+'/result.json','utf8'):null;
const retained=previous?JSON.parse(previous):null;
const requests=[], report={mode:'isolated shipping-player fixtures with actual saved art/audio',cases:retained?.cases??[],errors:[]};
if(retained){assert.equal(retained.cases.length,3);report.previousCaseReceiptSha256=createHash('sha256').update(previous).digest('hex');report.caseRun='Recovery only; three successful prior cases retained by receipt hash for the same shipping package';}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://local'),path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep))return res.writeHead(403).end();try{const bytes=url.pathname==='/project.json'?JSON.stringify(fixture):await readFile(path);requests.push({path:url.pathname,at:Date.now()});res.writeHead(200,{'content-type':mime[extname(path)]??'application/octet-stream','cache-control':'no-store'}).end(bytes);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});let lastPage; const releases=[];
const open=async()=>{
 const ctx=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'no-preference'}),page=await ctx.newPage();lastPage=page;
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error') (report.consoleErrors??=[]).push(m.text());});page.on('response',r=>{if(r.url().includes('ATTRIBUTION'))(report.licenseResponses??=[]).push({status:r.status(),headers:r.headers()});});
 const wait=page.waitForFunction.bind(page);page.waitForFunction=(fn,arg,opts)=>wait(fn,arg,{polling:50,...opts});
 await page.addInitScript(()=>{window.__audioPlays=[];const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){const evidence={at:Date.now(),src:this.src,loop:this.loop,played:false,currentTime:0};window.__audioPlays.push(evidence);this.addEventListener('playing',()=>{evidence.played=true;},{once:true});setTimeout(()=>evidence.currentTime=this.currentTime,300);fetch(this.src).then(r=>r.arrayBuffer()).then(async b=>{evidence.bytes=b.byteLength;evidence.sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');}).catch(()=>{});return originalPlay.apply(this,args);};window.__OPENRPG_BOOT__={projectUrl:'./project.json',qaInstrumentation:true};window.__preparedTimeline=[];window.__visibleLoading=0;let last='';setInterval(()=>{
 const node=document.querySelector('[data-testid="play-loading-overlay"]');if(node&&getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width)window.__visibleLoading++;
 const cine=document.querySelector('[data-testid="cinematic-sequence"]'),cover=document.querySelector('[data-testid="opening-map-handoff"]'),dialogue=document.querySelector('[data-testid="dialogue-box"]'),state=window.__oprnDebug?.readState();
 const key=[cine?.dataset.sceneId,!!cover,!!dialogue,!!state].join('|');if(key!==last){last=key;window.__preparedTimeline.push({at:Date.now(),scene:cine?.dataset.sceneId,cover:!!cover,dialogue:!!dialogue,state:state?{x:state.x,y:state.y,switches:state.switches,variables:state.variables,gameTime:state.gameTime}:null});}
 },50);});
 const cdp=await ctx.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});return{ctx,page};
};
const title=async page=>{await page.goto(base+'/player.html',{waitUntil:'domcontentloaded'});await page.getByTestId('title-screen').waitFor({timeout:120000});};
const prepared=page=>page.waitForFunction(()=>window.__oprnDebug&&document.querySelector('[data-testid="cinematic-sequence"]'),null,{timeout:30000});
const actualPlay=async page=>{await page.getByTestId('cinematic-sequence').waitFor({state:'hidden',timeout:40000});await page.getByTestId('opening-map-handoff').waitFor({state:'hidden',timeout:45000});await page.getByTestId('dialogue-box').waitFor({timeout:30000});};
try{
 if(!recoveryOnly){
 {
 fixture.system.opening.scenes.forEach(s=>s.durationMs=20000);
 const{ctx,page}=await open();await title(page);
 if(fixture.system.titleScreen.sounds){const select=async id=>{for(let i=0;i<12;i++){if(await page.getByTestId(id).getAttribute('aria-selected')==='true')return;await page.keyboard.press('ArrowDown');await page.waitForTimeout(80);}throw Error('Keyboard title selection failed: '+id);};await select('title-credits');await page.keyboard.press('Enter');await page.getByTestId('title-credits-dialog').waitFor({state:'attached'});await page.waitForTimeout(300);await page.keyboard.press('Escape');await select('title-new-game');await page.keyboard.press('Enter');}else await page.keyboard.press('Enter');
 await prepared(page);
 const before=await page.evaluate(()=>window.__oprnDebug.readState());assert.equal(await page.getByTestId('dialogue-box').count(),0,'Start autorun must wait behind the opening');
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(1600);const after=await page.evaluate(()=>window.__oprnDebug.readState());
 for(const key of ['x','y','switches','variables','selfSwitches','timers','gameTime','rng'])assert.deepEqual(after[key],before[key],'Opening must freeze '+key);
 await page.screenshot({path:out+'/prepared-behind-opening.png'});await actualPlay(page);assert.equal(await page.evaluate(()=>window.__visibleLoading),0);
 await page.waitForTimeout(400);const audio=await page.evaluate(()=>window.__audioPlays);
 if(fixture.system.titleScreen.sounds){for(const id of Object.values(fixture.system.titleScreen.sounds)){const sha=fixture.assets.uploaded[id]?.ref?.sha256;assert(sha&&audio.some(p=>p.sha256===sha&&p.played),'Actual generated title SE must play: '+id);}const id=fixture.maps[fixture.startMapId].bgm.resourceId;assert(audio.some(p=>p.sha256===fixture.assets.uploaded[id].ref.sha256&&p.loop&&p.played&&p.currentTime>0),'Actual map OST must start after handoff');}
 report.cases.push({audio,name:'cold actual map ready during opening; input, events and clock frozen; natural handoff',passed:true,timeline:await page.evaluate(()=>window.__preparedTimeline)});await page.screenshot({path:out+'/natural-game.png'});await ctx.close();
 }
 fixture.system.opening.scenes.forEach(s=>s.durationMs=4000);
 for(const skip of [false,true]){
 const{ctx,page}=await open();let release;const held=new Promise(r=>release=r); releases.push(release);await page.route('**/assets/phaser.min-*',async route=>{await held;await route.continue().catch(()=>{});});
 await title(page);await page.keyboard.press('Enter');await page.getByTestId('cinematic-sequence').waitFor();if(skip)await page.keyboard.press('Escape');
 await page.getByTestId('opening-map-handoff').waitFor({timeout:25000});await page.waitForTimeout(1200);
 assert.equal(await page.getByTestId('dialogue-box').count(),0);assert.equal(await page.evaluate(()=>window.__visibleLoading),0);assert.equal(await page.locator('canvas').count(),0);
 await page.screenshot({path:out+(skip?'/skip-wait.png':'/slow-wait.png')});release();await actualPlay(page);
 assert.equal(await page.evaluate(()=>window.__visibleLoading),0);report.cases.push({name:skip?'early skip with pending engine retains cover':'short opening with pending engine retains cover',passed:true,timeline:await page.evaluate(()=>window.__preparedTimeline)});await ctx.close();
 }
 }
 {const{ctx,page}=await open();await page.route('**/assets/phaser.min-*',route=>route.fulfill({status:503,body:'Intentional engine failure'}));await title(page);const reloaded=page.waitForEvent('domcontentloaded',{timeout:30000});await page.keyboard.press('Enter');await reloaded;await page.getByTestId('title-screen').waitFor({timeout:30000});await page.keyboard.press('Enter');const recovery=page.getByTestId('play-loading-overlay');await page.waitForFunction(()=>document.querySelector('[data-testid="play-loading-overlay"]')?.dataset.stage==='error',null,{timeout:45000});assert(await recovery.isVisible(),'Real boot failures must reveal recovery');assert.equal(await page.getByTestId('cinematic-sequence').count(),0);await page.screenshot({path:out+'/error-recovery.png'});report.cases.push({name:'actual engine failure aborts opening and reveals recovery',passed:true});await ctx.close();}
 report.passed=report.cases.length===4&&!report.errors.length;
}catch(error){report.failure=error.message;report.observed=await lastPage?.evaluate(()=>({timeline:window.__preparedTimeline,audio:window.__audioPlays,loading:document.querySelector('[data-testid="play-loading-overlay"]')?.outerHTML,title:document.querySelector('[data-testid="title-screen"]')?.outerHTML,opening:document.querySelector('[data-testid="cinematic-sequence"]')?.outerHTML,cover:document.querySelector('[data-testid="opening-map-handoff"]')?.outerHTML,visibleLoading:window.__visibleLoading,dialogs:[...document.querySelectorAll('dialog')].map(d=>({html:d.outerHTML,rect:d.getBoundingClientRect().toJSON(),display:getComputedStyle(d).display})),juice:window.__oprnJuiceLog?.()})).catch(()=>null);await lastPage?.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{});}
finally{releases.forEach(r=>r());await writeFile(out+'/result.json',JSON.stringify({...report,requests},null,2));await writeFile(out+'/SUMMARY.md','# Background opening preparation\n\n'+(report.passed?'PASS':'FAIL: '+report.failure)+'\n\n즉시 확인: '+(report.passed?'prepared-behind-opening.png, natural-game.png, slow-wait.png, skip-wait.png, error-recovery.png':'failure.png')+'\n');await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify({passed:report.passed,failure:report.failure,cases:report.cases.length}));process.exitCode=report.passed?0:1;
