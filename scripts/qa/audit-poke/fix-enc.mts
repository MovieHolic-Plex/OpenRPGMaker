import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { eligibleEncounterEntries } from "@/player/encounters";
import { terrainRecordAt } from "@/project/terrainAt";
const p:any = (createMonsterExpedition({gymCount:1}) as any).project;
const sess:any = { ...p.session, switches: { ...Object.fromEntries(p.switches.map((s:any)=>[s.id,false])), mx_starter:true }, variables:{}, partyActorIds:p.session.partyActorIds, actorLevels:{} };
let anyTerr=0;
for (const m of Object.values<any>(p.maps)) { if(!m.encounterTable?.length) continue;
  let walk=0, elig=0, grass=0;
  for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){ const e=eligibleEncounterEntries(m,sess,{x,y},p).length>0; const g=terrainRecordAt(p,{mapId:m.id,x,y})?.record.id==="terrain_grass"; if(e)elig++; if(g)grass++; }
  const terr=m.encounterTable.filter((e:any)=>e.conditions?.terrainId).length; if(terr) anyTerr++;
  console.log(m.id, "size",m.width+"x"+m.height,"entries",m.encounterTable.length,"terrainId entries",terr,"grass cells",grass,"eligible cells",elig, "lv", [...new Set(m.encounterTable.map((e:any)=>e.levelMin+"-"+e.levelMax))].join(","));
}
