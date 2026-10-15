import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const prng=(seed:number)=>{let sd=seed>>>0;return()=>{sd=(Math.imul(sd,1664525)+1013904223)>>>0;return ((sd>>>8)&0xffff)/65536;};};
const mon=(o:any={})=>({instanceId:"m1",speciesId:scarloxySpeciesId("sparchu"),level:50,exp:0,skillIds:["skill_scarloxy_spark"],skillPp:{skill_scarloxy_spark:30},friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1},...o});
const project:any=createScarloxyPokemonDemoProject();
const e=project.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea"); e.stats={...e.stats,maxHp:999,attack:20,defense:50,mind:50,agility:60}; e.actions=[{skillId:"skill_scarloxy_scratch",priority:5,condition:{kind:"always"},switchOnAfterAction:{enabled:false},switchOffAfterAction:{enabled:false}}];
project.database.monsterSpecies.find((s:any)=>s.id===scarloxySpeciesId("sparchu")).baseStats.agility=35; // stat ~ 40
const order=(states?:string[])=>{ const rt=createBattleRuntime({project,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:[mon({stateIds:states})],sessionState:{switches:{},variables:{},inventory:{}},rng:prng(3)} as any);
  const a=rt.snapshot().actors[0].effectiveStats.agility; const b=rt.snapshot().timeline.length; rt.performActorCommand({kind:"skill",skillId:"skill_scarloxy_spark",targetEnemyId:"enemy-1"});
  return `actorAgi=${a} enemyAgi=60 order=`+rt.snapshot().timeline.slice(b).filter((x:any)=>x.kind==="damage"||x.kind==="miss").map((x:any)=>x.side).join(">"); };
console.log("slow actor, none       :",order());
console.log("slow actor + agility_up (x2 => 80 > 60):",order(["state_agility_up"]));
console.log("slow actor + paralysis (should be slower still):",order(["state_paralysis"]));
