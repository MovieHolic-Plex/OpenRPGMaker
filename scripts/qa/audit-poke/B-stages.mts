// A2 audit probe: gen1 battle runtime measurements (B1,B2,B3,B7,B8)
import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const B=255/256;
const seq=(v:number[],f=B)=>{let i=0;return()=>v[i++]??f;};
const mon=(o:any={})=>({instanceId:"m1",speciesId:scarloxySpeciesId("sparchu"),level:50,exp:0,skillIds:["skill_scarloxy_quick","skill_scarloxy_spark","skill_scarloxy_wave"],skillPp:{skill_scarloxy_quick:30,skill_scarloxy_spark:30},friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1},...o});
function baseProject(cfg:(p:any)=>void){
  const project:any=createScarloxyPokemonDemoProject();
  const enemy=project.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea")!;
  enemy.stats={...enemy.stats,maxHp:999,attack:1,defense:50,mind:50,agility:1};
  enemy.actions=[{skillId:"skill_scarloxy_scratch",priority:5,condition:{kind:"always"},switchOnAfterAction:{enabled:false},switchOffAfterAction:{enabled:false}}];
  cfg(project); return project;
}
function mk(cfg:(p:any)=>void,o:any={}){ return rtFrom(baseProject(cfg),o); }
function rtFrom(project:any,o:any={}){
  const rt=createBattleRuntime({project,troopId:o.troopId??"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:o.party??[mon()],sessionState:{switches:{},variables:{},inventory:{}},rng:o.rng??seq([B,B,0])} as any);
  return {project,rt};
}
const dmg=(rt:any,skillId:string)=>{const before=rt.snapshot().timeline.length; rt.performActorCommand({kind:"skill",skillId,targetEnemyId:"enemy-1"}); const t=rt.snapshot().timeline.slice(before).filter((e:any)=>e.side==="actor"&&(e.kind==="damage"||e.kind==="miss")); return t[0];};
console.log("battleModel",createScarloxyPokemonDemoProject().system.battleModel);


const sp=(p:any,id:string)=>p.database.monsterSpecies.find((s:any)=>s.id===id);
const addSkill=(p:any,s:any)=>{p.database.skills.push({id:s.id,name:s.name,scope:s.scope??"enemy",power:s.power??0,animationId:"anim_magic",description:"x",type:"normal",mpCost:{flat:0,percentMax:0},successRate:100,variance:0,hitRate:s.hitRate??100,effect:s.effect??{kind:"support"},elementId:s.elementId,stateEffects:s.stateEffects,maxPp:s.maxPp??20,...(s.extra??{})});};

const prng=(seed:number)=>{let sd=seed>>>0;return()=>{sd=(Math.imul(sd,1664525)+1013904223)>>>0;return ((sd>>>8)&0xffff)/65536;};};
const mean=(a:number[])=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
// ---- B2a: can a move raise/lower stat stages, and does it stack? ----
{
  const project=baseProject((p)=>{
    addSkill(p,{id:"audit_atkup",name:"audit 공격업",scope:"self",stateEffects:[{stateId:"state_attack_up",chance:100,operation:"add"}]});
    addSkill(p,{id:"audit_defdown",name:"audit 방어다운",scope:"enemy",stateEffects:[{stateId:"state_defense_down",chance:100,operation:"add"}]});
    sp(p,scarloxySpeciesId("sparchu")).types=["water"];
  });
  const m=mon({skillIds:["skill_scarloxy_quick","audit_atkup","audit_defdown"],skillPp:{skill_scarloxy_quick:30,audit_atkup:20,audit_defdown:20}});
  const {rt}=rtFrom(project,{party:[m],rng:prng(11)});
  const st=()=>JSON.stringify({a:rt.snapshot().actors[0].stateIds,e:rt.snapshot().enemies[0].stateIds});
  for(let i=0;i<3;i++){ try{rt.performActorCommand({kind:"skill",skillId:"audit_atkup",targetEnemyId:"enemy-1",targetActorId:rt.snapshot().actors[0].recordId} as any);}catch(e:any){console.log("cast err",e.message)} console.log("B2a after attack-up cast",i+1,"states:",st()); }
  for(let i=0;i<3;i++) rt.performActorCommand({kind:"skill",skillId:"audit_defdown",targetEnemyId:"enemy-1"} as any);
  console.log("B2a enemy states after 3x defense-down:",st());
}
// damage multiplier measurement: initial states on the attacker/target
function meanDmg(opts:{attStates?:string[],defStates?:string[],skill:string,N?:number,cfg?:(p:any)=>void}){
  const project=baseProject((p)=>{opts.cfg?.(p); });
  const out:number[]=[]; const N=opts.N??150;
  for(let i=0;i<N;i++){
    const {rt}=rtFrom(project,{party:[mon({stateIds:opts.attStates})],rng:prng(1000+i)});
    if(opts.defStates){ /* enemy states injected via enemy record? use runtime snapshot not mutable */ }
    const h=dmg(rt,opts.skill); if(h?.hit&&!h.critical) out.push(h.amount);
  }
  return mean(out);
}
const noCrit=(p:any)=>{ for(const s of p.database.skills) if(s.gen1CriticalRate) s.gen1CriticalRate="normal"; sp(p,scarloxySpeciesId("sparchu")).types=["water"]; sp(p,scarloxySpeciesId("sparchu")).baseStats.agility=1; };
console.log("B2b mean non-crit dmg quick(physical): none",meanDmg({skill:"skill_scarloxy_quick",cfg:noCrit}).toFixed(2),"| state_attack_up",meanDmg({skill:"skill_scarloxy_quick",attStates:["state_attack_up"],cfg:noCrit}).toFixed(2),"| state_attack_down",meanDmg({skill:"skill_scarloxy_quick",attStates:["state_attack_down"],cfg:noCrit}).toFixed(2));
// special move (electric = magical) with attack_up: gen1ModifiedStat only touches physical
console.log("B2b mean dmg spark(special/magical): none",meanDmg({skill:"skill_scarloxy_spark",cfg:noCrit}).toFixed(2),"| state_attack_up",meanDmg({skill:"skill_scarloxy_spark",attStates:["state_attack_up"],cfg:noCrit}).toFixed(2));
// accuracy: state_blind on attacker (accuracy modifier 50%) -> hit rate
function hitRate(states:string[]|undefined,N=400){
  const project=baseProject((p)=>{ noCrit(p); });
  let hits=0; for(let i=0;i<N;i++){ const {rt}=rtFrom(project,{party:[mon({stateIds:states})],rng:prng(5000+i)}); const h=dmg(rt,"skill_scarloxy_spark"); if(h?.hit) hits++; } return (hits/N*100).toFixed(1);
}
console.log("B2c hit% spark(100%): normal",hitRate(undefined),"| attacker state_blind(accuracyModifier 50)",hitRate(["state_blind"]));
// evasion state on target is injected via enemy? use project-level: give the ENEMY the state through troop? check withEvasion usage is non-gen1 only
