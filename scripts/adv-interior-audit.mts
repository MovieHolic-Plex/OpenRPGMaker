/**
 * 적대적 실내 감사 하네스 — LLM 저작 플랜 vs 코드 템플릿을 같은 파이프라인에 통과시키고
 * PNG + 내장 평가 + 추가 적대 지표를 한 번에 뽑는다.
 *
 *   npx vite-node --script scripts/adv-interior-audit.mts -- <plansJson> <outDir>
 *
 * plansJson: { cases: [{ id, label, source, brief, plan }] }  (plan = InteriorRoomPlan)
 *            source "code:<scale>:<program>" 이면 houseInteriors 템플릿을 대신 쓴다.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import {
  evaluateInteriorRoom,
  floorMaskFromPlan,
  runInteriorRoomPipeline,
  type InteriorRoomPlan,
} from "../src/editor/interiorRoomPipeline.ts";
import { buildHouseInteriorPlan, type HouseInteriorProgram, type HouseInteriorScale } from "../src/editor/houseInteriors.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { GameMap } from "../src/project/types.ts";

const TILE = 16;
const COLS = 30;
const SCALE = 2;

const [plansJson, outDirArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!plansJson || !outDirArg) throw new Error("usage: adv-interior-audit.mts <plansJson> <outDir>");
const outDir = path.resolve(outDirArg);
fs.mkdirSync(outDir, { recursive: true });

const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png"));
const tileset = createBlankProject().tilesets.easyrpg_chipset_interior!;

function blitTile(
  dst: PNG,
  tile: number,
  dx: number,
  dy: number,
  scale: number,
  q?: { sx: number; sy: number; sw: number; sh: number },
): void {
  if (tile < 0) return;
  const sx0 = (tile % COLS) * TILE + (q?.sx ?? 0);
  const sy0 = Math.floor(tile / COLS) * TILE + (q?.sy ?? 0);
  const sw = q?.sw ?? TILE;
  const sh = q?.sh ?? TILE;
  for (let y = 0; y < sh * scale; y += 1) {
    for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      if (chip.data[si + 3]! === 0) continue;
      const di = ((dy + y) * dst.width + (dx + x)) * 4;
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
    png.data[i] = 18;
    png.data[i + 1] = 16;
    png.data[i + 2] = 22;
    png.data[i + 3] = 255;
  }
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      const lower = map.lowerTiles[i]!;
      const upper = map.upperTiles[i]!;
      const dx = x * TILE * SCALE;
      const dy = y * TILE * SCALE;
      const comp = chipsetQuarterComposition(map, tileset, x, y);
      if (comp) {
        blitTile(png, comp.underlayTile ?? lower, dx, dy, SCALE);
        for (const src of comp.sources) {
          blitTile(png, src.tile, dx + src.offsetX * SCALE, dy + src.offsetY * SCALE, SCALE, {
            sx: src.offsetX,
            sy: src.offsetY,
            sw: 8,
            sh: 8,
          });
        }
      } else if (lower >= 0) blitTile(png, lower, dx, dy, SCALE);
      if (upper >= 0) blitTile(png, upper, dx, dy, SCALE);
    }
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

// ── 적대 지표 ────────────────────────────────────────────────────────────────

type RoomMetric = {
  id: string;
  theme: string;
  area: number;
  occupied: number;
  fill: number;
  emptyRatio: number;
  northBias: number;
  distinctProps: number;
  largestEmptyRect: number;
  propSignature: string;
};

function adversarialMetrics(map: GameMap, plan: InteriorRoomPlan) {
  const floor = floorMaskFromPlan(plan);
  const w = map.width;
  const isOcc = (x: number, y: number) => map.upperTiles[y * w + x]! >= 0;
  const rooms = plan.rooms ?? [];
  const roomMetrics: RoomMetric[] = [];

  for (const room of rooms) {
    const cells: Array<{ x: number; y: number }> = [];
    for (let dy = 0; dy < room.h; dy += 1) {
      for (let dx = 0; dx < room.w; dx += 1) {
        const x = room.x + dx;
        const y = room.y + dy;
        if (floor[y * w + x]) cells.push({ x, y });
      }
    }
    const area = cells.length;
    const occ = cells.filter((c) => isOcc(c.x, c.y));
    const props = new Map<number, number>();
    for (const c of occ) props.set(map.upperTiles[c.y * w + c.x]!, (props.get(map.upperTiles[c.y * w + c.x]!) ?? 0) + 1);
    const topThird = room.y + Math.max(1, Math.floor(room.h / 3));
    const north = occ.filter((c) => c.y < topThird).length;
    // 최대 빈 직사각형(가구·벽 없는 연속 바닥) — 시각적 죽은 공간 크기
    const grid: number[][] = [];
    for (let dy = 0; dy < room.h; dy += 1) {
      const row: number[] = [];
      for (let dx = 0; dx < room.w; dx += 1) {
        const x = room.x + dx;
        const y = room.y + dy;
        row.push(floor[y * w + x] && !isOcc(x, y) ? 1 : 0);
      }
      grid.push(row);
    }
    roomMetrics.push({
      id: room.id,
      theme: String(room.theme ?? plan.theme),
      area,
      occupied: occ.length,
      fill: area ? round(occ.length / area) : 0,
      emptyRatio: area ? round(1 - occ.length / area) : 1,
      northBias: occ.length ? round(north / occ.length) : 0,
      distinctProps: props.size,
      largestEmptyRect: largestRect(grid),
      propSignature: [...props.entries()].sort((a, b) => a[0] - b[0]).map(([t, n]) => `${t}x${n}`).join(","),
    });
  }

  // 같은 테마 방끼리 가구 구성이 완전히 같으면 '복붙'
  const twins: string[] = [];
  for (let i = 0; i < roomMetrics.length; i += 1) {
    for (let j = i + 1; j < roomMetrics.length; j += 1) {
      const a = roomMetrics[i]!;
      const b = roomMetrics[j]!;
      if (a.theme === b.theme && a.propSignature === b.propSignature && a.occupied > 0) {
        twins.push(`${a.id}=${b.id}`);
      }
    }
  }
  let floorCells = 0;
  let occupiedCells = 0;
  const allProps = new Set<number>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!floor[y * w + x]) continue;
      floorCells += 1;
      if (isOcc(x, y)) {
        occupiedCells += 1;
        allProps.add(map.upperTiles[y * w + x]!);
      }
    }
  }
  return {
    floorCells,
    occupiedCells,
    globalFill: floorCells ? round(occupiedCells / floorCells) : 0,
    distinctProps: allProps.size,
    twinRooms: twins,
    rooms: roomMetrics,
  };
}

function largestRect(grid: number[][]): number {
  if (grid.length === 0) return 0;
  const width = grid[0]!.length;
  const heights = new Array(width).fill(0) as number[];
  let best = 0;
  for (const row of grid) {
    for (let x = 0; x < width; x += 1) heights[x] = row[x] === 1 ? heights[x]! + 1 : 0;
    // histogram 최대 직사각형
    const stack: number[] = [];
    for (let x = 0; x <= width; x += 1) {
      const h = x === width ? 0 : heights[x]!;
      while (stack.length > 0 && heights[stack[stack.length - 1]!]! >= h) {
        const top = stack.pop()!;
        const left = stack.length ? stack[stack.length - 1]! + 1 : 0;
        best = Math.max(best, heights[top]! * (x - left));
      }
      stack.push(x);
    }
  }
  return best;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── 실행 ────────────────────────────────────────────────────────────────────

type CaseSpec = {
  id: string;
  label: string;
  source: string;
  brief?: string;
  note?: string;
  plan?: InteriorRoomPlan;
};

const spec = JSON.parse(fs.readFileSync(plansJson, "utf8")) as { cases: CaseSpec[] };
const report: unknown[] = [];

for (const c of spec.cases) {
  let plan: InteriorRoomPlan;
  if (c.source.startsWith("code:")) {
    const [, scale, program, seedRaw] = c.source.split(":");
    plan = buildHouseInteriorPlan({
      mapId: `map_${c.id}`,
      name: c.label,
      seed: Number(seedRaw ?? 7),
      scale: scale as HouseInteriorScale,
      program: program as HouseInteriorProgram,
    });
  } else {
    plan = c.plan!;
  }
  const run = runInteriorRoomPipeline(plan);
  const evaluation = evaluateInteriorRoom(run.map, plan);
  const adv = adversarialMetrics(run.map, plan);
  const file = path.join(outDir, `${c.id}.png`);
  renderMap(run.map, file);
  report.push({
    id: c.id,
    label: c.label,
    source: c.source,
    brief: c.brief ?? null,
    note: c.note ?? null,
    png: path.basename(file),
    size: { width: plan.width, height: plan.height },
    rooms: (plan.rooms ?? []).map((r) => ({ id: r.id, theme: r.theme ?? plan.theme, box: [r.x, r.y, r.w, r.h], floorTile: r.floorTile ?? null })),
    wallMaterial: plan.wallMaterial ?? null,
    seed: plan.seed ?? null,
    pipeline: { ok: run.ok, warnings: run.warnings, log: run.log },
    evaluation,
    adversarial: adv,
  });
  console.log(
    `${c.id.padEnd(26)} score=${String(evaluation.score).padStart(3)} ok=${evaluation.ok} fill=${adv.globalFill} props=${adv.distinctProps} warn=${run.warnings.length} twins=${adv.twinRooms.length}`,
  );
  for (const issue of evaluation.issues) console.log(`   · ${issue}`);
  for (const warning of run.warnings) console.log(`   ! ${warning}`);
}

fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log("wrote", path.join(outDir, "report.json"));
