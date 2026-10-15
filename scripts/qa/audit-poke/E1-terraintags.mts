import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
const project: any = deserialize(readFileSync("qa-runs/audit-poke/A1-base.json", "utf8"));
for (const id of Object.keys(project.tilesets)) { const ts = project.tilesets[id]; const tags = new Map<number, number>(); for (const m of Object.values(ts.tileMeta ?? {}) as any[]) if (m.terrainTag) tags.set(m.terrainTag, (tags.get(m.terrainTag) ?? 0) + 1); for (const t of Object.values(ts.terrain ?? {}) as any[]) if (t) tags.set(t, (tags.get(t) ?? 0) + 1);
  console.log(id, "terrain tag histogram:", JSON.stringify([...tags]), "autotile groups:", (ts.autotileGroups ?? []).filter((g:any)=>/grass|풀/i.test(g.id+g.name)).map((g:any)=>g.id+":"+g.name).join(",")); }
console.log("DB terrains:", JSON.stringify(project.database.terrains.map((t: any) => [t.id, t.name, t.encounterRatePercent])));
