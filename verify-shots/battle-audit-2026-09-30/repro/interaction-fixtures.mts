import { readFileSync, writeFileSync } from 'node:fs';
import { createBlankProject } from '../../src/project/defaults/blankProject';
import { createScarloxyPokemonDemoProject } from '../../src/project/defaults/defaultProject';
import { normalizeSkillRecord } from '../../src/project/databaseRecordModel';
import { repairProjectReferences } from '../../src/project/io/references';

function base() {
  const p = JSON.parse(readFileSync('test/fixtures/projects/editor-authored-demo-v3.json','utf8'));
  const d = createBlankProject().database;
  for (const key of ['actors','classes','skills','equipment','states']) p.database[key] = structuredClone(d[key]);
  p.system.battleUiStyle = 'retro2003'; p.system.battleFlow = 'strict'; p.system.atbMode = 'wait';
  p.system.startActorIds = ['actor_hero','actor_guardian']; p.session.partyActorIds = [...p.system.startActorIds];
  for (const a of p.database.actors) {
    a.parameterCurves.maxHp = Array(99).fill(9999); a.parameterCurves.maxMp = Array(99).fill(999);
    a.initialEquipment = {}; a.learnedSkills = []; a.initialLevel = 22;
  }
  for (const e of p.database.enemies) { e.stats.maxHp = 9999; e.stats.attack = 1; e.stats.agility = 1; e.actions = []; }
  for (const t of p.database.troops) { t.battleFlow = 'strict'; t.battleEventPages = []; delete t.previewBackgroundResourceId; }
  return p;
}
function skill(id:string, scope = 'self') {
  return normalizeSkillRecord({id,name:id,scope,mpCost:{flat:0,percentMax:0},power:10,damageFormula:'10',variance:0,criticalRate:0,hitRate:100,successRate:100,effect:{kind:'damage',statistic:'attack',affects:'hp'},stateEffects:[]} as any);
}
function save(id:string,p:any) {
 const animations=new Set(p.database.battleAnimations.map(a=>a.id));
 for(const s of p.database.skills) if(s.animationId&&!animations.has(s.animationId)) delete s.animationId;
 repairProjectReferences(p); writeFileSync('.omo/battle-audit-3852/'+id+'.json', JSON.stringify(p));
}
{
 const p=base(); const s=skill('skill_audit_input');
 s.inputSequence={keys:['up','down','confirm'],timeLimitMs:30000,successMultiplier:2,failMultiplier:0.5};
 p.database.skills.push(s);
 for(const a of p.database.actors.filter(a=>p.system.startActorIds.includes(a.id))) a.learnedSkills=[{level:1,skillId:s.id}];
 save('input-auto',p);
}
{
 const p=base(); p.system.battleFlow='gauge'; p.system.atbMode='active';
 for(const t of p.database.troops) t.battleFlow='gauge';
 const s=skill('skill_audit_combo','allEnemies'); s.comboActorIds=['actor_hero','actor_guardian']; p.database.skills.push(s);
 const a=p.database.actors.find(a=>a.id==='actor_hero'); a.parameterCurves.agility=Array(99).fill(999);
 const b=p.database.actors.find(a=>a.id==='actor_guardian'); b.parameterCurves.agility=Array(99).fill(100);
 save('combo-menu',p);
}
{
 const p=base(); p.system.startActorIds=['actor_hero'];p.session.partyActorIds=['actor_hero'];
 const s=skill('skill_audit_mon_borrow','enemy'); s.name='감사 산성 연출'; s.retroChoreographyId='skill_mon_acid_spit'; p.database.skills.push(s);
 p.database.actors.find(a=>a.id==='actor_hero').learnedSkills=[{level:1,skillId:s.id}]; save('crosskind',p);
}
{
 const p=base();p.system.startActorIds=['actor_ranger'];p.session.partyActorIds=['actor_ranger'];
 const a=p.database.actors.find(a=>a.id==='actor_ranger');a.initialEquipment={accessory:'equip_focus_charm'};
 p.database.equipment.find(e=>e.id==='equip_focus_charm').grantsSkillIds=['skill_gunner_snipe'];save('same-name',p);
}
{
 const p=createScarloxyPokemonDemoProject();p.startMapId='map_pkmn_town';p.startPos={x:13,y:12};
 const map=p.maps[p.startMapId]!;
 map.events.push({id:'ev_audit_capture',x:13,y:13,trigger:{kind:'action'},commands:[],pages:[{id:'page_audit_capture',name:'QA',conditions:[],graphic:{transparent:true},trigger:{kind:'action'},priority:'same',movement:{type:'fixed',speed:3,frequency:3},commands:[{kind:'giveMonster',speciesId:'species_scarloxy_mossling',level:11},{kind:'changeItem',itemId:'item_capture_orb',op:'+=',amount:5},{kind:'battleProcessing',troopId:'troop_pkmn_grass_a',canEscape:true,canLose:true}]}]} as any);
 p.database.items.find(i=>i.id==='item_capture_orb')!.captureProfile={multiplier:255,ballClass:'master'};
 save('capture-cancel',p);
}
