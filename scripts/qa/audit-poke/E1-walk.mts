import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { eligibleEncounterEntries } from "@/player/encounters";
import { canMove } from "@/project/collision";
const project: any = (createMonsterExpedition({}) as any).project;
const session: any = { switches: { mx_starter: true }, variables: {}, partyActorIds: ["hero"], actorLevels: { hero: 5 }, gameTime: { totalMinutes: 600 } };
const ts = project.tilesets[project.maps.mx_map_meadow.tilesetId];
console.log("tileset", ts.id, "tags:", Object.keys(ts).join(","), "terrain entries", Object.keys(ts.terrain ?? {}).length, "tileMeta terrainTag", Object.values(ts.tileMeta ?? {}).filter((m:any)=>m.terrainTag).length);
console.log("terrains in DB:", JSON.stringify(project.database.terrains?.map((t:any)=>[t.id,t.encounterRatePercent])));
for (const id of ["mx_map_meadow","mx_map_forest","mx_map_river"]) {
  const map = project.maps[id];
  // BFS reachable walkable from start / any walkable
  let walk=0, walkElig=0; const byTile = new Map<number,[number,number]>();
  for (let y=0;y<map.height;y++) for (let x=0;x<map.width;x++) {
    // walkable if can enter from a neighbour
    const can = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const nx=x+dx,ny=y+dy; return nx>=0&&ny>=0&&nx<map.width&&ny<map.height&&canMove(project,map,nx,ny,x,y);});
    if(!can) continue; walk++;
    const e = eligibleEncounterEntries(map, session,{x,y}).length>0; if(e) walkElig++;
    const t = map.lowerTiles[y*map.width+x]; const c=byTile.get(t)??[0,0]; c[e?0:1]++; byTile.set(t,c);
  }
  console.log(id, "walkable", walk, "walkable&eligible", walkElig, "pct", (100*walkElig/walk).toFixed(1));
  console.log("  tile -> [eligible,notEligible] top:", JSON.stringify([...byTile].sort((a,b)=>(b[1][0]+b[1][1])-(a[1][0]+a[1][1])).slice(0,8)));
}
