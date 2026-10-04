import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { withTsModule } from '../ontology-ts-loader.mjs';
const args=process.argv.slice(2);
const projectDir=args[args.indexOf('--project')+1];
if(!args.includes('--project') || !projectDir) throw new Error('Pass --project <canonical folder>; --save is explicit.');
const out=path.resolve('output/joseon-folklore'); fs.mkdirSync(out,{recursive:true});
await withTsModule('scripts/content/lib-joseon-folklore.ts','jf-content.mjs',async api=>{
 const db=await api.openLocalProjectStore({projectDir:path.resolve(projectDir)});
 const before=db.loadSnapshot(); assert(before,'Canonical snapshot required');
 assert.equal(db.projectId,'0d6dca6b-a6a7-49be-a49f-1edf5eccc602','This integration recipe targets the existing Beodeul RPG');
 const p=structuredClone(before.project);
 const installed=api.applyJoseonFolklorePack(p);
 const classMap={class_hero:'class_jf_warrior',class_scout:'class_jf_rogue',class_mage:'class_jf_shaman',class_cleric:'class_jf_taoist',class_jb_novice:'class_jf_novice'};
 const jobs={actor_hero:'novice',actor_scout:'rogue',actor_mage:'shaman',actor_cleric:'taoist'};
 for(const actor of p.database.actors) {
  const job=jobs[actor.id]; if(!job)continue;
  actor.classId='class_jf_'+job;
  const klass=p.database.classes.find(c=>c.id===actor.classId); assert(klass,'Class '+job);
  actor.parameterCurves=structuredClone(klass.parameterCurves); actor.expCurve=structuredClone(klass.expCurve);
  actor.skillIds=['skill_attack']; actor.learnedSkills=[{level:1,skillId:'skill_attack'}];
  const equipJob=job==='novice'?'warrior':job;
  actor.initialEquipment={weapon:`equip_jf_${equipJob}_weapon_1`,armor:`equip_jf_${equipJob}_body_1`};
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
   }
   if(c.kind==='text') c.body=c.body.replace(/3·5레벨에 새 기술을 배운다/g,'3·5·8·12·16레벨에 새 기술을 배운다').replace(/약초는 체력, 산삼은 기력을 회복하지요/g,'쑥단은 체력, 산삼탕은 기력을 회복하지요');
   for(const v of Object.values(c)) {
    if(Array.isArray(v)) for(const row of v) { if(row?.branch)walk(row.branch); }
   }
   for(const key of ['successBranch','failureBranch','cancelBranch','thenBranch','elseBranch','victoryBranch','defeatBranch','escapeBranch','commands']) if(Array.isArray(c[key]))walk(c[key]);
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
  const ids=troopEnemies[troop.id]; if(!ids)continue;
  troop.enemyIds=ids;
  troop.members=troop.members.slice(0,ids.length);
  troop.members.forEach((member,i)=>{member.enemyId=ids[i];});
 }
 const issues=api.collectProjectReferenceIssues(p); assert.deepEqual(issues,[],'Pack reference integrity');
 const proof={projectId:db.projectId,projectDir:db.projectDir,beforeRevision:before.revision,installed,shops:shops.map(s=>({map:s.map,event:s.event,goods:s.command.itemIds.length})),referenceIssues:issues};
 fs.writeFileSync(path.join(out,'candidate.oprn.json'),JSON.stringify(p));
 if(args.includes('--save')) {
  fs.writeFileSync(path.join(out,'before.oprn.json'),JSON.stringify(before.project));
  const saved=await db.saveSerialized(JSON.stringify(p),before.sha256); assert.equal(saved.kind,'saved'); db.close();
  const reopened=await api.openLocalProjectStore({projectDir:path.resolve(projectDir)});
  const read=reopened.loadSnapshot(); assert(read); assert.equal(read.sha256,saved.sha256);
  for(const k of ['database','session','system','maps']) assert.deepEqual(JSON.parse(JSON.stringify(read.project[k])),JSON.parse(JSON.stringify(p[k])),'Reload '+k);
  fs.writeFileSync(path.join(out,'game.oprn.json'),JSON.stringify(read.project));
  Object.assign(proof,{saved:true,revision:read.revision,sha256:read.sha256,reopened:true}); reopened.close();
 } else {db.close();proof.saved=false;}
 fs.writeFileSync(path.join(out,'storage-proof.json'),JSON.stringify(proof,null,2)); console.log(JSON.stringify(proof));
});
