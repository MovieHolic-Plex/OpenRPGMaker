// Scratch audit: measure the visual/structural defects of the live 128x128 ice grand expanse
// before rebuilding it at 64x64. Prints JSON to stdout; writes ASCII maps to tmp/.
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "../src/project/defaults";
import { buildIceGrandExpanseTerrain } from "../src/project/defaults/iceGrandExpanseTerrain";
import { buildIceGrandExpanseMap } from "../src/project/defaults/iceGrandExpanseMap";
import { iceDiagonalRole } from "../src/project/defaults/iceDiagonalTerrain";
import { passageMarkForTile } from "../src/project/tilesetPassage";
import { isPassable } from "../src/project/collision";
import { DUNGEON_TILESET_ID } from "../src/project/defaults/dungeonThemedLayouts";

mkdirSync("tmp", { recursive: true });

const project = createBlankProject();
const tileset = project.tilesets[DUNGEON_TILESET_ID];
if (!tileset) throw new Error(`dungeon tileset missing: ${Object.keys(project.tilesets).join(", ")}`);

const terrain = buildIceGrandExpanseTerrain();
const map = buildIceGrandExpanseMap({ tilesetId: DUNGEON_TILESET_ID, tileSize: 16 });
project.maps[map.id] = map;

const W = terrain.width;
const H = terrain.height;
const lower = [...terrain.lowerTiles];
const upper = [...terrain.upperTiles];

const mark = (tile: number): string => (tile < 0 || tile >= tileset.count ? "?" : passageMarkForTile(tileset, tile));

// ---- 1. upper tiles sitting on cliff (diagonal-ice) cells that are NOT star ----
const cliffPunchThrough: Array<{ x: number; y: number; lower: number; upper: number; mark: string }> = [];
let cliffCells = 0;
let cliffWithUpper = 0;
for (let i = 0; i < lower.length; i += 1) {
  if (iceDiagonalRole(lower[i]!) === null) continue;
  cliffCells += 1;
  const u = upper[i]!;
  if (u < 0) continue;
  cliffWithUpper += 1;
  const m = mark(u);
  if (m !== "star") cliffPunchThrough.push({ x: i % W, y: Math.floor(i / W), lower: lower[i]!, upper: u, mark: m });
}

// same for horizontal cliff (372-374 / 402-404) and ceiling 428
const HORIZ_CLIFF = new Set([372, 373, 374, 402, 403, 404, 428]);
const horizPunchThrough: Array<{ x: number; y: number; lower: number; upper: number; mark: string }> = [];
for (let i = 0; i < lower.length; i += 1) {
  if (!HORIZ_CLIFF.has(lower[i]!)) continue;
  const u = upper[i]!;
  if (u < 0) continue;
  const m = mark(u);
  if (m !== "star") horizPunchThrough.push({ x: i % W, y: Math.floor(i / W), lower: lower[i]!, upper: u, mark: m });
}

// ---- 2. reachability from start; which ridge cells are never adjacent to reachable floor ----
const start = { x: 64, y: 120 };
const reach = new Uint8Array(lower.length);
{
  const q: Array<[number, number]> = [[start.x, start.y]];
  reach[start.y * W + start.x] = 1;
  for (let c = 0; c < q.length; c += 1) {
    const [x, y] = q[c]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (reach[ni] === 1) continue;
      if (!isPassable(project, map, nx, ny)) continue;
      reach[ni] = 1;
      q.push([nx, ny]);
    }
  }
}
const reachableCells = [...reach].filter((c) => c === 1).length;

// a cliff cell is "seen" if any cell within radius 8 (camera-ish) is reachable
function seenWithin(i: number, radius: number): boolean {
  const x = i % W;
  const y = Math.floor(i / W);
  for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (reach[ny * W + nx] === 1) return true;
  }
  return false;
}
let ridgeCellsUnseen = 0;
let ridgeCellsSeen = 0;
for (let i = 0; i < lower.length; i += 1) {
  if (iceDiagonalRole(lower[i]!) === null) continue;
  if (seenWithin(i, 10)) ridgeCellsSeen += 1;
  else ridgeCellsUnseen += 1;
}

// ---- 3. modulo artifacts in the horizontal cliff fringe (index % 3 tile pick) ----
// A proper 9-slice never puts a "right" cap (374) immediately left of a "left" cap (372).
let fringeBadPairs = 0;
const fringeSamples: Array<{ x: number; y: number; a: number; b: number }> = [];
for (let y = 0; y < H; y += 1) for (let x = 0; x + 1 < W; x += 1) {
  const a = lower[y * W + x]!;
  const b = lower[y * W + x + 1]!;
  const bad = (a === 374 && b === 372) || (a === 374 && b === 373) || (a === 404 && b === 402) || (a === 404 && b === 403);
  if (bad) {
    fringeBadPairs += 1;
    if (fringeSamples.length < 12) fringeSamples.push({ x, y, a, b });
  }
}

// ---- 4. cap sawtooth: horizontal runs of the same diagonal cap ----
let capRuns2 = 0;
let capRunsLong = 0;
for (let y = 0; y < H; y += 1) {
  let run = 0;
  let prev = -1;
  for (let x = 0; x <= W; x += 1) {
    const t = x < W ? lower[y * W + x]! : -1;
    const isCap = t === 286 || t === 287;
    if (isCap && t === prev) run += 1;
    else {
      if (run >= 2) capRuns2 += 1;
      if (run >= 4) capRunsLong += 1;
      run = isCap ? 1 : 0;
    }
    prev = isCap ? t : -1;
  }
}

// ---- 5. tile histogram + star inventory ----
const hist = new Map<number, number>();
for (const t of lower) hist.set(t, (hist.get(t) ?? 0) + 1);
for (const t of upper) if (t >= 0) hist.set(t, (hist.get(t) ?? 0) + 1);
const histTop = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 26)
  .map(([tile, count]) => ({ tile, count, mark: mark(tile) }));

// which props/decor tiles from the decision sheet are actually present?
const DECISION_PROPS = {
  "얼음 수정": [350, 351], "석순": [261, 288, 291], "얼음 블록": [232],
  "얼음 난간/계단": [375, 376, 377], "설산 봉우리": [408, 409], "눈뭉치": [315],
  "눈사람": [345], "얼음 마법 블록": [125, 155, 185, 215], "눈처짐": [237, 238, 239],
  "부빙": [282, 283, 284, 312, 313, 314, 342, 343, 344],
} as const;
const propPresence = Object.entries(DECISION_PROPS).map(([label, tiles]) => ({
  label,
  tiles: tiles.map((t) => ({ tile: t, count: hist.get(t) ?? 0, mark: mark(t) })),
  total: tiles.reduce((sum, t) => sum + (hist.get(t) ?? 0), 0),
}));

// ---- ascii ----
const CLASS: Record<number, string> = {
  428: "#", 67: ".", 66: ".", 68: ".", 7: ".", 37: ".", 96: ",", 97: ",", 98: ",", 6: ".", 8: ".", 36: ".", 38: ".",
  286: "c", 287: "C", 316: "d", 317: "D", 346: "e", 347: "E",
  372: "T", 373: "T", 374: "T", 402: "b", 403: "b", 404: "b",
  69: "~", 70: "~", 71: "~", 99: "~", 100: "~", 101: "~",
};
const rows: string[] = [];
for (let y = 0; y < H; y += 1) {
  let row = "";
  for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    const u = upper[i]!;
    row += u >= 0 ? (CLASS[u] ?? "*") : (CLASS[lower[i]!] ?? "?");
  }
  rows.push(row);
}
writeFileSync("tmp/ice-expanse-ascii.txt", rows.join("\n"));

const reachRows: string[] = [];
for (let y = 0; y < H; y += 1) {
  let row = "";
  for (let x = 0; x < W; x += 1) row += reach[y * W + x] === 1 ? "o" : (isPassable(project, map, x, y) ? "+" : " ");
  reachRows.push(row);
}
writeFileSync("tmp/ice-expanse-reach.txt", reachRows.join("\n"));

console.log(JSON.stringify({
  size: { W, H, cells: W * H },
  cliff: { cliffCells, cliffWithUpper, punchThrough: cliffPunchThrough.length, samples: cliffPunchThrough.slice(0, 10) },
  horizCliffPunchThrough: { count: horizPunchThrough.length, samples: horizPunchThrough.slice(0, 10) },
  reach: { reachableCells, ratio: Number((reachableCells / (W * H)).toFixed(3)), bossReachable: reach[11 * W + 64] === 1 },
  ridgeVisibility: { ridgeCellsSeen, ridgeCellsUnseen },
  fringe9Slice: { badPairs: fringeBadPairs, samples: fringeSamples },
  capSawtooth: { runsOf2Plus: capRuns2, runsOf4Plus: capRunsLong },
  histTop,
  propPresence,
}, null, 1));
