// A5 감사: 생성된 몬스터 게임(A5-game.json)을 출하 플레이어(player.html)에서 열어 전투 한 프레임을 캡처한다.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
const out=resolve('qa-runs/audit-poke/A5-p5');await mkdir(out,{recursive:true});
process.env.VITE_CACHE_DIR??=resolve('.vite-cache/a5-p5');
const project=JSON.parse(await readFile('qa-runs/audit-poke/A5-game.json','utf8'));
const report={route:'player.html + exportProjectStoreShim',errors:[],shots:[]};
let server,browser;
try{
 server=await startPlayerQaServer({logLevel:'error'});
 browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
 const page=await (await browser.newContext({viewport:{width:960,height:720}})).newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__a5/project.json',saveNamespace:'a5-p5',qaInstrumentation:true};});
 await page.route('**/__a5/project.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(project)}));
 await page.goto(server.url+'/player.html?e2eVitals=1',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-testid="title-screen"]',{timeout:150000});
 await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done',undefined,{timeout:60000}).catch(()=>{});
 await page.waitForTimeout(800);
 await page.screenshot({path:out+'/00-title.png'});
 await page.keyboard.press('Enter');
 await page.waitForTimeout(4000);await page.screenshot({path:out+'/00b-after-start.png'});
 for(let i=0;i<40;i++){const ok=await page.evaluate(()=>!!window.__oprnDebug?.readState?.().currentMapId);if(ok)break;await page.keyboard.press('Enter');await page.waitForTimeout(700);}
 await page.waitForFunction(()=>!!window.__oprnDebug?.readState?.().currentMapId,null,{timeout:30000});
 for(let i=0;i<60;i++){const n=await page.evaluate(()=>document.querySelectorAll('[data-testid="cinematic-sequence"],.dialogue-box,[data-testid="dialogue-box"]').length);if(!n)break;await page.keyboard.press('Escape');await page.waitForTimeout(500);await page.keyboard.press('Enter');await page.waitForTimeout(400);}
 await page.waitForTimeout(1500);
 await page.screenshot({path:out+'/01-field.png'});
 const seeded=await page.evaluate(()=>{
  const s=window.__oprnHooksScene.session;
  const mk=(id,sp,lv)=>({instanceId:id,speciesId:sp,level:lv,exp:0,friendship:70,caughtAt:{mapId:s.currentMapId,x:s.x,y:s.y},ivs:{hp:10,atk:10,def:10,spd:10}});
  s.monsterInstances={monster_1:mk('monster_1','mx_species_spriglet',8),monster_2:mk('monster_2','mx_species_coalbit',7)};
  s.monsterParty=['monster_1','monster_2'];s.monsterBox=[];
  return Object.keys(s.monsterInstances);
 });
 report.seeded=seeded;

 report.menu={};
 await page.keyboard.press('Escape');await page.waitForTimeout(900);
 await page.screenshot({path:out+'/40-menu.png'});
 report.menu.root=await page.evaluate(()=>[...document.querySelectorAll('[data-testid^="status-menu"]')].map(n=>n.dataset.testid+':'+n.innerText.replace(/\n/g,' ').slice(0,40)).slice(0,40));
 for(const [id,name] of [['status-menu-command-monsters','mon'],['status-menu-command-monster-dex','dex'],['status-menu-command-trainer-card','card'],['status-menu-command-save','save'],['status-menu-command-options','opt']]){
  const el=page.getByTestId(id);
  if(!(await el.count())){report.menu[id]='absent';continue;}
  await el.focus();await page.keyboard.press('Enter');await page.waitForTimeout(700);
  await page.screenshot({path:`${out}/41-${name}.png`});
  report.menu[id]=await page.evaluate(()=>document.body.innerText.replace(/\n/g,' | ').slice(0,600));
  await page.keyboard.press('Escape');await page.waitForTimeout(500);
 }
}catch(e){report.errors.push('FATAL '+(e&&e.stack||e));}
finally{await writeFile(out+'/report3.json',JSON.stringify(report,null,1));await browser?.close();await server?.close();}
console.log(JSON.stringify(report).slice(0,2500));
