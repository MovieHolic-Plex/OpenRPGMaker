/** Real battle DOM on player.html + vite.player-qa.config.ts (start server separately).
 * PLAYER_QA_URL defaults to port 9944. Each sample uses a fresh browser context.
 * Restart the QA server after source edits: its default watcher is disabled.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rows=[];
try {
for(let round=0;round<Number(process.env.BATTLE_WARMUP_ROUNDS ?? 3);round++) for(const variant of (process.env.BATTLE_WARMUP_VARIANTS ?? 'baseline,current,contain,hidden,cold').split(',')) {
 const page=await browser.newPage({viewport:{width:960,height:720}});
 await page.addInitScript('window.__name = (fn) => fn');
 await page.goto(process.env.PLAYER_QA_URL ?? 'http://127.0.0.1:9944/player.html');
 await page.addScriptTag({content:'window.__name = (fn) => fn'});
 for(let attempt=0;;attempt++) { try { await page.evaluate(async()=>{
  const imp=(p:string)=>import(/* @vite-ignore */p);
  const [defaults,shim,runtime,warm,dom]=await Promise.all(['/src/project/defaults/defaultProject.ts','/src/player/exportProjectStoreShim.ts','/src/battle/runtime.ts','/src/player/battleStyleWarmup.ts','/src/player/battleDom.ts'].map(imp));
  const project=defaults.createScarloxyPokemonDemoProject();shim.setExportedProject(project);
  const battle=runtime.createBattleRuntime({project,troopId:'troop_pkmn_grass_a',canEscape:true,canLose:true,rng:()=>0.5});
  const host=document.createElement('div');host.className='player-layout system-shell';host.style.cssText='position:relative;width:640px;height:480px';document.body.replaceChildren(host);
  (window as any).bench={host,battle,warm,dom};
 });
 break; } catch(error) { if(attempt===2 || !String(error).includes('Failed to fetch dynamically imported module'))throw error; await page.reload(); } }
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
 await page.evaluate(()=>{performance.setResourceTimingBufferSize(5000);performance.clearResourceTimings();});
 let phase='warm';const requests:any[]=[];page.on('response',async r=>{if(r.request().resourceType()==='image')requests.push({phase,url:r.url(),status:r.status()});});
 const a=await metrics();
 const warm=await page.evaluate(variant=>{
  const {host,battle,warm}= (window as any).bench;
  const append=host.append.bind(host);let images=0,backgrounds=0,width=0;
  host.append=(stage:HTMLElement)=>{
    if(variant==='baseline'){stage.style.transform='none';stage.style.left='-100000px';stage.style.top='0';}
    if(variant==='contain')stage.style.contain='layout style paint';
    if(variant==='hidden')stage.style.contentVisibility='hidden';
    if(variant==='bounded'){stage.style.right='auto';stage.style.width='640px';}
    images=stage.querySelectorAll('img').length;backgrounds=[...stage.querySelectorAll<HTMLElement>('*')].filter(e=>e.style.backgroundImage).length;
    append(stage);width=stage.getBoundingClientRect().width;
  };
  const t=performance.now();if(variant!=='cold')warm.warmBattleStyles(host,battle.snapshot());const ms=performance.now()-t;
  host.append=append;return {ms,images,backgrounds,width};
 },variant);
 await page.waitForTimeout(300);const b=await metrics();phase='mount';
 const mount=await page.evaluate(()=>{const b=(window as any).bench;const t=performance.now();b.controller=b.dom.mountBattleScene({host:b.host,runtime:b.battle,onResult:()=>{},introHold:true});return performance.now()-t;});
 const c=await metrics();await page.waitForTimeout(300);
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter((x:any)=>x.initiatorType==='img'||x.initiatorType==='css').map((x:any)=>({url:x.name,bytes:x.transferSize,decoded:x.decodedBodySize})));
 rows.push({round,variant,warm,mount,warmLayout:(b.LayoutDuration-a.LayoutDuration)*1000,mountLayout:(c.LayoutDuration-b.LayoutDuration)*1000,mountStyle:(c.RecalcStyleDuration-b.RecalcStyleDuration)*1000,requests,resources});
 if(round===0 && variant==='current' && process.env.BATTLE_WARMUP_SCREENSHOT)await page.screenshot({path:process.env.BATTLE_WARMUP_SCREENSHOT});
 console.log(JSON.stringify(rows.at(-1)));
 await page.evaluate(()=>{const b=(window as any).bench;b.controller.destroy();b.battle.cancel();});await page.close();
}
writeFileSync(process.env.BATTLE_WARMUP_OUTPUT ?? '/tmp/lvD-save/battle-browser.json',JSON.stringify(rows,null,2));console.log(rows.map(({requests,resources,...r})=>r));
}finally{await browser.close();}
