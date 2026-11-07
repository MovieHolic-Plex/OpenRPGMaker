import { createBlankProject } from "../../src/project/defaults/defaultProject";
import { shapeAutotileGroupAround } from "../../src/project/defaults/autotileEngine";
import { resolveAutotile } from "../../src/editor/tools/v3/rmTypeExpander";
import { autotileGroupsForTileset } from "../../src/project/defaults/autotileGroups";
import type { GameMap, AutotileGroup } from "../../src/project/types";

const W = 8;
const H = 8;

function blank(body: number): GameMap {
  return {
    id: "probe", name: "probe", tilesetId: "", width: W, height: H,
    lowerTiles: new Array<number>(W * H).fill(-1),
    upperTiles: new Array<number>(W * H).fill(-1),
    events: [],
  } as unknown as GameMap;
}

function brushShape(group: AutotileGroup, cells: readonly { x: number; y: number }[], body: number): GameMap {
  const map = blank(body);
  for (const c of cells) map.lowerTiles[c.y * W + c.x] = body;
  shapeAutotileGroupAround(map, group, cells);
  return map;
}

function aiShape(group: AutotileGroup, cells: readonly { x: number; y: number }[], body: number): GameMap {
  const map = blank(body);
  for (const c of cells) map.lowerTiles[c.y * W + c.x] = body;
  resolveAutotile(group, cells, map);
  return map;
}

const project = createBlankProject();
let totalMismatch = 0;
const rows: string[] = [];
const records: { tileset: string; group: string; shape: string; cells: number; edgeConnects: boolean; outsideConnects: boolean; phase: boolean; neighborhood: number }[] = [];

for (const [tilesetId, tileset] of Object.entries(project.tilesets)) {
  for (const group of autotileGroupsForTileset(tileset)) {
    if (group.layer === "upper") continue;
    const body = group.variantMap[group.neighborhood === 8 ? "255" : "15"] ?? group.memberTileIds[0]!;
    if (typeof body !== "number" || body < 0) continue;
    // 맵 가장자리에 닿는 띠 + 내부 3x3: edgeConnects 와 phaseVariants 를 함께 자극한다.
    const shapes: readonly { name: string; cells: { x: number; y: number }[] }[] = [
      { name: "edgeRow", cells: Array.from({ length: W }, (_, x) => ({ x, y: 0 })) },
      { name: "edgeCol", cells: Array.from({ length: H }, (_, y) => ({ x: 0, y })) },
      { name: "corner", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { name: "inner3", cells: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: 2 + (i % 3), y: 2 + Math.floor(i / 3) })) },
    ];
    for (const shape of shapes) {
      const a = brushShape(group, shape.cells, body);
      const b = aiShape(group, shape.cells, body);
      const diffs: string[] = [];
      for (let i = 0; i < W * H; i += 1) {
        if (a.lowerTiles[i] !== b.lowerTiles[i]) diffs.push(`(${i % W},${Math.floor(i / W)}) brush=${a.lowerTiles[i]} ai=${b.lowerTiles[i]}`);
      }
      if (diffs.length > 0) {
        totalMismatch += 1;
        rows.push(`${tilesetId} | ${group.id} | ${shape.name} | ${diffs.length}칸 불일치 | ${diffs.slice(0, 3).join(" ; ")}`);
        records.push({ tileset: tilesetId, group: group.id, shape: shape.name, cells: diffs.length, edgeConnects: group.edgeConnects === true, outsideConnects: group.outsideConnects === true, phase: !!group.phaseVariants, neighborhood: group.neighborhood ?? 4 });
      }
    }
  }
}

console.log(`mismatching (tileset,group,shape) cases: ${totalMismatch}`);
for (const row of rows.slice(0, 40)) console.log("  " + row);
if (rows.length > 40) console.log(`  … ${rows.length - 40} more`);
const cli = process.argv.slice(2).filter((a) => a !== "--");
const outArg = cli[0];
const pngDir = cli[1];
const fs = await import("node:fs");
if (outArg) fs.writeFileSync(outArg, JSON.stringify(records, null, 1));

// 대표 그림: 타일셋마다 불일치 그룹 하나씩(최대 8), 실제 렌더러로 8×8 맵을 두 경로로 그린다.
if (pngDir) {
  const { drawMapTileLayer } = await import("../../src/editor/mapTileDrawCore");
  const { CanvasContext2D, createCanvas, decodePng, encodePng } = await import("./canvasShim");
  const { BUNDLED_EASYRPG_CHIPSET_ASSETS } = await import("../../src/assets/bundled");
  const { join } = await import("node:path");
  fs.mkdirSync(pngDir, { recursive: true });
  const paths = new Map(BUNDLED_EASYRPG_CHIPSET_ASSETS.map((a) => [a.textureKey, a.path]));
  const seen = new Set<string>();
  // 수정 후에는 불일치가 거의 없어 같은 그룹을 다시 그리려면 수정 전 그림 폴더를 넘긴다(BEFORE/AFTER 같은 그룹).
  const picksFrom = cli[2];
  const picks: { tileset: string; group: string }[] = picksFrom
    ? fs.readdirSync(picksFrom).filter((f) => f.endsWith(".brush.png")).map((f) => { const [tileset, group] = f.replace(/\.brush\.png$/, "").split("__"); return { tileset: tileset!, group: group! }; })
    : records.filter((r) => r.shape === "edgeRow" && !seen.has(r.tileset) && (seen.add(r.tileset), true)).slice(0, 8);
  const phasePick = records.find((r) => r.phase && r.shape === "inner3") ?? records.find((r) => r.phase);
  if (!picksFrom && phasePick && !picks.includes(phasePick)) picks.push(phasePick);
  const SCALE = 3;
  for (const pick of picks) {
    const tileset = project.tilesets[pick.tileset]!;
    const group = autotileGroupsForTileset(tileset).find((g) => g.id.replace(/[^a-zA-Z0-9_.-]/g, "_") === pick.group || g.id === pick.group)!;
    const atlasPath = tileset.image.type === "bundled" ? paths.get(tileset.image.id) : undefined;
    if (!atlasPath) continue;
    const atlas = decodePng(fs.readFileSync(join(process.cwd(), "public", atlasPath)));
    const body = group.variantMap[group.neighborhood === 8 ? "255" : "15"] ?? group.memberTileIds[0]!;
    // 맵 윗변 전체 + 왼변 절반 + 가운데 덩어리: 가장자리와 위상을 한 그림에.
    const cells: { x: number; y: number }[] = [];
    for (let x = 0; x < W; x += 1) for (let y = 0; y < 2; y += 1) cells.push({ x, y });
    for (let y = 2; y < 6; y += 1) for (let x = 0; x < 2; x += 1) cells.push({ x, y });
    for (let y = 3; y < 7; y += 1) for (let x = 3; x < 7; x += 1) cells.push({ x, y });
    for (const [kind, map] of [["brush", brushShape(group, cells, body)], ["ai", aiShape(group, cells, body)]] as const) {
      const base = map.lowerTiles.map((t) => t);
      const groundTile = (() => { for (let t = 0; t < tileset.count; t += 1) if (!(group.connectTileIds ?? group.memberTileIds).includes(t)) return t; return -1; })();
      (map as { lowerTiles: number[] }).lowerTiles = base.map((t) => (t < 0 ? groundTile : t));
      const canvas = createCanvas(W * tileset.tileSize * SCALE, H * tileset.tileSize * SCALE);
      drawMapTileLayer(new CanvasContext2D(canvas) as unknown as CanvasRenderingContext2D, atlas as unknown as HTMLCanvasElement, map, tileset, "lower", SCALE);
      fs.writeFileSync(join(pngDir, `${pick.tileset}__${pick.group}.${kind}.png`.replace(/[^a-zA-Z0-9_.-]/g, "_")), encodePng(canvas));
    }
  }
  console.log(`AIVB_PNG wrote ${picks.length} pairs to ${pngDir}`);
}
