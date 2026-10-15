// A5 감사: 생성된 몬스터 게임(A5-game.json)을 출하 플레이어(player.html)에서 열어 전투 한 프레임을 캡처한다.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
const out=resolve('qa-runs/audit-poke/A5-p1');await mkdir(out,{recursive:true});
process.env.VITE_CACHE_DIR??=resolve('.vite-cache/a5-p1');
const project=JSON.parse(await readFile('qa-runs/audit-poke/A5-game.json','utf8'));
const report={route:'player.html + exportProjectStoreShim',errors:[],shots:[]};
let server,browser;
try{
 server=await startPlayerQaServer({logLevel:'error'});
 browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
 const page=await (await browser.newContext({viewport:{width:960,height:720}})).newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__a5/project.json',saveNamespace:'a5-p1',qaInstrumentation:true};});
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
 const begin=async troopId=>{await page.evaluate(troopId=>{void window.__oprnHooksScene.playBattle({kind:'battleProcessing',troopId,canEscape:true,canLose:true});},troopId);await page.getByTestId('battle-scene').waitFor({timeout:40000});await page.waitForTimeout(3500);};
 for(const [label,troop] of [['wild','mx_troop_mx_map_meadow_wild_0'],['trainer','mx_troop_mx_map_meadow_trainer_0']]){
  await begin(troop);
  await page.screenshot({path:`${out}/10-${label}-intro.png`});
  // wait command menu
  await page.waitForFunction(()=>document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep==='command',null,{timeout:60000}).catch(e=>report.errors.push('no command step '+label));
  await page.waitForTimeout(600);
  await page.screenshot({path:`${out}/11-${label}-command.png`});
  const dom=await page.evaluate(()=>{const r=document.querySelector('[data-testid="battle-scene"]');return {dataset:{...r.dataset},text:r.innerText.slice(0,900),buttons:[...r.querySelectorAll('button')].map(b=>b.dataset.testid+':'+b.innerText.replace(/\n/g,' ')).slice(0,30),bars:[...r.querySelectorAll('[class*=bar]')].map(n=>n.className+'|'+(n.dataset.hpState||'')).slice(0,30)};});
  report[label]={command:dom};
  const fight=page.getByTestId('actor-command-fight');
  if(await fight.count()){await fight.focus();await page.keyboard.press('Enter');await page.waitForTimeout(700);await page.screenshot({path:`${out}/12-${label}-moves.png`});
   report[label].moves=await page.evaluate(()=>{const r=document.querySelector('[data-testid="battle-scene"]');return {text:r.innerText.slice(0,900),buttons:[...r.querySelectorAll('button')].map(b=>b.dataset.testid+':'+b.innerText.replace(/\n/g,' ')).slice(0,30)};});
  }
  // finish battle by escaping (wild) or force victory
  await page.evaluate(()=>{});
  if(label==='wild'){await page.keyboard.press('Escape');await page.waitForTimeout(400);}
  await writeFile(out+'/report.json',JSON.stringify(report,null,1));
  break; // trainer battle requires finishing the wild first; keep it simple
 }
}catch(e){report.errors.push('FATAL '+(e&&e.stack||e));}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,1));await browser?.close();await server?.close();}
console.log(JSON.stringify(report).slice(0,3000));
