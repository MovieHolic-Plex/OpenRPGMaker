import { createBattleRuntime } from "../../../src/battle/runtime";
import { gen1CaptureProbability } from "../../../src/battle/gen1/capture";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const B=255/256;
function seq(v:number[],f=B){let i=0;return()=>v[i++]??f;}
function mk(opts:{trainer?:boolean;rng?:()=>number;ball?:string;hpFrac?:number}){
  const project=createScarloxyPokemonDemoProject();
  const enemy=project.database.enemies.find(r=>r.id==="enemy_pkmn_larvea")!;
  enemy.stats={...enemy.stats,maxHp:100,attack:1,defense:100,mind:100,agility:1};
  enemy.actions=[{skillId:"skill_scarloxy_scratch",priority:5,condition:{kind:"always"},switchOnAfterAction:{enabled:false},switchOffAfterAction:{enabled:false}} as any];
  const troop=project.database.troops.find(t=>t.id==="troop_pkmn_grass_a")!;
  if(opts.trainer) (troop as any).trainerBattle=true;
  if(opts.ball){const orb=project.database.items.find(r=>r.id==="item_capture_orb")!;orb.captureProfile={...orb.captureProfile!,ballClass:opts.ball as any};}
  const pm={instanceId:"m1",speciesId:scarloxySpeciesId("sparchu"),level:50,exp:0,skillIds:["skill_scarloxy_quick"],skillPp:{skill_scarloxy_quick:5},friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1}} as any;
  const rt=createBattleRuntime({project,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:[pm],
    sessionState:{switches:{},variables:{},inventory:{item_capture_orb:5}},rng:opts.rng??seq([B,B,0])} as any);
  return {project,rt};
}
console.log("battleModel:",createScarloxyPokemonDemoProject().system.battleModel);
{ const {project,rt}=mk({rng:seq([45/256,85/256,0,0,0,0])});
  const e=rt.snapshot().enemies[0]!; const sp=project.database.monsterSpecies!.find(s=>s.id===e.speciesId)!;
  const exp=gen1CaptureProbability({ballClass:"poke",maxHp:e.maxHp,currentHp:e.hp,catchRate:Math.round(sp.captureRate*255)});
  rt.performActorCommand({kind:"capture",captureItemId:"item_capture_orb",targetEnemyId:"enemy-1"} as any);
  const s=rt.snapshot(); console.log("wild capture result:",JSON.stringify(s.lastCaptureResult),"expectedGen1:",exp.value,"captured:",s.capturedMonsters.length);
  console.log("species captureRate",sp.captureRate,"enemy hp",e.hp,e.maxHp);}
{ const {rt}=mk({trainer:true,ball:"master"});
  rt.performActorCommand({kind:"capture",captureItemId:"item_capture_orb",targetEnemyId:"enemy-1"} as any);
  const s=rt.snapshot(); console.log("trainer battle capture w/ master ball:",JSON.stringify(s.lastCaptureResult),"captured:",s.capturedMonsters.length);}
{ const {rt}=mk({ball:"master"});
  rt.performActorCommand({kind:"capture",captureItemId:"item_capture_orb",targetEnemyId:"enemy-1"} as any);
  const s=rt.snapshot(); console.log("master ball wild:",JSON.stringify(s.lastCaptureResult),"captured:",s.capturedMonsters.length);}
// distribution through runtime: 2000 wild attempts with random rng, full HP
{ let c=0,N=80,rate=0; for(let i=0;i<N;i++){ let sd=i*7919+13; const r=()=>{sd=(sd*1103515245+12345)&0x7fffffff;return (sd>>>8)/(1<<23);};
   const {rt}=mk({rng:r}); rt.performActorCommand({kind:"capture",captureItemId:"item_capture_orb",targetEnemyId:"enemy-1"} as any);
   const s=rt.snapshot(); if(s.capturedMonsters.length)c++; rate=s.lastCaptureResult!.rate; }
  console.log(`runtime MC full-HP poke: caught ${(c/N*100).toFixed(1)}% vs analytic ${(rate*100).toFixed(1)}%`);}
