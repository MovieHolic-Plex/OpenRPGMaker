import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";

const TILE = 16;
const COLS = 30;
const SCALE = 3;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const project = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
});
if (!project) throw new Error("no project");
const map = project.maps.map_interior_blank!;
const tileset = project.tilesets[map.tilesetId]!;
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png"));

function blitTile(
  dst: PNG,
  tile: number,
  dx: number,
  dy: number,
  scale: number,
  sourceQuarter?: { sx: number; sy: number; sw: number; sh: number },
): void {
  if (tile < 0) return;
  const col = tile % COLS;
  const row = Math.floor(tile / COLS);
  const sx0 = col * TILE + (sourceQuarter?.sx ?? 0);
  const sy0 = row * TILE + (sourceQuarter?.sy ?? 0);
  const sw = sourceQuarter?.sw ?? TILE;
  const sh = sourceQuarter?.sh ?? TILE;
  for (let y = 0; y < sh * scale; y += 1) {
    for (let x = 0; x < sw * scale; x += 1) {
      const sx = sx0 + Math.floor(x / scale);
      const sy = sy0 + Math.floor(y / scale);
      const si = (sy * chip.width + sx) * 4;
      const di = ((dy + y) * dst.width + (dx + x)) * 4;
      const a = chip.data[si + 3]!;
      if (a === 0) continue;
      dst.data[di] = chip.data[si]!;
      dst.data[di + 1] = chip.data[si + 1]!;
      dst.data[di + 2] = chip.data[si + 2]!;
      dst.data[di + 3] = 255;
    }
  }
}

const scale = SCALE;
const png = new PNG({ width: map.width * TILE * scale, height: map.height * TILE * scale });
for (let i = 0; i < png.data.length; i += 4) {
  png.data[i] = 20;
  png.data[i + 1] = 18;
  png.data[i + 2] = 24;
  png.data[i + 3] = 255;
}
for (let y = 0; y < map.height; y += 1) {
  for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x;
    const lower = map.lowerTiles[i]!;
    const upper = map.upperTiles[i]!;
    const dx = x * TILE * scale;
    const dy = y * TILE * scale;
    const composition = chipsetQuarterComposition(map, tileset, x, y);
    if (composition) {
      blitTile(png, composition.underlayTile ?? lower, dx, dy, scale);
      for (const src of composition.sources) {
        blitTile(png, src.tile, dx + src.offsetX * scale, dy + src.offsetY * scale, scale, {
          sx: src.offsetX,
          sy: src.offsetY,
          sw: 8,
          sh: 8,
        });
      }
    } else if (lower >= 0) blitTile(png, lower, dx, dy, scale);
    if (upper >= 0) blitTile(png, upper, dx, dy, scale);
  }
}
const out = path.resolve("output/docs/villager-room-v1/vision/gold-interior-blank.png");
fs.writeFileSync(out, PNG.sync.write(png));
console.log("wrote", out);
