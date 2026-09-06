import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox } from '@playwright/test';
import { startPlayerQaServer, performObservedAction } from '../../../../scripts/lib/runtimeQaRun.mjs';
const root=new URL('./',import.meta.url);
const fixture=await readFile(new URL('project.json',root),'utf8');
const browserName=process.env.LIFE_QA_BROWSER ?? 'chromium';
const server=await startPlayerQaServer();
let browser;
const results={surface:'shipped player.html through vite.player-qa.config.ts/exportProjectStoreShim',cwd:process.cwd(),url:server.url+'/player.html',port:server.port,browser:browserName,project:'Life QA observability fixture',projectPath:'.omo/evidence/life-full-20260906/5/project.json',viewport:{width:1280,height:960},runs:[]};
async function observeDom(page, selector, trigger=async()=>{}, absent=false) {
  const pending=await page.evaluateHandle(({selector,absent})=>{
    let cancel;
    const promise=new Promise(resolve=>{
      const finish=value=>{observer.disconnect();clearTimeout(deadline);resolve(value);};
      const check=()=>{if(Boolean(document.querySelector(selector))!==absent)finish({ok:true});};
      const observer=new MutationObserver(check);
      const deadline=setTimeout(()=>finish({error:'DOM signal missing: '+selector}),120000);
      cancel=()=>finish({error:'cancelled'});
      observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});check();
    });return {promise,cancel:()=>cancel()};
  },{selector,absent});
  try {await trigger();const result=await pending.evaluate(entry=>entry.promise);assert.equal(result.error,undefined);}
  finally{await pending.evaluate(entry=>entry.cancel());await pending.dispose();}
}
try {
  browser=await (browserName==='firefox'?firefox:chromium).launch({headless:true,...(browserName==='chromium'?{args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']}: {})});
  results.browserVersion=browser.version();
  for(const qa of [false,true]) {
    const context=await browser.newContext({viewport:results.viewport});
    const page=await context.newPage();const errors=[];const failedRequests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
    try {
      await page.addInitScript(qa=>{window.__OPENRPG_BOOT__={projectUrl:'/__life-qa/project.json',saveNamespace:'life-qa-observability',qaInstrumentation:qa};},qa);
      await page.route('**/__life-qa/project.json',route=>route.fulfill({status:200,contentType:'application/json',body:fixture}));
      await page.goto(results.url,{waitUntil:'domcontentloaded'});
      await observeDom(page,'[data-testid="title-screen"]');
      await observeDom(page,'.play-stage canvas',()=>page.keyboard.press('Enter'));
      await observeDom(page,'[data-testid="play-loading-overlay"]',async()=>{},true);
      assert.equal(await page.locator('[data-testid="title-screen"]').count(),0);
      assert.equal(await page.locator('[data-testid="mode-play"]').count(),0);
      if(!qa) {
        // A visible menu signal proves a running scene, without exposing any instrumentation.
        await observeDom(page,'[data-testid="main-menu"]',()=>page.keyboard.press('Escape'));
        const off=await page.evaluate(()=>({globals:['__oprnDebug','__oprnInput','__oprnCamera','__oprnPlayerSprite','__oprnCharacterSprites','__oprnActionCombat','__oprnPerf','__oprnEmotes'].filter(key=>window[key]!==undefined),mirrors:document.querySelectorAll('[data-testid="runtime-state-json"],[data-testid="audio-state-json"]').length,markers:document.querySelectorAll('.runtime-debug-marker').length}));
        assert.deepEqual(off,{globals:[],mirrors:0,markers:0});
        await page.screenshot({path:new URL('player-off.png',root).pathname});
        results.runs.push({qa,actions:['Enter: new game','Escape: visible menu'],observed:off,errors,failedRequests});
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
        results.runs.push({qa,actions:['Enter: new game','prearmed oprn:action -> keyboard z: till','prearmed oprn:action -> keyboard z: rejected'],first,second,rejectedObservedStateUnchanged:true,detachedReads:true,errors,failedRequests});
      }
      assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
    } finally {await context.close();}
  }
  results.ok=true;
} catch(error) {results.error=String(error?.stack??error);throw error;}
finally {
  await browser?.close();await server.close();results.cleanup={browserClosed:true,contextsClosed:true,serverClosed:true,remoteWrites:0};
  await writeFile(new URL('browser.json',root),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results));
}
