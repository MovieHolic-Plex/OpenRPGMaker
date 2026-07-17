/**
 * Supabase rpg-zzu-home-8pyeong 맵을 PNG로 렌더해 육안 확인.
 * bun scripts/render-home-8pyeong-png.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import type { GameMap } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-home-8pyeong";
const MAP_ID = "map_home_8pyeong_v1";
const TILE = 16;
const COLS = 30;
const SCALE = 4;
const OUT = path.resolve("output/evidence/home-8pyeong");

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
  projectId: PROJECT_ID,
});
if (!project?.maps[MAP_ID]) {
  console.error("missing project/map", PROJECT_ID, MAP_ID);
  process.exit(1);
}
const map = project.maps[MAP_ID]!;
const tileset = project.tilesets[map.tilesetId] ?? createBlankProject().tilesets.easyrpg_chipset_interior!;
const chipPath = "public/assets/easyrpg-chipset-interior-transparent.png";
const chip = PNG.sync.read(fs.readFileSync(chipPath));

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

function renderMap(map: GameMap, file: string): void {
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
  // event markers
  for (const ev of map.events ?? []) {
    const cx = Math.floor((ev.x + 0.5) * TILE * scale);
    const cy = Math.floor((ev.y + 0.5) * TILE * scale);
    const r = Math.max(3, Math.floor(TILE * scale * 0.2));
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        if (x * x + y * y > r * r) continue;
        const px = cx + x;
        const py = cy + y;
        if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
        const di = (py * png.width + px) * 4;
        png.data[di] = 60;
        png.data[di + 1] = 140;
        png.data[di + 2] = 255;
        png.data[di + 3] = 255;
      }
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log("wrote", file, `${map.width}x${map.height}`, "events", map.events.length);
}

const outFile = path.join(OUT, "home-8pyeong-map.png");
renderMap(map, outFile);

// also ascii furniture summary
const meta = tileset.tileMeta ?? [];
const items: Array<{ x: number; y: number; label: string }> = [];
for (let y = 0; y < map.height; y += 1) {
  for (let x = 0; x < map.width; x += 1) {
    const u = map.upperTiles[y * map.width + x]!;
    if (u >= 0) items.push({ x, y, label: meta[u]?.label ?? `t${u}` });
  }
}
fs.writeFileSync(
  path.join(OUT, "home-8pyeong-inventory.json"),
  JSON.stringify(
    {
      projectId: PROJECT_ID,
      mapId: MAP_ID,
      title: project.meta?.title,
      size: `${map.width}x${map.height}`,
      events: map.events.map((e) => ({ id: e.id, x: e.x, y: e.y, name: e.pages?.[0]?.name })),
      upper: items,
      png: outFile,
    },
    null,
    2,
  ),
);
console.log("inventory", items.length, "upper tiles");
console.log("events", map.events.map((e) => `${e.id}@(${e.x},${e.y})`).join(", "));
