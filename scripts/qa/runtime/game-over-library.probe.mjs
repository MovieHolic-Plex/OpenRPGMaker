import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
const out=resolve('output/evidence/game-over-library');await mkdir(out,{recursive:true});
process.env.VITE_AI_ACTIVITY_DISK_MIRROR='0';process.env.VITE_EDIT_ACTIVITY_DISK_MIRROR='0';
const server=await createServer({configFile:resolve('vite.config.ts'),cacheDir:resolve('output/.vite-library-editor'),server:{host:'127.0.0.1',port:0,strictPort:false,watch:null,hmr:false},logLevel:'error'});
await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
let playerServer;const result={errors,flows:[]};
try {
 await page.addInitScript(()=>localStorage.setItem('oprn:editor-ui-mode','expert'));
 await page.goto(origin+'/?blankProject=1&aiBridge=0',{waitUntil:'domcontentloaded'});await page.getByTestId('edit-canvas').waitFor({timeout:90000});
 const fixture=JSON.parse(await readFile('test/fixtures/projects/editor-authored-demo-v3.json','utf8'));
 await page.evaluate(async p=>{const {store}=await import('/src/project/store.ts');const {deserialize}=await import('/src/project/io.ts');store.replace(deserialize(JSON.stringify(p)));},fixture);
 await page.getByTestId('toolbar-database').click();await page.getByTestId('database-modal').waitFor();
 const tab=page.getByTestId('db-tab-game-over');if(!await tab.isVisible())await page.getByTestId('db-tab-group-system').click();await tab.click();
 console.log('DB OPEN');const by=id=>page.getByTestId(id);
 const change=async(id,value)=>{await by(id).fill(value);await by(id).dispatchEvent('change');await by(id).evaluate(e=>e.blur());};
 const create=async(template,name,title,outcome)=>{
  await by('db-game-over-template').selectOption(template);await by('db-cinematic-game-over-add').click();
  await change('db-game-over-name',name);const id=await by('db-game-over-select').inputValue();
  if(await by('db-cinematic-game-over-title').isEnabled())await change('db-cinematic-game-over-title',title);await by('db-defeat-outcome').selectOption(outcome);return id;
 };
 const horror=await create('horror','추격자에게 붙잡힘','문 너머에는 아무도 없었다','menu');
 await change('db-cinematic-game-over-message','당신의 발소리가 멎었다.');
 await change('db-defeat-silenceMs','1000');
 await by('db-cinematic-add').click();await change('db-cinematic-narration','마지막 문은 열리지 않았다.');await change('db-cinematic-duration','1000');
 await by('db-cinematic-enabled').click();
 await by('db-game-over-default').selectOption(horror);
 assert(await by('db-cinematic-game-over-delete').isDisabled());
 await by('db-game-over-select').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'editor-library.png')});
 await by('db-cinematic-preview-start').click();await by('return-title').waitFor();await page.waitForTimeout(300);
 await page.screenshot({path:resolve(out,'editor-preview.png')});await page.keyboard.press('Escape');assert.equal(await by('game-over-screen').count(),0);
 const recover=await create('blackout','전투 전멸 · 회복소','다시 일어설 시간','recover');
 await change('db-cinematic-game-over-message','눈앞이 캄캄해졌다…\n회복소에서 다시 눈을 떴다.');
 await by('db-defeat-recovery-map').selectOption(fixture.startMapId);
 await page.getByLabel('귀환 X',{exact:true}).fill('14');await page.getByLabel('귀환 X',{exact:true}).press('Tab');
 await page.getByLabel('귀환 Y',{exact:true}).fill('20');await page.getByLabel('귀환 Y',{exact:true}).press('Tab');
 await by('db-defeat-outcome').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'editor-recovery.png')});
 const timeout=await create('horror','시간 초과 · 돌아오지 못한 밤','밤이 끝나지 않았다','title');
 await change('db-cinematic-game-over-message','새벽이 오기 전에 돌아오지 못했다.');
 await by('db-cinematic-game-over-duplicate').click();const duplicate=await by('db-game-over-select').inputValue();
 await change('db-cinematic-game-over-message','복제 항목만 수정');await by('db-cinematic-game-over-delete').click();
 await by('db-game-over-select').selectOption(timeout);assert.equal(await by('db-cinematic-game-over-message').inputValue(),'새벽이 오기 전에 돌아오지 못했다.');
 // Use the production command dialog; only its QA onApply sink is fixture-specific.
 await page.evaluate(async()=>{
  const {store}=await import('/src/project/store.ts');const {openNewEventCommandDialog}=await import('/src/editor/panels/eventEditor/commandEditDialog.ts');
  openNewEventCommandDialog({kind:'killPlayer'},command=>{window.__authoredTerminalCommand=command;store.update(p=>{const e=p.maps[p.startMapId].events[0];e.pages[0].commands=[command];e.commands=[command];},{scope:'system',label:'QA command authoring'});});
 });
 await by('event-command-game-over-id').selectOption(horror);await change('event-command-kill-player-message','');await page.screenshot({path:resolve(out,'editor-event.png')});
 await by('event-command-edit-ok').click();
 await by('db-game-over-select').selectOption(horror);await by('db-game-over-default').selectOption('');
 assert(await by('db-cinematic-game-over-delete').isDisabled(),'referenced entry cannot be deleted');
 await by('db-game-over-default').selectOption(horror);
 const saved=await page.evaluate(async()=>{const {store}=await import('/src/project/store.ts');const {serialize,deserialize}=await import('/src/project/io.ts');const before=store.getCurrent();const p=deserialize(serialize(before));return {before:before.system,after:p.system,p,command:window.__authoredTerminalCommand};});
 assert.deepEqual(saved.before.gameOvers,saved.after.gameOvers);assert.equal(saved.after.defaultGameOverId,horror);assert.equal(saved.command.gameOverId,horror);assert.equal(saved.after.gameOvers.length,3);assert(!saved.after.gameOvers.some(r=>r.id===duplicate));
 result.ids={horror,recover,timeout};result.roundtrip=true;result.editorVideo=await page.video().path();
 await writeFile(resolve(out,'authored-project.json'),JSON.stringify(saved.p));await context.close();await server.close();
 console.log('EDITOR OK');
 playerServer=await startPlayerQaServer();
 for(const [name,id] of [['horror',horror],['recover',recover],['timeout',timeout],['default',undefined],['battle',horror]]){
  const p=structuredClone(saved.p);delete p.system.opening;p.system.titleScreen.musicResourceId='';
  const map=p.maps[p.startMapId],e=structuredClone(map.events[0]);e.x=p.startPos.x;e.y=p.startPos.y-1;
  const commands=[{kind:'checkpointSave'},{kind:'setVariable',variableId:'var_lantern_shards',op:'=',value:37},{kind:name==='recover'?'killPlayer':'gameOver',...(id?{gameOverId:id}:{})},{kind:'setVariable',variableId:'var_lantern_shards',op:'=',value:777}];
  if(name==='battle') {
   const troop=p.database.troops.find(row=>row.members.length);
   troop.battleEventPages=[{id:'named-defeat',name:'Named defeat',span:'battle',conditions:[],commands:[{kind:'gameOver',gameOverId:id}]}];
   commands[2]={kind:'battleProcessing',troopId:troop.id,canEscape:false,canLose:true};
  }
  e.pages=[{...e.pages[0],conditions:[],trigger:{kind:'action'},movement:{type:'fixed',speed:3,frequency:3},commands}];e.commands=commands;map.events=[e];
  const ctx=await browser.newContext({viewport:{width:960,height:720},recordVideo:{dir:out,size:{width:960,height:720}}}),pg=await ctx.newPage();pg.on('pageerror',e=>errors.push(String(e)));
  await pg.addInitScript(()=>window.__OPENRPG_BOOT__={projectUrl:'/__library/project.json',saveNamespace:'library-proof',qaInstrumentation:true});
  await pg.route('**/__library/project.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(p)}));
  await pg.goto(playerServer.url+'/player.html',{waitUntil:'domcontentloaded'});await pg.getByTestId('title-screen').waitFor({timeout:90000});await pg.keyboard.press('Enter');await pg.waitForFunction(()=>window.__oprnDebug?.readState?.().currentMapId);
  await pg.waitForTimeout(500);const flow={name,clipStart:Date.now()};await pg.waitForTimeout(700);await pg.keyboard.press('ArrowUp');await pg.keyboard.press('Enter');if(name==='battle'){for(let attempt=0;attempt<60 && !await pg.getByTestId('game-over-screen').count();attempt++){await pg.waitForTimeout(500);await pg.keyboard.press('Enter');}await pg.screenshot({path:resolve(out,'battle-handoff.png')});}await pg.getByTestId('game-over-screen').waitFor();
  if(name==='recover'){
   await pg.getByTestId('game-over-screen').waitFor({state:'detached'});const s=await pg.evaluate(()=>window.__oprnDebug.readState());assert.equal(s.x,14);assert.equal(s.y,20);assert.equal(s.variables.var_lantern_shards,37);
   await pg.keyboard.press('ArrowDown');await pg.waitForTimeout(350);assert.equal(await pg.evaluate(()=>window.__oprnDebug.readState().y),21);
  }else if(name==='timeout'){await pg.getByTestId('title-screen').waitFor();}
  else{await pg.getByTestId('return-title').waitFor();assert.equal(await pg.locator('.game-over-heading').innerText(),'문 너머에는 아무도 없었다');assert.equal(await pg.evaluate(()=>window.__oprnDebug.readState().variables.var_lantern_shards),37);}
  await pg.waitForTimeout(500);await pg.screenshot({path:resolve(out,`player-${name}.png`)});flow.clipEnd=Date.now();flow.video=await pg.video().path();await ctx.close();result.flows.push(flow);console.log(name,'OK');
 }
 assert.deepEqual(errors,[]);
}catch(e){console.error(e);await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}finally{await browser.close();await server.close();await playerServer?.close();await writeFile(resolve(out,'results.json'),JSON.stringify(result,null,2));}
