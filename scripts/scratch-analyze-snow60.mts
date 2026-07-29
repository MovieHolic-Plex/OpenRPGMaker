// Analyze live snow60 vs freshly generated original. Prints JSON summary to stdout,
// writes full diff + ascii map to tmp/.
import { readFileSync, writeFileSync } from "node:fs";
import { buildSnowMountainTerrain, BANDS, bandProfile, stairBlocks, CLIFF_HEIGHT, STAIR_WIDTH } from "../src/project/defaults/snowMountain60";

const W = 60, H = 60;
const live = JSON.parse(readFileSync("tmp/snow60-live.json", "utf-8")) as { lowerTiles: number[]; upperTiles: number[] };
const orig = buildSnowMountainTerrain();

const CLASS: Record<number, string> = {};
for (const t of [372, 373, 374]) CLASS[t] = "T"; // 수평 상단
CLASS[285] = "B"; // 수평 몸통
for (const t of [402, 403, 404]) CLASS[t] = "b"; // 수평 밑동
CLASS[286] = "c"; CLASS[287] = "C"; // 대각 캡 L/R
CLASS[316] = "d"; CLASS[317] = "D"; // 대각 몸통 L/R
CLASS[346] = "e"; CLASS[347] = "E"; // 대각 밑동 L/R
CLASS[375] = "s"; CLASS[376] = "="; CLASS[377] = "S"; // 계단
CLASS[343] = "~"; // 눈 덮개 (생성기 금지)
CLASS[67] = "."; // 눈밭

function ascii(tiles: number[]): string {
  const rows: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let row = "";
    for (let x = 0; x < W; x += 1) {
      const t = tiles[y * W + x]!;
      row += CLASS[t] ?? (t === -1 ? " " : "?");
    }
    rows.push(row);
  }
  return rows.join("\n");
}

// histogram compare
const hist = (arr: number[]): Map<number, number> => {
  const m = new Map<number, number>();
  for (const t of arr) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
};
const hl = hist(live.lowerTiles), ho = hist([...orig.lowerTiles]);
const ids = [...new Set([...hl.keys(), ...ho.keys()])].sort((a, b) => a - b);
const table = ids.map((id) => ({ id, orig: ho.get(id) ?? 0, live: hl.get(id) ?? 0, delta: (hl.get(id) ?? 0) - (ho.get(id) ?? 0) }));

// diff cells
const diffs: Array<{ x: number; y: number; from: number; to: number }> = [];
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const i = y * W + x;
  if (orig.lowerTiles[i] !== live.lowerTiles[i]) diffs.push({ x, y, from: orig.lowerTiles[i]!, to: live.lowerTiles[i]! });
}

// transition summary
const trans = new Map<string, number>();
for (const d of diffs) {
  const k = `${CLASS[d.from] ?? d.from}→${CLASS[d.to] ?? d.to} (${d.from}→${d.to})`;
  trans.set(k, (trans.get(k) ?? 0) + 1);
}
const transitions = [...trans.entries()].sort((a, b) => b[1] - a[1]);

// 343 runs: rows where 343 appears, contiguous x-runs per row
function runsOf(tile: number): Array<{ y: number; x0: number; x1: number }> {
  const runs: Array<{ y: number; x0: number; x1: number }> = [];
  for (let y = 0; y < H; y += 1) {
    let start = -1;
    for (let x = 0; x <= W; x += 1) {
      const hit = x < W && live.lowerTiles[y * W + x] === tile;
      if (hit && start === -1) start = x;
      if (!hit && start !== -1) { runs.push({ y, x0: start, x1: x - 1 }); start = -1; }
    }
  }
  return runs;
}

// stair blocks in live: rows containing 375/376/377
const stairRows = new Set<number>();
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const t = live.lowerTiles[y * W + x]!;
  if (t === 375 || t === 376 || t === 377) stairRows.add(y);
}

// where are tiles 8 and 37?
function cellsOf(tile: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (live.lowerTiles[y * W + x] === tile) out.push({ x, y });
  }
  return out;
}

// band crest comparison: per band, sample original crest rows vs live cliff-top rows
const bandInfo = BANDS.map((b) => ({ id: b.id, baseCrestY: b.baseCrestY, profile: [...bandProfile(b).crestY] }));

writeFileSync("tmp/snow60-ascii-live.txt", ascii(live.lowerTiles));
writeFileSync("tmp/snow60-ascii-orig.txt", ascii([...orig.lowerTiles]));
writeFileSync("tmp/snow60-diff.json", JSON.stringify({ diffs, table, transitions }, null, 1));

console.log(JSON.stringify({
  diffCells: diffs.length,
  table,
  transitions: transitions.slice(0, 20),
  lip343Runs: runsOf(343).length,
  lip343Sample: runsOf(343).slice(0, 15),
  stairRows: [...stairRows].sort((a, b) => a - b),
  tile8: cellsOf(8).slice(0, 20),
  tile37: cellsOf(37).slice(0, 20),
  tile8Count: cellsOf(8).length,
  tile37Count: cellsOf(37).length,
  origStairBlocks: stairBlocks(),
  bandInfo: bandInfo.map((b) => ({ id: b.id, baseCrestY: b.baseCrestY })),
}, null, 1));
