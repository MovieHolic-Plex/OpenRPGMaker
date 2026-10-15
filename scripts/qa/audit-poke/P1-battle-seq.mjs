// A5 감사: 생성된 몬스터 게임(A5-game.json)을 출하 플레이어(player.html)에서 열어 전투 한 프레임을 캡처한다.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';
const out=resolve('qa-runs/audit-poke/A5-p1b');await mkdir(out,{recursive:true});
process.env.VITE_CACHE_DIR??=resolve('.vite-cache/a5-p1b');
const project=JSON.parse(await readFile('qa-runs/audit-poke/A5-game.json','utf8'));
const report={route:'player.html + exportProjectStoreShim',errors:[],shots:[]};
let server,browser;
try{
 server=await startPlayerQaServer({logLevel:'error'});
 browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
 const page=await (await browser.newContext({viewport:{width:960,height:720}})).newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__a5/project.json',saveNamespace:'a5-p1b',qaInstrumentation:true};});
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

 const begin=async troopId=>{await page.evaluate(troopId=>{window.__res=null;void window.__oprnHooksScene.playBattle({kind:'battleProcessing',troopId,canEscape:true,canLose:true}).then(v=>{window.__res=v;});},troopId);await page.getByTestId('battle-scene').waitFor({timeout:40000});};
 const waitCmd=async()=>page.waitForFunction(()=>document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep==='command'||window.__res,null,{timeout:90000});
 const snap=async(n)=>{await page.screenshot({path:`${out}/${n}.png`});};
 const text=()=>page.evaluate(()=>document.querySelector('[data-testid="battle-scene"]')?.innerText.replace(/\n/g,' | ').slice(0,300));
 report.seq=[];
 // trainer battle intro frames
 await begin('mx_troop_mx_map_meadow_trainer_0');
 for(let i=0;i<6;i++){await page.waitForTimeout(500);await snap('20-trainer-intro-'+i);report.seq.push(['trainer-intro-'+i,await text()]);}
 await waitCmd();await page.waitForTimeout(500);await snap('21-trainer-command');
 // fight until victory, capturing frames
 let n=0;
 while(!(await page.evaluate(()=>window.__res))&&n<20){
  n++;
  const fight=page.getByTestId('actor-command-fight');
  if(!(await fight.count())){await page.waitForTimeout(500);await page.keyboard.press('Enter');continue;}
  await fight.focus();await page.keyboard.press('Enter');await page.waitForTimeout(400);
  await page.keyboard.press('Enter');await page.waitForTimeout(200);
  const tgt=page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
  if(await tgt.count()){await tgt.first().focus();await page.keyboard.press('Enter');}
  for(let k=0;k<8;k++){await page.waitForTimeout(350);if(n<=2)await snap(`22-turn${n}-f${k}`);report.seq.push([`turn${n}-f${k}`,await text()]);}
  await page.waitForFunction(()=>document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep==='command'||window.__res||document.querySelector('[data-testid="battle-result-panel"]'),null,{timeout:90000}).catch(()=>{});
  for(let k=0;k<12&&await page.getByTestId('battle-result-panel').count();k++){await snap('23-result-'+k);report.seq.push(['result-'+k,await text()]);await page.keyboard.press('Enter');await page.waitForTimeout(700);}
 }
 await page.waitForTimeout(1500);report.result=await page.evaluate(()=>window.__res);
 report.after=await page.evaluate(()=>{const s=window.__oprnHooksScene.session;return Object.values(s.monsterInstances).map(m=>({id:m.instanceId,sp:m.speciesId,lv:m.level,exp:m.exp,pp:m.skillPp,hp:m.currentHp}))});
 // wild capture
 await page.evaluate(()=>{const s=window.__oprnHooksScene.session;s.inventory.item_capture_orb=9;});
 await begin('mx_troop_mx_map_meadow_wild_0');await waitCmd();await page.waitForTimeout(600);
 const itemBtn=page.getByTestId('actor-command-item');await itemBtn.focus();await page.keyboard.press('Enter');await page.waitForTimeout(600);await snap('30-item-menu');
 report.itemMenu=await text();
 await page.keyboard.press('Enter');await page.waitForTimeout(400);
 const tgt2=page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
 if(await tgt2.count()){await tgt2.first().focus();await page.keyboard.press('Enter');}
 for(let k=0;k<14;k++){await page.waitForTimeout(350);await snap('31-capture-f'+k);report.seq.push(['cap-f'+k,await text()]);}
 await page.waitForTimeout(3000);report.captureResult=await page.evaluate(()=>({res:window.__res,box:window.__oprnHooksScene.session.monsterBox,party:window.__oprnHooksScene.session.monsterParty}));
 // expose journal
 report.journal=await page.evaluate(()=>Object.keys(window.__oprnHooksScene.session.switches).filter(k=>k.startsWith('mx_seen_')||k.startsWith('mx_caught_')));
 await page.keyboard.press('Escape');await page.waitForTimeout(800);
}catch(e){report.errors.push('FATAL '+(e&&e.stack||e));}
finally{await writeFile(out+'/report2.json',JSON.stringify(report,null,1));await browser?.close();await server?.close();}
console.log(JSON.stringify(report).slice(0,2500));
