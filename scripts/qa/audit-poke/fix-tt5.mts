import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
const p:any = (createMonsterExpedition({gymCount:1}) as any).project;
for (const [id,ts] of Object.entries<any>(p.tilesets)) { const h=new Map<number,number>(); for (const m of Object.values<any>(ts.tileMeta??{})) if(m.terrainTag) h.set(m.terrainTag,(h.get(m.terrainTag)??0)+1); for (const t of Object.values<any>(ts.terrain??{})) if(t) h.set(t,(h.get(t)??0)+1); console.log(id, JSON.stringify([...h])); }
console.log(p.database.terrains.map((t:any)=>t.id));
const m=p.maps.mx_map_meadow; console.log(m.tilesetId, m.width,m.height, JSON.stringify(m.locations), m.encounterRate);
const ts=p.tilesets[m.tilesetId]; const cnt=new Map<string,number>();
for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const t=m.lowerTiles[y*m.width+x]; const tag=ts.tileMeta?.[t]?.terrainTag??ts.terrain?.[t]??0; const k=t+":"+tag; cnt.set(k,(cnt.get(k)??0)+1)}
console.log(JSON.stringify([...cnt].sort((a,b)=>b[1]-a[1]).slice(0,25)));
