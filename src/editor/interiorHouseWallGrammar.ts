/**
 * Deterministic house interior wall grammar (Option B).
 * No store autotile — every wall cell is a finished whole tile.
 *
 * Topology (gold map_interior_blank):
 * - Outer 4-neighbor ring around floor (south diagonal corners stay void 430)
 * - North face: cream lower / cream upper / cap (2 rows + cap)
 * - Posts 428/426, south trim 397, door alcove 398|floor|396 + step 397
 * - 1-col partitions: ceiling-attached 77/107 then deeper 428 posts
 * - Forbidden: 233 / 257 / 258
 */
import { HOUSE_SHELL_TILE } from "@/project/defaults/interiorHouseWallTiles";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";

export type DoorSpec = { readonly x: number; readonly y: number };

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
  if (runLen === 1) {
    return upper ? HOUSE_SHELL_TILE.creamUpperM : HOUSE_SHELL_TILE.creamLowerM;
  }
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
  const get = (x: number, y: number): number | undefined => place.get(key(x, y));

  // Seed floors so furniture layer sees floor cells; walls overwrite shell.
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (F(x, y)) set(x, y, HOUSE_SHELL_TILE.floor);
    }
  }

  // Outer ring (4-neighbor only — south diagonal corners stay void).
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

  // Vertical partition door gaps: floor openings that must not become north face.
  const doorGapKeys = new Set<string>();
  for (const innerDoor of innerDoors) {
    if (F(innerDoor.x, innerDoor.y) && F(innerDoor.x - 1, innerDoor.y) && F(innerDoor.x + 1, innerDoor.y)) {
      doorGapKeys.add(key(innerDoor.x, innerDoor.y));
    }
  }
  // Exterior door is on the south floor edge — the shell south of it is the wall opening.
  // Also treat horizontal-partition door cells as non-face triggers.
  for (const d of [door, ...innerDoors]) {
    if (!F(d.x, d.y) && F(d.x - 1, d.y) && F(d.x + 1, d.y)) {
      // rare: door not in floor mask
    }
  }

  // North face bottom row: shell cells with floor immediately south (not a door gap).
  const faceBottom: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!F(x, y) && F(x, y + 1) && !doorGapKeys.has(key(x, y + 1))) {
        faceBottom.push({ x, y });
        addShell(x, y); // ensure face bottoms are in shell even if only adjacent N-S
      }
    }
  }
  for (const c of faceBottom) {
    addShell(c.x - 1, c.y);
    addShell(c.x + 1, c.y);
    addShell(c.x, c.y - 1); // cream upper
    addShell(c.x, c.y - 2); // cap
    addShell(c.x - 1, c.y - 1);
    addShell(c.x + 1, c.y - 1);
    addShell(c.x - 1, c.y - 2);
    addShell(c.x + 1, c.y - 2);
  }

  // Default shell cells → void (will reclassify). Outside shell stays unset (void on map).
  for (const cell of shell) set(cell.x, cell.y, HOUSE_SHELL_TILE.void);

  // Cream face runs: lower at faceBottom, upper at y-1, cap at y-2.
  const faceKeys = new Set<string>();
  for (const run of horizontalRuns(faceBottom)) {
    for (let i = 0; i < run.cells.length; i += 1) {
      const c = run.cells[i]!;
      set(c.x, c.y, faceTileFor(run.cells.length, i, false));
      faceKeys.add(key(c.x, c.y));
      if (c.y - 1 >= 0 && !F(c.x, c.y - 1)) {
        set(c.x, c.y - 1, faceTileFor(run.cells.length, i, true));
        faceKeys.add(key(c.x, c.y - 1));
      }
      // Cap row above upper cream
      if (c.y - 2 >= 0 && !F(c.x, c.y - 2)) {
        set(c.x, c.y - 2, HOUSE_SHELL_TILE.capStraight);
      }
    }
  }

  // Cap end joints on expanded cap cells left/right of face
  for (const run of horizontalRuns(faceBottom)) {
    const first = run.cells[0]!;
    const last = run.cells[run.cells.length - 1]!;
    const capY = first.y - 2;
    if (capY < 0) continue;
    // west joint cell
    if (inBounds(first.x - 1, capY, W, H) && !F(first.x - 1, capY)) {
      set(first.x - 1, capY, HOUSE_SHELL_TILE.capJointNW); // 458 bottom+right
    }
    if (inBounds(last.x + 1, capY, W, H) && !F(last.x + 1, capY)) {
      set(last.x + 1, capY, HOUSE_SHELL_TILE.capJointNE); // 456 bottom+left
    }
  }

  const floorOrFace = (x: number, y: number): boolean => F(x, y) || faceKeys.has(key(x, y));
  const dualFloorPartition: Array<{ x: number; y: number }> = [];

  for (const cell of shell) {
    if (F(cell.x, cell.y)) continue;
    if (faceKeys.has(key(cell.x, cell.y))) continue;
    // Cap row already set — only touch if still void
    const current = get(cell.x, cell.y);
    if (
      current === HOUSE_SHELL_TILE.capStraight
      || current === HOUSE_SHELL_TILE.capJointNW
      || current === HOUSE_SHELL_TILE.capJointNE
    ) {
      continue;
    }

    const eastFloor = F(cell.x + 1, cell.y);
    const westFloor = F(cell.x - 1, cell.y);
    const eastRoom = floorOrFace(cell.x + 1, cell.y);
    const westRoom = floorOrFace(cell.x - 1, cell.y);
    const northFloor = F(cell.x, cell.y - 1);

    if (northFloor && !doorGapKeys.has(key(cell.x, cell.y - 1))) {
      set(cell.x, cell.y, HOUSE_SHELL_TILE.southTrim);
    } else if (eastFloor && westFloor) {
      dualFloorPartition.push(cell);
    } else if (eastRoom && westRoom) {
      // Cream-band piercing post (between left/right face cells)
      set(cell.x, cell.y, HOUSE_SHELL_TILE.postWest);
    } else if (eastRoom) {
      set(cell.x, cell.y, HOUSE_SHELL_TILE.postWest); // west exterior post (right line faces room)
    } else if (westRoom) {
      set(cell.x, cell.y, HOUSE_SHELL_TILE.postEast); // east exterior post
    } else if (current === HOUSE_SHELL_TILE.void || current === undefined) {
      // leftover shell near cap/T — prefer west-facing post
      if (eastRoom || westRoom || northFloor) set(cell.x, cell.y, HOUSE_SHELL_TILE.postWest);
    }
  }

  // 1-col partitions: ceiling-attached top 2 cells = 77/107, deeper = post 428.
  const byCol = new Map<number, number[]>();
  for (const c of dualFloorPartition) {
    const ys = byCol.get(c.x) ?? [];
    ys.push(c.y);
    byCol.set(c.x, ys);
  }
  for (const [x, ys] of byCol) {
    const sorted = [...new Set(ys)].sort((a, b) => a - b);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1]! === sorted[j]! + 1) j += 1;
      const segment = sorted.slice(i, j + 1);
      const northY = segment[0]! - 1;
      const attachedToCeiling = northY >= 0 && !F(x, northY);
      for (let k = 0; k < segment.length; k += 1) {
        const y = segment[k]!;
        if (attachedToCeiling && k === 0) set(x, y, HOUSE_SHELL_TILE.soloUpper);
        else if (attachedToCeiling && k === 1) set(x, y, HOUSE_SHELL_TILE.soloLower);
        else set(x, y, HOUSE_SHELL_TILE.postWest);
      }
      i = j + 1;
    }
  }

  // Horizontal partition reserved cells → south trim (unless opening)
  for (const [k, orient] of partition) {
    if (openings.has(k)) continue;
    if (orient !== "h") continue;
    const [xs, ys] = k.split(",").map(Number) as [number, number];
    // If still floor-looking from seed, force trim
    if (!F(xs, ys)) set(xs, ys, HOUSE_SHELL_TILE.southTrim);
  }

  // Exterior door: door cell is south floor edge; punch shell at door.y+1.
  set(door.x, door.y, HOUSE_SHELL_TILE.floor);
  const doorWallY = door.y + 1;
  const doorOpened = doorWallY < H && !F(door.x, doorWallY);
  if (doorOpened) {
    set(door.x, doorWallY, HOUSE_SHELL_TILE.floor);
    if (inBounds(door.x - 1, doorWallY, W, H) && !F(door.x - 1, doorWallY) && seen.has(key(door.x - 1, doorWallY))) {
      set(door.x - 1, doorWallY, HOUSE_SHELL_TILE.southWestCorner); // 398
    }
    if (inBounds(door.x + 1, doorWallY, W, H) && !F(door.x + 1, doorWallY) && seen.has(key(door.x + 1, doorWallY))) {
      set(door.x + 1, doorWallY, HOUSE_SHELL_TILE.southEastCorner); // 396
    }
    const stepY = doorWallY + 1;
    if (stepY < H && !F(door.x, stepY)) {
      set(door.x, stepY, HOUSE_SHELL_TILE.southTrim); // 397 only — no 257 flanks
    }
  }

  // Inner door openings stay floor; flank when neighbors are south-trim or cap (horizontal corridor).
  for (const d of innerDoors) {
    set(d.x, d.y, HOUSE_SHELL_TILE.floor);
    const flankable = (t: number | undefined): boolean =>
      t === HOUSE_SHELL_TILE.southTrim
      || t === HOUSE_SHELL_TILE.capStraight
      || t === HOUSE_SHELL_TILE.creamLowerM
      || t === HOUSE_SHELL_TILE.creamUpperM;
    if (flankable(get(d.x - 1, d.y))) {
      set(d.x - 1, d.y, HOUSE_SHELL_TILE.southWestCorner);
    }
    if (flankable(get(d.x + 1, d.y))) {
      set(d.x + 1, d.y, HOUSE_SHELL_TILE.southEastCorner);
    }
  }

  // South outer corners of the building: SW/SE of south wall → 398/396 when shell.
  // (Gold left these as void 430 for quarter wrap; plan Option B allows whole-tile corners.)
  // Keep void at diagonal south corners (not in 4-neighbor ring) — already not in shell.

  // Drop pure void placements that match map default (optional) — keep them so paint clears furniture.
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
