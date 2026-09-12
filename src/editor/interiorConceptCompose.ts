/**
 * 개념 꾸러미 방 구성 — 물건을 슬롯에 앉힌다.
 *
 * 이전(2026-09-02 verdict)에는 `placeCatalogObject` 가 물건을 후보 첫 자리에 투하했다. 그래서
 *  - 상위 레이어 물건이 방 밖 천장 칸으로 넘어갔다(카운터가 동쬭 벽을 뚫음),
 *  - 벽걸이(창문·그림)가 벽면이 아니라 벽 옆 바닥 칸에 찍혔다,
 *  - 점유 격자가 없어 시계가 러그 위에, 캐비닛이 침대 밑에 붙었다,
 *  - `free` 스냅 계단이 홀 한가운데 떨어졐다.
 *
 * 여기서는 방 하나를 받아 슬롯 종류별로 자리를 정한다. 모든 칸은 그 방 바닥(또는 그 방의 벽면 행) 안이어야 하고,
 * 이미 놓인 칸·문 접근로·방 입구는 비운다. 못 앉힌 물건은 경고로 남긴다 — 숨기지 않는다.
 *
 * 세로 규약은 테마 파이프라인의 정본을 따른다: 벽걸이는 크림 벽면 **윗줄**에 상위 레이어로,
 * 키 큰 가구(시계·갑옷·흉상·거울·진열대·화덕)는 상단이 벽면 **아랫줄**에 겹치고 하단이 북쪽 바닥 행에 선다.
 * 침대·책장·카운터·피아노는 북쪽 바닥 행에서 시작한다.
 *
 * interiorRoomPipeline 을 import 하지 않는다(파이프라인이 이 모듈을 부른다).
 */
import type { ConceptOverlayThing } from "@/editor/conceptBundleResolve";
import { isCeilingTile, shapeInteriorCeiling } from "@/editor/interiorHouseWallGrammar";
import type { InteriorObjectCell, InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { TILE } from "@/project/defaults/constants";
import { HOUSE_SHELL_TILE } from "@/project/defaults/interiorHouseWallTiles";
import type { ConceptChipId, ConceptPlaceRole } from "@/project/types/conceptBundle";
import type { GameMap } from "@/project/types";
import { deterministicRng, type Rng } from "@/util/rng";

/** 「암흑 공허」 — 건물 밖. 천장(430 계열)과 다른 타일이라 천장 테두리가 건물 윤곽으로 드러난다. */
export const OUTSIDE_VOID_TILE = 116;

/** 상단이 벽면 아랫줄에 겹치는 키 큰 가구(정본: placeTallPairU / placeStovePair). */
const TALL_FACE_OVERLAP_IDS: ReadonlySet<string> = new Set(["armor", "bust", "mirror", "display", "stove", "flue"]);

const CREAM_FACE_TILES: ReadonlySet<number> = new Set([
  HOUSE_SHELL_TILE.creamUpperL,
  HOUSE_SHELL_TILE.creamUpperM,
  HOUSE_SHELL_TILE.creamUpperR,
  HOUSE_SHELL_TILE.creamLowerL,
  HOUSE_SHELL_TILE.creamLowerM,
  HOUSE_SHELL_TILE.creamLowerR,
  HOUSE_SHELL_TILE.soloUpper,
  HOUSE_SHELL_TILE.soloLower,
]);

export type ConceptRoomBox = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type ConceptPlacedCell = {
  readonly x: number;
  readonly y: number;
  readonly layer: "lower" | "upper";
  readonly tile: number;
};

export type ConceptPlacement = {
  readonly roomId: string;
  readonly thingId: string;
  readonly objectId: string;
  readonly label: string;
  readonly chips: readonly ConceptChipId[];
  readonly required: boolean;
  readonly cells: readonly ConceptPlacedCell[];
  /** 이벤트 앵커 — 최하단 행의 중앙 열. 플레이어가 남쪽에서 마주 보는 칸. */
  readonly anchor: { readonly x: number; readonly y: number };
};

export type ConceptComposeInput = {
  readonly map: GameMap;
  /** Built-in facility identity; other facilities retain the legacy slot grammar. */
  readonly facilityId?: string;
  /** 이 방의 바닥 마스크(맵 크기). */
  readonly floor: readonly boolean[];
  /** 맵 전체 바닥 마스크 — 방 밖 바닥(문 개구부)을 보고 통로를 잡는다. */
  readonly fullFloor: readonly boolean[];
  readonly roomId: string;
  readonly room: ConceptRoomBox;
  readonly role: ConceptPlaceRole;
  readonly door: { readonly x: number; readonly y: number };
  readonly placeLabel: string;
  readonly things: readonly ConceptOverlayThing[];
  readonly resolveObject: (objectId: string) => InteriorObjectDef | undefined;
  /** 하위 타일이 통행 바닥 재질인가(나무·돌·널·돗자리). 파이프라인이 정본을 준다. */
  readonly isFloorTile: (tile: number) => boolean;
  /** 파이프라인이 문 앞 입구 칸에 잠시 꽂는 상위 레이어 표지. 러그는 그 위에 깔려도 된다(걷는 바닥). */
  readonly entrySentinel?: number;
  /**
   * 배치 변주 시드. 같은 방·같은 물건이라도 시드가 다르면 첫 가구의 좌우, 동률 후보의 선택이 달라진다.
   * 없으면 종전과 같은 결정적 배치(서쪽 첫 자리 · 가운데 · 동쪽).
   * 2026-09-03: 개념 시설이 매번 픽셀 단위로 같은 맵을 냈다 — 이 파일에 난수가 한 곳도 없었다.
   */
  readonly seed?: number;
};

export type ConceptComposeResult = {
  readonly placements: readonly ConceptPlacement[];
  readonly warnings: readonly string[];
};

type SlotClass = "stair-face" | "face" | "tall-face" | "north-end" | "north" | "floor" | "rug" | "corner";

// 큰 가구(북벽)가 먼저 자리를 잡고 장식(키 큰 가구·벽걸이)이 남은 틈을 채운다. 계단은 복도 끝을 가장 먼저 받는다.
// 러그는 바닥 가구보다 먼저 깔린다 — 탁자·소품(상위 레이어)이 러그 위에 앉을 수 있다(정본 placeRugUnder 의 「탁자 밑 러그」).
const CLASS_ORDER: readonly SlotClass[] = ["stair-face", "north-end", "north", "face", "tall-face", "rug", "floor", "corner"];


/** 큰 화로 계열 — 복도 끝 알코브 슬롯의 원래 대상. */
const HEARTH_OBJECT_IDS: readonly string[] = ["hearth", "stone_hearth_lit", "stone_hearth_unlit"];
/**
 * 복도 끝 알코브 슬롯을 받는 물건 — 화로 계열과 **폭 3칸 이상 하부 설비**(피아노·긴 탁자·큰 화로 등).
 * 카탈로그 role 을 손대는 대신 id·크기로 판정한다(role 은 타일 의미 계약이라 임의 값이 못 들어간다).
 */
const endNookObject = (object: InteriorObjectDef): boolean =>
  HEARTH_OBJECT_IDS.includes(object.id) || (object.width >= 3 && object.layer === "lower");

type Point = { readonly x: number; readonly y: number };

export function composeConceptRoom(input: ConceptComposeInput): ConceptComposeResult {
  const { map, floor, room, door } = input;
  const grouped = ["house", "shop", "tavern", "library", "smithy", "church", "warehouse", "guild"]
    .includes(input.facilityId ?? "");
  const W = map.width;
  const idx = (x: number, y: number): number => y * W + x;
  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < map.height;
  const inRoomFloor = (x: number, y: number): boolean =>
    inBounds(x, y)
    && x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h
    && floor[idx(x, y)] === true;
  const lowerAt = (x: number, y: number): number => map.lowerTiles[idx(x, y)] ?? TILE.EMPTY;
  const upperEmpty = (x: number, y: number): boolean => (map.upperTiles[idx(x, y)] ?? TILE.EMPTY) < 0;

  /** 가구가 찍힌 칸(두 레이어 모두). */
  const taken = new Set<number>();
  /** 바닥 점유 가구 칸 — 러그가 밑으로 들어가지 못하는 칸. */
  const floorTaken = new Set<number>();
  /** 러그가 깔린 칸 — 하부 타일은 러그지만 상위 레이어 가구는 그 위에 앉을 수 있다. */
  const rugCells = new Set<number>();
  /** 벽 물건 사이 간격 칸 — 자리가 모자라면 양보한다(soft). */
  const soft = new Set<number>();
  /** 통로 — 문에서 방 안으로 곧게 이어지는 줄. 가구 금지, 러그는 허용. */
  const lane = new Set<number>();
  const warnings: string[] = [];
  const placements: ConceptPlacement[] = [];
  let bedCells: Point[] = [];
  // 방마다 다른 난수열 — 같은 시드라도 객실 1·2 가 거울처럼 같지 않게.
  const rng: Rng | null = input.seed === undefined ? null : deterministicRng(input.seed, "concept", input.roomId);
  // 이 방의 좌우 뒤집기 — 「서쪽 첫 자리」 규약을 시드로 동쪽으로 바꾼다. 첫 가구가 가장자리에서 시작하는 건 그대로라
  // 북벽 런이 조각나지 않는다(가운데 무작위 투하는 뒤 가구의 자리를 깨뜨린다).
  const flip = rng ? rng() < 0.5 : false;
  /** 동률 후보 사이의 선택 — 시드가 있으면 그중 하나를 뽑고, 없으면 첫 것. */
  const pickAmong = <T>(ties: readonly T[]): T | null => {
    if (ties.length === 0) return null;
    if (!rng || ties.length === 1) return ties[0] ?? null;
    return ties[Math.floor(rng() * ties.length)] ?? null;
  };

  const laneFrom = (x: number, y: number, dx: number, dy: number): void => {
    let cx = x;
    let cy = y;
    let steps = 0;
    while (inRoomFloor(cx, cy) && (input.role === "walkway" || steps++ < 1)) {
      lane.add(idx(cx, cy));
      cx += dx;
      cy += dy;
    }
  };
  // 정문: 문 칸 좌우 한 칸씩과 문에서 북쪽으로 곧게 올라가는 열.
  if (inRoomFloor(door.x, door.y)) {
    for (const dx of [-1, 1]) if (inRoomFloor(door.x + dx, door.y)) lane.add(idx(door.x + dx, door.y));
    laneFrom(door.x, door.y, 0, -1);
    if (inRoomFloor(door.x, door.y - 1)) lane.add(idx(door.x, door.y - 1));
  }
  // 방 입구: 방 밖 바닥과 맞닿는 방 바닥 칸에서 안쪽으로 곧게.
  for (let y = room.y; y < room.y + room.h; y += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      if (!inRoomFloor(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny) || input.fullFloor[idx(nx, ny)] !== true) continue;
        const outside = nx < room.x || nx >= room.x + room.w || ny < room.y || ny >= room.y + room.h;
        if (!outside) continue;
        laneFrom(x, y, -dx, -dy);
      }
    }
  }

  const blocked = (x: number, y: number, loose: boolean): boolean =>
    taken.has(idx(x, y)) || lane.has(idx(x, y)) || (!loose && soft.has(idx(x, y)));
  const free = (x: number, y: number, loose = false): boolean =>
    inRoomFloor(x, y) && input.isFloorTile(lowerAt(x, y)) && upperEmpty(x, y) && !blocked(x, y, loose);
  /** 상위 레이어 셀은 러그 위에도 앉는다. 하부 레이어 셀(상자·책장)은 러그를 덮어 구멍을 내므로 바닥 재질 칸만. */
  const freeFor = (cell: InteriorObjectCell, x: number, y: number, loose = false): boolean =>
    (free(x, y, loose) && (cell.layer === "upper" || !rugCells.has(idx(x, y))))
    || (cell.layer === "upper" && rugCells.has(idx(x, y)) && inRoomFloor(x, y) && upperEmpty(x, y) && !blocked(x, y, loose));
  /**
   * 복도 끝 알코브용 — 통행선(lane)을 점유로 보지 않는다. 복도 lane 은 복도 전체를 덮으므로
   * 이 규칙이 없으면 3×3 석조 화로가 복도 끝에 설 수 없다(2026-09-11 사용자: "난로는 복도 끝에").
   * 대신 아래 preservesAccess 가 그 자리 뒤쪽에 남는 상호작용(문·계단)이 없는지 계속 검사한다 —
   * 화로가 통로를 끊으면 후보에서 빠진다.
   */
  const freeForEndNook = (cell: InteriorObjectCell, x: number, y: number): boolean =>
    inRoomFloor(x, y) && input.isFloorTile(lowerAt(x, y)) && upperEmpty(x, y)
    && !taken.has(idx(x, y)) && (cell.layer === "upper" || !rugCells.has(idx(x, y)));
  const faceFree = (x: number, y: number, loose = false): boolean =>
    inBounds(x, y)
    && x >= room.x && x < room.x + room.w
    && y >= room.y - 2 && y < room.y + room.h
    && (inRoomFloor(x, y + 1) || inRoomFloor(x, y + 2))
    && CREAM_FACE_TILES.has(lowerAt(x, y))
    && upperEmpty(x, y)
    && !blocked(x, y, loose);
  // 러그는 침대 밑으로는 들어가고(정본 placeRugUnder) 다른 가구 밑으로는 들어가지 않는다. 통로 위는 허용(걷는 바닥).
  const upperEmptyOrEntry = (x: number, y: number): boolean => {
    const upper = map.upperTiles[idx(x, y)] ?? TILE.EMPTY;
    return upper < 0 || (input.entrySentinel !== undefined && upper === input.entrySentinel);
  };
  const rugFree = (x: number, y: number): boolean =>
    inRoomFloor(x, y)
    && input.isFloorTile(lowerAt(x, y))
    && (bedCells.some((cell) => cell.x === x && cell.y === y) || (!floorTaken.has(idx(x, y)) && upperEmptyOrEntry(x, y)));

  const classify = (thing: ConceptOverlayThing, object: InteriorObjectDef): SlotClass => {
    if (object.id === "stairs_horizontal") return "stair-face";
    if (object.id === "stairs_down") return "north-end";
    // 큰 화로(석조 3×3)는 복도에서 통행을 막지 않는 **끝 알코브**에 선다.
    // 거실·홀에서는 아래 wall-north 규칙을 그대로 타서 북벽에 앉는다(2026-09-11 사용자: "석조 난로는 거실이나 복도 끝").
    if (endNookObject(object) && input.role === "walkway") return "north-end";
    if (object.id === "clock" || object.snap === "wall-any") return "face";
    if (object.snap === "wall-north") {
      return object.height === 2 && TALL_FACE_OVERLAP_IDS.has(object.id) ? "tall-face" : "north";
    }
    if (thing.chips.includes("transfer")) return "north-end";
    if (object.id.startsWith("rug") || (thing.chips.includes("floor") && object.layer === "lower")) return "rug";
    if (object.width === 1 && object.height === 1 && thing.chips.includes("block")) return "corner";
    return "floor";
  };

  type Job = { readonly thing: ConceptOverlayThing; readonly object: InteriorObjectDef; readonly slot: SlotClass };
  const jobs: Job[] = [];
  for (const thing of input.things) {
    const object = input.resolveObject(thing.objectId);
    if (!object) {
      warnings.push(`concept: 물건 ${thing.objectId} 정의를 찾지 못함 (${input.placeLabel})`);
      continue;
    }
    jobs.push({ thing, object, slot: classify(thing, object) });
  }
  // 벽에 붙는 가구(필수 먼저) → 러그 → 바닥·구석 소품(필수 먼저). 러그는 상위 레이어 가구의 자리를 빼앗지 않으므로
  // 필수 탁자보다 먼저 깔려도 손해가 없고, 반대로 탁자가 먼저 앉으면 러그가 들어갈 3×3 이 남지 않는다.
  const groupOf = (job: Job): number => {
    // Opaque table assemblies must fit before rugs; otherwise either the table
    // erases the rug or a decorative rug prevents required furniture placement.
    if (job.slot === "floor" && job.object.cells.some((cell) => cell.layer === "lower")) return 0.5;
    return job.slot === "rug" ? 1 : job.slot === "floor" || job.slot === "corner" ? 2 : 0;
  };
  jobs.sort((a, b) => {
    const group = groupOf(a) - groupOf(b);
    if (group !== 0) return group;
    const req = Number(b.thing.required) - Number(a.thing.required);
    if (req !== 0) return req;
    const cls = CLASS_ORDER.indexOf(a.slot) - CLASS_ORDER.indexOf(b.slot);
    if (cls !== 0) return cls;
    return b.object.width * b.object.height - a.object.width * a.object.height;
  });

  const placedByClass = new Map<SlotClass, Point[]>();
  // 북벽에 붙는 세 종류(북벽 가구·키 큰 가구·복도 끝 계단)는 한 줄을 나눠 쓰므로 서로를 앵커로 본다 —
  // 그렇지 않으면 흉상 둘이 나란히 동쪽에만 선다(2026-09-02 교회 실측).
  const NORTH_WALL_SLOTS: readonly SlotClass[] = ["north", "tall-face", "north-end"];
  const anchorsFor = (slot: SlotClass): Point[] =>
    (NORTH_WALL_SLOTS.includes(slot) ? NORTH_WALL_SLOTS : [slot]).flatMap((entry) => placedByClass.get(entry) ?? []);
  const spreadPick = (candidates: readonly Point[], slot: SlotClass, first: "west" | "center" | "east"): Point | null => {
    if (candidates.length === 0) return null;
    const anchors = anchorsFor(slot);
    if (anchors.length === 0) {
      const side = flip ? (first === "west" ? "east" : first === "east" ? "west" : first) : first;
      if (side === "west") return candidates[0] ?? null;
      if (side === "east") return candidates[candidates.length - 1] ?? null;
      return candidates[Math.floor(candidates.length / 2)] ?? null;
    }
    let ties: Point[] = [];
    let bestScore = -1;
    for (const candidate of candidates) {
      const score = Math.min(...anchors.map((anchor) => Math.abs(anchor.x - candidate.x) + Math.abs(anchor.y - candidate.y)));
      if (score > bestScore) {
        bestScore = score;
        ties = [candidate];
      } else if (score === bestScore) {
        ties.push(candidate);
      }
    }
    return pickAmong(ties);
  };

  const paint = (job: Job, ox: number, oy: number, cells: readonly InteriorObjectCell[]): void => {
    const placed: ConceptPlacedCell[] = [];
    for (const cell of cells) {
      const x = ox + cell.dx;
      const y = oy + cell.dy;
      if (cell.layer === "upper") map.upperTiles[idx(x, y)] = cell.tile;
      else map.lowerTiles[idx(x, y)] = cell.tile;
      if (job.slot === "rug") rugCells.add(idx(x, y));
      else {
        taken.add(idx(x, y));
        floorTaken.add(idx(x, y));
      }
      placed.push({ x, y, layer: cell.layer, tile: cell.tile });
    }
    // 벽 물건 사이는 한 칸 띈다 — 북벽에 쟁여지지 않게. 자리가 모자라면 양보하는 간격이다.
    if (job.slot === "north" || job.slot === "tall-face" || job.slot === "north-end" || job.slot === "face") {
      const rowY = job.slot === "face" ? oy : oy + (job.slot === "tall-face" ? 1 : 0);
      soft.add(idx(ox - 1, rowY));
      soft.add(idx(ox + job.object.width, rowY));
    }
    const bottom = Math.max(...cells.map((cell) => cell.dy));
    const anchor = { x: ox + Math.floor(job.object.width / 2), y: oy + bottom };
    placements.push({
      roomId: input.roomId,
      thingId: job.thing.thingId,
      objectId: job.object.id,
      label: job.thing.label,
      chips: job.thing.chips,
      required: job.thing.required,
      cells: placed,
      anchor,
    });
    const list = placedByClass.get(job.slot) ?? [];
    list.push({ x: ox, y: oy });
    placedByClass.set(job.slot, list);
    if (job.object.role === "bed") bedCells = [...bedCells, ...placed.map((cell) => ({ x: cell.x, y: cell.y }))];
  };

  // Evaluate an entire furniture assembly before committing it. Keep existing reachable
  // floor reachable; table legs/seats must never be repaired by deleting one tile.
  const reachable = (extra: ReadonlySet<number>): Set<number> => {
    const seen = new Set<number>();
    const queue: number[] = [];
    const open = (i:number):boolean => {
      const upper = map.upperTiles[i] ?? TILE.EMPTY;
      return input.fullFloor[i] === true && !extra.has(i)
        && input.isFloorTile(map.lowerTiles[i] ?? TILE.EMPTY)
        && (upper < 0 || upper === input.entrySentinel);
    };
    for (const y of [door.y,door.y-1,door.y+1]) {
      const i=idx(door.x,y); if (inBounds(door.x,y) && open(i)) {seen.add(i);queue.push(i);}
    }
    for(let n=0;n<queue.length;n++) {
      const i=queue[n]!,x=i%W,y=Math.floor(i/W);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx!,ny=y+dy!,next=idx(nx,ny);
        if(inBounds(nx,ny)&&!seen.has(next)&&open(next)){seen.add(next);queue.push(next);}
      }
    }
    return seen;
  };
  const preservesAccess = (cells:readonly InteriorObjectCell[],x:number,y:number,baseline:ReadonlySet<number>):boolean => {
    const blocked = new Set(cells.map(cell=>idx(x+cell.dx,y+cell.dy)));
    const after = reachable(blocked);
    return [...baseline].every(i=>blocked.has(i)||after.has(i));
  };

  const cellsFit = (cells: readonly InteriorObjectCell[], ox: number, oy: number, test: (x: number, y: number) => boolean): boolean =>
    cells.every((cell) => test(ox + cell.dx, oy + cell.dy));
  /** 간격을 지키는 후보가 없으면 간격을 양보한 후보로 다시 찾는다. */
  const withRetry = (candidatesFor: (loose: boolean) => Point[], pickFrom: (candidates: Point[]) => Point | null): Point | null =>
    pickFrom(candidatesFor(false)) ?? pickFrom(candidatesFor(true));

  const interiorRows = room.h > 1 ? { from: room.y + 1, to: room.y + room.h - 1 } : { from: room.y, to: room.y };
  const floorObjectFits = (object: InteriorObjectDef, x: number, y: number): boolean =>
    object.cells.every((cell) => freeFor(cell, x + cell.dx, y + cell.dy))
    && !object.cells.some((cell) =>
      ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) =>
        floorTaken.has(idx(x + cell.dx + dx, y + cell.dy + dy))));
  const preservesInteractionAccess = (x: number, y: number, thing: ConceptOverlayThing): boolean => {
    if (!grouped) return true;
    const interactive = (chips: readonly ConceptChipId[]): boolean =>
      chips.some((chip) => ["event", "loot", "sleep", "transfer"].includes(chip));
    const targets = placements
      .filter((placement) => interactive(placement.chips) && inRoomFloor(placement.anchor.x, placement.anchor.y))
      .map((placement) => placement.anchor);
    if (interactive(thing.chips)) targets.push({ x, y });
    if (targets.length === 0) return true;
    const candidate = idx(x, y);
    const canReach = (index: number): boolean => {
      const cx = index % W;
      const cy = Math.floor(index / W);
      return index !== candidate && inRoomFloor(cx, cy) && !taken.has(index)
        && (input.isFloorTile(lowerAt(cx, cy)) || rugCells.has(index))
        && upperEmptyOrEntry(cx, cy);
    };
    const start = inRoomFloor(door.x, door.y) ? idx(door.x, door.y) : [...lane].find(canReach);
    if (start === undefined || !canReach(start)) return false;
    const queue = [start];
    const reached = new Set(queue);
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      if (index === undefined) break;
      const cx = index % W;
      const cy = Math.floor(index / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const next = idx(cx + dx, cy + dy);
        if (!reached.has(next) && canReach(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
    return targets.every((target) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
        reached.has(idx(target.x + dx, target.y + dy))));
  };

  for (const job of jobs) {
    const { object, thing } = job;
    const baselineReach = reachable(new Set());
    let done = false;
    switch (job.slot) {
      case "stair-face": {
        // The flight rises from the first floor row through both north wall-face rows.
        const pick = withRetry((loose) => {
          const candidates: Point[] = [];
          for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x <= room.x + room.w - object.width; x++) {
              if (inRoomFloor(x, y - 1)) continue;
              const fits = object.cells.every(cell => {
                const cy = y - 2 + cell.dy;
                return cell.dy < 2 ? faceFree(x + cell.dx, cy, loose) : freeFor(cell, x + cell.dx, cy, loose);
              });
              if (fits) candidates.push({ x, y: y - 2 });
            }
          }
          return candidates;
        }, candidates => candidates[flip ? 0 : candidates.length - 1] ?? null);
        if (pick) {
          paint(job, pick.x, pick.y, object.cells);
          done = true;
        }
        break;
      }
      case "face": {
        // 벽걸이: 벽면 윗줄, 상위 레이어(정본 placeWallMount). 카탈로그 셀이 lower 여도 벽면 위에 얹는다.
        const cells = object.cells.map((cell) => ({ ...cell, layer: "upper" as const }));
        const pick = withRetry((loose) => {
          const candidates: Point[] = [];
          for (let y = room.y - 2; y < room.y + room.h; y += 1) for (let x = room.x; x <= room.x + room.w - object.width; x += 1) {
            if (inRoomFloor(x, y + 1) || !inRoomFloor(x, y + 2)) continue;
            if (thing.chips.includes("event") && !free(x + Math.floor(object.width / 2), y + 2, true)) continue;
            if (cellsFit(cells, x, y, (cx, cy) => faceFree(cx, cy, loose))) candidates.push({ x, y });
          }
          return candidates;
        }, (candidates) => spreadPick(candidates, "face", "center"));
        if (pick) {
          paint(job, pick.x, pick.y, cells);
          if (thing.chips.includes("event")) lane.add(idx(pick.x + Math.floor(object.width / 2), pick.y + 2));
          done = true;
        }
        break;
      }
      case "tall-face": {
        // 상단이 벽면 아랫줄, 하단이 북쪽 바닥 행.
        const pick = withRetry((loose) => {
          const candidates: Point[] = [];
          for (let oy = room.y - 1; oy < room.y + room.h - 1; oy += 1) for (let x = room.x; x <= room.x + room.w - object.width; x += 1) {
            const ok = object.cells.every((cell) => {
              const cx = x + cell.dx;
              const cy = oy + cell.dy;
              return cell.dy === 0 ? faceFree(cx, cy, loose) : freeFor(cell, cx, cy, loose);
            });
            if (ok) candidates.push({ x, y: oy });
          }
          return candidates;
        }, (candidates) => spreadPick(candidates, "north", "east"));
        if (pick) {
          paint(job, pick.x, pick.y, object.cells);
          done = true;
        }
        break;
      }
      case "north-end":
      case "north": {
        // 복도 끝 알코브의 화로는 통행선을 점유로 보지 않는다(끝 자리 전용 규칙).
        const endNook = endNookObject(object) && input.role === "walkway";
        const pick = withRetry((loose) => {
          const candidates: Point[] = [];
          for (let northY = room.y; northY < room.y + room.h; northY += 1) for (let x = room.x; x <= room.x + room.w - object.width; x += 1) {
            if (inRoomFloor(x, northY - 1)) continue;
            const fits = object.cells.every((cell) => endNook
              ? freeForEndNook(cell, x + cell.dx, northY + cell.dy)
              : freeFor(cell, x + cell.dx, northY + cell.dy, loose));
            if (fits && preservesAccess(object.cells, x, northY, baselineReach)) candidates.push({ x, y: northY });
          }
          return candidates;
        }, (candidates) => (job.slot === "north-end"
          ? candidates[flip ? 0 : candidates.length - 1] ?? null
          : spreadPick(candidates, "north", "west")));
        if (pick) {
          paint(job, pick.x, pick.y, object.cells);
          done = true;
        }
        break;
      }
      case "floor": {
        // 방 안쪽 중앙에 가깝게. 복도에서는 바닥 점유 물건을 놓지 않는다(통행이 주인).
        if (input.role === "walkway" && thing.chips.includes("block")) break;
        const centerX = room.x + (room.w - object.width) / 2;
        const centerY = interiorRows.from + (interiorRows.to - interiorRows.from + 1 - object.height) / 2;
        const candidates: Array<Point & { score: number }> = [];
        for (let y = interiorRows.from; y <= interiorRows.to - object.height + 1; y += 1) {
          for (let x = room.x; x <= room.x + room.w - object.width; x += 1) {
            if (!floorObjectFits(object, x, y) || !preservesAccess(object.cells, x, y, baselineReach)) continue;
            const rugCoverage = grouped && object.role === "table"
              ? object.cells.filter((cell) => rugCells.has(idx(x + cell.dx, y + cell.dy))).length
              : 0;
            // Align one-row seating into alternate rows. A centered random row
            // can consume both remaining rows and strand a third seating group.
            const rowPenalty = grouped && object.role === "table" && object.height === 1
              ? ((y - room.y) % 2) * 2 : 0;
            // In a multi-table hall, a wide opaque table in the middle leaves
            // only narrow strips for the remaining seating groups. Prefer a side.
            const aislePenalty = grouped && object.layer === "lower"
              && jobs.filter((entry) => entry.slot === "floor" && entry.object.role === "table").length > 2
              && x <= door.x && x + object.width > door.x ? 100 : 0;
            candidates.push({ x, y, score: Math.abs(x - centerX) + Math.abs(y - centerY) - rugCoverage * 10 + rowPenalty + aislePenalty });
          }
        }
        candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
        const pick = pickAmong(candidates.filter((entry) => entry.score === candidates[0]?.score));
        if (pick) {
          paint(job, pick.x, pick.y, object.cells);
          done = true;
        }
        break;
      }
      case "corner": {
        // 1×1 바닥 소품: 네 구석 → 벽을 따라 둘레(남·북 행, 서·동 열) → 마지막으로 방 안쪽.
        // 창고처럼 상자·술통이 여럿인 시설이 구석 넷에서 멈추지 않게 한다. 복도는 양 끝 열만 쓴다.
        const ends = input.role === "walkway"
          ? [room.x, room.x + room.w - 1].flatMap((x) => {
              const out: Point[] = [];
              for (let y = room.y; y < room.y + room.h; y += 1) out.push({ x, y });
              return out;
            })
          : perimeterCandidates(room);
        const cell = object.cells[0]!;
        const propFree = (x: number, y: number, loose = false): boolean =>
          freeFor(cell, x, y, loose) && preservesInteractionAccess(x, y, thing);
        // Warehouse stock sits in short rows on either side of the loading
        // aisle, with a one-cell perimeter so every group can be approached.
        const stockRows: Point[] = [];
        if (input.facilityId === "warehouse" && ["crate", "barrel"].includes(object.id)) {
          const middle = room.x + Math.floor(room.w / 2);
          const fromX = object.id === "crate" ? room.x + 1 : middle + 1;
          const toX = object.id === "crate" ? middle - 1 : Math.min(middle + 2, room.x + room.w - 2);
          for (let y = room.y + 1; y < room.y + room.h - 1; y += 1) {
            for (let x = fromX; x <= toX; x += 1) {
              if (propFree(x, y)) stockRows.push({ x, y });
            }
          }
        }
        // Work tools accompany the forge; a bedside box and seating accompany
        // their furniture. Repeated stock forms a group instead of four corners.
        const anchorIds = ["cauldron", "kettle", "bucket"].includes(object.id)
          ? ["stove"]
          : object.id === "box" && bedCells.length > 0
            ? ["bed_h", "bed_v"]
            : object.id === "stool"
              ? ["table_long", "table_chairs", "counter"]
              : ["crate", "barrel", "grain", "jars"].includes(object.id) ? [object.id] : [];
        const related = grouped && input.role !== "walkway"
          ? placements.filter((placement) => anchorIds.includes(placement.objectId))
          : [];
        const clustered: Array<Point & { distance: number }> = [];
        if (related.length > 0) {
          for (let y = room.y; y < room.y + room.h; y += 1) {
            for (let x = room.x; x < room.x + room.w; x += 1) {
              if (!propFree(x, y)) continue;
              // Leave the interaction approach directly below a related object.
              if (related.some((placement) =>
                placement.anchor.x === x && placement.anchor.y + 1 === y
                && placement.chips.includes("event"))) continue;
              const distance = Math.min(...related.flatMap((placement) => placement.cells.map((placed) =>
                Math.abs(placed.x - x) + Math.abs(placed.y - y))));
              clustered.push({ x, y, distance });
            }
          }
          clustered.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
        }
        // 시드가 있으면 네 구석(복도는 양 끝) 중 비어 있는 것을 하나 뽑고, 없으면 종전 순서의 첫 자리.
        const cornerCount = input.role === "walkway" ? ends.length : 4;
        const openCorners = ends.slice(0, cornerCount).filter((point) => propFree(point.x, point.y));
        let pick: Point | null = stockRows[0] ?? clustered[0] ?? (rng ? pickAmong(openCorners) : null)
          ?? ends.find((point) => propFree(point.x, point.y))
          ?? ends.find((point) => propFree(point.x, point.y, true))
          ?? null;
        if (!pick && input.role !== "walkway") {
          for (let y = interiorRows.from; y <= interiorRows.to && !pick; y += 1) {
            for (let x = room.x; x < room.x + room.w; x += 1) {
              if (!propFree(x, y)) continue;
              const crowded = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => floorTaken.has(idx(x + dx, y + dy)));
              if (crowded) continue;
              pick = { x, y };
              break;
            }
          }
        }
        if (pick) {
          paint(job, pick.x, pick.y, object.cells);
          done = true;
        }
        break;
      }
      case "rug": {
        // 침대 발치에 앵커(정본 placeRugUnder: 러그 중심 = 침대 아래 칸). 없으면 방 안에서 중앙에 가장 가까운 자리.
        // 탁자가 중앙을 차지한 방에서도 러그가 옆으로 비켜 앉도록 한 열만 보지 않고 방 전체를 훑는다.
        const candidates: Point[] = [];
        const bed = bedCells[0];
        if (bed) {
          const ox = Math.min(room.x + room.w - object.width, Math.max(room.x, bed.x - Math.floor(object.width / 2)));
          for (const oy of [bed.y, bed.y + 1]) {
            if (cellsFit(object.cells, ox, oy, rugFree)) candidates.push({ x: ox, y: oy });
          }
        }
        if (candidates.length === 0) {
          const centerX = room.x + (room.w - object.width) / 2;
          const centerY = room.y + (room.h - object.height) / 2;
          const scored: Array<Point & { score: number }> = [];
          for (let y = room.y; y <= room.y + room.h - object.height; y += 1) {
            for (let x = room.x; x <= room.x + room.w - object.width; x += 1) {
              if (!cellsFit(object.cells, x, y, rugFree)) continue;
              // 북쪽 행(가구 줄)보다 방 안쪽을 선호한다.
              const northPenalty = y === room.y ? 1.5 : 0;
              const table = grouped && !bed ? jobs.find((entry) => entry.slot === "floor" && entry.object.role === "table" && entry.object.cells.every((cell) => cell.layer === "upper")) : undefined;
              let tableFits = false;
              if (table) {
                for (let ty = Math.max(y, interiorRows.from); ty <= y + object.height - table.object.height; ty += 1) {
                  for (let tx = x; tx <= x + object.width - table.object.width; tx += 1) {
                    if (floorObjectFits(table.object, tx, ty)) tableFits = true;
                  }
                }
              }
              const ungroupedPenalty = table && !tableFits ? 100 : 0;
              scored.push({ x, y, score: Math.abs(x - centerX) + Math.abs(y - centerY) + northPenalty + ungroupedPenalty });
            }
          }
          scored.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
          for (const entry of scored) candidates.push({ x: entry.x, y: entry.y });
        }
        const pick = candidates.length > 1 && bed ? pickAmong(candidates) : candidates[0] ?? null;
        if (pick) {
          paint(job, pick.x, pick.y, object.cells);
          done = true;
        }
        break;
      }
    }
    if (!done) warnings.push(`concept: ${thing.label} 자리 없음 (${input.placeLabel})`);
  }

  return { placements, warnings };
}

/** 방 둘레 칸 — 네 구석, 남쪽 행, 북쪽 행, 서·동 열 순. 구석 소품이 벽을 따라 늘어선다. */
function perimeterCandidates(room: ConceptRoomBox): Point[] {
  const south = room.y + room.h - 1;
  const east = room.x + room.w - 1;
  const out: Point[] = [
    { x: room.x, y: south },
    { x: east, y: south },
    { x: room.x, y: room.y },
    { x: east, y: room.y },
  ];
  const seen = new Set(out.map((point) => `${point.x},${point.y}`));
  const push = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y });
  };
  // 남쪽 행은 바깥에서 안쪽으로 — 문 통로(가운데)는 어차피 lane 이라 뒤로 간다.
  for (let d = 1; d < room.w - 1; d += 1) {
    push(room.x + d, south);
    push(east - d, south);
  }
  for (let d = 1; d < room.w - 1; d += 1) {
    push(room.x + d, room.y);
    push(east - d, room.y);
  }
  for (let y = room.y + 1; y < south; y += 1) {
    push(room.x, y);
    push(east, y);
  }
  return out;
}

/**
 * 건물 밖을 「암흑 공허」로 비운다. 천장은 바닥·벽면에 이웃한 한 겹만 남는다.
 * 천장 정본 v2(검정 몸통 + 회암 테두리)에서는 건물 밖도 같은 검정이라 「벽 위에 천장이 없다」고 읽힌다 —
 * 밖을 다른 타일로 두면 천장 테두리가 건물 윤곽으로 드러난다. 그 뒤 천장을 다시 성형한다.
 */
export function carveOutsideVoid(map: GameMap, floor: readonly boolean[]): void {
  const W = map.width;
  const keep = new Set<number>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const structure = floor[i] === true || CREAM_FACE_TILES.has(map.lowerTiles[i] ?? TILE.EMPTY);
      if (!structure) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= map.height) continue;
          keep.add(ny * W + nx);
        }
      }
    }
  }
  for (let i = 0; i < map.lowerTiles.length; i += 1) {
    if (keep.has(i)) continue;
    if (!isCeilingTile(map.lowerTiles[i] ?? TILE.EMPTY)) continue;
    map.lowerTiles[i] = OUTSIDE_VOID_TILE;
    map.upperTiles[i] = TILE.EMPTY;
  }
  shapeInteriorCeiling(map);
}
