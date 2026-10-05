// Read-only diagnosis of the recording player's blank startup.
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { startPlayerQaServer } from '../../../scripts/lib/runtimeQaRun.mjs';
process.env.VITE_CACHE_DIR = new URL('../../../.vite-cache/snes-boot-diagnostic',import.meta.url).pathname;
const project=await readFile('verify-shots/snes-study-redraw-20261005/runtime-confirmed/recording-project-0.json','utf8');
const out='verify-shots/snes-study-redraw-20261005/boot';await mkdir(out,{recursive:true});
const server=await startPlayerQaServer({logLevel:'error'});
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage(); const pending=new Set(),failures=[],messages=[];
page.on('request',r=>pending.add(r.url()));
page.on('requestfinished',r=>pending.delete(r.url()));
page.on('requestfailed',r=>{pending.delete(r.url());failures.push({url:r.url(),reason:r.failure()});});
page.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});});
page.on('pageerror',e=>messages.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push(m.text());});
try{
 await page.addInitScript(()=>window.__OPENRPG_BOOT__={projectUrl:'/__boot-project',saveNamespace:'snes-boot-diagnostic',qaInstrumentation:true});
 await page.route('**/__boot-project',r=>r.fulfill({contentType:'application/json',body:project}));
 await page.goto(server.url+'/player.html?e2eVitals=1',{waitUntil:'domcontentloaded'});
 const ready=await page.waitForSelector('[data-testid="title-screen"]',{timeout:30000}).then(()=>true,()=>false);
 await page.screenshot({path:out+'/startup.png'});
 const report={ready,pending:[...pending],failures,messages,body:await page.locator('body').innerText()};
 await writeFile(out+'/observations.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await server.close();}
