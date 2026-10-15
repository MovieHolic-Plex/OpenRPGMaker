import { writeFileSync } from "node:fs";
import { runTool } from "../../../src/editor/tools/index.ts";
import { createNewProjectSeed } from "../../../src/editor/genrePacks.ts";
import { serialize, deserialize } from "../../../src/project/io.ts";
import { isPassable, isPassableLanding } from "../../../src/project/collision.ts";
import { blankFillTileFor } from "../../../src/project/defaults/defaultMaps.ts";
const kitId = process.argv[2] ?? "modern_campus";
const seedNum = Number(process.argv[3] ?? 3);
const seed = createNewProjectSeed("story-cutscene", "t");
const project = deserialize(serialize(seed));
const ctx = { project };
const start = project.maps[project.startMapId]!;
const kit = project.tilesets[kitId]!;
console.log("kit", !!kit, project.startMapId, start.width, start.height);
start.tilesetId = kit.id; start.tileSize = kit.tileSize;
const [w, h] = kitId === "modern_campus" ? [56, 44] : [60, 48];
let r = runTool(ctx, "resize_map", { mapId: start.id, width: w, height: h }); console.log("resize", r.ok, r.summary);
const m = ctx.project.maps[start.id]!; m.lowerTiles.fill(blankFillTileFor(kit.id, 0, kit));
r = kitId === "modern_campus"
  ? runTool(ctx, "compose_campus_grounds", { mapId: start.id, style: "university", seed: seedNum })
  : runTool(ctx, "compose_modern_city_street", { mapId: start.id, seed: seedNum, shops: ["편의점", "카페", "사무실"] });
console.log(r.ok, r.summary.slice(0, 600), JSON.stringify(r.issues ?? []).slice(0, 400));
const mm = ctx.project.maps[start.id]!;
console.log("startPos", ctx.project.startPos);
let east: number[] = [], west: number[] = [];
for (let y = 0; y < mm.height; y++) { if (isPassableLanding(ctx.project, mm, mm.width - 1, y)) east.push(y); if (isPassableLanding(ctx.project, mm, 0, y)) west.push(y); }
console.log("east edge passable rows", east.join(","), "| west", west.join(","));
writeFileSync(process.argv[4] ?? "/tmp/proto.json", serialize(ctx.project));
