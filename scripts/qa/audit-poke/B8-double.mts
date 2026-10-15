import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const prng=(seed:number)=>{let sd=seed>>>0;return()=>{sd=(Math.imul(sd,1664525)+1013904223)>>>0;return ((sd>>>8)&0xffff)/65536;};};
const SP=scarloxySpeciesId("sparchu");
const mon=(id:string)=>({instanceId:id,speciesId:SP,level:50,exp:0,skillIds:["skill_scarloxy_spark"],skillPp:{skill_scarloxy_spark:30},friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1}});
for(const [label,model] of [["gen1","gen1"],["rm2k3 (control)",undefined]] as const){
  const p:any=createScarloxyPokemonDemoProject();
  if(model===undefined) delete p.system.battleModel;
  p.system.activeSlots=2;
  const enemyIds=["enemy_pkmn_larvea","enemy_pkmn_sparchu"]; 
  const t=p.database.troops.find((x:any)=>x.id==="troop_pkmn_grass_a");
  t.activeSlots=2;
  t.members=[{enemyId:enemyIds[0],x:100,y:80,hidden:false},{enemyId:enemyIds[1],x:150,y:100,hidden:false}]; t.enemyIds=enemyIds;
  const rt=createBattleRuntime({project:p,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:[mon("m1"),mon("m2")],sessionState:{switches:{},variables:{},inventory:{}},rng:prng(7)} as any);
  const s=rt.snapshot();
  console.log(`${label}: activeActorIds=${JSON.stringify(s.activeActorIds??s.actors.filter((a:any)=>a.active).map((a:any)=>a.id))} actors(in snapshot)=${s.actors.length} visible enemies=${s.enemies.length}`);
  console.log("   enemy list:",s.enemies.map((e:any)=>e.id+":"+e.name).join(","),"| departed/benched:",JSON.stringify((s as any).departedEnemies?.length??0), "| pending actors this round:",JSON.stringify((s as any).strictPendingActorIds ?? (s as any).pendingActorIds));
}
// full round 2v2 under rm2k3 control + gen1 2v1: how many actions each side takes in one round
for(const [label,model] of [["gen1","gen1"],["rm2k3 control",undefined]] as const){
  const p:any=createScarloxyPokemonDemoProject(); if(model===undefined) delete p.system.battleModel; p.system.activeSlots=2;
  const t=p.database.troops.find((x:any)=>x.id==="troop_pkmn_grass_a"); t.activeSlots=2; t.members=[{enemyId:"enemy_pkmn_larvea",x:100,y:80,hidden:false},{enemyId:"enemy_pkmn_sparchu",x:150,y:100,hidden:false}]; t.enemyIds=["enemy_pkmn_larvea","enemy_pkmn_sparchu"];
  for(const e of p.database.enemies) e.stats={...e.stats,maxHp:999};
  const rt=createBattleRuntime({project:p,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:[mon("m1"),mon("m2")],sessionState:{switches:{},variables:{},inventory:{}},rng:prng(9)} as any);
  const b=rt.snapshot().timeline.length;
  try{ rt.performActorCommand({kind:"skill",skillId:"skill_scarloxy_spark",targetEnemyId:"enemy-1"} as any); rt.performActorCommand({kind:"skill",skillId:"skill_scarloxy_spark",targetEnemyId:rt.snapshot().enemies[1]?.id??"enemy-1"} as any); }catch(e:any){console.log("err",e.message)}
  const tl=rt.snapshot().timeline.slice(b).filter((e:any)=>e.kind==="damage"||e.kind==="miss");
  console.log(`${label}: round actions =`,tl.map((e:any)=>e.side+":"+e.userRecordId).join(" , "));
}
