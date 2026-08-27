/**
 * 하이브리드 개선안 프로토타입 — LLM 의도(intent) + 코드 정규화/시공/정리.
 *
 *   npx vite-node --script scripts/adv-interior-hybrid.mts -- <casesJson> <outDir>
 *
 * 케이스마다 3단 렌더를 낸다.
 *   a-raw       : LLM 플랜 그대로 시공 (현행)
 *   b-norm      : 코드 정규화기(여백·갭·임계·내부문 자동 보정 + 도달성 재시도) 통과 후 시공
 *   c-composed  : 정규화 + 구성 패스(기물 예산 정리 → 중앙 초점 클러스터)
 *
 * 기존 파이프라인은 건드리지 않는다. 전부 산출물 후처리/전처리로만 구현한 제안 프로토타입.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import {
  evaluateInteriorRoom,
  floorMaskFromPlan,
  reachableOpenCells,
  runInteriorRoomPipeline,
  VR,
  type InteriorRoomPlan,
  type RoomSpec,
} from "../src/editor/interiorRoomPipeline.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { isPassable } from "../src/project/collision.ts";
import type { GameMap } from "../src/project/types.ts";

const TILE = 16;
const COLS = 30;
const SCALE = 2;
const EMPTY = -1;

const [casesJson, outDirArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!casesJson || !outDirArg) throw new Error("usage: adv-interior-hybrid.mts <casesJson> <outDir>");
const outDir = path.resolve(outDirArg);
fs.mkdirSync(outDir, { recursive: true });

const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-interior-transparent.png"));
const project = createBlankProject();
const tileset = project.tilesets.easyrpg_chipset_interior!;

// ── 렌더 ─────────────────────────────────────────────────────────────────────

function blitTile(dst: PNG, tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void {
  if (tile < 0) return;
  const sx0 = (tile % COLS) * TILE + (q?.sx ?? 0);
  const sy0 = Math.floor(tile / COLS) * TILE + (q?.sy ?? 0);
  const sw = q?.sw ?? TILE;
  const sh = q?.sh ?? TILE;
  for (let y = 0; y < sh * SCALE; y += 1) {
    for (let x = 0; x < sw * SCALE; x += 1) {
      const si = ((sy0 + Math.floor(y / SCALE)) * chip.width + (sx0 + Math.floor(x / SCALE))) * 4;
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
      const dx = x * TILE * SCALE;
      const dy = y * TILE * SCALE;
      const comp = chipsetQuarterComposition(map, tileset, x, y);
      if (comp) {
        blitTile(png, comp.underlayTile ?? map.lowerTiles[i]!, dx, dy);
        for (const s of comp.sources) {
          blitTile(png, s.tile, dx + s.offsetX * SCALE, dy + s.offsetY * SCALE, { sx: s.offsetX, sy: s.offsetY, sw: 8, sh: 8 });
        }
      } else if (map.lowerTiles[i]! >= 0) blitTile(png, map.lowerTiles[i]!, dx, dy);
      if (map.upperTiles[i]! >= 0) blitTile(png, map.upperTiles[i]!, dx, dy);
    }
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

// ── 기물 분류 ────────────────────────────────────────────────────────────────

type PropRole = "essential" | "focal" | "accent" | "filler";

const ROLE_OF_TILE = new Map<number, { cls: string; role: PropRole }>();
function reg(role: PropRole, cls: string, ...tiles: number[]): void {
  for (const t of tiles) ROLE_OF_TILE.set(t, { cls, role });
}
// 절대 제거 금지 — 테마 필수 역할
reg("essential", "bed", VR.BED_L, VR.BED_R, VR.BED_V_HEAD, VR.BED_V_FOOT);
reg("essential", "stove", VR.STOVE_TOP, VR.STOVE_BOT);
reg("essential", "counter", VR.COUNTER_L, VR.COUNTER_M, VR.COUNTER_R);
reg("essential", "bookshelf", VR.BOOK_TL, VR.BOOK_TR, VR.BOOK_ML, VR.BOOK_MR, VR.BOOK_BL, VR.BOOK_BR);
reg("essential", "hearth", VR.HEARTH);
reg("essential", "stairs", VR.STAIRS_L, VR.STAIRS_M, VR.STAIRS_R, VR.STAIRS_DOWN, VR.LADDER);
// 초점 — 방의 주인공. 예산에서 우선 보존
reg("focal", "longTable", VR.TABLE_L, VR.TABLE_R, VR.TABLE_R3, VR.TABLE_TOP, VR.TABLE_BOT);
reg("focal", "tableSet", VR.SQUARE_TABLE);
reg("focal", "seat", VR.CHAIR_LEFT, VR.CHAIR_RIGHT, VR.STOOL);
reg("focal", "piano", VR.PIANO_L, VR.PIANO_M, VR.PIANO_R);
reg("focal", "crystal", VR.CRYSTAL_BALL);
// 악센트 — 성격 부여용 장식. 방마다 1~2개면 충분
reg("accent", "picture", VR.PICTURE_L, VR.PICTURE_R);
reg("accent", "window", VR.WINDOW);
reg("accent", "mirror", VR.MIRROR_T, VR.MIRROR_B);
reg("accent", "clock", VR.CLOCK_T, VR.CLOCK_B);
reg("accent", "bust", VR.BUST_T, VR.BUST_B);
reg("accent", "armor", VR.ARMOR_T, VR.ARMOR_B);
reg("accent", "display", VR.DISPLAY_T, VR.DISPLAY_B);
reg("accent", "religious", VR.RELIGIOUS);
reg("accent", "swordRack", VR.SWORD_RACK);
reg("accent", "sign", VR.TAVERN_SIGN);
reg("accent", "plant", VR.PLANT);
reg("accent", "cabinet", VR.CABINET_U, VR.CABINET_L);
reg("accent", "shelf", VR.FRUIT_SHELF, VR.SHELF_JARS);
// 필러 — 사분면 채우기용 적재물. 어수선함의 주범
reg("filler", "barrel", VR.BARREL);
reg("filler", "crate", VR.CRATE);
reg("filler", "box", VR.BOX);
reg("filler", "grain", VR.GRAIN);
reg("filler", "jars", VR.JARS);
reg("filler", "bucket", VR.BUCKET);
reg("filler", "kettle", VR.KETTLE);
reg("filler", "cauldron", VR.CAULDRON);
reg("filler", "debris", VR.BROKEN_GLASS);

type Instance = { cls: string; role: PropRole; cells: Array<{ x: number; y: number }>; cx: number; cy: number; lower: boolean };

/** 하단(lower)에 쓰이는 멀티타일 세트 — 서가·화덕 하단·카운터. 제거 불가(엔진 계약상 벽 취급). */
const LOWER_SETS = new Map<number, { cls: string; role: PropRole }>([
  ...[VR.BOOK_TL, VR.BOOK_TR, VR.BOOK_ML, VR.BOOK_MR, VR.BOOK_BL, VR.BOOK_BR].map(
    (t) => [t, { cls: "bookshelf", role: "essential" as PropRole }] as const,
  ),
  [VR.STOVE_BOT, { cls: "stove", role: "essential" as PropRole }],
  ...[VR.COUNTER_L, VR.COUNTER_M, VR.COUNTER_R].map((t) => [t, { cls: "counter", role: "essential" as PropRole }] as const),
]);

/** 방 bbox + 위쪽 벽면 2행(벽걸이 밴드)에서 소품을 연결요소로 묶는다. 상단 타일 + 하단 멀티세트 모두. */
function extractInstances(map: GameMap, room: RoomSpec): Instance[] {
  const w = map.width;
  const band = { x0: room.x, x1: room.x + room.w - 1, y0: room.y - 2, y1: room.y + room.h - 1 };
  const seen = new Set<number>();
  const out: Instance[] = [];
  for (let y = band.y0; y <= band.y1; y += 1) {
    for (let x = band.x0; x <= band.x1; x += 1) {
      if (x < 0 || y < 0 || x >= w || y >= map.height) continue;
      const i = y * w + x;
      if (seen.has(i)) continue;
      const t = map.upperTiles[i]!;
      const lowerMeta = LOWER_SETS.get(map.lowerTiles[i]!);
      const meta = (t >= 0 ? ROLE_OF_TILE.get(t) : undefined) ?? lowerMeta;
      if (!meta) continue;
      const isLower = !(t >= 0 && ROLE_OF_TILE.has(t));
      // 같은 클래스끼리 8방향 연결 → 하나의 기물 인스턴스
      const cells: Array<{ x: number; y: number }> = [];
      const stack = [{ x, y }];
      seen.add(i);
      while (stack.length) {
        const c = stack.pop()!;
        cells.push(c);
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = c.x + dx;
            const ny = c.y + dy;
            if (nx < band.x0 || nx > band.x1 || ny < band.y0 || ny > band.y1) continue;
            const ni = ny * w + nx;
            if (seen.has(ni)) continue;
            const nt = map.upperTiles[ni]!;
            const nmeta = (nt >= 0 ? ROLE_OF_TILE.get(nt) : undefined) ?? LOWER_SETS.get(map.lowerTiles[ni]!);
            if (!nmeta || nmeta.cls !== meta.cls) continue;
            seen.add(ni);
            stack.push({ x: nx, y: ny });
          }
        }
      }
      out.push({
        cls: meta.cls,
        role: meta.role,
        cells,
        cx: cells.reduce((s, c) => s + c.x, 0) / cells.length,
        cy: cells.reduce((s, c) => s + c.y, 0) / cells.length,
        lower: isLower,
      });
    }
  }
  return out;
}

// ── 구성 패스 1 · 기물 예산 정리 ─────────────────────────────────────────────

export type ClutterLevel = "minimal" | "spare" | "lived-in" | "packed";
const CLUTTER_MULT: Record<ClutterLevel, number> = { minimal: 0.35, spare: 0.7, "lived-in": 1, packed: 1.35 };
/** 테마별 허용 어수선함 — 창고는 쌓여 있어야 정상, 침실·서재는 비어야 정상. */
const THEME_TOLERANCE: Record<string, number> = {
  storage: 2,
  kitchen: 1.2,
  tavern: 1.1,
  dining: 0.9,
  bedroom: 0.8,
  study: 0.8,
  corridor: 0.4,
};

type DeclutterLog = { room: string; area: number; before: number; after: number; budget: number; dropped: string[] };

function declutterRoom(map: GameMap, room: RoomSpec, floor: boolean[], clutter: ClutterLevel): DeclutterLog {
  const w = map.width;
  const cells: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < room.h; dy += 1) {
    for (let dx = 0; dx < room.w; dx += 1) {
      const x = room.x + dx;
      const y = room.y + dy;
      if (floor[y * w + x]) cells.push({ x, y });
    }
  }
  const area = cells.length;
  const instances = extractInstances(map, room);
  const theme = String(room.theme ?? "dining");
  // 예산: 바닥 10칸당 1기물 × 테마 관용도 × LLM이 지정한 생활감. 필수/초점은 예산 밖.
  const budget = Math.max(2, Math.round((area / 10) * CLUTTER_MULT[clutter] * (THEME_TOLERANCE[theme] ?? 1)));
  const trimmable = instances.filter((i) => i.role === "accent" || i.role === "filler");
  const fixed = instances.length - trimmable.length;
  // 방을 텅 비우지 않는다. 적재 테마(창고·주방)는 군집화 단계에 쓸 재료를 남긴다.
  const minKeep = clutter === "minimal" ? 0 : theme === "storage" ? 4 : theme === "kitchen" || theme === "tavern" ? 3 : 2;
  const keepCount = Math.min(trimmable.length, Math.max(minKeep, budget - fixed));

  // 보존 우선순위: 악센트 > 필러, 클래스 첫 등장 > 중복.
  const seenCls = new Set<string>();
  const scored = trimmable
    .map((inst) => {
      const firstOfCls = !seenCls.has(inst.cls);
      seenCls.add(inst.cls);
      return { inst, keepScore: (inst.role === "accent" ? 3 : 0) + (firstOfCls ? 2 : 0) };
    })
    .sort((a, b) => b.keepScore - a.keepScore);

  const dropped: string[] = [];
  scored.forEach((s, idx) => {
    if (idx < keepCount) return;
    if (s.inst.lower) return; // 하단 세트는 제거 불가(엔진 계약)
    for (const c of s.inst.cells) map.upperTiles[c.y * w + c.x] = EMPTY;
    dropped.push(s.inst.cls);
  });
  return { room: room.id, area, before: instances.length, after: instances.length - dropped.length, budget, dropped };
}

// ── 구성 패스 2 · 중앙 초점 클러스터 ────────────────────────────────────────

const RUG_TEAL = [
  [279, 280, 281],
  [309, 310, 311],
  [339, 340, 341],
];
const RUG_RED = [
  [375, 376, 377],
  [405, 406, 407],
  [435, 436, 437],
];
const RUG_MAT = [
  [108, 109, 110],
  [138, 139, 140],
  [168, 169, 170],
];

const RUG_TILES = new Set<number>([...RUG_TEAL.flat(), ...RUG_RED.flat(), ...RUG_MAT.flat()]);

type FocalKind = "long-table" | "table-set" | "reading-nook" | "work-island" | "none";

const FOCAL_BY_THEME: Record<string, FocalKind> = {
  dining: "long-table",
  tavern: "long-table",
  bedroom: "reading-nook",
  study: "reading-nook",
  kitchen: "work-island",
  storage: "none",
  corridor: "none",
};

type FocalLog = { room: string; kind: FocalKind; placed: boolean; reason?: string };

function focalRoom(map: GameMap, room: RoomSpec, floor: boolean[], door: { x: number; y: number }, kindOverride?: FocalKind): FocalLog {
  const theme = String(room.theme ?? "dining");
  const kind = kindOverride ?? FOCAL_BY_THEME[theme] ?? "none";
  if (kind === "none") return { room: room.id, kind, placed: false, reason: "테마상 여백이 정답" };
  const w = map.width;
  const area = room.w * room.h;
  if (area < 24) return { room: room.id, kind, placed: false, reason: "면적 24 미만" };
  // 이미 방 중앙에 초점 가구가 있으면 덧놓지 않는다.
  const midX0 = room.x + (room.w - 1) / 2;
  const midY0 = room.y + (room.h - 1) / 2;
  if (extractInstances(map, room).some((i) => i.role === "focal" && Math.abs(i.cx - midX0) <= 1.2 && Math.abs(i.cy - midY0) <= 1.2)) {
    return { room: room.id, kind, placed: false, reason: "이미 중앙 초점 있음" };
  }
  // 이미 러그로 역할 지역이 직혀진 방(침대 러그 등)은 건드리지 않는다 — 러그 위 탁자 중첩 방지.
  for (let dy = 0; dy < room.h; dy += 1) {
    for (let dx = 0; dx < room.w; dx += 1) {
      if (RUG_TILES.has(map.lowerTiles[(room.y + dy) * map.width + (room.x + dx)]!)) {
        return { room: room.id, kind, placed: false, reason: "기존 러그 지역 유지" };
      }
    }
  }

  const snapshotU = map.upperTiles.slice();
  const snapshotL = map.lowerTiles.slice();
  const free = (x: number, y: number) => floor[y * w + x] === true && map.upperTiles[y * w + x]! < 0 && isPassable(project, map, x, y);

  // 중앙 후보: 방 중심에서 가까운 순. 벽에서 최소 1칸 띄우고, 문 행/열은 피한다.
  const cx0 = room.x + (room.w - 1) / 2;
  const cy0 = room.y + (room.h - 1) / 2;
  const cands: Array<{ x: number; y: number; d: number }> = [];
  for (let y = room.y + 1; y <= room.y + room.h - 2; y += 1) {
    for (let x = room.x + 1; x <= room.x + room.w - 2; x += 1) {
      cands.push({ x, y, d: Math.abs(x - cx0) + Math.abs(y - cy0) });
    }
  }
  cands.sort((a, b) => a.d - b.d);

  // 1차: 러그 포함 3×3 여유 / 2차: 러그 없이 가구 폭만 확보
  for (const pass of ["rug", "bare"] as const) {
  for (const c of cands) {
    const need: Array<[number, number]> =
      pass === "rug"
        ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
        : kind === "long-table"
          ? [[-1, 0], [0, 0], [1, 0]]
          : [[0, 0], [1, 0]];
    if (!need.every(([dx, dy]) => free(c.x + dx, c.y + dy))) continue;
    if (pass === "rug") {
      const rug = theme === "bedroom" ? RUG_TEAL : theme === "kitchen" ? RUG_MAT : RUG_RED;
      for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) map.lowerTiles[(c.y - 1 + dy) * w + (c.x - 1 + dx)] = rug[dy]![dx]!;
    }

    if (kind === "long-table") {
      map.upperTiles[c.y * w + (c.x - 1)] = VR.TABLE_L;
      map.upperTiles[c.y * w + c.x] = VR.TABLE_R3 - 1; // 몸통(326)
      map.upperTiles[c.y * w + (c.x + 1)] = VR.TABLE_R3;
      if (free(c.x - 1, c.y - 1)) map.upperTiles[(c.y - 1) * w + (c.x - 1)] = VR.STOOL;
      if (free(c.x + 1, c.y - 1)) map.upperTiles[(c.y - 1) * w + (c.x + 1)] = VR.STOOL;
      if (free(c.x, c.y + 1)) map.upperTiles[(c.y + 1) * w + c.x] = VR.STOOL;
    } else if (kind === "table-set" || kind === "reading-nook") {
      map.upperTiles[c.y * w + c.x] = VR.SQUARE_TABLE;
      if (free(c.x + 1, c.y)) map.upperTiles[c.y * w + (c.x + 1)] = VR.CHAIR_LEFT;
      if (free(c.x - 1, c.y)) map.upperTiles[c.y * w + (c.x - 1)] = VR.CHAIR_RIGHT;
      if (theme === "study" && free(c.x, c.y - 1)) map.upperTiles[(c.y - 1) * w + c.x] = VR.CRYSTAL_BALL;
    } else if (kind === "work-island") {
      map.upperTiles[c.y * w + c.x] = VR.SQUARE_TABLE;
      if (free(c.x + 1, c.y)) map.upperTiles[c.y * w + (c.x + 1)] = VR.JARS;
      if (free(c.x - 1, c.y)) map.upperTiles[c.y * w + (c.x - 1)] = VR.KETTLE;
    }

    // 놓고-검증-되돌리기: 문에서 모든 개방 셀 도달 가능해야 한다.
    const reach = reachableOpenCells(map, floor, door);
    let sealed = false;
    for (let y = 0; y < map.height && !sealed; y += 1) {
      for (let x = 0; x < w && !sealed; x += 1) {
        const i = y * w + x;
        if (!floor[i] || map.upperTiles[i]! >= 0) continue;
        if (!isPassable(project, map, x, y)) continue;
        if (!reach.has(i)) sealed = true;
      }
    }
    if (sealed) {
      map.upperTiles.splice(0, map.upperTiles.length, ...snapshotU);
      map.lowerTiles.splice(0, map.lowerTiles.length, ...snapshotL);
      continue;
    }
    return { room: room.id, kind, placed: true, reason: pass === "rug" ? "러그+가구" : "가구만(러그 자리 부족)" };
  }
  }
  return { room: room.id, kind, placed: false, reason: "중앙 여유 없음" };
}

// ── 구성 패스 3 · 적재물 군집화 ──────────────────────────────────────────────

type ClusterLog = { room: string; moved: number; anchor?: string };

/**
 * 살아남은 필러(통·상자 등 1칸 소품)를 방 한 구석으로 모아 '적재 코너'로 읽히게 한다.
 * 같은 개수라도 흩뿌리면 어수선하고 뭉치면 정돈돼 보인다 — 개수보다 배열이 문제.
 */
function clusterFillers(map: GameMap, room: RoomSpec, floor: boolean[], door: { x: number; y: number }): ClusterLog {
  const w = map.width;
  const inst = extractInstances(map, room).filter((i) => i.role === "filler" && i.cells.length === 1 && !i.lower);
  if (inst.length < 2) return { room: room.id, moved: 0 };

  const focal = extractInstances(map, room).filter((i) => i.role === "focal" || i.role === "essential");
  const fx = focal.length ? focal.reduce((s, i) => s + i.cx, 0) / focal.length : room.x + room.w / 2;
  const fy = focal.length ? focal.reduce((s, i) => s + i.cy, 0) / focal.length : room.y + room.h / 2;

  // 앵커 코너: 문·초점에서 가장 먼 구석
  const corners = [
    { x: room.x, y: room.y, name: "북서" },
    { x: room.x + room.w - 1, y: room.y, name: "북동" },
    { x: room.x, y: room.y + room.h - 1, name: "남서" },
    { x: room.x + room.w - 1, y: room.y + room.h - 1, name: "남동" },
  ].sort(
    (a, b) =>
      Math.hypot(b.x - fx, b.y - fy) + Math.hypot(b.x - door.x, b.y - door.y) - (Math.hypot(a.x - fx, a.y - fy) + Math.hypot(a.x - door.x, a.y - door.y)),
  );
  const anchor = corners[0]!;

  // 앵커 주변 벽 인접 칸을 가까운 순으로 슬롯화
  const slots: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < room.h; dy += 1) {
    for (let dx = 0; dx < room.w; dx += 1) {
      const x = room.x + dx;
      const y = room.y + dy;
      if (!floor[y * w + x]) continue;
      const wallAdj = x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
      if (!wallAdj) continue;
      slots.push({ x, y });
    }
  }
  slots.sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y));

  const payload = inst.map((i) => ({ tile: map.upperTiles[i.cells[0]!.y * w + i.cells[0]!.x]!, from: i.cells[0]! }));
  const snapshotU = map.upperTiles.slice();
  for (const p of payload) map.upperTiles[p.from.y * w + p.from.x] = EMPTY;

  let moved = 0;
  let si = 0;
  for (const p of payload) {
    while (si < slots.length) {
      const s = slots[si]!;
      si += 1;
      if (s.x === door.x && s.y === door.y) continue;
      if (map.upperTiles[s.y * w + s.x]! >= 0 || !isPassable(project, map, s.x, s.y)) continue;
      map.upperTiles[s.y * w + s.x] = p.tile;
      const reach = reachableOpenCells(map, floor, door);
      let sealed = false;
      for (let y = 0; y < map.height && !sealed; y += 1) {
        for (let x = 0; x < w && !sealed; x += 1) {
          const i2 = y * w + x;
          if (!floor[i2] || map.upperTiles[i2]! >= 0 || !isPassable(project, map, x, y)) continue;
          if (!reach.has(i2)) sealed = true;
        }
      }
      if (sealed) {
        map.upperTiles[s.y * w + s.x] = EMPTY;
        continue;
      }
      if (s.x !== p.from.x || s.y !== p.from.y) moved += 1;
      break;
    }
  }
  // 전부 재배치 실패하면 원상복구
  const placed = payload.filter((p) => true).length;
  if (placed === 0) {
    map.upperTiles.splice(0, map.upperTiles.length, ...snapshotU);
    return { room: room.id, moved: 0 };
  }
  return { room: room.id, moved, anchor: anchor.name };
}

// ── 코드 정규화기 (LLM 플랜 → 안전 플랜) ────────────────────────────────────

type NormAction = { rule: string; detail: string };

function normalizePlan(plan: InteriorRoomPlan): { plan: InteriorRoomPlan; actions: NormAction[] } {
  const actions: NormAction[] = [];
  let rooms = (plan.rooms ?? []).map((r) => ({ ...r }));
  let innerDoors = (plan.innerDoors ?? []).map((d) => ({ ...d }));
  let door = { ...plan.door };
  let width = plan.width;
  let height = plan.height;

  // R1 · 천장 여백: 방 최상단은 y>=3 (벽면 2행 + 트림)
  const minY = Math.min(...rooms.map((r) => r.y));
  if (rooms.length && minY < 3) {
    const dy = 3 - minY;
    rooms = rooms.map((r) => ({ ...r, y: r.y + dy }));
    innerDoors = innerDoors.map((d) => ({ ...d, y: d.y + dy }));
    door = { ...door, y: door.y + dy };
    height += dy;
    actions.push({ rule: "ceiling-margin", detail: `방 전체 y+${dy}, 맵 높이 ${plan.height}→${height}` });
  }

  // R2 · 서가 이중열 봉쇄 임계 회피: 서재 면적 48 이상이면 폭을 줄인다
  rooms = rooms.map((r) => {
    if (String(r.theme) !== "study") return r;
    const area = r.w * r.h;
    if (area < 48) return r;
    let w2 = r.w;
    while (w2 > 5 && w2 * r.h >= 48) w2 -= 1;
    actions.push({ rule: "shelf-mine", detail: `서재 '${r.id}' 폭 ${r.w}→${w2} (면적 ${area}→${w2 * r.h}, 서가 이중열 봉쇄 회피)` });
    return { ...r, w: w2 };
  });

  // R3 · 남·동 여백: 맵 경계에 방이 붙지 않게 최소 2칸
  const maxX = Math.max(...rooms.map((r) => r.x + r.w - 1));
  const maxY = Math.max(...rooms.map((r) => r.y + r.h - 1));
  if (maxX + 2 >= width) {
    const nw = maxX + 3;
    actions.push({ rule: "edge-margin", detail: `맵 폭 ${width}→${nw}` });
    width = nw;
  }
  if (maxY + 2 >= height) {
    const nh = maxY + 3;
    actions.push({ rule: "edge-margin", detail: `맵 높이 ${height}→${nh}` });
    height = nh;
  }

  // R4 · 내부 문 자동 보강: 인접 방 쌍마다 개구부가 없으면 파티션 중앙에 뚫는다
  const hasDoorNear = (x: number, y: number) => innerDoors.some((d) => d.x === x && Math.abs(d.y - y) <= 1) || innerDoors.some((d) => d.y === y && Math.abs(d.x - x) <= 1);
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      const [l, r] = a.x <= b.x ? [a, b] : [b, a];
      // 세로 파티션(좌우 인접, 갭 1열)
      if (l.x + l.w === r.x - 1) {
        const y0 = Math.max(l.y, r.y);
        const y1 = Math.min(l.y + l.h, r.y + r.h) - 1;
        if (y1 >= y0) {
          const gx = l.x + l.w;
          const gy = Math.floor((y0 + y1) / 2);
          if (!innerDoors.some((d) => d.x === gx && d.y >= y0 && d.y <= y1)) {
            innerDoors.push({ x: gx, y: gy });
            actions.push({ rule: "auto-inner-door", detail: `'${l.id}'↔'${r.id}' 세로 개구부 (${gx},${gy}) 추가` });
          }
        }
      }
      const [t, bt] = a.y <= b.y ? [a, b] : [b, a];
      // 가로 파티션(상하 인접, 갭 3행)
      if (t.y + t.h + 2 === bt.y) {
        const x0 = Math.max(t.x, bt.x);
        const x1 = Math.min(t.x + t.w, bt.x + bt.w) - 1;
        if (x1 >= x0) {
          const gy = t.y + t.h;
          const gx = Math.floor((x0 + x1) / 2);
          if (!innerDoors.some((d) => d.y === gy && d.x >= x0 && d.x <= x1)) {
            innerDoors.push({ x: gx, y: gy });
            actions.push({ rule: "auto-inner-door", detail: `'${t.id}'↔'${bt.id}' 가로 개구부 (${gx},${gy}) 추가` });
          }
        }
      }
      void hasDoorNear;
    }
  }

  return { plan: { ...plan, width, height, rooms, innerDoors, door }, actions };
}

/** 도달성 실패 시 내부 문 행/열을 밀어보며 재시공 — '코드가 검증까지 책임진다'. */
function buildWithRetry(plan: InteriorRoomPlan): { plan: InteriorRoomPlan; map: GameMap; attempts: number; retryLog: string[] } {
  const retryLog: string[] = [];
  let current = plan;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const built = runInteriorRoomPipeline(current);
    const ev = evaluateInteriorRoom(built.map, current);
    const bad = ev.issues.find((s) => s.includes("walkability") || s.includes("도달"));
    if (!bad) return { plan: current, map: built.map, attempts: attempt + 1, retryLog };
    // 개구부를 한 칸씩 옮겨본다(세로 문은 y, 가로 문은 x)
    const rooms = current.rooms ?? [];
    const shifted = (current.innerDoors ?? []).map((d) => {
      const vertical = rooms.some((r) => r.x + r.w === d.x);
      return vertical ? { ...d, y: d.y + (attempt % 2 === 0 ? 1 : -2) } : { ...d, x: d.x + (attempt % 2 === 0 ? 1 : -2) };
    });
    retryLog.push(`시도 ${attempt + 1}: ${bad} → 개구부 이동 재시공`);
    current = { ...current, innerDoors: shifted };
  }
  const built = runInteriorRoomPipeline(current);
  return { plan: current, map: built.map, attempts: 7, retryLog };
}

// ── 지표 ─────────────────────────────────────────────────────────────────────

function metrics(map: GameMap, plan: InteriorRoomPlan) {
  const floor = floorMaskFromPlan(plan);
  const w = map.width;
  const rooms = (plan.rooms ?? []).map((room) => {
    const cells: Array<{ x: number; y: number }> = [];
    for (let dy = 0; dy < room.h; dy += 1) {
      for (let dx = 0; dx < room.w; dx += 1) {
        const x = room.x + dx;
        const y = room.y + dy;
        if (floor[y * w + x]) cells.push({ x, y });
      }
    }
    const area = cells.length || 1;
    const inst = extractInstances(map, room);
    const occ = cells.filter((c) => map.upperTiles[c.y * w + c.x]! >= 0 || !isPassable(project, map, c.x, c.y));
    // 벽 인접 비율: 기물 중심이 방 경계 1칸 이내인 비율
    const wallHug = inst.filter(
      (i) => i.cx <= room.x + 0.5 || i.cx >= room.x + room.w - 1.5 || i.cy <= room.y + 0.5 || i.cy >= room.y + room.h - 1.5,
    ).length;
    const midX = room.x + (room.w - 1) / 2;
    const midY = room.y + (room.h - 1) / 2;
    const centerOccupied = inst.some((i) => Math.abs(i.cx - midX) <= 1.2 && Math.abs(i.cy - midY) <= 1.2);
    const byRole: Record<string, number> = {};
    for (const i of inst) byRole[i.role] = (byRole[i.role] ?? 0) + 1;
    return {
      id: room.id,
      theme: String(room.theme ?? plan.theme),
      area,
      instances: inst.length,
      instPer10: Number(((inst.length / area) * 10).toFixed(2)),
      byRole,
      wallHugRatio: Number((inst.length ? wallHug / inst.length : 0).toFixed(2)),
      centerOccupied,
      fill: Number((occ.length / area).toFixed(2)),
      classes: [...new Set(inst.map((i) => i.cls))].sort(),
    };
  });
  const ev = evaluateInteriorRoom(map, plan);
  return {
    score: ev.score,
    ok: ev.ok,
    issues: ev.issues,
    totalInstances: rooms.reduce((s, r) => s + r.instances, 0),
    centerRooms: rooms.filter((r) => r.centerOccupied).length,
    rooms,
  };
}

// ── 실행 ─────────────────────────────────────────────────────────────────────

type Case = { id: string; label: string; brief?: string; clutter?: ClutterLevel; focal?: Record<string, FocalKind>; plan: InteriorRoomPlan };
const spec = JSON.parse(fs.readFileSync(casesJson, "utf8")) as { cases: Case[] };
const report: unknown[] = [];

for (const c of spec.cases) {
  const clutter = c.clutter ?? "lived-in";

  // a · 현행
  const rawBuilt = runInteriorRoomPipeline(c.plan);
  renderMap(rawBuilt.map, path.join(outDir, `${c.id}-a-raw.png`));
  const rawMetrics = metrics(rawBuilt.map, c.plan);

  // b · 정규화 + 도달성 재시도
  const { plan: normPlan, actions } = normalizePlan(c.plan);
  const retried = buildWithRetry(normPlan);
  renderMap(retried.map, path.join(outDir, `${c.id}-b-norm.png`));
  const normMetrics = metrics(retried.map, retried.plan);

  // c · 구성 패스
  const composedBuilt = runInteriorRoomPipeline(retried.plan);
  const floor = floorMaskFromPlan(retried.plan);
  const declutterLogs: DeclutterLog[] = [];
  const focalLogs: FocalLog[] = [];
  for (const room of retried.plan.rooms ?? []) {
    declutterLogs.push(declutterRoom(composedBuilt.map, room, floor, clutter));
  }
  renderMap(composedBuilt.map, path.join(outDir, `${c.id}-c-declutter.png`));
  const declutterMetrics = metrics(composedBuilt.map, retried.plan);
  for (const room of retried.plan.rooms ?? []) {
    focalLogs.push(focalRoom(composedBuilt.map, room, floor, retried.plan.door, c.focal?.[room.id]));
  }
  const clusterLogs: ClusterLog[] = [];
  for (const room of retried.plan.rooms ?? []) {
    clusterLogs.push(clusterFillers(composedBuilt.map, room, floor, retried.plan.door));
  }
  renderMap(composedBuilt.map, path.join(outDir, `${c.id}-d-composed.png`));
  const composedMetrics = metrics(composedBuilt.map, retried.plan);

  report.push({
    id: c.id,
    label: c.label,
    brief: c.brief ?? "",
    clutter,
    size: { width: retried.plan.width, height: retried.plan.height },
    normPlan: retried.plan,
    normalizer: actions,
    retry: { attempts: retried.attempts, log: retried.retryLog },
    declutter: declutterLogs,
    focal: focalLogs,
    cluster: clusterLogs,
    stages: { raw: rawMetrics, norm: normMetrics, declutter: declutterMetrics, composed: composedMetrics },
    png: {
      raw: `${c.id}-a-raw.png`,
      norm: `${c.id}-b-norm.png`,
      declutter: `${c.id}-c-declutter.png`,
      composed: `${c.id}-d-composed.png`,
    },
  });

  const dropped = declutterLogs.reduce((s, d) => s + d.dropped.length, 0);
  const focalOk = focalLogs.filter((f) => f.placed).length;
  console.log(
    `${c.id.padEnd(22)} score ${String(rawMetrics.score).padStart(3)}→${String(composedMetrics.score).padStart(3)}  ` +
      `기물 ${rawMetrics.totalInstances}→${composedMetrics.totalInstances}(정리 ${dropped})  ` +
      `중앙채움 ${rawMetrics.centerRooms}→${composedMetrics.centerRooms}방(초점 ${focalOk})  ` +
      `군집이동 ${clusterLogs.reduce((s, l) => s + l.moved, 0)}  ` +
      `정규화 ${actions.length}건 재시도 ${retried.attempts}`,
  );
}

fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log("wrote", path.join(outDir, "report.json"));
