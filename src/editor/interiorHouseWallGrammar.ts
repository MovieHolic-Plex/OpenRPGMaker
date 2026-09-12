/**
 * Deterministic house interior wall grammar — ceiling canon v2 (2026-07-20).
 *
 * 사용자 교정 2차: 천장 블록은 (0,0) 체커+비드(366 블록)가 아니라 **(0,1)
 * 검정+회암 테두리 오토타일**(앵커 369, body 430 — builtin_darkness_deep와 동일 블록)이다.
 *
 * - 천장(구조 질량·맵 바깥 어둠 전체) = 430 계열 오토타일 하나로 통일.
 *   테두리는 templateBlockFromAnchor(369) 변형을 **저장 시점에 성형**한다
 *   (shapeInteriorCeiling — 맵 밖은 이어진 것으로 취급, 경계 테두리 없음).
 * - 남향 구조 모서리(아래가 방 바닥)에는 반드시 벽면: 크림 2행(위 74–76 · 아래 104–106,
 *   1칸은 77/107). 반대로 모든 벽면 위에는 반드시 천장 — 쌍 불변식.
 * - 문은 천장 띠를 뚫는 바닥 통로만 — 스텝(397)·플랭크(396/398) 금지.
 * - 배제: 366 체커 블록 전체(366–368/396–398/426–428/456–458) · 233/257/258.
 */
import { HOUSE_SHELL_TILE } from "@/project/defaults/interiorHouseWallTiles";
import {
  DEFAULT_DARKNESS_DEEP_AUTOTILE_GROUP,
  templateBlockFromAnchor,
} from "@/project/defaults/autotileGroups";
import { AUTOTILE_DIR, autotileVariantForMask } from "@/project/defaults/autotileEngine";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";

export type DoorSpec = { readonly x: number; readonly y: number };

/**
 * 바깥 문의 실제 개구부. plan.door 는 홀 남쪽 행(방 안)이고, 천장 띠를 뚫은
 * 바닥 통로는 바로 아래 칸이다. 입구 표식 176 과 출입 이벤트는 여기 둔다 —
 * 방 안에 두면 크림 표식 남쪽에 바닥이 한 칸 더 남아 입구가 건너뛴 것처럼 보인다.
 */
export function southDoorOpening(door: DoorSpec, height: number): DoorSpec {
  const y = door.y + 1;
  return y < height ? { x: door.x, y } : door;
}

export type RoomBox = {
  readonly id?: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type HouseWallPlacement = {
  readonly x: number;
  readonly y: number;
  readonly tile: number;
};

export type InteriorHouseWallInput = {
  readonly width: number;
  readonly height: number;
  readonly floor: readonly boolean[];
  readonly rooms?: readonly RoomBox[];
  readonly door: DoorSpec;
  readonly innerDoors?: readonly DoorSpec[];
};

/** 천장 블록(검정+회암 테두리, 앵커 369) — body 430. 테두리는 shapeInteriorCeiling이 저장 성형. */
export const CEILING_BLOCK = templateBlockFromAnchor(369);
export const CEILING_TILE = CEILING_BLOCK.body; // 430
/** 천장 블록 전체 멤버(벽걸이/질량 판정·테스트 대조용). */
export const CEILING_MEMBER_TILES: readonly number[] = [
  CEILING_BLOCK.isolated, CEILING_BLOCK.inner,
  CEILING_BLOCK.cornerNW, CEILING_BLOCK.edgeN, CEILING_BLOCK.cornerNE,
  CEILING_BLOCK.edgeW, CEILING_BLOCK.body, CEILING_BLOCK.edgeE,
  CEILING_BLOCK.cornerSW, CEILING_BLOCK.edgeS, CEILING_BLOCK.cornerSE,
];
const CEILING_MEMBER_SET = new Set<number>(CEILING_MEMBER_TILES);

export function isCeilingTile(tile: number): boolean {
  return CEILING_MEMBER_SET.has(tile);
}

/**
 * 천장 저장 성형 — 천장 멤버 셀 전체를 이웃 마스크로 재계산한다.
 * 맵 밖은 천장이 이어진 것으로 취급(경계에 테두리를 그리지 않는다 — RM2K 정본 관례).
 */
export function shapeInteriorCeiling(map: GameMap): void {
  const connected = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
    return CEILING_MEMBER_SET.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY);
  };
  const next = [...map.lowerTiles];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!CEILING_MEMBER_SET.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) continue;
      let mask = 0;
      if (connected(x, y - 1)) mask |= AUTOTILE_DIR.N;
      if (connected(x + 1, y)) mask |= AUTOTILE_DIR.E;
      if (connected(x, y + 1)) mask |= AUTOTILE_DIR.S;
      if (connected(x - 1, y)) mask |= AUTOTILE_DIR.W;
      if (connected(x + 1, y - 1)) mask |= AUTOTILE_DIR.NE;
      if (connected(x + 1, y + 1)) mask |= AUTOTILE_DIR.SE;
      if (connected(x - 1, y + 1)) mask |= AUTOTILE_DIR.SW;
      if (connected(x - 1, y - 1)) mask |= AUTOTILE_DIR.NW;
      const variant = autotileVariantForMask(DEFAULT_DARKNESS_DEEP_AUTOTILE_GROUP, mask);
      if (typeof variant === "number") next[y * map.width + x] = variant;
    }
  }
  map.lowerTiles = next;
}

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function isFloorMask(
  floor: readonly boolean[],
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  if (!inBounds(x, y, width, height)) return false;
  return floor[y * width + x] === true;
}

type HorizontalRun = { readonly cells: readonly { x: number; y: number }[] };

function horizontalRuns(cells: readonly { x: number; y: number }[]): HorizontalRun[] {
  const byRow = new Map<number, number[]>();
  for (const c of cells) {
    const xs = byRow.get(c.y) ?? [];
    xs.push(c.x);
    byRow.set(c.y, xs);
  }
  const runs: HorizontalRun[] = [];
  for (const [y, xs] of byRow) {
    const sorted = [...new Set(xs)].sort((a, b) => a - b);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1]! === sorted[j]! + 1) j += 1;
      runs.push({
        cells: sorted.slice(i, j + 1).map((x) => ({ x, y })),
      });
      i = j + 1;
    }
  }
  return runs;
}

function faceTileFor(runLen: number, i: number, upper: boolean): number {
  if (i === 0) return upper ? HOUSE_SHELL_TILE.creamUpperL : HOUSE_SHELL_TILE.creamLowerL;
  if (i === runLen - 1) return upper ? HOUSE_SHELL_TILE.creamUpperR : HOUSE_SHELL_TILE.creamLowerR;
  return upper ? HOUSE_SHELL_TILE.creamUpperM : HOUSE_SHELL_TILE.creamLowerM;
}

/**
 * Plan finished house wall tiles from floor mask + rooms + doors.
 * Room shared edges reserve partition cells (subtracted from floor) before shell.
 */
export function planInteriorHouseWalls(input: InteriorHouseWallInput): readonly HouseWallPlacement[] {
  const { width: W, height: H, floor, door } = input;
  const rooms = input.rooms ?? [];
  const innerDoors = input.innerDoors ?? [];
  const openings = new Set<string>([key(door.x, door.y), ...innerDoors.map((d) => key(d.x, d.y))]);

  // Gapless shared room edges → partition cells on the west/north room's last col/row.
  const partition = new Map<string, "v" | "h">();
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      if (a.x + a.w === b.x) {
        const y0 = Math.max(a.y, b.y);
        const y1 = Math.min(a.y + a.h, b.y + b.h);
        for (let y = y0; y < y1; y += 1) partition.set(key(a.x + a.w - 1, y), "v");
      } else if (b.x + b.w === a.x) {
        const y0 = Math.max(a.y, b.y);
        const y1 = Math.min(a.y + a.h, b.y + b.h);
        for (let y = y0; y < y1; y += 1) partition.set(key(b.x + b.w - 1, y), "v");
      }
      if (a.y + a.h === b.y) {
        const x0 = Math.max(a.x, b.x);
        const x1 = Math.min(a.x + a.w, b.x + b.w);
        for (let x = x0; x < x1; x += 1) partition.set(key(x, a.y + a.h - 1), "h");
      } else if (b.y + b.h === a.y) {
        const x0 = Math.max(a.x, b.x);
        const x1 = Math.min(a.x + a.w, b.x + b.w);
        for (let x = x0; x < x1; x += 1) partition.set(key(x, b.y + b.h - 1), "h");
      }
    }
  }

  // Effective floor: original minus partition (unless opening).
  const F = (x: number, y: number): boolean => {
    if (!isFloorMask(floor, W, H, x, y)) return false;
    const k = key(x, y);
    if (openings.has(k)) return true;
    if (partition.has(k)) return false;
    return true;
  };

  const place = new Map<string, number>();
  const set = (x: number, y: number, tile: number): void => {
    if (!inBounds(x, y, W, H)) return;
    place.set(key(x, y), tile);
  };

  // Seed floors so furniture layer sees floor cells; walls overwrite shell.
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (F(x, y)) set(x, y, HOUSE_SHELL_TILE.floor);
    }
  }

  // Structure shell: 4-neighbor ring around floor.
  const shell: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  const addShell = (x: number, y: number): void => {
    if (!inBounds(x, y, W, H) || F(x, y)) return;
    const k = key(x, y);
    if (seen.has(k)) return;
    seen.add(k);
    shell.push({ x, y });
  };
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!F(x, y)) continue;
      addShell(x, y - 1);
      addShell(x, y + 1);
      addShell(x - 1, y);
      addShell(x + 1, y);
    }
  }

  // 벽면 하단: 아래가 방 바닥인 모든 구조 칸 — 문 개구부 위도 예외 없음("천장 아래에는 반드시 벽").
  // 위 칸이 바닥이면(1행 수평 파티션) 벽면을 세울 공간이 없어 천장 띠로 남긴다.
  const faceBottom: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!F(x, y) && F(x, y + 1) && !F(x, y - 1)) {
        faceBottom.push({ x, y });
        addShell(x, y);
      }
    }
  }
  // 벽면 위(=천장)와 좌우 이음 천장까지 구조에 편입 — "벽 위에는 반드시 천장" 불변식.
  for (const c of faceBottom) {
    addShell(c.x - 1, c.y);
    addShell(c.x + 1, c.y);
    addShell(c.x, c.y - 1);
    addShell(c.x, c.y - 2);
    addShell(c.x - 1, c.y - 1);
    addShell(c.x + 1, c.y - 1);
    addShell(c.x - 1, c.y - 2);
    addShell(c.x + 1, c.y - 2);
  }

  // 천장 통일: 모든 구조 칸 = 366 (렌더 쿼터가 테두리 성형).
  for (const cell of shell) set(cell.x, cell.y, CEILING_TILE);

  // 벽면 2행: 하단(104–106) + 상단(74–76), 1칸 런은 107/77.
  for (const run of horizontalRuns(faceBottom)) {
    const len = run.cells.length;
    for (let i = 0; i < len; i += 1) {
      const c = run.cells[i]!;
      if (len === 1) {
        set(c.x, c.y, HOUSE_SHELL_TILE.soloLower);
        if (c.y - 1 >= 0 && !F(c.x, c.y - 1)) set(c.x, c.y - 1, HOUSE_SHELL_TILE.soloUpper);
        continue;
      }
      set(c.x, c.y, faceTileFor(len, i, false));
      if (c.y - 1 >= 0 && !F(c.x, c.y - 1)) set(c.x, c.y - 1, faceTileFor(len, i, true));
    }
  }

  // 바깥 문: 남쪽 천장 띠를 바닥으로 뚫는다 — 스텝·플랭크 없음.
  set(door.x, door.y, HOUSE_SHELL_TILE.floor);
  const doorWallY = door.y + 1;
  if (doorWallY < H && !F(door.x, doorWallY)) {
    set(door.x, doorWallY, HOUSE_SHELL_TILE.floor);
  }

  // 내부 문 개구부는 바닥 그대로 — 플랭크 없음(이웃 천장은 쿼터 렌더가 마감).
  for (const d of innerDoors) {
    set(d.x, d.y, HOUSE_SHELL_TILE.floor);
  }

  return [...place.entries()].map(([k, tile]) => {
    const [x, y] = k.split(",").map(Number) as [number, number];
    return { x, y, tile };
  });
}

export function paintInteriorHouseWalls(map: GameMap, placements: readonly HouseWallPlacement[]): void {
  for (const p of placements) {
    if (p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height) continue;
    map.lowerTiles[p.y * map.width + p.x] = p.tile;
    if (p.tile !== HOUSE_SHELL_TILE.floor) {
      map.upperTiles[p.y * map.width + p.x] = TILE.EMPTY;
    }
  }
}
