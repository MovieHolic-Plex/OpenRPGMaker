// 버들항 woodland 감사 — 편집기·조수가 실제로 만드는 숲 장면을 같은 렌더러(renderMapPng)로 그린다.
//   bun scripts/qa/beodeul-woodlands-audit.mts <outDir> [tag]
// 장면: 도로 숲 벽(author_wild_route), 공동마당 식생 보정(refine_beodeul_courtyard_vegetation), 강가 마을 숲(author_beodeul_town river).
import fs from "node:fs";
import { runTool } from "../../src/editor/tools/toolRunner.ts";
import { resetMapEditHistory } from "../../src/editor/mapEditHistory.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import type { Project } from "../../src/project/types.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { PNG } from "pngjs";

const out = process.argv[2] ?? "/tmp/bw/audit", tag = process.argv[3] ?? "now";
fs.mkdirSync(out, { recursive: true });
const ok = (r: { ok: boolean; summary?: string }, what: string) => { if (!r.ok) throw new Error(`${what}: ${r.summary}`); };
const save = (p: Project, id: string, name: string) => {
  // 높이(relief) 맵은 렌더러가 맨 위에 pad 띠(맵 0행 위, 게임 화면 밖)를 더 그린다 — 맵 칸만 남기고 잘라 낸다.
  const png = PNG.sync.read(renderMapPng({ ...p, startMapId: "" }, p.maps[id]!, 1).png), m = p.maps[id]!;
  const pad = png.height - m.height * 16, cut = new PNG({ width: png.width, height: m.height * 16 });
  png.data.copy(cut.data, 0, pad * png.width * 4);
  fs.writeFileSync(`${out}/${tag}-${name}.png`, PNG.sync.write(cut));
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

// 닫힌 울타리(북서·북동 모서리까지 7조각 모두) — 독립 검수 P3 「북서·북동 모서리는 어느 장면에도 쓰이지 않아 미검증」.
{
  resetMapEditHistory();
  const project = createBlankProject();
  const ctx = { project };
  ok(runTool(ctx, "create_map", { id: "map_fence", name: "울타리", width: 12, height: 9, tilesetId: "beodeul_city" }, { dryRun: false }), "create_map");
  const { default: catalog } = await import("../../src/assets/beodeulGroundCatalog.json");
  const { createBeodeulGroundTileset } = await import("../../src/project/defaults/beodeulGround.ts");
  const { translateTiles } = await import("../../src/project/objectStamp.ts");
  const { setLayerTileAt } = await import("../../src/project/mapLayers.ts");
  const m = ctx.project.maps.map_fence!, ts = ctx.project.tilesets[m.tilesetId]!;
  const common = ctx.project.tilesets.beodeul_ground ??= createBeodeulGroundTileset();
  const piece = (name: string) => catalog.recipes.find((r) => r.id === `bdg-woodland-fence-${name}`)!.rows[0]![0]!;
  const tr = translateTiles(common, ts, ["horizontal", "vertical", "vertical-east", "corner", "corner-se", "corner-nw", "corner-ne"].map(piece)).map;
  const put = (name: string, x: number, y: number) => setLayerTileAt(m, 3, y * m.width + x, tr.get(piece(name))!);
  const [x0, y0, x1, y1] = [2, 2, 9, 6];
  put("corner-nw", x0, y0); put("corner-ne", x1, y0); put("corner", x0, y1); put("corner-se", x1, y1);
  for (let x = x0 + 1; x < x1; x++) { put("horizontal", x, y0); put("horizontal", x, y1); }
  for (let y = y0 + 1; y < y1; y++) { put("vertical", x0, y); put("vertical-east", x1, y); }
  save(ctx.project, "map_fence", "fence-ring");
}

// 잘림 검사(독립 검수 D1·D2·D5): 심은 나무의 보이는 칸이 맵 밖으로 나가거나, 앞 불투명 칸 없이 층이 모자라 사라진 칸이 있는지 센다.
{
  const { beodeulForestComposer, planBeodeulForest } = await import("../../src/editor/tools/beodeulForest.ts");
  const { composeTreesPlaced } = await import("../../src/project/defaults/treeComposer.ts");
  const { layerTileAt } = await import("../../src/project/mapLayers.ts");
for (const type of ["broadleaf", "conifer", "mixed"] as const) {
    const project = createBlankProject(); const ctx = { project };
    runTool(ctx, "create_map", { id: "m", name: "t", width: 40, height: 30, tilesetId: "beodeul_city" }, { dryRun: false });
    const m = ctx.project.maps.m!, ts = ctx.project.tilesets.beodeul_city!;
    const forest = (x: number, y: number) => (x - 20) ** 2 / 300 + (y - 15) ** 2 / 120 < 1;
    const hold = (x: number, y: number) => (x - 20) ** 2 / 360 + (y - 15) ** 2 / 160 < 1;
    const def = beodeulForestComposer(ctx.project, ts, type);
    const plan = planBeodeulForest(m, def, type, forest, hold, 5);
    composeTreesPlaced(m, def, plan.placements, plan.shade, forest, hold, hold);
    let lost = 0, total = 0, topCut = 0;
    for (const p of plan.placements) for (let j = 0; j < p.sprite.h; j++) for (let i = 0; i < p.sprite.w; i++) {
      const t = p.sprite.tiles[j * p.sprite.w + i]!, cv = p.sprite.cover[j * p.sprite.w + i]!;
      if (t < 0 || cv <= 0) continue;
      const x = p.x0 + i, y = p.y0 + j;
      if (y < 0 || x < 0 || x >= m.width) { if (cv > 2) topCut++; continue; }
      total++;
      const k = y * m.width + x;
      if (![2, 3, 4].some((L) => layerTileAt(m, L as 2, k) === t)) {
        const front = plan.placements.some((q) => q.z > p.z && x >= q.x0 && x < q.x0 + q.sprite.w && y >= q.y0 && y < q.y0 + q.sprite.h && (q.sprite.cover[(y - q.y0) * q.sprite.w + x - q.x0] ?? 0) >= 98);
        if (!front) lost++;
      }
    }
    console.log("clip-check", type, "trees", plan.placements.length, "tiles", total, "missing", lost, "cut", topCut);
  }
}
