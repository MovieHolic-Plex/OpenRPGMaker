import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { eligibleEncounterEntries } from "@/player/encounters";
const project: any = (createMonsterExpedition({}) as any).project;
const session: any = { switches: { mx_starter: true }, variables: {}, partyActorIds: ["hero"], actorLevels: { hero: 5 }, gameTime: { totalMinutes: 600 } };
for (const id of ["mx_map_meadow","mx_map_forest"]) {
  const map = project.maps[id]; const ts = project.tilesets[map.tilesetId];
  const groups: any[] = ts.autotileGroups ?? [];
  console.log(id, "groups:", groups.map((g:any)=>g.id ?? g.name).slice(0,40).join(" | "));
  const tileToGroup = new Map<number,string>();
  for (const g of groups) for (const t of (g.tileIds ?? g.tiles ?? g.members ?? [])) tileToGroup.set(t, g.id ?? g.name);
  const stat = new Map<string,[number,number]>();
  for (let y=0;y<map.height;y++) for (let x=0;x<map.width;x++) {
    const t = map.lowerTiles[y*map.width+x]; const g = tileToGroup.get(t) ?? "?"+(t<6?"plain":"other");
    const e = eligibleEncounterEntries(map, session,{x,y}).length>0; const c=stat.get(g)??[0,0]; c[e?0:1]++; stat.set(g,c);
  }
  console.log("  group -> [eligible, notEligible]", JSON.stringify([...stat].sort((a,b)=>(b[1][0]+b[1][1])-(a[1][0]+a[1][1])).slice(0,12)));
  // also upper tiles groups
}
