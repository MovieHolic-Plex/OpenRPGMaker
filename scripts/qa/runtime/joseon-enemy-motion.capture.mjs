/** Actual shipping renderer capture. Default: three-enemy review formation with unchanged stats. --shipped: served project.json, original encounter, skills and victory. Keyboard input only; no forced results. */
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runRuntimeQa} from '../../lib/runtimeQaRun.mjs';
import starter from './joseon-folklore-starter.scenario.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1];};
const shipped=process.argv.includes('--shipped');
const variety=process.argv.includes('--variety');
assert(!(shipped&&variety),'Use the variety review formation or the authored encounter');
// Tall enemies take the left/top seats; the low toad occupies the bottom seat without covering a nameplate.
const reviewEnemies=variety?['enemy_jf_mortar_rabbit','enemy_jf_jangseung_spirit','enemy_jf_venom_toad','enemy_jf_earthen_jar_fiend']:['enemy_jf_wild_boar','enemy_jf_straw_dokkaebi','enemy_jf_maiden_ghost'];
const expectedSkills=variety?['chor_jf_poison_spit','chor_jf_pestle_strike','chor_jf_guardian_quake','chor_jf_lid_guard']:shipped?['chor_jf_tusk_charge','chor_jf_straw_club']:['chor_jf_tusk_charge','chor_jf_straw_club','chor_jf_sorrow_cry'];
const dir=arg('out',shipped?'output/joseon-enemy-motion/native':'output/joseon-enemy-motion');
const serverUrl=arg('server','http://127.0.0.1:18345');
fs.mkdirSync(dir,{recursive:true});
const projectPath=arg('project','output/joseon-folklore/starter/game.oprn.json');
const p=JSON.parse(fs.readFileSync(projectPath,'utf8'));
if(!shipped){
const troop=p.database.troops.find(t=>t.id==='troop_jb_goblins');
troop.enemyIds=reviewEnemies;
troop.members=troop.enemyIds.map((enemyId,i)=>({enemyId,x:70+i*42,y:112+i*13,invisible:false}));
fs.writeFileSync(`${dir}/three-enemies.oprn.json`,JSON.stringify(p));
}
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:960,height:720},recordVideo:{dir:`${dir}/video`,size:{width:960,height:720}}});
const page=await context.newPage(),errors=[],missing=[];
page.setDefaultNavigationTimeout(120000);
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});
let proof;
try{
  const scenario={...starter,id:shipped?'joseon-enemy-motion-shipped':variety?'joseon-monster-variety':'joseon-enemy-motion',viewport:{width:960,height:720},projectFixture:shipped?projectPath:`${dir}/three-enemies.oprn.json`,beats:starter.beats.filter(b=>['title','village','new-monsters'].includes(b.id)).map(b=>b.id==='new-monsters'?{...b,expect:{battlerGeometry:{minEnemies:shipped?2:reviewEnemies.length}}}:b)};
  const result=await runRuntimeQa(page,scenario,{serverUrl,outDir:`${dir}/runtime`,...(shipped?{projectUrl:'/project.json'}:{})});
  assert.equal(result.errors.length,0);assert(result.beats.every(b=>!b.failures?.length));
  await page.evaluate(()=>{
    const records=[];window.__jfMotionRecords=records;const start=performance.now();
    const read=()=>{
      const field=document.querySelector('.battle-field'),scene=document.querySelector('[data-testid="battle-scene"]');
      const enemies=[...document.querySelectorAll('.battle-enemy[data-pixel-enemy]')].map(n=>{const image=n.querySelector('.battle-enemy-image'),r=image.getBoundingClientRect();return {id:n.dataset.recordId,skill:n.dataset.retroClassSkill??null,pose:image.dataset.pixelCell,charging:n.dataset.charging??null,x:Math.round(r.x),y:Math.round(r.y),reach:n.dataset.retroReach??null};});
      const fx=[...document.querySelectorAll('[data-retro-skill-fx]')].map(n=>n.dataset.retroSkillFx);
      const actors=[...document.querySelectorAll('.battle-actor')].map(n=>({id:n.dataset.recordId,hp:n.dataset.hp??null,aura:n.dataset.battleAura??null}));
      const text=scene?.querySelector('.battle-message-window')?.textContent??'';
      const r={at:Math.round(performance.now()-start),skill:field?.dataset.retroClassSkill??null,enemies,fx,actors,text};
      const last=records.at(-1);if(!last||JSON.stringify({...r,at:0})!==JSON.stringify({...last,at:0}))records.push(r);
    };read();window.__jfMotionTimer=setInterval(read,40);
  });
  const initial=await page.evaluate(()=>({startAt:performance.now(),rect:(()=>{const r=document.querySelector('.play-stage').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()}));
  let commands=0;
  for(let i=0;i<36;i++){
    const seen=await page.evaluate(()=>new Set(window.__jfMotionRecords.filter(r=>r.fx.length&&r.skill?.startsWith('chor_jf_')).map(r=>r.skill)).size);
    if(seen>=expectedSkills.length && i>=12)break;
    if(await page.getByTestId('battle-result-panel').count())break;
    await page.getByTestId('actor-command-defend').press('Enter',{timeout:25000});commands++;
    await page.waitForFunction(()=>document.querySelector('[data-testid="battle-result-panel"]')||document.querySelector('[data-testid="battle-scene"]')?.getAttribute('data-battle-sequence-busy')==='false',null,{timeout:25000});
  }
  if(shipped){await page.keyboard.press('f');await page.waitForFunction(()=>document.querySelector('[data-testid="battle-result-panel"]'),null,{timeout:90000});}
  await page.waitForTimeout(700);
  const records=await page.evaluate(()=>{clearInterval(window.__jfMotionTimer);return window.__jfMotionRecords;});
  await page.screenshot({path:`${dir}/final.png`});
  proof={errors,missing,commands,initial,records,projectUrl:shipped?'/project.json':`QA-only ${reviewEnemies.length}-enemy formation; unchanged game stats`,resultText:shipped?await page.getByTestId('battle-result-panel').innerText():null,result:result.beats.map(b=>({id:b.id,failures:b.failures}))};
  assert.equal(errors.length,0);assert.equal(missing.length,0);
  if(shipped)assert(proof.resultText.includes('승리'),'Normal encounter must end in victory');
  const observed=[...new Set(records.filter(r=>r.fx.length&&r.skill?.startsWith('chor_jf_')).map(r=>r.skill))];proof.observedSkills=observed;
  assert.deepEqual(observed.sort(),expectedSkills.sort());
  if(!variety)assert(records.some(r=>r.enemies.some(e=>Boolean(e.charging))),'Charge must be visible');
}finally{
  const video=page.video();await context.close();if(video)proof={...proof,video:await video.path()};
  await browser.close();fs.writeFileSync(`${dir}/motion-proof.json`,JSON.stringify(proof??{errors,missing},null,2));
}
console.log(JSON.stringify({errors,missing,commands:proof.commands,observedSkills:proof.observedSkills,video:proof.video}));
