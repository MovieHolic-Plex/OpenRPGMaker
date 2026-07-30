// Scratch: build the 64x64 ice plain, print ASCII + audit numbers.
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "../src/project/defaults";
import { passageMarkForTile } from "../src/project/tilesetPassage";
import { isPassable } from "../src/project/collision";
import { DUNGEON_TILESET_ID } from "../src/project/defaults/dungeonThemedLayouts";
import { validateIceDiagonalTerrain, iceDiagonalRole } from "../src/project/defaults/iceDiagonalTerrain";
import {
  buildIcePlainTerrain, buildIcePlainMap, ICE_PLAIN_START, ICE_PLAIN_SUMMIT,
  ICE_PLAIN_WIDTH as W, ICE_PLAIN_HEIGHT as H, STAIR_WIDTH, CLIFF_HEIGHT, CLIFF_WALL_ROWS, CLIFF_LIP, BANNED_WATER_TILES,
  BLOCK_BODY, FORBIDDEN_CLIFF_LIP, blockTile,
} from "../src/project/defaults/iceGrandPlain64";

mkdirSync("tmp", { recursive: true });
const project = createBlankProject();
const tileset = project.tilesets[DUNGEON_TILESET_ID]!;
const terrain = buildIcePlainTerrain();
const map = buildIcePlainMap({ tilesetId: DUNGEON_TILESET_ID, tileSize: 16 });
project.maps[map.id] = map;
const lower = [...terrain.lowerTiles];
const upper = [...terrain.upperTiles];
const mark = (t: number) => (t < 0 || t >= tileset.count ? "?" : passageMarkForTile(tileset, t));

const CLASS: Record<number, string> = {};
for (const t of [36, 37, 38, 66, 67, 68, 96, 97, 98]) CLASS[t] = ".";
for (const t of [39, 40, 41, 69, 70, 71, 99, 100, 101]) CLASS[t] = "-";
for (const t of [396, 397, 398, 426, 427, 428, 456, 457, 458]) CLASS[t] = "~";
for (const t of [282, 283, 284, 312, 313, 314, 342, 343, 344]) CLASS[t] = "o";
CLASS[372] = "T"; CLASS[373] = "T"; CLASS[374] = "T"; CLASS[285] = "B";
CLASS[402] = "b"; CLASS[403] = "b"; CLASS[404] = "b";
CLASS[286] = "c"; CLASS[287] = "C"; CLASS[316] = "d"; CLASS[317] = "D"; CLASS[346] = "e"; CLASS[347] = "E";
CLASS[375] = "["; CLASS[376] = "="; CLASS[377] = "]";
for (const t of [125, 155, 185, 215]) CLASS[t] = "I";
const UP: Record<number, string> = { 408: "^", 409: "^", 237: "w", 238: "w", 239: "w" };

const rows: string[] = [];
for (let y = 0; y < H; y += 1) {
  let row = String(y).padStart(2, " ") + "|";
  for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    const u = upper[i]!;
    row += u >= 0 ? (UP[u] ?? "*") : (CLASS[lower[i]!] ?? "?");
  }
  rows.push(row);
}
writeFileSync("tmp/ice-plain-ascii.txt", rows.join("\n"));

// reachability from start
const reach = new Uint8Array(W * H);
{
  const q: Array<[number, number]> = [[ICE_PLAIN_START.x, ICE_PLAIN_START.y]];
  reach[ICE_PLAIN_START.y * W + ICE_PLAIN_START.x] = 1;
  for (let c = 0; c < q.length; c += 1) {
    const [x, y] = q[c]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (reach[ni] === 1 || !isPassable(project, map, nx, ny)) continue;
      reach[ni] = 1; q.push([nx, ny]);
    }
  }
}
const reachRows: string[] = [];
for (let y = 0; y < H; y += 1) {
  let row = String(y).padStart(2, " ") + "|";
  for (let x = 0; x < W; x += 1) row += reach[y * W + x] === 1 ? "o" : (isPassable(project, map, x, y) ? "+" : " ");
  reachRows.push(row);
}
writeFileSync("tmp/ice-plain-reach.txt", reachRows.join("\n"));

// ---- audits ----
// A. non-star upper on cliff/pool cells
let punchThrough = 0;
for (let i = 0; i < lower.length; i += 1) {
  const solid = terrain.cliffMask[i] === 1;
  const u = upper[i]!;
  if (solid && u >= 0 && mark(u) !== "star") punchThrough += 1;
}
// B. 9-slice self-consistency: every masked cell must equal blockTile of its own mask
function checkBlock(maskName: string, mask: Uint8Array, body: number) {
  let bad = 0; const samples: unknown[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    if (mask[i] !== 1) continue;
    const n = y === 0 || mask[i - W] === 1, s = y === H - 1 || mask[i + W] === 1;
    const w = x === 0 || mask[i - 1] === 1, e = x === W - 1 || mask[i + 1] === 1;
    const want = blockTile(body, n, s, w, e);
    if (lower[i] !== want) { bad += 1; if (samples.length < 5) samples.push({ x, y, got: lower[i], want }); }
  }
  return { maskName, bad, samples };
}
const snowMask = new Uint8Array(W * H);
for (let i = 0; i < snowMask.length; i += 1) {
  if (terrain.cliffMask[i] === 1 || terrain.stairMask[i] === 1) continue;
  snowMask[i] = 1;
}
// snow is painted from the full snowMask (ice/floe patches overpaint it), so the audit must
// compare against that same mask and skip cells another block legitimately overwrote.
const snowVisible = new Uint8Array(snowMask);
for (let i = 0; i < snowVisible.length; i += 1) if (terrain.iceMask[i] === 1) snowVisible[i] = 0;
function checkSnow() {
  let bad = 0; const samples: unknown[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    // 평지 립 343 은 절벽 윗선에 맞춰 일부러 덮어쓴 칸이라 눈 9슬라이스 대상이 아니다.
    if (snowMask[i] !== 1 || terrain.iceMask[i] === 1 || lower[i] === CLIFF_LIP) continue;
    const n = y === 0 || snowMask[i - W] === 1, s = y === H - 1 || snowMask[i + W] === 1;
    const w = x === 0 || snowMask[i - 1] === 1, e = x === W - 1 || snowMask[i + 1] === 1;
    const want = blockTile(BLOCK_BODY.snow, n, s, w, e);
    if (lower[i] !== want) { bad += 1; if (samples.length < 5) samples.push({ x, y, got: lower[i], want }); }
  }
  return { maskName: "snow", bad, samples };
}

// C. stairs are exact rectangles and fully passable
const stairAudit = terrain.stairs.map((b) => {
  let cells = 0, passableCells = 0;
  const tiles = new Set<number>();
  for (let o = 0; o < STAIR_WIDTH; o += 1) for (let s = 0; s < CLIFF_WALL_ROWS; s += 1) {
    const x = b.fromX + o, y = b.crestY + s;
    cells += 1; tiles.add(lower[y * W + x]!);
    if (isPassable(project, map, x, y)) passableCells += 1;
  }
  return { ...b, cells, passableCells, tiles: [...tiles].sort((p, q) => p - q) };
});

// D. blocking each stair block cuts reach to the terrace above
function reachWithBlocked(blockedCells: Set<number>): Uint8Array {
  const r = new Uint8Array(W * H);
  const q: Array<[number, number]> = [[ICE_PLAIN_START.x, ICE_PLAIN_START.y]];
  r[ICE_PLAIN_START.y * W + ICE_PLAIN_START.x] = 1;
  for (let c = 0; c < q.length; c += 1) {
    const [x, y] = q[c]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (r[ni] === 1 || blockedCells.has(ni) || !isPassable(project, map, nx, ny)) continue;
      r[ni] = 1; q.push([nx, ny]);
    }
  }
  return r;
}
const stairGate = terrain.stairs.map((b) => {
  const blocked = new Set<number>();
  for (let o = 0; o < STAIR_WIDTH; o += 1) for (let s = 0; s < CLIFF_WALL_ROWS; s += 1) blocked.add((b.crestY + s) * W + b.fromX + o);
  const r = reachWithBlocked(blocked);
  return { bandId: b.bandId, summitStillReachable: r[ICE_PLAIN_SUMMIT.y * W + ICE_PLAIN_SUMMIT.x] === 1 };
});

// E. 물은 이 맵에 없다 — 못/부빙 감사 항목을 지웠다.

// F. forbidden lip on cliff
let lipOnCliff = 0;
for (let i = 0; i < lower.length; i += 1) if (terrain.cliffMask[i] === 1 && lower[i] === FORBIDDEN_CLIFF_LIP) lipOnCliff += 1;

// G. histogram
const hist = new Map<number, number>();
for (const t of lower) hist.set(t, (hist.get(t) ?? 0) + 1);
for (const t of upper) if (t >= 0) hist.set(t, (hist.get(t) ?? 0) + 1);

console.log(JSON.stringify({
  canonical: validateIceDiagonalTerrain({ width: W, height: H, lower }).length,
  diagonalColumns: terrain.diagonalColumns.length,
  horizontalCliffCells: terrain.horizontalCliffCells,
  cliffCells: [...terrain.cliffMask].filter((c) => c === 1).length,
  punchThroughUpperOnSolid: punchThrough,
  nineSlice: [
    checkSnow(),
    checkBlock("ice", terrain.iceMask, BLOCK_BODY.ice),
  ],
  stairs: stairAudit,
  stairGate,
  water: lower.filter((tile) => BANNED_WATER_TILES.includes(tile)).length,
  lip343: lower.filter((tile) => tile === CLIFF_LIP).length,
  lipOnCliff,
  reach: {
    reachableCells: [...reach].filter((c) => c === 1).length,
    startPassable: isPassable(project, map, ICE_PLAIN_START.x, ICE_PLAIN_START.y),
    summitReachable: reach[ICE_PLAIN_SUMMIT.y * W + ICE_PLAIN_SUMMIT.x] === 1,
  },
  props: {
    peaks: (hist.get(408) ?? 0) + (hist.get(409) ?? 0),
    peakPaired: (hist.get(408) ?? 0) === (hist.get(409) ?? 0),
    drapes: (hist.get(237) ?? 0) + (hist.get(238) ?? 0) + (hist.get(239) ?? 0),
    floorProps: [350, 351, 261, 288, 291, 232, 315, 345].map((t) => ({ t, n: hist.get(t) ?? 0 })),
    magicPillars: [125, 155, 185, 215].map((t) => ({ t, n: hist.get(t) ?? 0 })),
  },
  histTop: [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([t, n]) => ({ t, n, mark: mark(t) })),
}, null, 1));
