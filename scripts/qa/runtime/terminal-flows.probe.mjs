import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
const out = resolve('output/evidence/terminal-flows-20260922');
await mkdir(out, { recursive: true });
const source = JSON.parse(await readFile('test/fixtures/projects/editor-authored-demo-v3.json', 'utf8'));
const server = await startPlayerQaServer();
const browser = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
const results = JSON.parse(await readFile(resolve(out, "results.json"), "utf8").catch(() => "[]"));
const variants = ['horror', 'blackout', 'ending', 'ending-dark', 'ending-reduced', 'ending-auto', 'blackout-invalid'];
try {
 for (const variant of variants.filter(id => !process.env.PROOF_VARIANTS || process.env.PROOF_VARIANTS.split(',').includes(id))) {
  const p = structuredClone(source);
  delete p.system.opening; delete p.system.gameOver;
  p.system.titleScreen.musicResourceId = '';
  const map = p.maps[p.startMapId];
  const ending = variant.startsWith('ending');
  const blackout = variant.startsWith('blackout');
  p.system.gameOver = {presentation: blackout ? 'blackout' : 'horror', ...(blackout ? {recovery:{mapId:p.startMapId,x:variant==='blackout-invalid'?0:14,y:variant==='blackout-invalid'?0:20}} : {})};
  if (variant==='blackout-invalid') { map.lowerTiles[0]=-1;map.upperTiles[0]=-1; }
  const e = structuredClone(map.events[0]); e.id = 'terminal-proof';e.x=p.startPos.x;e.y=p.startPos.y-1;
  const final = ending ? {kind:'triggerEnding',endingId:'proof-ending'} : {kind:'killPlayer'};
  p.endings = [{id:'proof-ending',name:variant==='ending-dark'?'아무도 돌아오지 않았다':'다시, 아침이 온다',priority:1,conditions:[],presentation:{tone:variant==='ending-dark'?'dark':'warm',musicResourceId:'cc0-bgm-field',backgroundResourceId:'oprn-title-field',credits:'등대의 마지막 불빛\n\n\n이야기와 세계\n안개 항구\n\n함께 걸어온 이들\n등대지기 · 여행자 · 항구의 사람들\n\n\n그리고\n여기까지 걸어온 당신\n\n고맙습니다.'}}];
  if (variant==='ending-auto') p.endings[0].presentation.credits='만든 이들\n안개 항구';
  const commands = [{kind:'checkpointSave'},{kind:'setVariable',variableId:'var_lantern_shards',op:'=',value:37},final,{kind:'setVariable',variableId:'var_lantern_shards',op:'=',value:777}];
  e.pages=[{...e.pages[0],id:'terminal-page',conditions:[],movement:{type:'fixed',speed:3,frequency:3},trigger:{kind:'action'},commands}];e.commands=commands;map.events=[e];
  const context = await browser.newContext({viewport:{width:960,height:720},recordVideo:{dir:out,size:{width:960,height:720}},...(variant==='ending-reduced'?{reducedMotion:'reduce'}:{})});
  const page = await context.newPage();
  const result = {variant,errors:[],beats:[]};const prior=results.findIndex(r=>r.variant===variant);if(prior>=0)results.splice(prior,1);results.push(result);
  page.on('pageerror',error=>result.errors.push(String(error)));
  await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__terminal/project.json',saveNamespace:'terminal-proof',qaInstrumentation:true};});
  await page.route('**/__terminal/project.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(p)}));
  await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-testid="title-screen"]',{timeout:90000});await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__oprnDebug?.readState?.().currentMapId,undefined,{timeout:90000});
  const beat = async name => {result.beats.push({name,t:Date.now()});await page.screenshot({path:resolve(out,`${variant}-${name}.png`)});};
  await page.waitForTimeout(600);result.clipStart=Date.now();await beat('field');await page.waitForTimeout(800);
  await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
  const root = page.locator(`[data-testid="${ending?'ending':'game-over'}-screen"]`);
  await root.waitFor();
  await page.keyboard.down('Enter');await page.waitForTimeout(300);await page.keyboard.up('Enter');
  assert.equal(await page.locator('[data-testid="return-title"]').count(),0,'trigger key must not open/activate choices');
  await beat('fade');
  if (ending) {
    await page.waitForFunction(()=>document.querySelector('[data-testid="ending-screen"]')?.dataset.phase==='epilogue');
    await page.waitForTimeout(1900);await beat('epilogue');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('[data-testid="ending-screen"]')?.dataset.phase==='credits');
    await page.waitForTimeout(11000);await beat('credits');
    result.music=await page.locator('[data-testid="ending-music"]').evaluate(a=>({paused:a.paused,time:a.currentTime}));assert(!result.music.paused && result.music.time>0);
    if(variant==='ending-reduced')await page.keyboard.press('PageDown');
    if(variant!=='ending-auto')await page.keyboard.press('Enter');await page.waitForSelector('[data-testid="return-title"]',{timeout:60000});await page.waitForTimeout(1000);await beat('final');
    result.marker=await page.evaluate(()=>window.__oprnDebug.readState().variables.var_lantern_shards);assert.equal(result.marker,37);
    await page.keyboard.press('Enter');await page.waitForSelector('[data-testid="title-screen"]');await beat('title');
  } else if (blackout && variant!=='blackout-invalid') {
    await page.waitForFunction(()=>document.querySelector('[data-testid="game-over-screen"]')?.dataset.phase==='blackout-message');
    await page.waitForTimeout(600);await beat('blackout');
    await root.waitFor({state:'detached'});await page.waitForTimeout(800);await beat('recovered');
    result.state=await page.evaluate(()=>({...window.__oprnDebug.readState(),actorVitals:JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent).actorVitals}));
    assert.equal(result.state.variables.var_lantern_shards,37,'current progress must survive');assert.equal(result.state.x,14);assert.equal(result.state.y,20);assert(Object.values(result.state.actorVitals).every(v=>v.hp===v.maxHp),'party must be healed');
    await page.keyboard.press('ArrowDown');await page.waitForTimeout(300);await beat('walking');
    assert.equal(await page.evaluate(()=>window.__oprnDebug.readState().y),21,'recovered player must move');
  } else {
    await page.waitForSelector('[data-testid="return-title"]');await page.waitForTimeout(700);await beat('choices');
    result.marker=await page.evaluate(()=>window.__oprnDebug.readState().variables.var_lantern_shards);assert.equal(result.marker,37);
    await page.keyboard.press('Enter');await root.waitFor({state:'detached'});await page.waitForTimeout(800);await beat('retry');
    assert.equal(await page.evaluate(()=>window.__oprnDebug.readState().variables.var_lantern_shards),0,'horror retry restores the checkpoint');
  }
  assert.deepEqual(result.errors,[]);
  await page.waitForTimeout(600);result.clipEnd=Date.now();result.videoPath=await page.video().path();await context.close();
  await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));
  console.log(variant,'OK');
 }
} finally {await browser.close();await server.close();await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));}
await writeFile(resolve(out,'SUMMARY.md'),'# Terminal flows\n\nActual player.html browser recordings. Memory-only runtime fixture.\n\nImmediate inspection: horror-choices.png, blackout-recovered.png, ending-epilogue.png, ending-credits.png, ending-final.png.\n');
