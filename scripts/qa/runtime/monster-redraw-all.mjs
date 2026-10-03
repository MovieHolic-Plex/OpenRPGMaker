// Seven movement families of the fresh 140-species catalog through the exported player. Temporary fixture only.
import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
import {recordingFixture} from './retro2003-gif-fixture.mjs';
import {startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';

const out=resolve('verify-shots/monster-redraw-all/runtime');
await mkdir(out,{recursive:true});
process.env.VITE_CACHE_DIR??=resolve('.vite-cache/monster-redraw-all');
const manifest=JSON.parse(await readFile(resolve('scripts/asset-gen/pixel-enemy/redraw/manifest.json'),'utf8'));
const cases=[['slime','슬라임'],['bee-giant','거대 벌'],['golem','골렘'],['goblin-scout','고블린 척후'],['ghost-pale','유령'],['skeleton-archer','해골 궁수'],['dragon-blue','푸른 용']];
const requested=process.argv.slice(2);
if(requested.some(slug=>!cases.some(c=>c[0]===slug)))throw new Error('Unknown representative species');
const selectedCases=requested.length?cases.filter(c=>requested.includes(c[0])):cases;
const poses=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'];
const previous=requested.length?JSON.parse(await readFile(join(out,'report.json'),'utf8')):null;
if(previous)await copyFile(join(out,'report.json'),join(out,'previous-'+requested.join('-')+'-attempt.json'));
const report={route:'player.html + exportProjectStoreShim',fixtureOnly:true,cases:previous?.cases.filter(c=>!requested.includes(c.slug))??[],errors:[],
 ...(previous?.browserDecodedAssets?{browserDecodedAssets:previous.browserDecodedAssets}:{}),
 ...(previous?{previousAttemptErrors:previous.errors}: {})};
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
 for(const [slug,name] of selectedCases){
  const fixture=await recordingFixture();
  const entry=manifest.find(e=>e.slug===slug),cell=entry.cell;
  const row={slug,skin:'retro2003',nativeCell:cell,motion:entry.motion,errors:[]};
  const context=await browser.newContext({viewport:{width:960,height:720}});
  let page;
  try{
   const project=fixture.project;
   project.system.battleUiStyle='retro2003';project.system.battleFlow='strict';
   project.system.startActorIds=['actor_hero'];project.session.partyActorIds=['actor_hero'];
   const sample=structuredClone(project.database.enemies[0]);
   const enemy={...sample,id:'enemy_study',name,monsterResourceId:entry.resourceId,
    stats:{...sample.stats,maxHp:35,defense:1,attack:35,agility:1},
    actions:[{skillId:'skill_attack',priority:5,condition:{kind:'always'}}]};
   delete enemy.collapseEffect;
   project.database.enemies.push(enemy);
   const troop=project.database.troops.find(t=>t.id===fixture.entry.troopId);
   troop.enemyIds=[enemy.id];troop.autoAlign=false;troop.members=[{enemyId:enemy.id,x:110,y:144,hidden:false}];
   page=await context.newPage();const starter=[];
   row.consoleErrors=[];row.failedRequests=[];
   page.on('pageerror',e=>row.errors.push(String(e)));
   page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
   page.on('requestfailed',r=>row.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
   page.on('request',r=>{if(r.url().includes('/starter/'))starter.push(r.url());});
   page.on('response',r=>{if(r.status()>=400&&r.url().includes('/pixel-enem'))row.errors.push(`${r.status()} ${r.url()}`);});
   await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__monster-redraw-all/project.json',saveNamespace:'all-monster-fixture',qaInstrumentation:true};});
   await page.route('**/__monster-redraw-all/project.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(project)}));
   await page.goto(server.url+'/player.html?e2eVitals=1',{waitUntil:'domcontentloaded'});
   for(let bootAttempt=0;bootAttempt<3;bootAttempt++){
    try{await page.waitForSelector('[data-testid="title-screen"]',{timeout:30000});break;}
    catch(error){
     const interruptions=row.failedRequests.filter(r=>r.error==='net::ERR_NETWORK_CHANGED');
     if(!interruptions.length||bootAttempt===2)throw error;
     (row.bootNetworkInterruptions??=[]).push({attempt:bootAttempt+1,requests:interruptions});
     row.failedRequests=[];row.consoleErrors=[];
     await page.reload({waitUntil:'domcontentloaded'});
    }
   }
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>!!window.__oprnDebug?.readState?.().currentMapId,null,{timeout:120000});
   await page.evaluate(entry=>{window.__oprnDebug.setSeed(1);window.__oprnDebug.teleport(entry.mapId,entry.x,entry.y);window.__oprnInput.face('up');},fixture.entry);
   for(let i=0;i<40&&!(await page.locator('[data-testid="battle-scene"]').count());i++){await page.keyboard.press('z');await page.waitForTimeout(200);}
   await page.waitForFunction(cell=>{
    const root=document.querySelector('[data-testid="battle-scene"]'),node=root?.querySelector('.battle-enemy');
    const im=node?.querySelector('img');
    return root?.dataset.battlePhase==='actorCommand'&&root.dataset.battleSequenceBusy==='false'&&node?.dataset.pixelEnemyCell===String(cell)&&im?.complete&&im.naturalWidth===cell;
   },cell,{timeout:30000});
   await page.locator('[data-testid="battle-scene"]').screenshot({path:join(out,slug+'-idle.png')});
   if(!report.browserDecodedAssets){
    report.browserDecodedAssets=await page.evaluate(async entries=>{
     const results=[];
     for(const entry of entries){
      const portrait=entry.path.replace('/pixel-enemies/','/pixel-enemy-portraits/');
      for(const [path,expected] of [[entry.path,entry.cell*3],[portrait,entry.cell]]){
       const image=new Image();image.src='/'+path;await image.decode();
       results.push({slug:entry.slug,path,width:image.naturalWidth,height:image.naturalHeight,ok:image.naturalWidth===expected&&image.naturalHeight===expected});
      }
     }return results;
    },manifest);
    if(report.browserDecodedAssets.some(r=>!r.ok))row.errors.push('catalog browser image dimensions');
   }

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
   for(const expected of ['windup','attack','hit','dead'])if(!row.actualFrames.includes(expected))row.errors.push('real input did not observe '+expected);
   row.starterRequests=starter;if(starter.length)row.errors.push('retired starter requested');
   await writeFile(join(out,slug+'-trace.json'),JSON.stringify(row,null,2)+'\n');
  }catch(e){
   row.errors.push(String(e.stack??e));
   if(page&&!page.isClosed()){
    row.bootDiagnostics=await page.evaluate(()=>({url:location.href,body:document.body.innerText.slice(0,4000),
      boot:window.__OPENRPG_BOOT__,debug:!!window.__oprnDebug})).catch(()=>null);
    await page.screenshot({path:join(out,slug+'-failure.png')}).catch(()=>{});
   }
  }
  finally{await context.close();fixture.cleanup();}
  report.cases.push(row);
  console.log(JSON.stringify({slug,actualFrames:row.actualFrames,errors:row.errors}));
 }
}catch(e){report.errors.push(String(e.stack??e));}
finally{await browser?.close();await server?.close();}
report.errors.push(...report.cases.flatMap(row=>row.errors.map(e=>row.slug+': '+e)));
report.cases.sort((a,b)=>cases.findIndex(c=>c[0]===a.slug)-cases.findIndex(c=>c[0]===b.slug));
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(join(out,'SUMMARY.md'),`# 전체 몬스터의 7개 이동 방식 실제 플레이어 확인\n\n${report.errors.length?'FAIL':'PASS'} — ${report.cases.length}/7종.\n\n즉시 확인: slime-idle.png, bee-giant-idle.png, golem-idle.png, goblin-scout-idle.png, ghost-pale-idle.png, skeleton-archer-idle.png, dragon-blue-idle.png.\n\nplayer.html + exportProjectStoreShim, retro2003, 임시 fixture. 140종 전체 브라우저 디코드와 7개 이동 방식의 대표 종 실제 행동을 구분한다. 사용자 SQLite 프로젝트를 수정하지 않았다. 기본 그림 실표시와 9칸 선택 산식은 별도 확인했고, 실제 키보드 입력으로 방어 후 적 공격과 아군 공격을 관측했다. 강제로 표시한 칸은 실제 행동 기록에 섞지 않았다.\n\n${report.errors.join('\n')}\n`);
if(report.errors.length)process.exitCode=1;
