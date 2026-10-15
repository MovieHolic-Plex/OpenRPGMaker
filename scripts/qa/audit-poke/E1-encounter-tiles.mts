import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { eligibleEncounterEntries } from "@/player/encounters";
import { canMove } from "@/project/collision";
import { terrainTagAt } from "@/project/terrainAt";
const res: any = createMonsterExpedition({});
const project: any = res.project ?? res;
console.log("keys", Object.keys(res).slice(0,8));
const session: any = { switches: { mx_starter: true }, variables: {}, partyActorIds: ["hero"], actorLevels: { hero: 5 }, gameTime: { totalMinutes: 600 } };
const maps = Object.values(project.maps) as any[];
let shown = 0;
for (const map of maps) {
  if (!(map.encounterRate > 0) || !map.encounterTable?.length) continue;
  let walk = 0, elig = 0; const tilesElig = new Map<number, number>(), tilesNot = new Map<number, number>();
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (!canMove(project, map, x, y, x, y) && false) continue;
    const e = eligibleEncounterEntries(map, session, { x, y }).length > 0;
    walk++; if (e) elig++;
    const t = map.lowerTiles[y * map.width + x];
    (e ? tilesElig : tilesNot).set(t, ((e ? tilesElig : tilesNot).get(t) ?? 0) + 1);
  }
  if (shown++ < 4) console.log(map.id, map.name, "rate", map.encounterRate, "tileset", map.tilesetId, `${map.width}x${map.height}`, "eligible", elig, "/", walk, "locs", JSON.stringify(map.locations?.map((l:any)=>[l.id,l.x,l.y,l.w,l.h])), "tilesElig(top5)", JSON.stringify([...tilesElig].sort((a,b)=>b[1]-a[1]).slice(0,5)), "tilesNot", JSON.stringify([...tilesNot].sort((a,b)=>b[1]-a[1]).slice(0,3)));
}
console.log("maps with encounters:", maps.filter(m => m.encounterRate > 0 && m.encounterTable?.length).length, "of", maps.length);
