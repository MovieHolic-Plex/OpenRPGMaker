// Four revised assets through the exported player. Temporary fixture only.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
import {recordingFixture} from './retro2003-gif-fixture.mjs';
import {startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';

const out=resolve('verify-shots/monster-battle-four/runtime');
await mkdir(out,{recursive:true});
process.env.VITE_CACHE_DIR??=resolve('.vite-cache/monster-battle-four');
const cases=[['kappa-01','갓파'],['wolf-grey','회색 늑대'],['bat-cave','동굴 박쥐'],['skeleton-knight','해골 전사']];
const poses=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'];
const report={route:'player.html + exportProjectStoreShim',fixtureOnly:true,cases:[],errors:[]};
let server,browser;

async function choose(page,id){
 for(let i=0;i<15;i++){
  const ui=await page.evaluate(()=>{
   const root=document.querySelector('[data-testid="battle-scene"]');
   const buttons=[...document.querySelectorAll('button.battle-command')].filter(n=>!n.disabled&&n.dataset.previewOnly!=='true');
   return {busy:root?.dataset.battleSequenceBusy==='true',menu:buttons.map(n=>n.dataset.testid),cursor:buttons.findIndex(n=>n.dataset.battleCommandCursor==='true')};
  });
  if(ui.busy||!ui.menu.includes(id))return false;
  const want=ui.menu.indexOf(id);
  if(ui.cursor===want){await page.keyboard.press('z');return true;}
  await page.keyboard.press(ui.cursor<0||want>ui.cursor?'ArrowDown':'ArrowUp');
  await page.waitForTimeout(55);
 }
 return false;
}

try{
 server=await startPlayerQaServer({logLevel:'error'});
 browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
 for(const [slug,name] of cases){
  const fixture=await recordingFixture();
  const row={slug,skin:'retro2003',nativeCell:64,errors:[]};
  const context=await browser.newContext({viewport:{width:960,height:720}});
  try{
   const project=fixture.project;
   project.system.battleUiStyle='retro2003';project.system.battleFlow='strict';
   project.system.startActorIds=['actor_hero'];project.session.partyActorIds=['actor_hero'];
   const sample=structuredClone(project.database.enemies[0]);
   const enemy={...sample,id:'enemy_study',name,monsterResourceId:'generated-enemy-'+slug,
    stats:{...sample.stats,maxHp:35,defense:1,attack:35,agility:1},
    actions:[{skillId:'skill_attack',priority:5,condition:{kind:'always'}}]};
   delete enemy.collapseEffect;
   project.database.enemies.push(enemy);
   const troop=project.database.troops.find(t=>t.id===fixture.entry.troopId);
   troop.enemyIds=[enemy.id];troop.autoAlign=false;troop.members=[{enemyId:enemy.id,x:110,y:144,hidden:false}];
   const page=await context.newPage();const starter=[];
   page.on('pageerror',e=>row.errors.push(String(e)));
   page.on('request',r=>{if(r.url().includes('/starter/'))starter.push(r.url());});
   page.on('response',r=>{if(r.status()>=400&&r.url().includes('/pixel-enem'))row.errors.push(`${r.status()} ${r.url()}`);});
   await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__monster-four/project.json',saveNamespace:'four-monster-fixture',qaInstrumentation:true};});
   await page.route('**/__monster-four/project.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(project)}));
   await page.goto(server.url+'/player.html?e2eVitals=1',{waitUntil:'domcontentloaded'});
   await page.waitForSelector('[data-testid="title-screen"]',{timeout:120000});
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>!!window.__oprnDebug?.readState?.().currentMapId,null,{timeout:120000});
   await page.evaluate(entry=>{window.__oprnDebug.setSeed(1);window.__oprnDebug.teleport(entry.mapId,entry.x,entry.y);window.__oprnInput.face('up');},fixture.entry);
   for(let i=0;i<40&&!(await page.locator('[data-testid="battle-scene"]').count());i++){await page.keyboard.press('z');await page.waitForTimeout(200);}
   await page.waitForFunction(()=>{
    const root=document.querySelector('[data-testid="battle-scene"]'),node=root?.querySelector('.battle-enemy');
    const im=node?.querySelector('img');
    return root?.dataset.battlePhase==='actorCommand'&&root.dataset.battleSequenceBusy==='false'&&node?.dataset.pixelEnemyCell==='64'&&im?.complete&&im.naturalWidth===64;
   },null,{timeout:30000});
   await page.locator('[data-testid="battle-scene"]').screenshot({path:join(out,slug+'-idle.png')});
   // Check every authored cell using the shipping renderer's existing frame API.
   // These explicit frame displays are separate from the real input observation.
   row.forcedFrameDisplays=await page.evaluate(async poses=>{
    const {applyBattlerPoseForTest}=await import('/src/player/battleFieldDom.ts');
    const node=document.querySelector('.battle-enemy'),im=node.querySelector('img');
    const results=[];
    for(const pose of poses){
     node.dataset.retroBeat='approach';node.dataset.retroPixelCell=pose;
     applyBattlerPoseForTest(node,'idle');
     const style=getComputedStyle(im);
     results.push({pose,cell:im.dataset.pixelCell,backgroundPosition:style.backgroundPosition,
       backgroundSize:style.backgroundSize,backgroundImage:style.backgroundImage});
    }
    delete node.dataset.retroBeat;delete node.dataset.retroPixelCell;
    applyBattlerPoseForTest(node,'idle');
    return results;
   },poses);
   if(row.forcedFrameDisplays.some((f,i)=>f.cell!==poses[i]))row.errors.push('wrong authored frame selection');
   // Observe actual keyboard-driven defend -> enemy attack -> player attack.
   await page.evaluate(()=>{
    window.__fourPoseTrace=[];window.__fourAttributeTrace=[];window.__fourStop=false;
    let previous='';
    const node=document.querySelector('.battle-enemy');
    window.__fourObserver=new MutationObserver(records=>{
     for(const record of records){
      if(record.oldValue)window.__fourAttributeTrace.push({cell:record.oldValue,source:'attribute-previous',at:performance.now()});
      window.__fourAttributeTrace.push({cell:node.dataset.battlePoseFrame,source:'attribute-current',at:performance.now()});
     }
    });
    window.__fourObserver.observe(node,{attributes:true,attributeOldValue:true,attributeFilter:['data-battle-pose-frame']});
    const record=()=>{
     const node=document.querySelector('.battle-enemy'),root=document.querySelector('[data-testid="battle-scene"]');
     const cell=node?.dataset.battlePoseFrame??'missing';
     if(cell!==previous){window.__fourPoseTrace.push({cell,at:performance.now(),phase:root?.dataset.battlePhase});previous=cell;}
     if(!window.__fourStop)requestAnimationFrame(record);
    };requestAnimationFrame(record);
   });
   let defended=false,acted=false;
   const deadline=Date.now()+40000;
   while(Date.now()<deadline){
    const ui=await page.evaluate(()=>{
     const root=document.querySelector('[data-testid="battle-scene"]');
     return {busy:root?.dataset.battleSequenceBusy==='true',phase:root?.dataset.battlePhase,
       target:!!document.querySelector('[data-testid="battle-target-prompt"]'),result:!!document.querySelector('[data-testid="battle-result-panel"]'),
       frames:[...window.__fourPoseTrace,...window.__fourAttributeTrace].map(r=>r.cell)};
    });
    if(ui.result||ui.frames.includes('dead'))break;
    if(ui.target){await page.keyboard.press('z');acted=true;}
    else if(!ui.busy&&ui.phase==='actorCommand'){
     if(!ui.frames.includes('attack'))defended=(await choose(page,'actor-command-defend'))||defended;
     else await choose(page,'actor-command-attack');
    }
    await page.waitForTimeout(80);
   }
   const trace=await page.evaluate(()=>{window.__fourStop=true;window.__fourObserver.disconnect();return {render:window.__fourPoseTrace,selection:window.__fourAttributeTrace};});
   row.actualInputTrace=trace.render;row.actualSelectionTrace=trace.selection;
   row.actualFrames=[...new Set([...trace.render,...trace.selection].map(r=>r.cell))];
   row.renderSampledFrames=[...new Set(trace.render.map(r=>r.cell))];
   row.defended=defended;row.playerAttackConfirmed=acted;
   for(const expected of ['windup','move','attack','recover','hit','dead'])if(!row.actualFrames.includes(expected))row.errors.push('real input did not observe '+expected);
   row.starterRequests=starter;if(starter.length)row.errors.push('retired starter requested');
   await writeFile(join(out,slug+'-trace.json'),JSON.stringify(row,null,2)+'\n');
  }catch(e){row.errors.push(String(e.stack??e));}
  finally{await context.close();fixture.cleanup();}
  report.cases.push(row);report.errors.push(...row.errors.map(e=>slug+': '+e));
  console.log(JSON.stringify({slug,actualFrames:row.actualFrames,errors:row.errors}));
 }
}catch(e){report.errors.push(String(e.stack??e));}
finally{await browser?.close();await server?.close();}
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(join(out,'SUMMARY.md'),`# 새 네 종 전투 에셋 실제 플레이어 확인\n\n${report.errors.length?'FAIL':'PASS'} — ${report.cases.length}/4종.\n\n즉시 확인: kappa-01-idle.png, wolf-grey-idle.png, bat-cave-idle.png, skeleton-knight-idle.png.\n\nplayer.html + exportProjectStoreShim, retro2003, 임시 fixture. 사용자 SQLite 프로젝트를 수정하지 않았다. 기본 그림 실표시와 9칸 선택 산식은 별도 확인했고, 실제 키보드 입력으로 방어 후 적 공격과 아군 공격을 관측했다. 강제로 표시한 칸은 실제 행동 기록에 섞지 않았다.\n\n${report.errors.join('\n')}\n`);
if(report.errors.length)process.exitCode=1;
