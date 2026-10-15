import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { createBattleRuntime } from "@/battle/runtime";
import { pickEncounterForMap } from "@/player/encounters";
const p:any = (createMonsterExpedition({gymCount:1}) as any).project;
const m=p.maps.mx_map_meadow; const e=m.encounterTable[0];
const troop=p.database.troops.find((t:any)=>t.id===e.troopId);
for (const lv of [undefined, 3, 7]) {
  const rt:any = createBattleRuntime({project:p, troopId:e.troopId, canEscape:true, canLose:false, enemyLevel: lv, rng:()=>0.5});
  const s=rt.getSnapshot?.() ?? rt.snapshot?.();
  const en=(s.enemies??s.battlers?.filter((b:any)=>b.id.startsWith("enemy")))[0];
  console.log("lv",lv,"->",en.level,"hp",en.maxHp,"skills",en.skillIds.length);
}
const sess:any={...p.session,switches:{mx_starter:true},variables:{},partyActorIds:[]};
import { eligibleEncounterEntries } from "@/player/encounters";
let cell:any; for(let y=0;y<m.height&&!cell;y++)for(let x=0;x<m.width&&!cell;x++) if(eligibleEncounterEntries(m,sess,{x,y},p).length) cell={x,y};
console.log("grass cell",cell, "plain cell elig:", eligibleEncounterEntries(m,sess,{x:12,y:4},p).length);
let seen=new Set<number>(); let i=0; const rng=()=>((i=(i*1103515245+12345)&0x7fffffff)/0x7fffffff);
for(let k=0;k<40;k++){const pk=pickEncounterForMap(m,sess,cell,rng,p); if(pk?.level!==undefined) seen.add(pk.level)}
console.log("levels rolled", [...seen].sort());
