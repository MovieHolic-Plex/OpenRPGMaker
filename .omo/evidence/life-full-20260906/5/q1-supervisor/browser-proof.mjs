import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { startPlayerQaServer, performObservedAction } from '../../../../../scripts/lib/runtimeQaRun.mjs';
const root=new URL('./',import.meta.url);
const fixture=await readFile(new URL('../project.json',root),'utf8');
const browserName='chromium';
const server=await startPlayerQaServer();
let browser;
const results={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),deadlineMs:120000,surface:'shipped player.html through vite.player-qa.config.ts/exportProjectStoreShim',cwd:process.cwd(),url:server.url+'/player.html',port:server.port,browser:browserName,project:'Life QA observability fixture',projectPath:'.omo/evidence/life-full-20260906/5/project.json',viewport:{width:1280,height:960},runs:[]};
async function observeDom(page, selector, trigger=async()=>{}, readyScene=false) {
  const pending=await page.evaluateHandle(({selector,readyScene})=>{
    let cancel;
    const promise=new Promise(resolve=>{
      const finish=value=>{observer.disconnect();clearTimeout(deadline);resolve(value);};
      const check=()=>{if(document.querySelector(selector)&&(!readyScene||!document.querySelector('[data-testid="play-loading-overlay"]')))finish({ok:true});};
      const observer=new MutationObserver(check);
      const deadline=setTimeout(()=>finish({error:'DOM signal missing: '+selector}),120000);
      cancel=()=>finish({error:'cancelled'});
      observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});check();
    });return {promise,cancel:()=>cancel()};
  },{selector,readyScene});
  try {await trigger();const result=await pending.evaluate(entry=>entry.promise);assert.equal(result.error,undefined);}
  finally{await pending.evaluate(entry=>entry.cancel());await pending.dispose();}
}
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
  results.browserVersion=browser.version();
  for(const capability of [undefined,false,true]) {
    const qa=capability===true;
    const bootFlag=capability===undefined?'omitted':String(capability);
    const context=await browser.newContext({viewport:results.viewport});
    const page=await context.newPage();const errors=[];const failedRequests=[];const httpErrors=[];const consoleErrors=[];
    const started=performance.now(), milestones=[], pendingRequests=new Map();
    const mark=phase=>milestones.push({phase,elapsedMs:performance.now()-started});
    const run={qa,bootFlag,milestones,errors,failedRequests,httpErrors,consoleErrors,audioEvents:[]};
    let audioDeadline, resolvePlaying;
    const playing=new Promise(resolve=>{resolvePlaying=resolve;audioDeadline=setTimeout(()=>resolve({error:'native BGM playing signal missing'}),120000);});
    results.runs.push(run);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
    page.on('request',request=>pendingRequests.set(request,{url:request.url(),resourceType:request.resourceType(),elapsedMs:performance.now()-started}));
    page.on('requestfinished',request=>pendingRequests.delete(request));
    page.on('requestfailed',request=>{pendingRequests.delete(request);failedRequests.push({url:request.url(),failure:request.failure()});});
    page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
    try {
      await page.exposeBinding('__q1NativeAudio', (_source, event)=>{
        run.audioEvents.push(event);
        if(event.event==='playing'&&event.loop&&event.src.endsWith('rtp-fld-003-amber-meadow-end-final_f5dafd12.mp3')) {clearTimeout(audioDeadline);resolvePlaying(event);}
      });
      await page.addInitScript(({capability})=>{
        window.__OPENRPG_BOOT__={projectUrl:'/__life-qa/project.json',saveNamespace:'life-qa-observability',...(capability===undefined?{}:{qaInstrumentation:capability})};
        // Observe native media events before the player or its audio engine is constructed.
        // This test-owned binding records facts only; it never replaces Audio/play or media state.
        for(const event of ['playing','error']) document.addEventListener(event, e=>{
          const audio=e.target;if(!(audio instanceof HTMLAudioElement))return;
          void window.__q1NativeAudio({event,src:audio.currentSrc||audio.src,loop:audio.loop,paused:audio.paused,readyState:audio.readyState,currentTime:audio.currentTime,volume:audio.volume,playbackRate:audio.playbackRate,error:audio.error?.code??null});
        },true);
      },{capability});
      await page.route('**/__life-qa/project.json',route=>route.fulfill({status:200,contentType:'application/json',body:fixture}));
      mark('navigation-trigger');
      const response=await page.goto(results.url,{waitUntil:'domcontentloaded'});
      run.navigationStatus=response.status();mark('domcontentloaded');
      await observeDom(page,'[data-testid="title-screen"]');mark('title-present');
      // Arm the complete ready condition before Enter: canvas alone is not scene readiness.
      await observeDom(page,'.play-stage canvas',()=>page.keyboard.press('Enter'),true);mark('scene-ready');
      assert.equal(await page.locator('[data-testid="title-screen"]').count(),0);
      assert.equal(await page.locator('[data-testid="mode-play"]').count(),0);
      if(!qa) {
        // A visible menu signal proves a running scene, without exposing any instrumentation.
        await observeDom(page,'[data-testid="main-menu"]',()=>page.keyboard.press('Escape'));
        const off=await page.evaluate(()=>({globals:['__oprnDebug','__oprnInput','__oprnCamera','__oprnPlayerSprite','__oprnCharacterSprites','__oprnActionCombat','__oprnPerf','__oprnEmotes','__oprnSetActorVitals','__oprnSetMediaState','__oprnAudioState','__oprnAudioObserved'].filter(key=>Object.hasOwn(window,key)),mirrors:document.querySelectorAll('[data-testid="runtime-state-json"],[data-testid="audio-state-json"]').length,markers:document.querySelectorAll('.runtime-debug-marker').length}));
        run.observed=off;
        assert.deepEqual(off,{globals:[],mirrors:0,markers:0});
        await page.screenshot({path:new URL(`player-${bootFlag}.png`,root).pathname});
        mark('menu-present');Object.assign(run,{actions:['Enter: new game','Escape: visible menu'],observed:off});
      } else {
        await observeDom(page,'[data-testid="runtime-state-json"]');
        const first=await performObservedAction(page,()=>page.keyboard.press('z'));
        assert.equal(first.receipt.sequence,1);assert.equal(first.receipt.handled,true);assert.equal(first.receipt.farmAttempts[0].kind,'tilled');
        assert.equal(first.state.energy,0);assert.equal(first.state.farmPlots.map_blank_start['2,3'].tilled,true);
        assert.deepEqual(first.mirror.actionReceipt,first.receipt);
        const second=await performObservedAction(page,()=>page.keyboard.press('z'));
        assert.equal(second.receipt.sequence,2);assert.equal(second.receipt.handled,false);
        assert.equal(second.receipt.farmAttempts[0].reason,'missing-seed');
        assert.equal(second.receipt.farmAttempts[1].reason,'insufficient-energy');
        const {actionReceipt:receipt1,...before}=first.state;
        const {actionReceipt:receipt2,...after}=second.state;
        assert.deepEqual(after,before);assert.deepEqual(second.mirror.actionReceipt,second.receipt);
        assert.equal('lifeRecovery' in after,false);assert.equal('regrowDaysRemaining' in after.farmPlots.map_blank_start['2,3'],false);
        // A read cannot progress or pay; mutate the detached read result, not gameplay state.
        const detached=await page.evaluate(()=>{const state=window.__oprnDebug.readState();state.farmPlots.map_blank_start['2,3'].tilled=false;state.actionReceipt.sequence=999;return window.__oprnDebug.readState();});
        assert.equal(detached.farmPlots.map_blank_start['2,3'].tilled,true);assert.equal(detached.actionReceipt.sequence,2);
        await page.screenshot({path:new URL('player-on.png',root).pathname});
        mark('accepted-and-rejected-actions-observed');Object.assign(run,{actions:['Enter: new game','prearmed oprn:action -> keyboard z: till','prearmed oprn:action -> keyboard z: rejected'],first,second,rejectedObservedStateUnchanged:true,detachedReads:true});
      }
      const nativePlayback=await playing;
      assert.equal(nativePlayback.error,null);assert.equal(nativePlayback.paused,false);assert.ok(nativePlayback.readyState>=2);assert.equal(nativePlayback.playbackRate,1);
      run.nativePlayback=nativePlayback;mark('native-bgm-playing');
      const audioState=await page.evaluate(async()=>{
        const {audioStateSnapshot}=await import('/src/player/audio/index.ts');
        return {publicState:audioStateSnapshot(),qaState:window.__oprnAudioState?.(),resources:window.__oprnAudioObserved,allOprnGlobals:Object.getOwnPropertyNames(window).filter(key=>key.startsWith('__oprn'))};
      });
      run.audioObservation=audioState;
      if(qa) {
        assert.deepEqual(audioState.qaState,audioState.publicState);
        assert.ok(audioState.resources.includes('cc0-bgm-rtp-fld-003'));
      } else {
        assert.equal(audioState.qaState,undefined);assert.equal(audioState.resources,undefined);
        assert.ok(audioState.allOprnGlobals.includes('__oprnPlayBootLog'));
        assert.ok(audioState.allOprnGlobals.includes('__oprnRuntimeJuice'));
        assert.ok(audioState.allOprnGlobals.includes('__oprnJuiceLog'));
      }
      assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(httpErrors,[]);assert.deepEqual(consoleErrors,[]);
      run.audioCleanup=await page.evaluate(async()=>{
        const {teardownPlayer}=await import('/src/player/player.ts');
        const {stopAllAudio}=await import('/src/player/audio/index.ts');
        teardownPlayer();stopAllAudio();
        return {globals:['__oprnAudioState','__oprnAudioObserved'].filter(key=>Object.hasOwn(window,key)),audioElements:document.querySelectorAll('audio[data-oprn-audio]').length};
      });
      assert.deepEqual(run.audioCleanup,{globals:[],audioElements:0});
    } catch(error) {
      run.failure={error:String(error?.stack??error),pendingRequests:[...pendingRequests.values()],url:page.url()};
      try {run.failure.title=await page.title();run.failure.html=await page.content();await page.screenshot({path:new URL(`failure-${bootFlag}.png`,root).pathname});}
      catch(diagnosticError) {run.failure.diagnosticError=String(diagnosticError);}
      throw error;
    } finally {clearTimeout(audioDeadline);await context.close();run.contextClosed=true;}
  }
  results.ok=true;
} catch(error) {results.error=String(error?.stack??error);throw error;}
finally {
  await browser?.close();await server.close();await rm(new URL('cache/',root),{recursive:true,force:true});results.cleanup={browserClosed:true,contextsClosed:true,serverClosed:true,cacheRemoved:true,remoteWrites:0};
  await writeFile(new URL('browser.json',root),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify({supervisorAudio:true,head:results.head,ok:results.ok,error:results.error,runs:results.runs.map(r=>({bootFlag:r.bootFlag,observed:r.observed,nativePlayback:r.nativePlayback,audioObservation:r.audioObservation,audioCleanup:r.audioCleanup,rejectedObservedStateUnchanged:r.rejectedObservedStateUnchanged,errors:r.errors,failedRequests:r.failedRequests,httpErrors:r.httpErrors,consoleErrors:r.consoleErrors,failure:r.failure?.error,contextClosed:r.contextClosed})),cleanup:results.cleanup}));
}
