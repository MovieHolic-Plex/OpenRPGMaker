import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { startPlayerQaServer } from '../lib/runtimeQaRun.mjs';
const out='verify-shots/tile-geometry';
const fixture=await readFile(`${out}/fixture.json`,'utf8');
const server=await startPlayerQaServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1024,height:768}});
const errors=[],observations=[];page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message)});
try {
await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/geometry-fixture.json',saveNamespace:'tile-geometry-qa',qaInstrumentation:true};});
await page.route('**/geometry-fixture.json',r=>r.fulfill({status:200,contentType:'application/json',body:fixture}));
await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});
await page.waitForSelector('[data-testid="title-screen"]',{timeout:120000});
await page.keyboard.press('Enter');
await page.waitForFunction(()=>window.__oprnDebug?.readState().currentMapId==='geometry32',null,{timeout:60000});
async function observe(name){
 const data=await page.evaluate(()=>({state:window.__oprnDebug.readState(),sprite:window.__oprnPlayerSprite(),camera:window.__oprnCamera()}));
 observations.push({name,...data});console.log(JSON.stringify({name,map:data.state.currentMapId,x:data.state.x,y:data.state.y,sprite:data.sprite}));
 await page.screenshot({path:`${out}/${name}.png`});
}
await observe('runtime32-start');
await page.evaluate(()=>window.__oprnInput.dir('right'));
await page.waitForFunction(()=>window.__oprnDebug.readState().x===3);
await page.evaluate(()=>window.__oprnInput.dir(null));
await page.waitForFunction(()=>!window.__oprnPlayerSprite().moving);
await observe('runtime32-step');
await page.evaluate(()=>window.__oprnInput.dir('right'));
await page.waitForTimeout(800); // A blocked direction has no completion event.
await page.evaluate(()=>window.__oprnInput.dir(null));
await observe('runtime32-blocked');
await page.evaluate(()=>{window.__oprnInput.face('down');window.__oprnInput.action();});
await page.waitForFunction(()=>window.__oprnDebug.readState().currentMapId==='geometry16');
await page.waitForFunction(()=>window.__oprnPlayerSprite().x===40 && window.__oprnPlayerSprite().y===48);
await observe('runtime16-transfer');
await page.evaluate(()=>{window.__oprnInput.face('down');window.__oprnInput.action();});
await page.waitForFunction(()=>window.__oprnDebug.readState().currentMapId==='geometry32');
await page.waitForFunction(()=>window.__oprnPlayerSprite().x===464 && window.__oprnPlayerSprite().y===352);
await observe('runtime32-transfer');
await writeFile(`${out}/runtime-observation.json`,JSON.stringify({observations,errors},null,2));
console.log(JSON.stringify({errors}));
} finally {await browser.close();await server.close();}
