import { resolveCinematicPresentation } from '../../src/project/cinematicPresentation.ts';
// Shipping player only. Observe real requests, decoded shot clocks, recovery and cancellation.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { webUploadedAssetPath } from '../../src/project/webUploadedAssetPath.ts';
const out=resolve(process.env.LIVE_GAME_OUT??'verify-shots/opening-cinematic-v4');
const root=resolve(process.env.LIVE_GAME_PACKAGE_OUT??'output/qa/opening-cinematic-v4','game-web');
const project=JSON.parse(await readFile(resolve(root,'project.json'),'utf8'));
const shots=project.system.opening.scenes.filter(s=>s.kind==='image');
assert.equal(shots.length,3);
const paths=shots.map(s=>webUploadedAssetPath(project.assets.uploaded[s.resourceId]));
const wanted=new Set((process.env.LIVE_LOADING_CASES??'delayed,reuse,missing,reduced').split(','));
assert([...wanted].every(name=>['delayed','reuse','missing','reduced'].includes(name)));
const reportName=process.env.LIVE_LOADING_REPORT??'loading';
let lastPage;
const requests=[],requested=[];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}try{const bytes=await readFile(path);requests.push({path:new URL(req.url,'http://local').pathname,time:Date.now()});res.writeHead(200,{'content-type':mime[extname(path)]??'application/octet-stream'}).end(bytes)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const saved=JSON.parse(await readFile(resolve(out,'reloaded.json'),'utf8').catch(()=>readFile(resolve(out,'completion.json'),'utf8')));
const result={projectId:saved.afterReload.projectId,paths,cases:[],errors:[]};
await mkdir(resolve(out,'loading'),{recursive:true});
async function open(options={}){
 const ctx=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:options.reduce?'reduce':'no-preference'});
 const page=await ctx.newPage();lastPage=page;page.on('pageerror',e=>result.errors.push(e.message));page.on('requestfailed',r=>{(result.requestFailures??=[]).push({path:new URL(r.url()).pathname,error:r.failure()?.errorText})});page.on('request',r=>{const path=new URL(r.url()).pathname;if(paths.some(p=>path.endsWith(p)))requested.push({path,time:Date.now()})});
 const waitForFunction=page.waitForFunction.bind(page);page.waitForFunction=(fn,arg,options)=>waitForFunction(fn,arg,{polling:100,...options});
 const cdp=await ctx.newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.addInitScript(()=>{window.__shotTimes=[];window.__handoffBackdrops=[];window.__handoffFrames=[];let last='';new MutationObserver(()=>{const cover=document.querySelector('.play-loading-overlay.has-cinematic-backdrop');if(cover)window.__handoffFrames.push({background:getComputedStyle(cover).backgroundColor,backdrop:cover.querySelector('.play-loading-backdrop')?.getAttribute('src')});const backdrop=document.querySelector('.play-loading-backdrop');if(backdrop)window.__handoffBackdrops.push(backdrop.getAttribute('src'));const n=document.querySelector('[data-testid="cinematic-sequence"]');if(!n)return;const state=[n.dataset.sceneId,n.dataset.mediaState,n.dataset.pendingSceneId].join(':');if(state===last)return;last=state;window.__shotTimes.push({id:n.dataset.sceneId,state:n.dataset.mediaState,pending:n.dataset.pendingSceneId,time:performance.now()});}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-scene-id','data-media-state','data-pending-scene-id']})});
 return{ctx,page};
}
async function title(page){await page.goto(base+'/player.html',{waitUntil:'domcontentloaded'});await page.getByTestId('title-screen').waitFor({timeout:120000});await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done',null,{timeout:30000})}
async function ready(page,index){await page.waitForFunction(id=>{const n=document.querySelector('[data-testid="cinematic-sequence"]');return n?.dataset.sceneId===id&&n.dataset.mediaState==='ready'},shots[index].id,{timeout:40000})}
async function playing(page){await page.getByTestId('cinematic-sequence').waitFor({state:'hidden',timeout:40000});await page.getByTestId('play-loading-overlay').waitFor({state:'hidden',timeout:40000});assert(await page.locator('canvas').count()>0)}
try{
 if(wanted.has('delayed')){const{ctx,page}=await open();const begin=requests.length;let releaseFirst,releaseSecond;const firstHeld=new Promise(r=>{releaseFirst=r});const secondHeld=new Promise(r=>{releaseSecond=r});
  await page.route('**/*',async route=>{const url=new URL(route.request().url()).pathname;if(url.endsWith(paths[0]))await firstHeld;if(url.endsWith(paths[1]))await secondHeld;await route.continue().catch(()=>{})});
  await title(page);await page.keyboard.press('Enter');await page.waitForTimeout(900);
  const startsWithText=project.system.opening.scenes[0].kind==='text';
  if(startsWithText) assert.equal(await page.getByTestId('cinematic-sequence').getAttribute('data-scene-id'),project.system.opening.scenes[0].id,'Start authored text while pictures load in the background');
  else assert(await page.getByTestId('title-screen').isVisible(),'Keep title while the first picture is decoded');
  await page.screenshot({path:resolve(out,'loading/01-title-preparing.png')});
  releaseFirst();
  await ready(page,0);assert.equal(await page.locator('.cinematic-effects').first().getAttribute('data-title-effects-renderer'),'webgl');assert.equal(await page.locator('.cinematic-image').evaluate(n=>n.complete&&n.naturalWidth>0),true);
  const pending=await page.waitForFunction(id=>{const n=document.querySelector('[data-testid="cinematic-sequence"]');if(n?.dataset.pendingSceneId!==id||n.dataset.mediaState!=='loading')return false;const image=n.querySelector('.cinematic-image');return{sceneId:n.dataset.sceneId,previousDecoded:Boolean(image?.complete&&image.naturalWidth>0),effectsFrozen:n.querySelector('.cinematic-effects')?.dataset.titleEffectsAnimated==='false'}},shots[1].id,{timeout:12000});
  const heldFrame=await pending.jsonValue();assert.equal(heldFrame.sceneId,shots[0].id);assert(heldFrame.previousDecoded,'Keep previous decoded shot during the delayed next picture');assert(heldFrame.effectsFrozen);
  await page.screenshot({path:resolve(out,'loading/02-previous-shot-retained.png')});
  releaseSecond();
  await ready(page,1);await ready(page,2);await playing(page);
  const handoff=await page.evaluate(()=>window.__handoffFrames);const last=project.system.opening.scenes.at(-1);const authoredFade=last.kind!=='image'&&last.presentation&&resolveCinematicPresentation(last.presentation).transition.exitMs>0;assert(handoff.some(frame=>authoredFade?frame.background==='rgb(0, 0, 0)'&&!frame.backdrop:frame.backdrop?.startsWith('blob:')),'Keep the authored final black frame or last artwork beneath map preparation');
  const times=await page.evaluate(()=>window.__shotTimes);const decoded=shots.map(s=>times.find(t=>t.id===s.id&&t.state==='ready'));
  assert(decoded.every(Boolean));assert(decoded[2].time-decoded[1].time>=shots[1].durationMs-100,'Second shot keeps its full duration after delayed decode');
  const counts=paths.map(path=>requests.slice(begin).filter(r=>r.path.endsWith(path)).length);result.delayDiagnostics={counts,requested:[...requested],times};
  assert.equal(counts[0],1);assert.equal(counts[2],1);assert(counts[1]===1||counts[1]===2);
  const secondRequests=requested.filter(r=>r.path.endsWith(paths[1]));
  if(secondRequests.length===2)assert(secondRequests[1].time-secondRequests[0].time>=10000,'A second request must follow the bounded prefetch deadline');
  assert(!times.some(t=>t.state==='error'),'Expired background preparation must recover before becoming a visible shot error');
  result.cases.push({name:'delayed-pictures',passed:true,requestsPerOpeningImage:counts,prefetchDeadlineRetry:secondRequests.length===2,heldFrame,handoffBackdropObserved:true,decodedTimes:decoded,times});await ctx.close();
 }
 if(wanted.has('reuse')){const{ctx,page}=await open();const begin=requests.length;
  await title(page);await page.keyboard.press('Enter');await ready(page,0);await ready(page,1);await ready(page,2);await playing(page);
  const counts=paths.map(path=>requests.slice(begin).filter(r=>r.path.endsWith(path)).length);assert.deepEqual(counts,[1,1,1],'Ready artwork must reuse its blob URL even with HTTP cache disabled');
  result.cases.push({name:'decoded-image-reuse-with-http-cache-disabled',passed:true,requestsPerOpeningImage:counts});await ctx.close();
 }
 if(wanted.has('missing')){const{ctx,page}=await open();let missing=true;
  await page.route('**/*',async route=>{if(new URL(route.request().url()).pathname.endsWith(paths[1])&&missing)await route.fulfill({status:404,body:'Missing picture'});else await route.continue()});
  await title(page);await page.keyboard.press('Enter');await ready(page,0);
  await page.waitForFunction(()=>document.querySelector('[data-testid="cinematic-sequence"]')?.dataset.mediaState==='error',null,{timeout:15000});
  assert((await page.getByTestId('cinematic-status').innerText()).includes('R'));
  await page.screenshot({path:resolve(out,'loading/03-picture-retry.png')});missing=false;await page.keyboard.press('r');await ready(page,1);await ready(page,2);await playing(page);
  result.cases.push({name:'missing-picture-retry',passed:true});await ctx.close();
 }
 if(wanted.has('reduced')){const{ctx,page}=await open({reduce:true});let release;const held=new Promise(r=>{release=r});
  await page.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith(paths[1])||path.includes('/assets/phaser.min-'))await held;await route.continue().catch(()=>{})});
  await title(page);await page.keyboard.press('Enter');await ready(page,0);
  assert.equal(await page.evaluate(()=>Boolean(window.Phaser)),false,'Exercise skip before the background engine has loaded');
  const animations=await page.locator('.cinematic-shot').evaluate(n=>n.getAnimations({subtree:true}).length);assert.equal(animations,0,'Reduced motion disables shot camera/transition animations');
  await page.keyboard.press('Escape');release();await playing(page);await page.waitForTimeout(1500);
  assert.equal(await page.getByTestId('cinematic-sequence').count(),0,'Late prepared image cannot revive a skipped opening');
  assert.equal(await page.locator('.cinematic-effects').count(),0);
  await page.screenshot({path:resolve(out,'loading/04-reduced-skip-first-play.png')});
  result.cases.push({name:'reduced-motion-and-skip-during-prefetch',passed:true,activeShotAnimations:animations,engineReadyBeforeSkip:false});await ctx.close();
 }
 result.passed=result.cases.length===wanted.size&&result.cases.every(c=>c.passed)&&!result.errors.length;
}catch(e){result.failure=e.message;result.passed=false;result.failureState=await lastPage?.evaluate(()=>({overlay:document.querySelector('[data-testid="play-loading-overlay"]')?.textContent,scene:document.querySelector('[data-testid="cinematic-sequence"]')?.dataset,shotTimes:window.__shotTimes})).catch(()=>null);await lastPage?.screenshot({path:resolve(out,'loading/failure.png'),timeout:5000}).catch(()=>{})}
finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(resolve(out,reportName+'.json'),JSON.stringify(result,null,2)+'\n');await writeFile(resolve(out,'loading/SUMMARY.md'),`# 출하 플레이어 로딩 QA\n\n결과: ${result.passed?'PASS':'FAIL'}\n\n${result.cases.map(c=>`- ${c.name}: PASS`).join('\n')}\n\n즉시 확인: 02-previous-shot-retained.png, 03-picture-retry.png, 04-reduced-skip-first-play.png${result.passed?'':', failure.png'}\n\n${result.failure??''}`.trimEnd()+'\n')}
console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;
