import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
const B=255/256; const seq=(v:number[],f=B)=>{let i=0;return()=>v[i++]??f;};
const project:any=createScarloxyPokemonDemoProject();
const sp=project.database.monsterSpecies.find((s:any)=>s.id===scarloxySpeciesId("sparchu"));
console.log("player species types",sp.types);
const chart=project.system.typeChart;
const dmg=project.database.skills.filter((s:any)=>s.effect.kind==="damage"&&s.elementId&&s.power>0);
const rows=dmg.map((s:any)=>({id:s.id,el:s.elementId,power:s.power,mult:sp.types.reduce((m:number,t:string)=>m*((chart.multipliers[s.elementId]??{})[t]??1),1)}));
const se=rows.filter((r:any)=>r.mult>1).sort((a:any,b:any)=>a.power-b.power)[0];
const nve=rows.filter((r:any)=>r.mult<1).sort((a:any,b:any)=>b.power-a.power)[0];
console.log("super effective candidate",se,"not very effective strong candidate",nve);
const enemy=project.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea");
enemy.stats={...enemy.stats,maxHp:999,attack:60,defense:100,mind:100,agility:1};
// NO authored actions: learned skills only -> AI utility
enemy.actions=[];
const counts:Record<string,number>={};
for(let trial=0;trial<12;trial++){
  const p2=structuredClone(project); const e2=p2.database.enemies.find((r:any)=>r.id==="enemy_pkmn_larvea");
  const ls=p2.database.monsterSpecies.find((x:any)=>x.id==="species_scarloxy_larvea"); const lv=e2.level??5; ls.skillsByLevel=[{level:1,skillId:nve.id},{level:1,skillId:se.id}]; if(trial===0)console.log("enemy level",lv,"species",ls.id);
  const rt:any=createBattleRuntime({project:p2,troopId:"troop_pkmn_grass_a",canEscape:true,canLose:true,battleFlow:"strict",partyMonsters:[{instanceId:"m1",speciesId:scarloxySpeciesId("sparchu"),level:30,exp:0,skillIds:["skill_scarloxy_quick"],skillPp:{skill_scarloxy_quick:5},friendship:70,caughtAt:{mapId:"map_pkmn_town",x:1,y:1}}],
    sessionState:{switches:{},variables:{},inventory:{}},rng:seq([B,B,0])});
  const en=rt.snapshot().enemies[0]; if(trial===0)console.log("enemy skillIds in battler:",en.skillIds);
  rt.performActorCommand({kind:"skill",skillId:"skill_scarloxy_quick",targetEnemyId:"enemy-1"});
  const t=rt.snapshot().timeline.filter((x:any)=>x.side==="enemy"&&x.skillId);
  const used=t[0]?.skillId??"(none/basic)"; counts[used]=(counts[used]??0)+1;
}
console.log("enemy skill choice with no authored actions:",counts);
// authored actions pattern both equal priority
