import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {startPlayerQaServer} from '../lib/runtimeQaRun.mjs';
const saved=JSON.parse(await readFile('verify-shots/slates-astra-experiment/reloaded-project.json','utf8'));
const bundle=JSON.parse(await readFile('verify-shots/slates-astra-experiment/bundle.json','utf8'));
saved.startMapId=bundle.map.id;saved.startPos=bundle.spawn;const project=JSON.stringify(saved);
const server=await startPlayerQaServer();const browser=await chromium.launch({args:['--use-gl=swiftshader','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1024,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/slates-project.json',saveNamespace:'slates32-preview',qaInstrumentation:true};});
await page.route('**/slates-project.json',r=>r.fulfill({status:200,contentType:'application/json',body:project}));
await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});
await page.waitForSelector('[data-testid="title-screen"]',{timeout:30000}).catch(async()=>{await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid="title-screen"]',{timeout:60000});});await page.keyboard.press('Enter');
await page.waitForFunction(()=>window.__oprnDebug?.readState().currentMapId==='slates_astra_walled_50',null,{timeout:60000});
const before=await page.evaluate(()=>window.__oprnPlayerSprite());
await page.evaluate(()=>{window.__oprnInput.dir('up');});
await page.waitForFunction(y=>window.__oprnPlayerSprite()?.y<y-32,before.y,{timeout:15000});
await page.evaluate(()=>{window.__oprnInput.dir(null);});
await page.waitForTimeout(300);
await page.screenshot({path:'verify-shots/slates-astra-experiment/runtime.png'});
const observed=await page.evaluate(()=>({state:window.__oprnDebug.readState(),sprite:window.__oprnPlayerSprite(),camera:window.__oprnCamera()}));
await writeFile('verify-shots/slates-astra-experiment/runtime-observation.json',JSON.stringify({observed,before,movedNorth:observed.sprite.y<before.y-32,errors},null,2));
console.log(JSON.stringify({sprite:observed.sprite,errors}));
}finally{await browser.close();await server.close();}
