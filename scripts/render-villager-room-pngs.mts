/**
 * Render villager-room-v1 maps to PNG (raw tile blit + upper overlay).
 * Uses pngjs (no canvas). Quarter composition not applied (vision still sees structure).
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import {
  INTERIOR_ROOM_DEMO_PLANS,
  VR,
  runInteriorRoomPipeline,
} from "../src/editor/interiorRoomPipeline.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { GameMap } from "../src/project/types.ts";

const TILE = 16;
const COLS = 30;
const SCALE = 3;

const chipPath = "public/assets/easyrpg-chipset-interior-transparent.png";
const outDir = path.resolve("output/docs/interior-room-v1/vision");
fs.mkdirSync(outDir, { recursive: true });

const chip = PNG.sync.read(fs.readFileSync(chipPath));
const tileset = createBlankProject().tilesets.easyrpg_chipset_interior!;

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
  fs.writeFileSync(file, PNG.sync.write(png));
  console.log("wrote", file);
}

for (const plan of INTERIOR_ROOM_DEMO_PLANS) {
  const map = runInteriorRoomPipeline(plan).map;
  // 방 구조 데모처럼 테마가 겹칠 수 있으므로 mapId 기반으로 저장 (기존 테마명 파일도 유지)
  const name = plan.mapId.replace(/^map_interior_/, "").replace(/_v\d+$/, "");
  renderMap(map, path.join(outDir, `${name}.png`));
}
console.log("bed", VR.BED_L, VR.BED_R);
