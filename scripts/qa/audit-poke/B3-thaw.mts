import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const prng=(seed:number)=>{let sd=seed>>>0;return()=>{sd=(Math.imul(sd,1664525)+1013904223)>>>0;return ((sd>>>8)&0xffff)/65536;};};
const SP=scarloxySpeciesId("sparchu");
const p:any=createScarloxyPokemonDemoProject();
p.database.states.find((s:any)=>s.id==="state_freeze").recoverNaturallyChance=20;
let thawedFirstTurn=0,N=500;
for(let i=0;i<N;i++){ const rt=createBattleRuntime({project:p,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:[{instanceId:"m1",speciesId:SP,level:50,exp:0,skillIds:["skill_scarloxy_spark"],skillPp:{skill_scarloxy_spark:30},stateIds:["state_freeze"],friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1}}],sessionState:{switches:{},variables:{},inventory:{}},rng:prng(40+i)} as any);
  const b=rt.snapshot().timeline.length; rt.performActorCommand({kind:"skill",skillId:"skill_scarloxy_spark",targetEnemyId:"enemy-1"} as any);
  if(!rt.snapshot().actors[0].stateIds.includes("state_freeze")) thawedFirstTurn++; }
console.log(`B3 freeze with authored recoverNaturallyChance=20: thawed on first action ${(thawedFirstTurn/N*100).toFixed(1)}% (Gen3 = 20%)`);
