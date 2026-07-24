/** 사용자가 수정한 map_g_ice_grand 로드 + 내 버전과 diff + 렌더 (읽기 전용). */
import fs from "node:fs";
import { PNG } from "pngjs";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const project = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: "rpg-zzu-dungeon-theme-gallery",
});
if (!project) throw new Error("로드 실패");
const map = project.maps["map_g_ice_grand"];
if (!map) throw new Error("map_g_ice_grand 없음");
const W = map.width, H = map.height;
console.log("loaded:", map.name, W + "x" + H);

// 내 버전 재구성 (build-grand-ice-cave.mts의 결정적 로직 — 동일 코드)
const CEIL = 428;
const WALL_N = [372, 373, 374], WALL_S = [402, 403, 404];
const SNOW_N = [36, 37, 38], SNOW_S = [96, 97, 98];
const SNOW_W = 66, SNOW_E = 68, SNOW_F = 67;
const LADDER = [375, 376, 377];
const PIT = 160;
const at = (x: number, y: number) => y * W + x;
const mine = new Array<number>(W * H).fill(CEIL);
const mineUpper = new Array<number>(W * H).fill(-1);
for (let x = 2; x < W - 2; x += 1) {
  mine[at(x, 2)] = x === 2 ? WALL_N[0] : x === W - 3 ? WALL_N[2] : WALL_N[1];
  mine[at(x, 3)] = x === 2 ? WALL_S[0] : x === W - 3 ? WALL_S[2] : WALL_S[1];
}
for (let x = 2; x < W - 2; x += 1) {
  mine[at(x, 4)] = x === 2 ? SNOW_N[0] : x === W - 3 ? SNOW_N[2] : SNOW_N[1];
  mine[at(x, H - 3)] = x === 2 ? SNOW_S[0] : x === W - 3 ? SNOW_S[2] : SNOW_S[1];
}
for (let y = 5; y < H - 3; y += 1) {
  mine[at(2, y)] = SNOW_W;
  mine[at(W - 3, y)] = SNOW_E;
  for (let x = 3; x < W - 3; x += 1) mine[at(x, y)] = SNOW_F;
}
function ridge(x0: number, y0: number, n: number, height: number): void {
  for (let i = 0; i < n; i += 1) {
    const foot = i === n - 1;
    const x = x0 - i, top = foot ? y0 + i + 1 : y0 + i;
    const bot = foot ? top + height - 3 : top + height - 1;
    for (let y = top; y <= bot; y += 1) {
      let t: number;
      if (y === top) t = foot ? 286 : 287;
      else if (y === bot) t = foot ? 346 : 347;
      else t = foot ? 316 : 317;
      mine[at(x, y)] = t;
    }
    if (!foot) {
      if (mine[at(x - 1, top)] === SNOW_F) mine[at(x - 1, top)] = 98;
      if (x - 2 >= 0 && mine[at(x - 2, top)] === SNOW_F) mine[at(x - 2, top)] = 8;
    }
    if (mine[at(x, bot + 1)] === SNOW_F) mine[at(x, bot + 1)] = 36;
    if (mine[at(x + 1, bot + 1)] === SNOW_F) mine[at(x + 1, bot + 1)] = 8;
  }
}
ridge(18, 7, 13, 5);
for (let y = 19; y < 23; y += 1) { mine[at(2, y)] = 375; mine[at(3, y)] = 376; mine[at(4, y)] = 376; mine[at(5, y)] = 377; }
for (let x = 2; x <= 5; x += 1) mine[at(x, 23)] = x === 2 ? SNOW_N[0] : x === 5 ? SNOW_N[2] : SNOW_N[1];
ridge(44, 8, 9, 5);
ridge(48, 36, 6, 5);
for (let y = 40; y < 43; y += 1) for (let x = 14; x < 19; x += 1) mine[at(x, y)] = PIT;
for (let x = 14; x < 19; x += 1) mine[at(x, 41)] = x === 14 ? LADDER[0] : x === 18 ? LADDER[2] : LADDER[1];
for (const [x, y] of [[6, 51], [9, 51], [44, 51], [48, 51]] as const) mine[at(x, y)] = [237, 238, 239][Math.abs(x * 7 + y) % 3]!;
for (let y = 20; y < 23; y += 1) for (let x = 47; x < 50; x += 1) if (mine[at(x, y)] === SNOW_F) mine[at(x, y)] = [9, 10, 11][Math.abs(x + y) % 3]!;

// diff
const diffs: { x: number; y: number; mine: number; theirs: number }[] = [];
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  if (mine[at(x, y)] !== map.lowerTiles[at(x, y)]) diffs.push({ x, y, mine: mine[at(x, y)]!, theirs: map.lowerTiles[at(x, y)]! });
}
console.log("lower diff 셀 수:", diffs.length);
const upperDiffs: { x: number; y: number; theirs: number }[] = [];
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const t = map.upperTiles[at(x, y)]!;
  if (t !== mineUpper[at(x, y)]) upperDiffs.push({ x, y, theirs: t });
}
console.log("upper diff 셀 수:", upperDiffs.length);
// diff를 행 단위로 요약 출력
for (const d of diffs) console.log(`  (${d.x},${d.y}) mine=${d.mine} → user=${d.theirs}`);
for (const d of upperDiffs) console.log(`  upper (${d.x},${d.y}) user=${d.theirs}`);

// 렌더
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
const T = 16, COLS = 30, scale = 4;
const png = new PNG({ width: W * T * scale, height: H * T * scale });
for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 24; png.data[i + 1] = 22; png.data[i + 2] = 28; png.data[i + 3] = 255; }
const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
  if (tile < 0) return;
  const sx0 = (tile % COLS) * T + (q?.sx ?? 0), sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
  const sw = q?.sw ?? T, sh = q?.sh ?? T;
  for (let y = 0; y < sh * scale; y += 1) for (let x = 0; x < sw * scale; x += 1) {
    const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
    const di = ((dy + y) * png.width + (dx + x)) * 4;
    if (chip.data[si + 3] === 0) continue;
    png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
  }
};
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const i = y * W + x, dx = x * T * scale, dy = y * T * scale;
  const comp = chipsetQuarterComposition(map, project.tilesets[map.tilesetId]!, x, y);
  if (comp) {
    blit(comp.underlayTile ?? map.lowerTiles[i]!, dx, dy);
    for (const s of comp.sources) blit(s.tile, dx + s.offsetX * scale, dy + s.offsetY * scale, { sx: s.offsetX, sy: s.offsetY, sw: 8, sh: 8 });
  } else if (map.lowerTiles[i]! >= 0) blit(map.lowerTiles[i]!, dx, dy);
  if (map.upperTiles[i]! >= 0) blit(map.upperTiles[i]!, dx, dy);
}
// diff 마커 (빨간 테두리)
for (const d of diffs) {
  const px = d.x * T * scale, py = d.y * T * scale, s = T * scale;
  for (let i = 0; i < s; i += 1) for (let k = 0; k < 4; k += 1) {
    const put = (xx: number, yy: number) => { const di = (yy * png.width + xx) * 4; if (di < 0 || di + 3 >= png.data.length) return; png.data[di] = 255; png.data[di + 1] = 60; png.data[di + 2] = 60; png.data[di + 3] = 255; };
    put(px + i, py + k); put(px + i, py + s - 1 - k); put(px + k, py + i); put(px + s - 1 - k, py + i);
  }
}
fs.writeFileSync("output/evidence/dungeon-theme-gallery/user-ice-grand-edited.png", PNG.sync.write(png));
console.log("rendered output/evidence/dungeon-theme-gallery/user-ice-grand-edited.png (diff 마커 포함)");
