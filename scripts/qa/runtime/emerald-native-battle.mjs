// Import a genuine existing slot into private browser storage, then use native Continue.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const [base='http://127.0.0.1:18583', slotPath='/tmp/monster-systems-20261004/native-starter/save-slot-one.json', out='/tmp/oprn-pokemon-motion-20261004/battle-qa'] = process.argv.slice(2);
await fs.mkdir(out,{recursive:true});
const slotBytes=await fs.readFile(slotPath,'utf8'), expected=JSON.parse(slotBytes).session;
const storageKey='starlight-islands-v1:save-slot:v5:1';
const report={scope:'Unmodified compiled player, original project and styles; HTML adds QA instrumentation only; native Continue; genuine predecessor slot copied byte-for-byte into isolated browser localStorage. Native Continue compatibility is unchanged; subsequent battle preparation is explicitly described in preparation.',slotSha256:createHash('sha256').update(slotBytes).digest('hex'),storageKey,errors:[]};
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:720}});
page.on('pageerror',error=>{report.errors.push(String(error));console.log(String(error));});
const pending=new Set();page.on('request',r=>pending.add(r.url()));page.on('requestfinished',r=>pending.delete(r.url()));page.on('requestfailed',r=>{pending.delete(r.url());console.log('Failed',r.url(),r.failure());});page.on('console',m=>{if(m.type()==='error')console.log('Console error',m.text());});
page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))report.errors.push(`${response.status()} ${response.url()}`);});
await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:storageKey,value:slotBytes});
const projectBytes=await (await fetch(base+'/project.json')).text();
await page.route('**/player.html',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('saveNamespace:"starlight-islands-v1"','saveNamespace:"starlight-islands-v1",qaInstrumentation:true')});});
try {
  await page.goto(base+'/player.html');
  await page.getByTestId('title-screen').waitFor({timeout:90000});
  await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done',undefined,{timeout:30000});
  for(let i=0;i<10;i++){
    if(await page.getByTestId('title-load-game').getAttribute('aria-selected')==='true')break;
    await page.keyboard.press('ArrowDown');
  }
  assert.equal(await page.getByTestId('title-load-game').getAttribute('aria-selected'),'true');
  await page.keyboard.press('Enter');
  await page.getByTestId('save-slot-1').waitFor();
  await page.screenshot({path:out+'/01-old-slot.png'});
  await page.getByTestId('save-slot-1').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__oprnDebug?.readState()?.currentMapId,undefined,{timeout:90000});
  await page.getByTestId('play-loading-overlay').waitFor({state:'detached',timeout:90000});
  await page.waitForTimeout(450);
  const state=await page.evaluate(()=>window.__oprnDebug.readState());
  for(const key of ['currentMapId','x','y','gold','inventory','monsterParty','monsterBox'])assert.deepEqual(state[key],expected[key],key);
  for(const id of expected.monsterParty){
    for(const key of ['speciesId','level','currentHp','skillIds','skillPp'])assert.deepEqual(state.monsterInstances[id][key],expected.monsterInstances[id][key],key);
  }
  assert.equal(await page.getByTestId('cinematic-sequence').count(),0);
  report.camera=await page.evaluate(()=>{const camera=window.__oprnHooksScene.cameras.main;return {zoom:camera.zoom,width:camera.width,height:camera.height};});
  assert.equal(report.camera.zoom,2);
  report.loaded={map:state.currentMapId,x:state.x,y:state.y,gold:state.gold,party:state.monsterParty.map(id=>state.monsterInstances[id]),inventory:state.inventory};
  await page.screenshot({path:out+'/02-continued-field.png'});

  report.projectSha256=createHash('sha256').update(projectBytes).digest('hex');
  const project=JSON.parse(projectBytes);
  const natural=JSON.parse(await fs.readFile('/tmp/oprn-emerald-20261004/creature-runtime-v2/runtime-record.json','utf8')).naturalFinal;
  report.preparation='Private browser: genuine old Continue slot byte-for-byte; replay naturally earned Coalbit/Spriglet party. Teleport lab and invoke original rival trainer troop through native scene.playBattle. Second battle explicit near-level Coalbit level5 EXP264 seed, fully restored naturally earned party, teleport meadow original wild troop. No enemy HP, moves, result or rewards changed. HTML QA observer flag only, no code/project/CSS aliases or replacements.';
  const setup=async(map,near=false)=>{
    await page.evaluate(({natural,map,near})=>{const s=window.__oprnHooksScene.session;for(const k of ['monsterInstances','monsterParty','monsterBox'])s[k]=structuredClone(natural[k]);if(near)s.monsterInstances[s.monsterParty[0]].exp=264;window.__oprnDebug.teleport(map,5,10);}, {natural,map,near});
    await page.waitForTimeout(400);
  };
  const partyState=()=>page.evaluate(()=>{const s=window.__oprnDebug.readState();return {gold:s.gold,party:s.monsterParty.map(id=>({id,exp:s.monsterInstances[id].exp,level:s.monsterInstances[id].level}))};});
  const begin=async troopId=>{
    await page.evaluate(troopId=>{window.__finalBattleResult=null;void window.__oprnHooksScene.playBattle({kind:'battleProcessing',troopId,canEscape:false,canLose:true}).then(value=>window.__finalBattleResult=value);},troopId);
    await page.getByTestId('battle-scene').waitFor({timeout:30000});
  };
  const fightToVictory=async(label,before)=>{
    const record={before,turns:[]};
    for(let turn=0;turn<15;turn++){
      if(await page.getByTestId('battle-result-panel').count())break;
      const fight=page.getByTestId('actor-command-fight');await fight.waitFor({timeout:30000});
      await page.waitForFunction(()=>document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep==='command');await fight.focus();await page.keyboard.press('Enter');
      const move=page.getByTestId('actor-skill-mx_skill_fire_1');await move.waitFor();await move.focus();await page.keyboard.press('Enter');await page.waitForTimeout(250);
      const target=page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
      if(await target.count()){await target.first().focus();await page.keyboard.press('Enter');}
      await page.waitForFunction(()=>document.querySelector('[data-testid="battle-result-panel"]')||document.querySelector('[data-testid="actor-command-fight"]'),undefined,{timeout:30000});
      await page.waitForTimeout(400);record.turns.push({turn,text:(await page.getByTestId('battle-scene').innerText()).slice(-1200)});
    }
    await page.getByTestId('battle-result-panel').waitFor({timeout:30000});await page.waitForTimeout(1300);
    record.layout=await page.getByTestId('battle-result-panel').evaluate(panel=>{const stage=panel.closest('.battle-scene'),st=stage.getBoundingClientRect(),p=panel.getBoundingClientRect();return {result:panel.dataset.battleResult,text:panel.innerText,heightLogical:p.height/st.height*320,panelTopLogical:(p.top-st.top)/st.height*320,contained:p.left>=st.left&&p.right<=st.right&&p.top>=st.top&&p.bottom<=st.bottom,bars:[...panel.querySelectorAll('.battle-result-exp-bar')].map(el=>({height:getComputedStyle(el).height,data:{...el.dataset},fill:el.querySelector('.battle-result-exp-fill').style.width,fillPixels:el.querySelector('.battle-result-exp-fill').getBoundingClientRect().width})),images:[...stage.querySelectorAll('.battle-actor-image,.battle-enemy-image')].map(el=>{const r=el.getBoundingClientRect();return {class:el.className,visible:getComputedStyle(el).opacity,top:(r.top-st.top)/st.height*320,bottom:(r.bottom-st.top)/st.height*320,intersectsPanel:r.bottom>p.top&&r.top<p.bottom&&r.right>p.left&&r.left<p.right};}),deathBadges:[...stage.querySelectorAll('.battle-status-icon-death')].map(el=>getComputedStyle(el).display)};});
    assert.equal(record.layout.result,'victory');assert(record.layout.contained);assert(record.layout.heightLogical<=165);
    assert(record.layout.bars.every(bar=>bar.height==='4px'&&parseFloat(bar.fill)>0));
    assert(record.layout.images.filter(image=>image.class.includes('authored-back')).every(image=>!image.intersectsPanel));
    await page.screenshot({path:out+'/'+label+'-victory.png'});
    await page.keyboard.down('Enter');await page.waitForTimeout(650);await page.keyboard.up('Enter');
    for(let n=0;n<8&&await page.getByTestId('battle-result-panel').count();n++){await page.keyboard.press('Enter');await page.waitForTimeout(400);}
    assert.equal(await page.getByTestId('battle-result-panel').count(),0);await page.waitForFunction(()=>window.__finalBattleResult==='victory',undefined,{timeout:15000});
    record.after=await partyState();
    assert(record.after.party[0].exp>before.party[0].exp);assert.equal(record.after.party[1].exp,before.party[1].exp);
    const expText=/경험치[^\d]*(\d+)/.exec(record.layout.text);
    record.rewardAmount=expText?Number(expText[1]):null;
    if(record.rewardAmount!==null)assert.equal(record.after.party[0].exp-before.party[0].exp,record.rewardAmount);
    await page.waitForTimeout(450);assert.deepEqual(await partyState(),record.after);
    return record;
  };
  await setup('mx_map_lab');const trainerBefore=await partyState();await begin('mx_troop_mx_map_lab_rival');
  await page.waitForFunction(()=>document.querySelector('[data-testid="emerald-trainer-intro"]')&&!document.querySelector('[data-testid="emerald-trainer-intro"]').hidden,undefined,{timeout:10000});
  await page.waitForTimeout(330);
  report.trainerIntro=await page.getByTestId('battle-scene').evaluate(stage=>{const st=stage.getBoundingClientRect(),layer=stage.querySelector('[data-testid="emerald-trainer-intro"]');return {message:stage.querySelector('.battle-message-line').textContent,role:layer.dataset.trainerRole,shown:stage.dataset.emeraldTrainerIntro,images:[...layer.querySelectorAll('img')].map(img=>{const r=img.getBoundingClientRect();return {class:img.className,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,width:getComputedStyle(img).width,height:getComputedStyle(img).height,animation:getComputedStyle(img).animationName,top:(r.top-st.top)/st.height*320,bottom:(r.bottom-st.top)/st.height*320};}),battlerVisibility:getComputedStyle(stage.querySelector('.battle-actor-group')).visibility};});
  assert.equal(report.trainerIntro.role,'rival');assert.equal(report.trainerIntro.shown,'true');assert.equal(report.trainerIntro.battlerVisibility,'hidden');assert(report.trainerIntro.message.includes('승부를 걸어왔다'));assert(report.trainerIntro.images.every(i=>i.naturalWidth===64&&i.naturalHeight===64&&i.width==='128px'&&i.height==='128px'&&i.bottom<=240));
  await page.screenshot({path:out+'/03-real-trainer-portraits.png'});
  await page.waitForFunction(()=>document.querySelector('.battle-message-line')?.textContent.includes('가라,'));
  report.sendOut=await page.getByTestId('battle-scene').evaluate(stage=>({message:stage.querySelector('.battle-message-line').textContent,hidden:stage.querySelector('.emerald-trainer-intro').hidden,shown:stage.dataset.emeraldTrainerIntro??null,battlerVisibility:getComputedStyle(stage.querySelector('.battle-actor-group')).visibility}));
  assert.equal(report.sendOut.hidden,true);assert.equal(report.sendOut.shown,null);assert.equal(report.sendOut.battlerVisibility,'visible');
  await page.screenshot({path:out+'/04-send-out-monsters.png'});
  report.trainerVictory=await fightToVictory('05-trainer',trainerBefore);
  await setup('mx_map_meadow',true);const wildBefore=await partyState();await begin(project.maps.mx_map_meadow.encounterTable[0].troopId);
  await page.getByTestId('actor-command-fight').waitFor();report.wildVictory=await fightToVictory('06-wild-levelup',wildBefore);
  assert.equal(report.wildVictory.after.party[0].exp,284);assert.equal(report.wildVictory.after.party[0].level,6);assert.equal(report.wildVictory.layout.bars[0].fill,'100%');assert.equal(report.wildVictory.layout.bars[0].data.expLevelUp,'true');assert.equal(report.errors.length,0);report.completed=true;
} catch(error){report.failure=String(error);report.body=await page.locator('body').innerText();await page.screenshot({path:out+'/failure.png'});throw error;} finally {
  await fs.writeFile(out+'/record.json',JSON.stringify(report,null,2));await fs.writeFile(out+'/SUMMARY.md',`# Compiled Emerald trainer + victory QA\n\nCompleted: ${report.completed===true}; errors: ${report.errors.length}.\n\nInspect first: 03-real-trainer-portraits.png, 05-trainer-victory.png, 06-wild-levelup-victory.png.\n\n${report.preparation}\n`);await browser.close();
}
console.log(JSON.stringify({completed:report.completed,trainer:report.trainerIntro,sendOut:report.sendOut,trainerVictory:report.trainerVictory,wildVictory:report.wildVictory,errors:report.errors}));
