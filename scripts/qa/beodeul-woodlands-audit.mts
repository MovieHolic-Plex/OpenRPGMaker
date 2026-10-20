// 버들항 woodland 감사 — 편집기·조수가 실제로 만드는 숲 장면을 같은 렌더러(renderMapPng)로 그린다.
//   bun scripts/qa/beodeul-woodlands-audit.mts <outDir> [tag]
// 장면: 도로 숲 벽(author_wild_route), 공동마당 식생 보정(refine_beodeul_courtyard_vegetation), 강가 마을 숲(author_beodeul_town river).
import fs from "node:fs";
import { runTool } from "../../src/editor/tools/toolRunner.ts";
import { resetMapEditHistory } from "../../src/editor/mapEditHistory.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import type { Project } from "../../src/project/types.ts";
import { renderMapPng } from "../qa-game/render.mts";

const out = process.argv[2] ?? "/tmp/bw/audit", tag = process.argv[3] ?? "now";
fs.mkdirSync(out, { recursive: true });
const ok = (r: { ok: boolean; summary?: string }, what: string) => { if (!r.ok) throw new Error(`${what}: ${r.summary}`); };
const save = (p: Project, id: string, name: string) => {
  fs.writeFileSync(`${out}/${tag}-${name}.png`, renderMapPng({ ...p, startMapId: "" }, p.maps[id]!, 1).png);
  fs.writeFileSync(`${out}/${tag}-${name}.json`, JSON.stringify(p.maps[id]));
  console.log(name);
};

const types = (process.env.BW_TYPES ?? "broadleaf").split(",");
for (const forestType of types) for (const seed of [1, 7]) {
  resetMapEditHistory();
  const project = createBlankProject();
  project.database.troops.push({ id: "troop_wild", name: "야생", members: [] } as unknown as Project["database"]["troops"][number]);
  const ctx = { project };
  ok(runTool(ctx, "create_map", { id: "map_route", name: "도로", width: 32, height: 40, tilesetId: "beodeul_city" }, { dryRun: false }), "create_map");
  ok(runTool(ctx, "author_wild_route", { mapId: "map_route", exits: [{ x: 16, y: 39 }, { x: 16, y: 0 }], grassPatches: 3, seed, encounters: [{ troopId: "troop_wild", weight: 1 }], ...(forestType === "broadleaf" ? {} : { forestType }) }, { dryRun: false }), "route");
  save(ctx.project, "map_route", forestType === "broadleaf" ? `route-${seed}` : `route-${forestType}-${seed}`);
}

{
  resetMapEditHistory();
  const project = createBlankProject();
  const ctx = { project };
  ok(runTool(ctx, "author_beodeul_town", { id: "map_court", houseCount: 5, church: true }, { dryRun: false }), "town");
  ok(runTool(ctx, "compose_beodeul_courtyard_village", { mapId: "map_court" }, { dryRun: false }), "courtyard");
  save(ctx.project, "map_court", "courtyard-before-refine");
  ok(runTool(ctx, "refine_beodeul_courtyard_vegetation", { mapId: "map_court" }, { dryRun: false }), "refine");
  save(ctx.project, "map_court", "courtyard");
}

for (const forestType of types) for (const seed of [3]) {
  resetMapEditHistory();
  const project = createBlankProject();
  const ctx = { project };
  const r = runTool(ctx, "author_beodeul_town", { id: "map_river", theme: "river", seed, ...(forestType === "broadleaf" ? {} : { forestType }) }, { dryRun: false });
  ok(r, "river");
  save(ctx.project, "map_river", forestType === "broadleaf" ? `river-${seed}` : `river-${forestType}-${seed}`);
}
