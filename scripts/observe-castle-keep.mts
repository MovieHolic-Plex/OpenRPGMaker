/**
 * Observe live map_castle_keep (user gold) and report structural modules
 * for castle harness design.
 */
import fs from "node:fs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { describeChipsetTile, tileDisplayLabelForIndex } from "../src/project/defaults/chipsetMapping.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const GRASS = new Set([240, 270, 300, 330]);
const ROOF = new Set([18, 19, 20, 48, 49, 50, 78, 79, 80, 108, 109, 110]);
const WALL = new Set([21, 51, 81]);
const TOWER_LOWER = new Set([138, 139, 140, 141, 142, 143]);
const TOWER_UPPER = new Set([24, 25, 54, 55]);
const PATH = new Set([393, 394, 423, 424, 425, 453, 454, 455, 363, 364, 365]);

const env = loadEnv();
const p = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
if (!p) throw new Error("no project");
const map = p.maps.map_castle_keep;
if (!map) throw new Error("no map_castle_keep");

const W = map.width;
const H = map.height;
const lowerF = new Map<number, number>();
const upperF = new Map<number, number>();
const stack = new Map<string, number>();

for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    const L = map.lowerTiles[i]!;
    const U = map.upperTiles[i]!;
    lowerF.set(L, (lowerF.get(L) ?? 0) + 1);
    if (U >= 0 && U !== 0) {
      upperF.set(U, (upperF.get(U) ?? 0) + 1);
      stack.set(`${L}:${U}`, (stack.get(`${L}:${U}`) ?? 0) + 1);
    }
  }
}

console.log("=== SIZE", W, "x", H, "events", Object.keys(map.events ?? {}).length);

console.log("\n=== LOWER (non-grass)");
for (const [t, n] of [...lowerF.entries()]
  .filter(([t]) => !GRASS.has(t))
  .sort((a, b) => b[1] - a[1])) {
  const d = describeChipsetTile(t);
  console.log(String(n).padStart(4), tileDisplayLabelForIndex(t), `layer=${d.layer}`, `pass=${d.passage}`);
}

console.log("\n=== UPPER used");
for (const [t, n] of [...upperF.entries()].sort((a, b) => b[1] - a[1])) {
  const d = describeChipsetTile(t);
  console.log(String(n).padStart(4), tileDisplayLabelForIndex(t), `layer=${d.layer}`, `pass=${d.passage}`);
}

console.log("\n=== L+U stacks");
for (const [k, n] of [...stack.entries()].sort((a, b) => b[1] - a[1])) {
  const [L, U] = k.split(":").map(Number) as [number, number];
  console.log(String(n).padStart(4), "L", tileDisplayLabelForIndex(L), "+ U", tileDisplayLabelForIndex(U));
}

const glyph = (L: number, U: number): string => {
  if (TOWER_UPPER.has(U) && (U === 24 || U === 25)) return "C";
  if (TOWER_UPPER.has(U) && (U === 54 || U === 55)) return "b";
  if (TOWER_LOWER.has(L) && (L === 142 || L === 143)) return "W";
  if (TOWER_LOWER.has(L)) return "O";
  if (L === 21) return "T";
  if (L === 51) return "M";
  if (L === 81) return "B";
  if ([18, 20, 108, 110].includes(L)) return "+";
  if ([19, 109].includes(L)) return "-";
  if ([48, 78].includes(L)) return "|";
  if ([49, 50, 79, 80].includes(L)) return "#";
  if (PATH.has(L)) return "~";
  if (GRASS.has(L)) return U > 0 ? "*" : ".";
  return "?";
};

let minX = W;
let minY = H;
let maxX = 0;
let maxY = 0;
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    const L = map.lowerTiles[i]!;
    const U = map.upperTiles[i]!;
    if (GRASS.has(L) && !(U > 0)) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
}

console.log("\n=== ASCII", { minX, minY, maxX, maxY });
console.log("C=cap b=base O=tower-body W=window TMB=wallface +-| #=roof ~path .grass");
for (let y = minY; y <= maxY; y += 1) {
  let row = "";
  for (let x = minX; x <= maxX; x += 1) {
    const i = y * W + x;
    row += glyph(map.lowerTiles[i]!, map.upperTiles[i]!);
  }
  console.log(String(y).padStart(2, "0"), row);
}

function scan(name: string, x0: number, y0: number, x1: number, y1: number): void {
  const lf = new Map<number, number>();
  const uf = new Map<number, number>();
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      const L = map.lowerTiles[i]!;
      const U = map.upperTiles[i]!;
      lf.set(L, (lf.get(L) ?? 0) + 1);
      if (U > 0) uf.set(U, (uf.get(U) ?? 0) + 1);
    }
  }
  const topL = [...lf.entries()]
    .filter(([t]) => !GRASS.has(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([t, n]) => `${t}:${n}`)
    .join(" ");
  const topU = [...uf.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t}:${n}`)
    .join(" ");
  console.log(`\n[${name}] ${x0},${y0}-${x1},${y1}`);
  console.log("  L", topL || "(grass only)");
  console.log("  U", topU || "(none)");
}

scan("outer-roof-band", 6, 4, 41, 6);
scan("N-wall+keep-top", 8, 6, 39, 13);
scan("keep-block", 16, 6, 28, 13);
scan("courtyard", 10, 14, 36, 25);
scan("round-tower", 16, 17, 21, 25);
scan("S-curtain+gate", 6, 26, 41, 32);
scan("approach-path", 22, 26, 25, 37);
scan("NW-corner", 6, 4, 14, 12);
scan("NE-corner", 33, 4, 41, 12);

console.log("\n=== wall face columns (x with 21)");
const xs = new Set<number>();
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    if (map.lowerTiles[y * W + x] === 21) xs.add(x);
  }
}
for (const x of [...xs].sort((a, b) => a - b).slice(0, 16)) {
  const col: string[] = [];
  for (let y = 0; y < H; y += 1) {
    const L = map.lowerTiles[y * W + x]!;
    if (WALL.has(L)) col.push(`${y}:${L}`);
  }
  console.log(`x=${x}`, col.join(" "));
}

console.log("\n=== round tower exact cells");
for (let y = 18; y <= 24; y += 1) {
  for (let x = 18; x <= 19; x += 1) {
    const i = y * W + x;
    console.log(
      `(${x},${y}) L=${map.lowerTiles[i]} U=${map.upperTiles[i]}  // ${tileDisplayLabelForIndex(map.lowerTiles[i]!)} / U ${map.upperTiles[i]! > 0 ? tileDisplayLabelForIndex(map.upperTiles[i]!) : "-"}`,
    );
  }
}

// south gate gap detection
console.log("\n=== south wall y=29..31 gap detection");
for (let y = 28; y <= 31; y += 1) {
  const gaps: number[] = [];
  for (let x = 6; x <= 41; x += 1) {
    const L = map.lowerTiles[y * W + x]!;
    if (!WALL.has(L) && !ROOF.has(L)) gaps.push(x);
  }
  console.log(`y=${y} non-wall-roof xs:`, gaps.join(",") || "(none)");
}

console.log("\n=== tiles on map outside known castle+path+grass sets");
const known = new Set([...ROOF, ...WALL, ...TOWER_LOWER, ...TOWER_UPPER, ...PATH, ...GRASS, 0]);
const unknown = new Set<number>();
for (const t of lowerF.keys()) if (!known.has(t)) unknown.add(t);
for (const t of upperF.keys()) if (!known.has(t)) unknown.add(t);
for (const t of [...unknown].sort((a, b) => a - b)) {
  console.log(" ", tileDisplayLabelForIndex(t), "L", lowerF.get(t) ?? 0, "U", upperF.get(t) ?? 0);
}

for (const e of Object.values(map.events ?? {})) {
  console.log("event", e.id, e.name, "at", e.x, e.y);
}

// Module recipe synthesis
console.log("\n=== MODULE RECIPE (from observation)");
console.log(`
1. Outer roof deck (top battlement walk):
   - Full top band y≈4–5 of roof tiles 18/19/20 + 48/78 sides + 49/79/80 fill
2. Curtain wall face:
   - Vertical strip 21 (top) / 51* (mid stretch) / 81 (bottom)
   - Used for outer N/S walls and keep front
3. Keep (본채):
   - Roof deck block + wall face under south edge of roof
4. Round tower (원형 타워):
   - 2-wide: upper 24|25 cap, lower 138|139 neck, 140|141 body*, 142|143 windows, upper 54|55 base
5. Courtyard:
   - Grass interior (passable) — do NOT paint roof tiles in yard
6. Approach path:
   - Sand/dirt strip through south gate into courtyard
7. South gate:
   - Curtain wall with gap for path (~2 tiles)
`);
