import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { startPlayerQaServer, runRuntimeQa } from '../../scripts/lib/runtimeQaRun.mjs';
import retroScenario from '../../scripts/qa/runtime/retro2003.scenario.mjs';
const out=resolve('verify-shots/battle-merge-2026-10-01/interactions');await mkdir(out,{recursive:true});
const report=[];const server=await startPlayerQaServer();const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
async function press(page,id){await page.getByTestId(id).focus();await page.keyboard.press('z');}
async function dom(page){return page.evaluate(()=>({scene:{...document.querySelector('.battle-scene')?.dataset},prompt:!!document.querySelector('.battle-input-prompt'),enemyGauges:[...document.querySelectorAll('.battle-enemy-atb-bar')].map(n=>n.style.getPropertyValue('--battle-stat')),active:document.querySelector('.battle-actor-status.is-active-actor')?.dataset.recordId,actors:[...document.querySelectorAll('.battle-actor-status')].map(n=>({id:n.dataset.recordId,text:n.textContent,atb:n.querySelector('.battle-atb-bar')?.style.width})),buttons:[...document.querySelectorAll('.battle-command')].map(n=>({id:n.dataset.testid,text:n.textContent,inert:n.dataset.battleCommandInert,reason:n.dataset.battleCommandInertReason}))}));}
async function shot(page,id,name){await page.screenshot({path:join(out,id+'-'+name+'.png')});}
try {
 for(const id of (process.env.AUDIT_CASES?.split(',')??['input-auto','combo-menu','crosskind','same-name','capture-cancel','capture-accept','enemy-crosskind','enemy-special','input-active'])){
  const r={id,errors:[]};report.push(r);const context=await browser.newContext({viewport:{width:1024,height:768}});const page=await context.newPage();page.on('pageerror',e=>r.errors.push(String(e)));
  try{
   const fixture=resolve('.omo/battle-merge-3852/'+(id==='capture-accept'?'capture-cancel':id)+'.json');
   if(id.startsWith('capture-')){
    const project=JSON.parse(await readFile(fixture,'utf8'));
    await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__audit/project.json',saveNamespace:'audit-capture',qaInstrumentation:true};});
    await page.route('**/__audit/project.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(project)}));
    await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});await page.getByTestId('title-screen').waitFor({timeout:60000});await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.__oprnDebug?.readState().currentMapId,undefined,{timeout:60000});
    await page.evaluate(()=>{window.__oprnInput.face('down');window.__oprnInput.action();});
    await page.getByTestId('actor-command-fight').waitFor({timeout:30000});await page.waitForFunction(()=>document.querySelector('.battle-scene')?.dataset.battleSequenceBusy==='false');
    r.before=await page.evaluate(()=>window.__oprnDebug.readState());await shot(page,id,'root');
    await press(page,'actor-command-item');await page.getByTestId('actor-capture-item_capture_orb').waitFor({timeout:5000});await shot(page,id,'bag');await press(page,'actor-capture-item_capture_orb');
    if(await page.locator('.battle-scene[data-battle-phase="targetSelect"]').count()) await page.keyboard.press('z');
    await page.waitForFunction(()=>document.querySelector('.battle-scene')?.dataset.battlePhase==='resolved',undefined,{timeout:20000});
    r.captured=await page.evaluate(()=>window.__oprnDebug.readState());await shot(page,id,'captured');
    if(id==='capture-accept'){for(let i=0;i<35&&await page.locator('[data-testid="battle-scene"]').count();i++){await page.keyboard.press('z');await page.waitForTimeout(250);}}else r.abort=await page.evaluate(()=>{const s=window.__oprnHooksScene;const found=!!s.battleAbortController;s.battleAbortController?.abort();return found;});
    await page.waitForSelector('[data-testid="battle-scene"]',{state:'detached',timeout:20000});if(id==='capture-accept')await page.waitForFunction(balls=>window.__oprnDebug.readState().inventory.item_capture_orb===balls-1,r.before.inventory.item_capture_orb,{timeout:10000});r.after=await page.evaluate(()=>window.__oprnDebug.readState());
    r.fixed=id==='capture-cancel'?Object.keys(r.after.monsterInstances).length===Object.keys(r.before.monsterInstances).length&&r.after.inventory.item_capture_orb===r.before.inventory.item_capture_orb:Object.keys(r.after.monsterInstances).length===Object.keys(r.before.monsterInstances).length+1&&r.after.inventory.item_capture_orb===r.before.inventory.item_capture_orb-1;
   }else{
    const beats=structuredClone(retroScenario.beats.slice(0,5));
    beats[3].expect={testidPresent:['battle-scene']};beats[4].ops=beats[4].ops.filter(o=>!(o.kind==='waitForAttr'&&o.attr==='data-battle-flow'));delete beats[4].expect.battlerGeometry;
    await runRuntimeQa(page,{...retroScenario,id:'interaction-'+id,projectFixture:fixture,beats},{serverUrl:server.url,outDir:join(out,id)});
    if(id==='input-auto'||id==='input-active'){
     for(let attempt=0;attempt<10&&!await page.getByTestId('actor-skill-skill_audit_input').count();attempt++){await page.waitForFunction(()=>document.querySelector('.battle-scene')?.dataset.battleSequenceBusy==='false',undefined,{timeout:15000});await press(page,'actor-command-skill');await page.waitForTimeout(50);}for(let attempt=0;attempt<20&&!await page.getByTestId('battle-input-prompt').count();attempt++){await page.waitForFunction(()=>document.querySelector('.battle-scene')?.dataset.battleSequenceBusy==='false',undefined,{timeout:15000});if(!await page.getByTestId('actor-skill-skill_audit_input').count())await press(page,'actor-command-skill');await press(page,'actor-skill-skill_audit_input');await page.waitForTimeout(60);}await page.getByTestId('battle-input-prompt').waitFor();r.before=await dom(page);await shot(page,id,'prompt');
     await page.keyboard.press('f');await page.waitForTimeout(id==='input-active'?1800:100);r.after=await dom(page);await shot(page,id,'auto');r.fixed=r.after.prompt&&r.after.scene.battleSequenceBusy==='false'&&r.after.actors[0].text===r.before.actors[0].text&&JSON.stringify(r.after.enemyGauges)===JSON.stringify(r.before.enemyGauges);await page.keyboard.press('f');await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowDown');await page.keyboard.press('z');await page.waitForTimeout(100);r.completed=await dom(page);r.fixed=r.fixed&&!r.completed.prompt;
    }else if(id==='combo-menu'){
     await press(page,'actor-command-skill');await page.getByTestId('actor-skill-skill_audit_combo').focus();r.before=await dom(page);await shot(page,id,'before');
     await page.waitForFunction(()=>[...document.querySelectorAll('.battle-actor-status')].find(n=>n.dataset.recordId==='actor_guardian')?.textContent.includes('ATB100%'),undefined,{timeout:45000});
     r.ready=await dom(page);await shot(page,id,'ready');await page.keyboard.press('x');await press(page,'actor-command-skill');await page.getByTestId('actor-skill-skill_audit_combo').focus();r.reopened=await dom(page);await shot(page,id,'reopened');
     const find=x=>x.buttons.find(n=>n.id==='actor-skill-skill_audit_combo');r.fixed=find(r.ready)?.inert!=='true'&&find(r.reopened)?.inert!=='true';
    }else{
     await page.evaluate(()=>{window.__auditFx=[];const sample=()=>{const f=document.querySelector('.battle-field');const x={skill:f?.dataset.retroClassSkill,fx:[...document.querySelectorAll('.retro-class-fx[data-retro-skill-fx]')].map(n=>n.dataset.retroSkillFx)};if(x.skill||x.fx.length)window.__auditFx.push(x);};window.__auditObserver=new MutationObserver(sample);window.__auditObserver.observe(document.body,{subtree:true,childList:true,attributes:true});});
     if(id.startsWith('enemy-')){await press(page,'actor-command-defend');}else{await press(page,'actor-command-skill');r.menu=await dom(page);await press(page,id==='record-actor'?'actor-skill-skill_audit_record':id==='crosskind'?'actor-skill-skill_audit_mon_borrow':'actor-skill-skill_gunner_snipe');}
     await page.waitForTimeout(80);if(await page.locator('.battle-scene[data-battle-phase="targetSelect"]').count())await page.keyboard.press('z');
     await page.waitForTimeout(6500);r.observed=await page.evaluate(()=>{window.__auditObserver.disconnect();return window.__auditFx;});r.after=await dom(page);await shot(page,id,'after');
     r.observedSkillIds=[...new Set(r.observed.map(x=>x.skill).filter(Boolean))];r.observedFx=[...new Set(r.observed.flatMap(x=>x.fx))];
     r.fixed=id.includes('record')?r.observedSkillIds.includes('chor_merge_probe')&&r.observedFx.includes('gunner_scope'):id==='crosskind'?r.observedSkillIds.includes('skill_mon_acid_spit'):r.observedSkillIds.includes('skill_gunner_snipe')&&!r.observedSkillIds.includes('skill_ranger_snipe');delete r.observed;
    }
   }
  }catch(e){r.errors.push(String(e.stack??e));r.lastDom=await dom(page).catch(()=>null);await shot(page,id,'failure').catch(()=>{});}
  finally{await context.close();console.log(JSON.stringify(r));}
 }
}finally{
 await browser.close();await server.close();let previous=[];try{previous=JSON.parse(await readFile(join(out,'interactions.json'),'utf8'));}catch{}
 const merged=[...previous.filter(r=>!report.some(n=>n.id===r.id)),...report];await writeFile(join(out,'interactions.json'),JSON.stringify(merged,null,2));
 await writeFile(join(out,'SUMMARY.md'),'# Interaction probes\n\nShipping player.html, transient fixtures.\n\n'+merged.map(r=>`- ${r.id}: fixed=${r.fixed}; errors=${r.errors.length}. 즉시 확인: ${r.id}-`+(r.errors.length?'failure.png':r.id.startsWith('input-')?'prompt.png, '+r.id+'-auto.png':r.id==='combo-menu'?'ready.png, '+r.id+'-reopened.png':r.id.startsWith('capture-')?'root.png, '+r.id+'-captured.png':'after.png')).join('\n'));
}
