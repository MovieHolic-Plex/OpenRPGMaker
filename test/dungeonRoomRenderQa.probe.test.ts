/**
 * dungeon-room-v1 비전 QA 프로브 — 파이프라인 산출 맵 3종(용암/석재/얼음)을
 * 실제 렌더 경로(chipsetQuarterComposition)로 PNG 래스터라이즈해 육안 감사용 증거를 남긴다.
 * RENDER_QA=1 일 때만 실행(평시 스위트에서는 skip). 출력: $RENDER_QA_OUT 또는 output/dungeon-room-qa/.
 * pngjs 는 리포 의존성이 아니므로 RENDER_QA_PNGJS 로 외부 설치 경로를 주입한다.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DUNGEON_ROOM_DEMO_PLANS, runDungeonRoomPipeline } from "@/editor/dungeonRoomPipeline";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";
import { createBlankProject } from "@/project/defaults";
import type { GameMap } from "@/project/types";

const RUN = process.env.RENDER_QA === "1";
const TILE = 16;
const COLS = 30;
const SCALE = 3;

describe.runIf(RUN)("dungeon-room-v1 render QA probe", () => {
  it("renders lava/stone/ice demo rooms to PNG evidence", () => {
    const require = createRequire(import.meta.url);
    const pngjsPath = process.env.RENDER_QA_PNGJS ?? "pngjs";
    // pngjs 는 리포 의존성이 아님(외부 설치 경로 주입) — 타입 참조 없이 동적 로드한다.
    type Raster = { width: number; height: number; data: Buffer };
    const { PNG } = require(pngjsPath) as {
      PNG: (new (opts: { width: number; height: number }) => Raster) & {
        sync: { read(buf: Buffer): Raster; write(png: Raster): Buffer };
      };
    };

    const outDir = process.env.RENDER_QA_OUT ?? path.resolve("output/dungeon-room-qa");
    fs.mkdirSync(outDir, { recursive: true });

    const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
    const tileset = createBlankProject().tilesets.easyrpg_chipset_dungeon!;

    function blitTile(
      dst: Raster,
      tile: number,
      dx: number,
      dy: number,
      sourceQuarter?: { sx: number; sy: number; sw: number; sh: number },
    ): void {
      if (tile < 0) return;
      const col = tile % COLS;
      const row = Math.floor(tile / COLS);
      const sx0 = col * TILE + (sourceQuarter?.sx ?? 0);
      const sy0 = row * TILE + (sourceQuarter?.sy ?? 0);
      const sw = sourceQuarter?.sw ?? TILE;
      const sh = sourceQuarter?.sh ?? TILE;
      for (let y = 0; y < sh * SCALE; y += 1) {
        for (let x = 0; x < sw * SCALE; x += 1) {
          const sx = sx0 + Math.floor(x / SCALE);
          const sy = sy0 + Math.floor(y / SCALE);
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
      const png = new PNG({ width: map.width * TILE * SCALE, height: map.height * TILE * SCALE });
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
          const dx = x * TILE * SCALE;
          const dy = y * TILE * SCALE;
          const composition = chipsetQuarterComposition(map, tileset, x, y);
          if (composition) {
            blitTile(png, composition.underlayTile ?? lower, dx, dy);
            for (const src of composition.sources) {
              blitTile(png, src.tile, dx + src.offsetX * SCALE, dy + src.offsetY * SCALE, {
                sx: src.offsetX,
                sy: src.offsetY,
                sw: 8,
                sh: 8,
              });
            }
          } else if (lower >= 0) blitTile(png, lower, dx, dy);
          if (upper >= 0) blitTile(png, upper, dx, dy);
        }
      }
      fs.writeFileSync(file, PNG.sync.write(png));
    }

    for (const plan of DUNGEON_ROOM_DEMO_PLANS) {
      const { map } = runDungeonRoomPipeline(plan);
      const file = path.join(outDir, `${plan.theme}.png`);
      renderMap(map, file);
      expect(fs.existsSync(file)).toBe(true);
    }
  });
});
