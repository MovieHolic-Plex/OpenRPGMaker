import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { withTsModule } from '../ontology-ts-loader.mjs';
const args=process.argv.slice(2);
const projectDir=args[args.indexOf('--project')+1];
if(!args.includes('--project') || !projectDir) throw new Error('Pass --project <canonical folder>; --save is explicit.');
const pilot=args.includes('--pilot');
const out=path.resolve(pilot?'output/joseon-folklore/pilot':'output/joseon-folklore');
if(pilot && path.resolve(projectDir)!==path.resolve('output/joseon-folklore/pilot-project'))throw new Error('Pilot pruning is limited to the isolated review store.'); fs.mkdirSync(out,{recursive:true});
await withTsModule('scripts/content/lib-joseon-folklore.ts','jf-content.mjs',async api=>{
 const db=await api.openLocalProjectStore({projectDir:path.resolve(projectDir)});
 const before=db.loadSnapshot(); assert(before,'Canonical snapshot required');
 assert.equal(db.projectId,'0d6dca6b-a6a7-49be-a49f-1edf5eccc602','This integration recipe targets the existing Beodeul RPG');
 const p=structuredClone(before.project);
 const installed=api.applyJoseonFolklorePack(p);
 if(pilot) {
  if(!p.meta.title.endsWith(' · 첫 검토판'))p.meta.title+=' · 첫 검토판';
  const skillIds=new Set(p.database.skills.map(s=>s.id)),itemIds=new Set(p.database.items.map(i=>i.id)),equipmentIds=new Set(p.database.equipment.map(e=>e.id));
  for(const c of p.database.classes.filter(c=>c.id.startsWith('class_jf_'))) {
   c.skillIds=c.skillIds.filter(id=>skillIds.has(id));c.learnedSkills=c.learnedSkills.filter(s=>skillIds.has(s.skillId));
   c.equipmentPermissions.equipmentIds=c.equipmentPermissions.equipmentIds.filter(id=>equipmentIds.has(id));
  }
  for(const e of p.database.enemies.filter(e=>e.id.startsWith('enemy_jf_'))) {
   if(e.rewards.dropItemId&&!itemIds.has(e.rewards.dropItemId)){delete e.rewards.dropItemId;e.rewards.dropRatePercent=0;}
   if(e.rewards.drops)e.rewards.drops=e.rewards.drops.filter(d=>itemIds.has(d.itemId));
  }
 }

 const classMap={class_hero:'class_jf_warrior',class_scout:'class_jf_rogue',class_mage:'class_jf_shaman',class_cleric:'class_jf_taoist',class_jb_novice:'class_jf_novice'};
 const jobs={actor_hero:'novice',actor_scout:'rogue',actor_mage:'shaman',actor_cleric:'taoist'};
 for(const actor of p.database.actors) {
  const job=jobs[actor.id]; if(!job)continue;
  actor.classId='class_jf_'+job;
  const klass=p.database.classes.find(c=>c.id===actor.classId); assert(klass,'Class '+job);
  actor.parameterCurves=structuredClone(klass.parameterCurves); actor.expCurve=structuredClone(klass.expCurve);
  actor.learnedSkills=[{level:1,skillId:'skill_attack'}];
  const equipJob=job==='novice'?'warrior':job;
  actor.initialEquipment=job==='novice'?{}:{weapon:`equip_jf_${equipJob}_weapon_1`,armor:`equip_jf_${equipJob}_body_1`};
 }
 if(p.session.classOverrides) for(const [id,old] of Object.entries(p.session.classOverrides)) p.session.classOverrides[id]=classMap[old]??old;
 const itemMap={item_potion:'item_jf_mugwort_pill',item_ether:'item_jf_ginseng_tea'};
 for(const [old,id] of Object.entries(itemMap)) if(p.session.inventory[old]) {p.session.inventory[id]=(p.session.inventory[id]??0)+p.session.inventory[old];delete p.session.inventory[old];}
 const walk=commands=>{
  for(const c of commands) {
   if(c.kind==='promoteActor') {
    c.toClassId=classMap[c.toClassId]??c.toClassId;
    const job=c.toClassId?.replace('class_jf_','');
    if(job && !c.successBranch?.some(c=>c.kind==='changeEquipment')) (c.successBranch??=[]).unshift(...['weapon','body'].flatMap(part=>{
     const equipmentId=`equip_jf_${job}_${part}_1`;
     return [{kind:'changeItem',itemId:equipmentId,op:'+=',amount:1},{kind:'changeEquipment',actorId:c.actorId,slot:part==='body'?'armor':part,equipmentId}];
    }));
   }
   if(c.kind==='changeItem') c.itemId=itemMap[c.itemId]??c.itemId;
   if(c.kind==='shop') {
    c.itemIds=[...new Set(c.itemIds.map(id=>itemMap[id]??id))];
    c.merchantGold=3000;
    c.shopUiPreset="pixel";
    c.quantityMode='single';
   }
   if(c.kind==='text') c.body=c.body.replace(/3·5레벨에 새 기술을 배운다/g,'3·5·8·12·16레벨에 새 기술을 배운다').replace(/약초는 체력, 산삼은 기력을 회복하지요/g,'쑥단은 체력, 산삼탕은 기력을 회복하지요');
   for(const v of Object.values(c)) {
    if(Array.isArray(v)) for(const row of v) { if(row?.branch)walk(row.branch); }
   }
   for(const key of ['successBranch','failureBranch','cancelBranch','then','else','thenBranch','elseBranch','victoryBranch','defeatBranch','escapeBranch','commands']) if(Array.isArray(c[key]))walk(c[key]);
  }
 };
 for(const m of Object.values(p.maps)) for(const e of m.events) {walk(e.commands??[]);for(const page of e.pages??[])walk(page.commands??[]);}
 const shops=[];
 for(const m of Object.values(p.maps)) for(const e of m.events) for(const page of e.pages??[]) for(const c of page.commands??[]) if(c.kind==='shop')shops.push({map:m.id,event:e.id,command:c});
 const medicines=p.database.items.filter(i=>i.id.startsWith('item_jf_')&&!i.id.startsWith('item_jf_mat_'));
 for(const shop of shops) {
  shop.command.itemIds=medicines.map(i=>i.id);
  if(shop.map==='joseon_v20')shop.command.itemIds.push(...p.database.equipment.filter(e=>e.id.startsWith('equip_jf_')).map(e=>e.id));
 }
 const troopEnemies={troop_jb_goblins:['enemy_jf_straw_dokkaebi','enemy_jf_wild_boar'],troop_jb_ghosts:['enemy_jf_maiden_ghost','enemy_jf_lantern_wisp'],troop_jb_cave:['enemy_jf_cave_bat','enemy_jf_grave_ghoul'],troop_jb_boss:['enemy_jf_bronze_dokkaebi','enemy_jf_straw_dokkaebi']};
 for(const troop of p.database.troops) {
  let ids=troopEnemies[troop.id]; if(!ids)continue;
  if(pilot) { ids=ids.filter(id=>p.database.enemies.some(e=>e.id===id));if(!ids.length)ids=['enemy_jf_maiden_ghost','enemy_jf_straw_dokkaebi']; }
  troop.enemyIds=ids;
  troop.members=troop.members.slice(0,ids.length);
  troop.members.forEach((member,i)=>{member.enemyId=ids[i];});
 }
 if(!pilot) {
  // The bat's flurry is conditional on a living ally. Its hunting encounter is a pair.
  const bats=p.database.troops.find(t=>t.id==='troop_jf_cave_bat');
  bats.name='굴박쥐 · 무리';bats.enemyIds=['enemy_jf_cave_bat','enemy_jf_cave_bat'];
  bats.members=[{enemyId:'enemy_jf_cave_bat',x:88,y:140,hidden:false},{enemyId:'enemy_jf_cave_bat',x:144,y:140,hidden:false}];
  const field=['field_rat','wild_boar','straw_dokkaebi','lantern_wisp','maiden_ghost','drowned_ghost','grave_ghoul','fox_spirit','stone_dokkaebi','bamboo_specter','masked_bandit'];
  const cave=['cave_bat','cave_bat','maiden_ghost','drowned_ghost','grave_ghoul','grave_ghoul','fox_spirit','stone_dokkaebi','bamboo_specter','masked_bandit'];
  for(const [mapId,entry,slugs] of [['joseon_field',[47,11],field],['joseon_cave',[23,44],cave]]) {
   const spawns=[...p.maps[mapId].fieldSpawns].sort((a,b)=>
    Math.hypot(a.area.x-entry[0],a.area.y-entry[1])-Math.hypot(b.area.x-entry[0],b.area.y-entry[1]));
   spawns.forEach((spawn,i)=>{spawn.troopId='troop_jf_'+slugs[Math.min(i,slugs.length-1)];spawn.chase=false;});
  }
  const guide=p.maps.joseon_field.events.find(e=>e.id==='joseon_field_resident_0');
  guide.pages[0].commands.find(c=>c.kind==='text').body='입구에는 들쥐와 멧돼지가 있지. 깊은 숲과 굴에는 귀물이 기다린다네. 안쪽은 10레벨 이상 수련하고 들어가게.';
  const sage=p.maps.joseon_field.events.find(e=>e.id==='joseon_field_resident_6');
  sage.name=sage.pages[0].name='산길 안내자';
  const retreat=[{kind:'text',body:'아직 수련이 더 필요하군. 마을에서 쉬어 가게.'},{kind:'recoverAll'},{kind:'transfer',mapId:'joseon_v20',x:31,y:28,fade:'black'}];
  sage.pages[0].commands=[sage.pages[0].commands[0],{kind:'text',speaker:'산길 안내자',body:'이곳에서는 깊은 산의 귀물과 맞서는 시련을 치를 수 있네. 신부 원귀는 12레벨, 산군은 19레벨 무렵을 권하네.'},
   {kind:'choices',prompt:'어느 시련에 도전하겠는가?',cancelBehavior:'branch',options:[['신부 원귀의 시련 · 권장 12레벨','bride_wraith'],['산군의 시련 · 권장 19레벨','mountain_tiger']].map(([text,slug])=>({text,branch:[{kind:'battleProcessing',troopId:'troop_jf_'+slug,canEscape:true,canLose:true,branchOnResult:true,victoryBranch:[{kind:'text',speaker:'산길 안내자',body:'시련을 이겨 냈군. 얻은 재료는 마을 상인에게 팔 수 있네.'}],defeatBranch:structuredClone(retreat),escapeBranch:[{kind:'text',body:'준비를 갖추고 다시 도전하자.'}]}]})).concat([{text:'다음에 도전한다',branch:[]}]),cancelBranch:[]}];
  const boss=p.maps.joseon_cave.events.find(e=>e.id==='ev_joseon_boss');
  boss.name='청동 도깨비';boss.pages[0].name='청동 도깨비';
  for(const c of boss.pages[0].commands)if(c.kind==='text'){c.speaker='청동 도깨비';c.body='청석굴의 청동 도깨비다. 6레벨 무렵의 수련자라면 내 방망이에 맞서 보아라!';}
 }
 const issues=api.collectProjectReferenceIssues(p); assert.deepEqual(issues,[],'Pack reference integrity');
 const proof={projectId:db.projectId,projectDir:db.projectDir,pilot,beforeRevision:before.revision,installed,shops:shops.map(s=>({map:s.map,event:s.event,goods:s.command.itemIds.length})),referenceIssues:issues};
 fs.writeFileSync(path.join(out,'candidate.oprn.json'),JSON.stringify(p));
 if(args.includes('--save')) {
  fs.writeFileSync(path.join(out,`before-revision-${before.revision}.oprn.json`),JSON.stringify(before.project));
  const saved=await db.saveSerialized(JSON.stringify(p),before.sha256); assert.equal(saved.kind,'saved'); db.close();
  const reopened=await api.openLocalProjectStore({projectDir:path.resolve(projectDir)});
  const read=reopened.loadSnapshot(); assert(read); assert.equal(read.sha256,saved.sha256);
  for(const k of ['database','session','system','maps']) assert(isDeepStrictEqual(JSON.parse(JSON.stringify(read.project[k])),JSON.parse(JSON.stringify(p[k]))),'Reload '+k);
  fs.writeFileSync(path.join(out,'game.oprn.json'),JSON.stringify(read.project));
  Object.assign(proof,{saved:true,revision:read.revision,sha256:read.sha256,reopened:true}); reopened.close();
 } else {db.close();proof.saved=false;}
 fs.writeFileSync(path.join(out,'storage-proof.json'),JSON.stringify(proof,null,2)); console.log(JSON.stringify(proof));
});
