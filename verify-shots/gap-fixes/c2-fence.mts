// C2 evidence: fences built by author_house, scrambled, then repaired by repair_fence via runTool.
import fs from "node:fs";
import { PNG } from "pngjs";
import { createEmptyToolProject, runTool } from "../../src/editor/tools/index.ts";
import { countBadFenceJoints } from "../../src/editor/tools/village/fenceRepair.ts";
import { FENCE_TILES } from "../../src/editor/tools/village/constants.ts";
import type { GameMap } from "../../src/project/types.ts";

const T = 16, COLS = 30, GRASS = 240, OUT = "verify-shots/gap-fixes";
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-combined-town-transparent.png"));
function render(map: GameMap, scale = 3, mark?: Set<number>): Buffer {
  const png = new PNG({ width: map.width * T * scale, height: map.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 64; png.data[i + 1] = 108; png.data[i + 2] = 74; png.data[i + 3] = 255; }
  const blit = (tile: number, dx: number, dy: number) => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T, sy0 = Math.floor(tile / COLS) * T;
    for (let y = 0; y < T * scale; y++) for (let x = 0; x < T * scale; x++) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      if (chip.data[si + 3] === 0) continue;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    blit(map.lowerTiles[i]!, x * T * scale, y * T * scale);
    blit(map.upperTiles[i]!, x * T * scale, y * T * scale);
    if (mark?.has(i)) for (let k = 0; k < T * scale; k++) for (const [px, py] of [[k, 0], [k, T * scale - 1], [0, k], [T * scale - 1, k]]) {
      const di = ((y * T * scale + py!) * png.width + (x * T * scale + px!)) * 4; png.data[di] = 255; png.data[di + 1] = 40; png.data[di + 2] = 40;
    }
  }
  return PNG.sync.write(png);
}
const fenceCells = (m: GameMap) => new Set([...m.upperTiles.keys()].filter(i => FENCE_TILES.has(m.upperTiles[i]!)));

const project = createEmptyToolProject("fence repair evidence");
const ctx = { project };
const mapId = "map_fence_town";
const v = runTool(ctx, "author_village", { target: { kind: "new", mapId, name: "울타리 마을", width: 40, height: 30, tilesetId: "easyrpg_chipset_combined_town" }, houseCount: 4, countPolicy: "exact", seed: 11, interior: false, morphology: "street", housePlans: [{ fence: true }, { fence: true }, { fence: true }, { fence: true }] });
if (!v.ok) throw new Error("author_village: " + v.summary + JSON.stringify(v.issues?.slice(0, 3)));
let map = ctx.project.maps[mapId]!;
const built = fenceCells(map);
const builtTiles = new Map([...built].map(i => [i, map.upperTiles[i]!]));
const nb = (m: GameMap, i: number) => { const x = i % m.width, y = Math.floor(i / m.width); const f = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < m.width && yy < m.height && FENCE_TILES.has(m.upperTiles[yy * m.width + xx]!); return (f(x, y-1)?'N':'')+(f(x, y+1)?'S':'')+(f(x+1, y)?'E':'')+(f(x-1, y)?'W':''); };
const builtNb = new Map([...built].map(i => [i, nb(map, i)]));
fs.writeFileSync(OUT + "/c2-0-built.png", render(map));
const builtBad = countBadFenceJoints(map);

// Scramble deterministically: wrong pieces on half the fence cells + 3 orphan posts in open grass.
const pieces = [...FENCE_TILES]; let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const scrambled = new Set<number>();
for (const i of built) if (rnd() < 0.5) { const cur = map.upperTiles[i]!; const other = pieces.filter(p => p !== cur); map.upperTiles[i] = other[Math.floor(rnd() * other.length)]!; scrambled.add(i); }
const free = [...map.upperTiles.keys()].filter(i => map.upperTiles[i] === -1 && ![-1, 1, map.width, -map.width].some(d => FENCE_TILES.has(map.upperTiles[i + d] ?? -1)) && [map.width+1, map.width-1, -map.width+1, -map.width-1].every(d => !FENCE_TILES.has(map.upperTiles[i + d] ?? -1)));
const orphanCells = [free[Math.floor(free.length * 0.2)]!, free[Math.floor(free.length * 0.5)]!, free[Math.floor(free.length * 0.8)]!];
for (const i of orphanCells) { map.upperTiles[i] = 408; scrambled.add(i); }
const messy = fenceCells(map);
const messyBad = countBadFenceJoints(map);
fs.writeFileSync(OUT + "/c2-1-messy.png", render(map, 3, scrambled));

const result = runTool(ctx, "repair_fence", { mapId });
if (!result.ok) throw new Error("repair_fence: " + result.summary + JSON.stringify(result.issues));
map = ctx.project.maps[mapId]!;
const after = fenceCells(map);
fs.writeFileSync(OUT + "/c2-2-repaired.png", render(map));
const added = [...after].filter(i => !messy.has(i)).length;
const removed = [...messy].filter(i => !after.has(i));
const diffs = [...after].filter(i => builtTiles.get(i) !== map.upperTiles[i]).map(i => ({ x: i % map.width, y: Math.floor(i / map.width), built: builtTiles.get(i), repaired: map.upperTiles[i], nb: builtNb.get(i) }));
const restoredToBuilt = diffs.length === 0 && after.size === built.size && [...after].every(i => built.has(i));
// Adversarial C4a: non-town tileset rejected.
const other = Object.keys(ctx.project.tilesets).find(id => !/combined_town|forest|retro/.test(id));
let rejection: string | null = null;
if (other) {
  const ctx2 = { project: structuredClone(ctx.project) };
  ctx2.project.maps[mapId]!.tilesetId = other;
  const r2 = runTool(ctx2, "repair_fence", { mapId });
  rejection = r2.ok ? "NOT REJECTED" : (r2.issues?.[0]?.code ?? "") + " " + r2.summary;
}
const report = { builtFenceCells: built.size, builtBadJoints: builtBad, scrambledCells: scrambled.size, messyBadJoints: messyBad, summary: result.summary, data: result.data, addedCells: added, removedCells: removed.length, removedAreOrphans: removed.every(i => orphanCells.includes(i)), identicalToBuilt: restoredToBuilt, diffsFromBuilt: diffs, otherTileset: other ?? null, rejection };
fs.writeFileSync(OUT + "/c2-report.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
