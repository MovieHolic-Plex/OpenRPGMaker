import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { eligibleEncounterEntries } from "@/player/encounters";
import { canMove } from "@/project/collision";
const project: any = deserialize(readFileSync("qa-runs/audit-poke/A1-t2.json", "utf8"));
const map = project.maps.e1_route;
const session: any = { switches: { mx_starter: true }, variables: {}, partyActorIds: ["hero"], actorLevels: { hero: 5 }, gameTime: { totalMinutes: 600 } };
console.log("rate", map.encounterRate, "locs", JSON.stringify(map.locations.map((l:any)=>[l.id,l.x,l.y,l.w,l.h])), "table", JSON.stringify(map.encounterTable));
let walk=0, elig=0, eligOnGrassRect=0; const rows: string[] = [];
const inRect=(l:any,x:number,y:number)=>x>=l.x&&y>=l.y&&x<l.x+l.w&&y<l.y+l.h;
for (let y=0;y<map.height;y++){ let row=""; for(let x=0;x<map.width;x++){
  const can=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const nx=x+dx,ny=y+dy; return nx>=0&&ny>=0&&nx<map.width&&ny<map.height&&canMove(project,map,nx,ny,x,y);});
  const e=eligibleEncounterEntries(map,session,{x,y}).length>0;
  if(can){walk++; if(e)elig++;}
  row += !can?"#": e?"G":".";
} rows.push(row);}
console.log(rows.join("\n"));
console.log("walkable",walk,"eligible",elig,(100*elig/walk).toFixed(1)+"%");
