// Read-only shipping-player benchmark. Start the documented player QA server first.
// node scripts/qa/runtime/map-entry-cost.mjs <project.json> <output.json>   (PLAYER_QA_URL overrides the default port 9961)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [input, output] = process.argv.slice(2);
const body = readFileSync(input, 'utf8');
const project = JSON.parse(body);
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const result = {renderer:'SwiftShader', projectSha256:createHash('sha256').update(body).digest('hex'), sourceSha256:createHash('sha256').update(readFileSync('src/player/playSceneMapRuntime.ts')).digest('hex'), samples:[], errors:[]};
try {
 const page = await browser.newPage({viewport:{width:1024,height:768}});
 page.on('pageerror', e => result.errors.push(e.message));
 await page.route('**/__runtime-qa/project.json', r=>r.fulfill({contentType:'application/json',body}));
 await page.addInitScript(()=>{ window.__OPENRPG_BOOT__={projectUrl:'/__runtime-qa/project.json',saveNamespace:'map-entry-cost',qaInstrumentation:true}; });
 await page.goto(process.env.PLAYER_QA_URL ?? 'http://127.0.0.1:9961/player.html');
 await page.waitForSelector('[data-testid="title-screen"]',{timeout:120000});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>!!window.__oprnHooksScene?.map,undefined,{timeout:120000});
 await page.waitForTimeout(2500);
 for(let repeat=0;repeat<3;repeat++) for(const map of Object.values(project.maps)) {
  const sample = await page.evaluate(async id=>{
   const frames=[]; let last=performance.now(); let running=true;
   const tick=now=>{ frames.push(now-last); last=now; if(running) requestAnimationFrame(tick); };
   await new Promise(requestAnimationFrame); last=performance.now(); requestAnimationFrame(tick);
   const scene=window.__oprnHooksScene;
   const render=scene.renderTiles; const renders=[];
   scene.renderTiles=function(...args) { const start=performance.now(); try { return render.apply(this,args); } finally { renders.push(performance.now()-start); } };
   const start=performance.now();
   try { await window.__oprnDebug.teleport(id,5,5); } finally { scene.renderTiles=render; }
   const transferMs=performance.now()-start;
   await new Promise(r=>setTimeout(r,650)); running=false;
   return {id,actual:scene.map.id,transferMs,renderMs:renders.reduce((a,b)=>a+b,0),maxFrameMs:Math.max(...frames),frames};
  },map.id);
  result.samples.push({...sample,repeat,width:map.width,height:map.height});
  console.log(map.id,repeat,sample.transferMs.toFixed(1),sample.maxFrameMs.toFixed(1));
  await page.waitForTimeout(150);
 }
 await page.screenshot({path:output.replace(/\.json$/,'.png')});
} finally {await browser.close();writeFileSync(output,JSON.stringify(result,null,2));}
