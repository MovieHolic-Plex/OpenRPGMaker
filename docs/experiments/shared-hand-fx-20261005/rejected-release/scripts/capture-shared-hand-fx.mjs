// Focused browser observations, not a gate/suite. Common defaults use a memory fixture.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base=process.argv[2]??'http://127.0.0.1:9877';
// The routed blank page bypasses the server; first wait for a real module response.
for(let attempt=0;attempt<20;attempt++){
 try {const r=await fetch(base+'/src/assets/handPixelFxCatalog.ts');if(r.ok)break;throw new Error('module HTTP '+r.status);}
 catch(e){if(attempt===19)throw e;await new Promise(r=>setTimeout(r,500));}
}
const out=resolve('verify-shots/shared-hand-fx-20261005');await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--disable-gpu','--disable-background-networking','--disable-features=NetworkChangeNotifier']});
const p=await browser.newPage({viewport:{width:1400,height:1000}});
const errors=[];p.on('pageerror',e=>errors.push(e.message));
p.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
// The container repeatedly notifies Chromium of network changes mid module load.
// Serve the same local GET responses through Node; no project/API writes are proxied.
await p.route(base+'/**',async route=>{
 const request=route.request();
 if(request.method()!=='GET'){await route.continue();return;}
 try {
  const response=await fetch(request.url());
  await route.fulfill({status:response.status,headers:{'content-type':response.headers.get('content-type')??'application/octet-stream'},body:Buffer.from(await response.arrayBuffer())});
 } catch(e){await route.abort('failed').catch(()=>{});}
});
try {
 await p.route('**/__hand-fx',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));
 await p.goto(base+'/__hand-fx');
 const data=await p.evaluate(async()=>{
  const presets=await import('/src/assets/handPixelFxCatalog.ts');
  const defaults=await import('/src/project/defaults/defaultDatabaseStarterRecords.ts');
  const catalog=await import('/src/assets/retroSkillCatalog.ts');
  const convergence=await import('/src/project/defaults/defaultDatabase.ts');
  const pixel=await import('/src/assets/retroPixelAnimations.ts');
  const party=await import('/src/project/defaults/defaultDatabasePartyRecords.ts');
  const util=await import('/src/project/defaults/defaultDatabaseUtilityRecords.ts');
  const skills=defaults.defaultSkillRecords().filter(s=>s.id.startsWith('skill_fx_'));
  const anims=defaults.defaultBattleAnimationRecords().filter(a=>a.id.startsWith('anim_px_'));
  // state_death is the runtime's implicit KO sentinel (also used by cleric_revive).
  const states=new Set(['state_death',...defaults.defaultStateRecords().map(s=>s.id)]);
  const elements=new Set(util.defaultElementRecords().map(e=>e.id));
  const issues=skills.flatMap(s=>[
   ...(!anims.some(a=>a.id===s.animationId)?[s.id+':animation']:[]),
   ...(s.elementId&&!elements.has(s.elementId)?[s.id+':element']:[]),
   ...(s.stateEffects??[]).filter(e=>!states.has(e.stateId)).map(e=>s.id+':'+e.stateId),
   ...(!catalog.resolveSkillChoreography(s)?[s.id+':contract']:[]),
  ]);
  const db=convergence.defaultDatabase();
  db.skills=db.skills.filter(s=>!s.id.startsWith('skill_fx_'));
  db.battleAnimations=db.battleAnimations.filter(a=>!a.id.startsWith('anim_px_hand_'));
  db.states=db.states.filter(s=>s.id!=='state_regen');
  const authored={...skills[0],name:'저자의 수정',power:987};db.skills.push(authored);
  const authoredAnimation={...anims.find(a=>a.id==='anim_px_hand_impact'),name:'저자의 애니메이션'};db.battleAnimations.push(authoredAnimation);
  const project={database:db};
  const changed=[convergence.ensureRetroRosterRecords(project),convergence.ensureBundledBattleAnimations(project)];
  const second=[convergence.ensureRetroRosterRecords(project),convergence.ensureBundledBattleAnimations(project)];
  const owner=party.defaultPartyRecords().classes.find(c=>c.id==='class_hero');
  const runtimeIds=['skill_fx_impact','skill_fx_heal_drop','skill_fx_guard_crystal','skill_fx_comet'];
  const runtimeSkills=skills.filter(s=>runtimeIds.includes(s.id));
  const borrowed={...skills[0],id:'skill_hand_summon_review',name:'용 소환 검토',retroChoreographyId:'skill_monk_dragon_fist'};
  owner.skillIds=[...owner.skillIds,...runtimeIds,borrowed.id];
  owner.learnedSkills=[...owner.learnedSkills,...[...runtimeIds,borrowed.id].map(skillId=>({skillId,level:1}))];
  const contract=presets.RETRO_HAND_FX_SKILLS.filter(s=>runtimeIds.includes(s.id)).map(s=>({id:s.id,actorId:'actor_hero',motion:s.motion,layers:s.layers.map(l=>l.key),level:1}));
  contract.push({id:borrowed.id,actorId:'actor_hero',motion:'finisher',layers:['monk_dragon_aura','monk_dragon_hit'],level:1});
  return {summary:{skills:skills.length,pixelAnimations:anims.length,sharedContracts:catalog.retroChoreographyEntries().filter(e=>e.classId==='class_shared_fx').length,
   sharedSearch:catalog.filterRetroChoreographies({query:'공용 손 도트'}).filter(e=>e.classId==='class_shared_fx').length,
   guardSheets:catalog.searchRetroFxSheets('수정 방벽').map(s=>s.key),issues,changed,second,
   existingSkills:db.skills.filter(s=>s.id.startsWith('skill_fx_')).length,preservedSkill:db.skills.find(s=>s.id===authored.id)===authored,
   preservedAnimation:db.battleAnimations.find(a=>a.id===authoredAnimation.id)===authoredAnimation,restoredRegen:db.states.some(s=>s.id==='state_regen')},
   preview:presets.HAND_PIXEL_FX_PRESETS.map(r=>({key:r.key,name:r.name,description:r.description})),
   runtime:{skills:[...runtimeSkills,borrowed],states:[],classes:[owner],actors:[],equipment:[],contract}};
 });
 await writeFile(out+'/defaults.json',JSON.stringify(data.summary,null,2)+'\n');
 await writeFile(resolve('docs/experiments/shared-hand-fx-20261005/runtime-fixture.json'),JSON.stringify(data.runtime,null,2)+'\n');
 await writeFile(resolve('docs/experiments/shared-hand-fx-20261005/catalog.json'),JSON.stringify(data.preview,null,2)+'\n');
 console.log(JSON.stringify(data.summary));
 if(process.argv.includes('--ui')) {
 await p.addInitScript(()=>localStorage.setItem('oprn:editor-ui-mode','expert'));
 for(let attempt=0;attempt<2;attempt++){
  await p.goto(base+'/?freshProject=1');
  try {await p.waitForSelector('[data-testid="edit-canvas"]',{timeout:45000});break;}
  catch(e){if(attempt===1){await p.screenshot({path:out+'/editor-startup-failure.png'});throw e;}}
 }
 await p.locator('[data-testid="toolbar-database"]').click();
 await p.locator('[data-testid="database-modal"]').waitFor();
 await p.locator('[data-testid="db-group-strip-battle"]').click();
 await p.locator('[data-testid="db-tab-retro-choreographies"]').click();
 await p.waitForTimeout(1400);
 await p.locator('[data-testid="db-retro-choreo-search"]').fill('공용 손 도트');
 await p.waitForTimeout(1000);
 await p.locator('[data-testid="db-retro-choreo-row-skill_fx_guard_crystal"]').click();
 await p.waitForTimeout(1200);
 await p.screenshot({path:out+'/editor-default-library.png'});
 await p.locator('[data-testid="db-retro-choreo-stage"]').screenshot({path:out+'/editor-crystal-stage.png'});
 const ui=await p.locator('[data-testid="db-retro-choreo-list"]').innerText();
 const selected=await p.locator('[data-testid="db-retro-choreo-stage"]').evaluate(n=>({layers:[...n.querySelectorAll('.retro-skill-fx')].map(x=>x.dataset.retroSkillFx),text:n.textContent}));
 await writeFile(out+'/editor.json',JSON.stringify({ui,selected,errors},null,2)+'\n');
 console.log('editor captured');
 }
} catch(e) {
 await writeFile(out+'/editor-failure.json',JSON.stringify({message:e.message,errors,url:p.url(),body:await p.locator('body').innerText().catch(()=> '')},null,2)+'\n');
 throw e;
} finally {await browser.close();}
