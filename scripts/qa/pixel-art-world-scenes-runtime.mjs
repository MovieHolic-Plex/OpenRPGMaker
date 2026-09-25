// Runtime observation uses the exported player, never the editor play shell.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {startPlayerQaServer} from '../lib/runtimeQaRun.mjs';
const [input,plan,out]=process.argv.slice(2);if(!input||!plan||!out)throw Error('Usage: <AI result-project.json> <transfer-plan.json> <output>');
await mkdir(out,{recursive:true});
const p=JSON.parse(await readFile(input,'utf8')),links=JSON.parse(await readFile(plan,'utf8'));
for(const ts of Object.values(p.tilesets)){delete ts.referenceDocuments;delete ts.structureKits;}delete p.spatialAuthoring;
const server=await startPlayerQaServer(),browser=await chromium.launch({args:['--use-gl=swiftshader','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[],passed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')console.log('browser-error',m.text().slice(0,400));});
page.on('response',r=>{if(r.status()>=400)console.log('http-error',r.status(),r.url());});
page.on('requestfailed',r=>console.log('request-failed',r.url(),r.failure()?.errorText));
const idle=()=>page.waitForFunction(()=>{const s=window.__oprnHooksScene;return s&&!s.running&&!s.moving&&!s.cameras.main.fadeEffect.isRunning;});
try{
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/ai-scenes.json',saveNamespace:'paw-scenes-ai-observation',qaInstrumentation:true};});
 await page.route('**/ai-scenes.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p)}));
 let booted=false;
 for(let attempt=0;attempt<4&&!booted;attempt++){
  try{await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});await page.getByTestId('title-screen').waitFor({timeout:25000});booted=true;}catch(error){console.log('boot-attempt',attempt+1,String(error).slice(0,140));if(attempt===3)throw error;}
 }
 await page.keyboard.press('Enter');await idle();
 for(const link of links){
  await page.evaluate(l=>window.__oprnDebug.teleport(l.from,l.approach.x,l.approach.y),link);await page.waitForFunction(l=>{const s=window.__oprnDebug.readState();return s.currentMapId===l.from&&s.x===l.approach.x&&s.y===l.approach.y;},link);await idle();
  if(link.trigger==='action')await page.evaluate(d=>{window.__oprnInput.face(d);window.__oprnInput.action();},link.facing);
  else await page.evaluate(d=>window.__oprnInput.dir(d),link.facing);
  try{await page.waitForFunction(l=>{const s=window.__oprnDebug.readState();return s.currentMapId===l.to&&s.x===l.spawn.x&&s.y===l.spawn.y;},link,{timeout:15000});}
  finally{await page.evaluate(()=>window.__oprnInput.dir(null));}
  await idle();passed.push(link);console.log('transfer',passed.length,link.event);
 }
 await page.screenshot({path:out+'/player.png'});
 await writeFile(out+'/report.json',JSON.stringify({passed,errors,pass:passed.length===links.length&&errors.length===0},null,2));
 await writeFile(out+'/SUMMARY.md',`# Actual AI scene runtime\n\n${passed.length}/${links.length} action/touch transfers executed with real player input. Browser errors: ${errors.length}.\n\n즉시 확인: player.png.\n`);
 if(errors.length)throw Error('Player errors');
}catch(e){await page.screenshot({path:out+'/failure.png'});await writeFile(out+'/failure.json',JSON.stringify({error:String(e),passed,errors,state:await page.evaluate(()=>window.__oprnDebug?.readState())},null,2));throw e;}
finally{await browser.close();await server.close();}
