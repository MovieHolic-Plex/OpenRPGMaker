import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const prng=(seed:number)=>{let sd=seed>>>0;return()=>{sd=(Math.imul(sd,1664525)+1013904223)>>>0;return ((sd>>>8)&0xffff)/65536;};};
const SP=scarloxySpeciesId("sparchu");
const mon=(o:any={})=>({instanceId:"m1",speciesId:SP,level:50,exp:0,skillIds:["skill_scarloxy_spark"],skillPp:{skill_scarloxy_spark:30},friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1},...o});
function proj(cfg:(p:any)=>void=()=>{}){ const p:any=createScarloxyPokemonDemoProject();
  const e=p.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea"); e.stats={...e.stats,maxHp:999,attack:10,defense:50,mind:50,agility:60}; e.actions=[{skillId:"skill_scarloxy_scratch",priority:5,condition:{kind:"always"},switchOnAfterAction:{enabled:false},switchOffAfterAction:{enabled:false}}];
  p.database.monsterSpecies.find((s:any)=>s.id===SP).baseStats.agility=35; cfg(p); return p; }
const add=(p:any,s:any)=>p.database.skills.push({id:s.id,name:s.name,scope:s.scope??"enemy",power:s.power??30,animationId:"anim_magic",description:"x",type:"normal",mpCost:{flat:0,percentMax:0},successRate:100,variance:0,hitRate:100,effect:s.effect??{kind:"damage",statistic:"attack",affects:"hp"},elementId:s.elementId??"normal",stateEffects:s.stateEffects,maxPp:s.maxPp??3,...(s.extra??{})});
const rt0=(p:any,party:any,rng=prng(5))=>createBattleRuntime({project:p,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:party,sessionState:{switches:{},variables:{},inventory:{}},rng} as any);
const cmd=(rt:any,c:any)=>{const b=rt.snapshot().timeline.length; rt.performActorCommand(c); return rt.snapshot().timeline.slice(b);};
const first=(t:any[])=>t.filter(e=>e.kind==="damage"||e.kind==="miss").map(e=>e.side).join(">");
// PP
{ const p=proj(); const rt=rt0(p,[mon({skillPp:{skill_scarloxy_spark:2}})]);
  const log:string[]=[]; for(let i=0;i<3;i++){ const pp=rt.snapshot().actors[0].skillPp?.skill_scarloxy_spark; cmd(rt,{kind:"skill",skillId:"skill_scarloxy_spark",targetEnemyId:"enemy-1"}); log.push(`pp ${pp}->${rt.snapshot().actors[0].skillPp?.skill_scarloxy_spark}`);}
  console.log("PP1 3 casts with PP=2:",log.join(" | "),"| legal after 0?",rt.snapshot().actors[0].skillPp?.skill_scarloxy_spark);
  // Struggle when no PP: attack command
  const t=cmd(rt,{kind:"attack",targetEnemyId:"enemy-1"}); console.log("PP2 attack cmd with PP exhausted ->",t.filter((e:any)=>e.side==="actor").map((e:any)=>`${e.kind}:${e.skillName}:${e.amount}`).join(","),"+ recoil entries:",t.filter((e:any)=>e.skillName==="Struggle recoil").length);
}
// priority (+1) vs faster enemy
{ const p=proj((p)=>{ add(p,{id:"audit_prio",name:"audit 선공",extra:{movePriority:1}}); add(p,{id:"audit_prio_m1",name:"audit 후공",extra:{movePriority:-1}}); });
  const m=mon({skillIds:["skill_scarloxy_spark","audit_prio","audit_prio_m1"],skillPp:{skill_scarloxy_spark:9,audit_prio:9,audit_prio_m1:9}});
  for(const s of ["skill_scarloxy_spark","audit_prio"]){ const rt=rt0(p,[m]); console.log(`PR1 slow actor(40) vs enemy(60), ${s}: order`,first(cmd(rt,{kind:"skill",skillId:s,targetEnemyId:"enemy-1"}))); }
  // fast actor, -1 priority
  const p2=proj((q)=>{ add(q,{id:"audit_prio_m1",name:"audit 후공",extra:{movePriority:-1}}); q.database.monsterSpecies.find((s:any)=>s.id===SP).baseStats.agility=120; });
  const rt=rt0(p2,[mon({skillIds:["audit_prio_m1"],skillPp:{audit_prio_m1:9}})]); console.log("PR2 fast actor, movePriority -1: order",first(cmd(rt,{kind:"skill",skillId:"audit_prio_m1",targetEnemyId:"enemy-1"})));
}
// multi-turn: chargeTurns
{ const p=proj((q)=>{ add(q,{id:"audit_charge",name:"audit 솔라빔형",power:60,extra:{chargeTurns:1}}); q.database.monsterSpecies.find((s:any)=>s.id===SP).baseStats.agility=120; });
  const rt=rt0(p,[mon({skillIds:["audit_charge"],skillPp:{audit_charge:9}})]);
  const t=cmd(rt,{kind:"skill",skillId:"audit_charge",targetEnemyId:"enemy-1"});
  console.log("MT1 chargeTurns:1 skill in gen1, first command result:",t.map((e:any)=>`${e.side}:${e.kind}${e.charge?"[charge]":""}${e.amount!=null?":"+e.amount:""}`).join(", "));
  // compare with rm2k3 mode (non-gen1)
  const p3=proj((q)=>{ add(q,{id:"audit_charge",name:"audit 솔라빔형",power:60,extra:{chargeTurns:1}}); delete q.system.battleModel; });
}
// hpCost (recoil-like) and drain
{ const p=proj((q)=>{ add(q,{id:"audit_recoil",name:"audit 반동",power:40,extra:{hpCostPercent:25}}); add(q,{id:"audit_drain",name:"audit 흡수",power:40,extra:{drainPercent:50}}); q.database.monsterSpecies.find((s:any)=>s.id===SP).baseStats.agility=120; });
  for(const s of ["audit_recoil","audit_drain"]){ const rt=rt0(p,[mon({skillIds:[s],skillPp:{[s]:9},currentHp:30})]); const h0=rt.snapshot().actors[0].hp; const t=cmd(rt,{kind:"skill",skillId:s,targetEnemyId:"enemy-1"}); console.log(`RC1 ${s}: actorHp ${h0}->${rt.snapshot().actors[0].hp} entries:`,t.map((e:any)=>`${e.side}:${e.kind}:${e.amount}${e.resource?":"+e.resource:""}`).join(", ")); }
}
// forced switch / phazing: does any skill field exist? and does a 'switch' type skill do anything in battle?
{ const p=proj((q)=>{ add(q,{id:"audit_phaze",name:"audit 강제교체",power:0,effect:{kind:"support"},extra:{type:"switch"}}); });
  const rt=rt0(p,[mon({skillIds:["audit_phaze"],skillPp:{audit_phaze:9}})]); const t=cmd(rt,{kind:"skill",skillId:"audit_phaze",targetEnemyId:"enemy-1"}); console.log("FS1 skill.type='switch' in battle: entries",t.map((e:any)=>`${e.side}:${e.kind}`).join(","),"enemy active still",rt.snapshot().enemies.map((e:any)=>e.id).join(","));
}
// multi-hit (hitSequence) in gen1
{ const p=proj((q)=>{ add(q,{id:"audit_multi",name:"audit 연속",power:20,extra:{hitSequence:[1,1,1]}}); q.database.monsterSpecies.find((s:any)=>s.id===SP).baseStats.agility=120; });
  const rt=rt0(p,[mon({skillIds:["audit_multi"],skillPp:{audit_multi:9}})]); const t=cmd(rt,{kind:"skill",skillId:"audit_multi",targetEnemyId:"enemy-1"});
  console.log("MH1 hitSequence[1,1,1] in gen1: actor damage entries =",t.filter((e:any)=>e.side==="actor"&&e.kind==="damage").length,"pp",rt.snapshot().actors[0].skillPp?.audit_multi);
}
