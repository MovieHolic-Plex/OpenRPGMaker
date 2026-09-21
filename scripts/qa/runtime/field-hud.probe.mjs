// Requested visual QA: real player + editor, never mutates the authored source fixture.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { hudPreset, normalizeFieldHud, normalizeHudWidget, recommendedHudMenu } from '../../../src/project/fieldHud.ts';
import { startPlayerQaServer, runRuntimeQa } from '../../lib/runtimeQaRun.mjs';
const out=process.env.HUD_QA_OUT ?? 'verify-shots/runtime-qa/field-hud-composer';
await mkdir(out,{recursive:true});
const base=JSON.parse(await readFile('test/fixtures/projects/editor-authored-demo-v3.json','utf8'));
base.system.timeSystem={enabled:true,minutesPerRealSecond:0,dayStartHour:9};
base.system.energy={max:100,initial:72}; base.session.gold=2840;
const toolDefs=[['hoe','괭이','hoe'],['watering-can','물뿌리개','wateringCan'],['axe','도끼','axe'],['pickaxe','곡괭이','pickaxe']];
// Use actual supported tool enums; invalid kinds are rejected by the project's IO.
for(const [icon,name,kind] of toolDefs.slice(0,2))base.database.items.push({...base.database.items[0],id:`qa_${icon}`,name,type:'normalGoods',scope:'none',farmTool:kind,iconResourceId:`cc0-jetrel-${icon}`,consumable:false});
const foodIds=[];
for(const [icon,name,count] of [['apple','사과',8],['bread','빵',3],['meat','고기',5]]){const id=`qa_${icon}`;foodIds.push(id);base.database.items.push({...base.database.items[0],id,name,iconResourceId:`cc0-jetrel-${icon}`,consumable:true});base.session.inventory[id]=count;}
for(const item of base.database.items.filter(i=>i.id.startsWith('qa_')&&i.farmTool))base.session.inventory[item.id]=1;
base.variables.push({id:'qa_hunger',name:'허기'});base.session.variables.qa_hunger=72;
const server=await startPlayerQaServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
const checks=[];
try{
 for(const profile of (process.env.HUD_QA_PROFILES?.split(',') ?? ['collector','classic','horror','chase','hearts','farm','survival','party','minimal','adventure','legacy','farm-edge'])){
  const theme=profile==='farm-edge'?'farm':profile;
  const project=structuredClone(base);const widgets=hudPreset(theme);
  if(profile==='farm-edge')project.startPos={x:14,y:28};
  if(theme==='survival'){project.system.actionCombat={enabled:true,hud:{hearts:true,stamina:true}};project.maps[project.startMapId].actionCombat=true;widgets.find(w=>w.id==='food').itemIds=foodIds;}
  project.system.fieldHud=normalizeFieldHud({theme,widgets,menuStyle:recommendedHudMenu(theme)});
  const fixture=`${out}/input-${profile}.json`;await writeFile(fixture,JSON.stringify(project));
  const page=await browser.newPage();page.on('pageerror',e=>console.error(theme,e.message));page.on('console',m=>{if(m.type()==='error')console.error(theme,m.text().slice(0,500));});
  console.log(`Capture ${profile}`);
  const report=await runRuntimeQa(page,{id:`composer-${profile}`,projectFixture:fixture,query:{e2eVitals:'1'},viewport:{width:1024,height:768},beats:[
   {id:'field',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'},{kind:'key',key:'1'}],shot:true},
   {id:'low-health',ops:[{kind:'setVitals',hp:103,mp:5,actorIds:[project.system.startActorIds[0]]}],shot:true},
   {id:'menu',ops:[{kind:'key',key:'Escape'},{kind:'waitFor',testid:'main-menu',state:'present'}],shot:true}
  ]},{serverUrl:server.url,outDir:`${out}/${profile}`});
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert(report.beats.every(b=>b.failures.length===0),JSON.stringify(report.beats));
  assert.equal(await page.getByTestId('field-hud').isVisible(),false,'menu hides HUD');
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished.catch(()=>{})));});
  await page.screenshot({path:`${out}/${profile}/03-menu.png`});
  if(theme==='collector'){
   const selected=()=>page.locator('.status-menu-command.selected').innerText();
   const first=await selected();await page.keyboard.press('ArrowDown');assert.notEqual(await selected(),first);await page.keyboard.press('ArrowUp');assert.equal(await selected(),first);
   await page.keyboard.press('Enter');await page.getByTestId('main-menu').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.querySelector('[data-testid="main-menu"]').dataset.statusMenuScreen==='function');
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished.catch(()=>{})));});
   await page.screenshot({path:`${out}/${profile}/06-items.png`});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('[data-testid="main-menu"]').dataset.statusMenuScreen==='main');
  }
  if (['collector','classic','horror','chase'].includes(theme)) assert.equal(await page.getByTestId('main-menu').getAttribute('data-menu-skin'),recommendedHudMenu(theme));
  await page.keyboard.press('Escape');await page.getByTestId('main-menu').waitFor({state:'detached'});
  if(theme==='survival'){
   await page.keyboard.down('c');await page.getByTestId('hud-widget-stamina').waitFor({state:'visible'});await page.screenshot({path:`${out}/${profile}/04-stamina.png`});await page.keyboard.up('c');
   const text=await page.getByTestId('hud-widget-food').innerText();assert(text.includes('8')&&text.includes('3')&&text.includes('5'),'food uses real inventory');
  }
  const roundtrip=await page.evaluate(async()=>{const {store}=await import('/src/player/exportProjectStoreShim.ts');const {serialize,deserialize}=await import('/src/project/io.ts');const p=store.getCurrent();return {before:p.system.fieldHud,after:deserialize(serialize(p)).system.fieldHud};});assert.deepEqual(roundtrip.after,roundtrip.before);
  if(profile==='farm'){
   await page.evaluate(async()=>{const {store,setExportedProject}=await import('/src/player/exportProjectStoreShim.ts');const {normalizeHudWidget}=await import('/src/project/fieldHud.ts');const p=structuredClone(store.getCurrent());p.system.fieldHud.widgets.push(normalizeHudWidget({id:'hunger',source:'variable',variableId:'qa_hunger',label:'허기',shape:'ring',anchor:'top-left',width:44,height:48,condition:'nonzero'}));setExportedProject(p);});
   await page.getByTestId('hud-widget-hunger').waitFor({state:'visible'});assert.match(await page.getByTestId('hud-widget-hunger').innerText(),/72/);
   await page.evaluate(()=>window.__oprnDebug.setVariable('qa_hunger',24));await page.waitForFunction(()=>document.querySelector('[data-testid="hud-widget-hunger"]').textContent.includes('24'));
   await page.screenshot({path:`${out}/${profile}/04-custom-variable.png`});
   await page.evaluate(()=>window.__oprnDebug.setVariable('qa_hunger',0));await page.getByTestId('hud-widget-hunger').waitFor({state:'hidden'});
   // IO rejects duplicate ids and unsafe numeric authoring before play.
   const rejected=await page.evaluate(async()=>{const{store}=await import('/src/player/exportProjectStoreShim.ts');const{serialize,deserialize}=await import('/src/project/io.ts');return ['duplicate','nan','enum'].map(kind=>{const p=structuredClone(store.getCurrent());if(kind==='duplicate')p.system.fieldHud.widgets.push({...p.system.fieldHud.widgets[0]});if(kind==='nan')p.system.fieldHud.widgets[0].width=-1;if(kind==='enum')p.system.fieldHud.widgets[0].shape='unsupported';try{deserialize(serialize(p));return false;}catch{return true;}});});assert(rejected.every(Boolean));
  }
  if(theme==='horror'){
   const actorId=project.system.startActorIds[0];
   const max=Number(await page.getByTestId('hud-widget-life').getAttribute('aria-valuemax'));assert(max>0);
   for(const [petals,fraction] of [[5,1],[3,.6],[1,.1],[0,0]]){
    await page.evaluate(({id,hp})=>window.__oprnSetActorVitals(id,hp,0),{id:actorId,hp:Math.floor(max*fraction)});
    await page.waitForFunction(n=>document.querySelectorAll('.hud-petal[data-alive="true"]').length===n,petals);
    await page.screenshot({path:`${out}/${profile}/06-petals-${petals}.png`});
   }
  }
  if(profile==='farm-edge'){
   await page.waitForFunction(()=>document.querySelector('[data-testid="hud-widget-tools"]')?.dataset.avoiding==='true');
   const overlap=await page.evaluate(()=>{const toolbar=document.querySelector('[data-testid="hud-widget-tools"]').getBoundingClientRect();return ['clock','gold','health','energy'].some(id=>{const node=document.querySelector(`[data-testid="hud-widget-${id}"]`);if(node.hidden)return false;const r=node.getBoundingClientRect();return toolbar.left<r.right&&toolbar.right>r.left&&toolbar.top<r.bottom&&toolbar.bottom>r.top;});});assert.equal(overlap,false,'auto-moved toolbar clears fixed panels');
   await page.screenshot({path:`${out}/${profile}/04-avoid-player.png`});
  }
  if(theme!=='legacy'){
   const geometry=await page.locator('.field-hud').evaluate(root=>{const r=root.getBoundingClientRect();return [...root.querySelectorAll('.hud-widget')].filter(n=>!n.hidden).map(n=>{const b=n.getBoundingClientRect();return {id:n.dataset.widgetId,inBounds:b.left>=r.left&&b.top>=r.top&&b.right<=r.right+.5&&b.bottom<=r.bottom+.5};});});assert(geometry.every(g=>g.inBounds),JSON.stringify(geometry));
   await page.setViewportSize({width:320,height:240});await page.screenshot({path:`${out}/${profile}/05-native-320.png`});
  }
  checks.push({profile,theme,beats:report.beats.length,roundtrip:true,menuHidden:true});await page.close();await rm(fixture);
 }
 await writeFile(`${out}/checks.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();await server.close();}
