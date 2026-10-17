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

// ---- B1: STAB / type effectiveness / immunity / dual ----
const sp=(p:any,id:string)=>p.database.monsterSpecies.find((s:any)=>s.id===id);
function typeCase(label:string, atkTypes:string[], defTypes:string[], skillId:string){
  const {project,rt}=mk((p)=>{
    const a=sp(p,scarloxySpeciesId("sparchu")); a.types=atkTypes;
    const enemy=p.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea"); const d=sp(p,enemy.speciesId); d.types=defTypes;
  });
  const h=dmg(rt,skillId); const s=rt.snapshot();
  console.log(`B1 ${label}: atkTypes=${atkTypes} def=${defTypes} skill=${skillId} -> hit=${h?.hit} dmg=${h?.amount} eff=${h?.effectiveness}`);
}
typeCase("neutral nonSTAB",["water"],["normal"],"skill_scarloxy_spark");   // electric vs normal
typeCase("STAB electric->normal",["electric"],["normal"],"skill_scarloxy_spark");
typeCase("super effective (electric->water)",["water"],["water"],"skill_scarloxy_spark");
typeCase("4x dual (electric->water/flying)",["water"],["water","flying"],"skill_scarloxy_spark");
typeCase("resist (electric->grass)",["water"],["grass"],"skill_scarloxy_spark");
typeCase("immune (electric->ground)",["water"],["ground"],"skill_scarloxy_spark");
typeCase("immune normal->ghost",["water"],["ghost"],"skill_scarloxy_quick");

// ---- B1b: author an 18-type chart (dark/steel/fairy) via the same normalize path as set_type_chart ----
{
  const {project,rt}=mk((p)=>{
    const types=[...p.system.typeChart.types,"dark","steel","fairy"];
    const m=JSON.parse(JSON.stringify(p.system.typeChart.multipliers));
    m.psychic={...(m.psychic??{}),dark:0}; m.dark={ghost:2,psychic:2,fighting:0.5,dark:0.5}; m.fairy={dragon:2,fighting:2,dark:2,fire:0.5};
    p.system.typeChart={types,multipliers:m};
    p.database.elements.push({id:"dark",name:"악",kind:"physical"} as any,{id:"steel",name:"강철",kind:"physical"} as any,{id:"fairy",name:"페어리",kind:"magical"} as any);
    const sk=p.database.skills.find((s:any)=>s.id==="skill_scarloxy_quick"); sk.elementId="fairy";
    const enemy=p.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea"); sp(p,enemy.speciesId).types=["dragon"];
    sp(p,scarloxySpeciesId("sparchu")).types=["water"];
  });
  const h=dmg(rt,"skill_scarloxy_quick");
  console.log(`B1b 18-type chart: fairy->dragon hit=${h?.hit} dmg=${h?.amount} eff=${h?.effectiveness}`);
}


// ---- B2: crit rate MC (normal vs high), one shared project, seeded rng ----
function mcCrit(rate:"normal"|"high", baseAgi:number,N=1500){
  const project=baseProject((p)=>{ sp(p,scarloxySpeciesId("sparchu")).baseStats.agility=baseAgi; const s=p.database.skills.find((x:any)=>x.id==="skill_scarloxy_spark"); s.gen1CriticalRate=rate; });
  let crit=0;
  for(let i=0;i<N;i++){
    let sd=i*2654435761+7; const r=()=>{sd=(Math.imul(sd,1103515245)+12345)>>>0;return ((sd>>>8)&0xffff)/65536;};
    const {rt}=rtFrom(project,{rng:r});
    const h=dmg(rt,"skill_scarloxy_spark"); if(h?.critical) crit++;
  }
  return (crit/N*100).toFixed(2);
}
console.log("B2 crit%: baseSpeed 50 normal",mcCrit("normal",50),"high",mcCrit("high",50),"| baseSpeed 120 normal",mcCrit("normal",120),"high",mcCrit("high",120));
