// Focused visual observation of the canonical reload using the shipped player entry.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {startPlayerQaServer} from '../lib/runtimeQaRun.mjs';
const directory='output/paw-city';
const project=await readFile(`${directory}/reloaded-portable.json`,'utf8');
const report=JSON.parse(await readFile(`${directory}/assembly-report.json`,'utf8'));
const server=await startPlayerQaServer();const browser=await chromium.launch({args:['--use-gl=swiftshader','--disable-gpu','--disable-features=NetworkChangeNotifier']});
const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[],observed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/paw-local.json',saveNamespace:'paw-canonical-observation',qaInstrumentation:true};});
 await page.route('**/paw-local.json',r=>r.fulfill({status:200,contentType:'application/json',body:project}));
 await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});
 await page.getByTestId('title-screen').waitFor({timeout:120000});await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__oprnDebug?.readState().currentMapId==='paw_city',null,{timeout:60000});
 await page.screenshot({path:`${directory}/runtime-city.png`});
 const visits=report.links.flatMap(link=>link.entranceWidth>1?[link,{...link,approach:{...link.approach,x:link.approach.x+1},rightLeaf:true}]:[link]);
 for(const link of visits){
  console.log('visiting',link.to,link.rightLeaf?'right':'left');
  await page.waitForFunction(()=>{const s=window.__oprnHooksScene;return !s.running&&!s.moving&&!s.cameras.main.fadeEffect.isRunning;});
  await page.evaluate(({approach,from})=>window.__oprnDebug.teleport(from,approach.x,approach.y),link);
  await page.waitForFunction(({approach,from})=>{const s=window.__oprnDebug.readState();return s.currentMapId===from&&s.x===approach.x&&s.y===approach.y;},link);
  await page.waitForFunction(()=>{const s=window.__oprnHooksScene;return !s.running&&!s.moving&&!s.cameras.main.fadeEffect.isRunning;});
  await page.evaluate(()=>{window.__oprnInput.face('up');window.__oprnInput.action();});
  await page.waitForFunction(id=>window.__oprnDebug.readState().currentMapId===id,link.to,{timeout:15000});
  await page.waitForFunction(({spawn})=>{const s=window.__oprnDebug.readState();return s.x===spawn.x&&s.y===spawn.y;},link);
  await page.waitForFunction(()=>{const s=window.__oprnHooksScene;return !s.running&&!s.moving&&!s.cameras.main.fadeEffect.isRunning;});
  await page.screenshot({path:`${directory}/runtime-${link.to}.png`});
  const entered=await page.evaluate(()=>window.__oprnDebug.readState());
  await page.evaluate(()=>window.__oprnInput.dir('down'));
  try{await page.waitForFunction(id=>window.__oprnDebug.readState().currentMapId===id,link.from,{timeout:10000});}
  finally{await page.evaluate(()=>window.__oprnInput.dir(null));}
  const returned=await page.evaluate(()=>window.__oprnDebug.readState());
  observed.push({map:link.to,entered:{x:entered.x,y:entered.y},returned:{map:returned.currentMapId,x:returned.x,y:returned.y}});
  console.log('entered and returned',link.to);
 }
 await writeFile(`${directory}/runtime-observation.json`,JSON.stringify({observed,errors},null,2));
 await writeFile(`${directory}/SUMMARY.md`,`# Pixel Art World city\n\nCanonical reload: ${Object.keys(JSON.parse(project).maps).length} maps, native32px. ${observed.length} actual door entries and touch returns observed. Browser errors: ${errors.length}.\n\n즉시 확인: runtime-city.png, runtime-conveni-compact-shop-3.png, runtime-school-classroom-north-0.png.\n`);
 console.log({transfers:observed.length,errors});
}catch(error){await page.screenshot({path:`${directory}/runtime-failure.png`});console.log({errors,state:await page.evaluate(()=>window.__oprnDebug?.readState()),body:(await page.locator('body').innerText()).slice(-1800)});throw error;}
finally{await browser.close();await server.close();}
