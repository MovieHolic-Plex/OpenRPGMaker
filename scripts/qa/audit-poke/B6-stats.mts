import { monsterBattleStatsForSpecies } from "../../../src/project/monsterCollection";
import { createMonsterExpedition } from "../../../src/project/examples/monsterExpedition";
const p:any=(createMonsterExpedition({gymCount:2,speciesCount:20}) as any).project;
const s=p.database.monsterSpecies.find((x:any)=>x.id==="mx_species_spriglet");
console.log("species base:",JSON.stringify(s.baseStats),"fields:",Object.keys(s).join(","));
for(const lv of [5,20,50,100]){
  const lo=monsterBattleStatsForSpecies(s,lv,{hp:0,atk:0,def:0,spd:0}), hi=monsterBattleStatsForSpecies(s,lv,{hp:15,atk:15,def:15,spd:15});
  console.log(`Lv${lv}: IV0 HP${lo.maxHp} A${lo.attack} D${lo.defense} Sp(mind)${lo.mind} Spd${lo.agility} | IV15 HP${hi.maxHp} A${hi.attack} D${hi.defense} Sp${hi.mind} Spd${hi.agility}`);
}
// gen3 reference for base 42 atk lv50: floor((2*42+31+63)*50/100)+5 = ?
console.log("Gen3 ref atk (base42, IV31, EV252, Lv50, neutral) =", Math.floor((2*42+31+Math.floor(252/4))*50/100)+5, " vs here (IV15, no EV) =",Math.floor((2*42+15)*50/100)+5);
// field names in MonsterInstance (session.ts) : check
