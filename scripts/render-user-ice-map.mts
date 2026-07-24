/** 사용자 제작 '던전 · 얼음 동굴' 로드·분석·렌더 (읽기 전용). */
import fs from "node:fs";
import { PNG } from "pngjs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const project = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: "rpg-zzu-showcase",
});
if (!project) throw new Error("로드 실패");
const map = project.maps["map_sc_dungeon_ice"];
if (!map) throw new Error("map_sc_dungeon_ice 없음");
console.log("map:", map.name, map.width + "x" + map.height);
const hist = (arr: readonly number[]): string => {
  const h = new Map<number, number>();
  for (const t of arr) h.set(t, (h.get(t) ?? 0) + 1);
  return [...h.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([t, n]) => `${t}×${n}`).join(" ");
};
console.log("lower:", hist(map.lowerTiles));
console.log("upper:", hist(map.upperTiles));
// 행별 타일 덤프 (구조 파악용)
const W = map.width, H = map.height;
console.log("== lower 행 덤프 ==");
for (let y = 0; y < H; y += 1) {
  const row: string[] = [];
  for (let x = 0; x < W; x += 1) row.push(String(map.lowerTiles[y * W + x]).padStart(4));
  console.log(String(y).padStart(2), row.join(""));
}
console.log("== upper 행 덤프 ==");
for (let y = 0; y < H; y += 1) {
  const row: string[] = [];
  for (let x = 0; x < W; x += 1) row.push(String(map.upperTiles[y * W + x]).padStart(4));
  console.log(String(y).padStart(2), row.join(""));
}
// 렌더
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
const T = 16, COLS = 30, scale = 5;
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
fs.writeFileSync("output/evidence/dungeon-theme-gallery/user-ice-map.png", PNG.sync.write(png));
console.log("rendered output/evidence/dungeon-theme-gallery/user-ice-map.png");
