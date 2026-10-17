import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { eligibleEncounterEntries } from "@/player/encounters";
const project: any = (createMonsterExpedition({}) as any).project;
const session: any = { switches: { mx_starter: true }, variables: {}, partyActorIds: ["hero"], actorLevels: { hero: 5 }, gameTime: { totalMinutes: 600 } };
const map = project.maps.mx_map_meadow; const ts = project.tilesets[map.tilesetId];
console.log(JSON.stringify(ts.autotileGroups[0]).slice(0,300));
const path = new Set<number>(); const g = ts.autotileGroups.find((g:any)=>g.id==="path");
const ids = (o:any, out=new Set<number>())=>{ if(typeof o==="number") out.add(o); else if(Array.isArray(o)) o.forEach(v=>ids(v,out)); else if(o&&typeof o==="object") Object.values(o).forEach(v=>ids(v,out)); return out;};
const pset = ids(g.variants ?? g.tiles ?? g.tileIds ?? g);
let pe=0, pn=0;
for (let y=0;y<map.height;y++) for (let x=0;x<map.width;x++){ const t=map.lowerTiles[y*map.width+x]; if(pset.has(t)){ const e=eligibleEncounterEntries(map,session,{x,y}).length>0; e?pe++:pn++; if(e&&pe<=5) console.log("path tile eligible at",x,y,t);} }
console.log("path-group lower tiles: eligible",pe,"not",pn, "(map has habitat rect", JSON.stringify(map.locations), ")");
