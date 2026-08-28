// harnessSuggestion/structureKitModel.ts
// 구조 킷 순수 변환 계층 — 감지 패턴 ↔ 저장 스키마 ↔ 팔레트 스탬프. store 의존 없음(유닛 테스트 대상).

import { sectionPatternSignature, type DetectedSectionPattern } from "@/editor/harnessSuggestion/patternDetect";
import { isHouseKitId, stampFootprintHouseKit } from "@/editor/houseKit";
import type { PaletteStamp, PaletteStampCell } from "@/editor/tilePaletteStamp";
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type {
  GameMap,
  HouseStructureKitDef,
  SectionStructureKitDef,
  StructureKitDef,
  TilesetDef,
} from "@/project/types";

/** 맵 구획(선택 영역과 같은 규약: 좌상단 + 크기). */
export interface MapRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 감지 패턴 → 저장 스키마. 상위 레이어 행은 내용이 있을 때만 기록(직렬화 최소화). */
export function structureKitFromPattern(
  pattern: DetectedSectionPattern,
  options: { readonly id?: string; readonly name?: string } = {},
): StructureKitDef {
  const rows = [];
  for (let row = 0; row < pattern.unit.height; row += 1) {
    const tiles: number[] = [];
    const upperTiles: number[] = [];
    let hasUpper = false;
    for (let column = 0; column < pattern.unit.width; column += 1) {
      const index = row * pattern.unit.width + column;
      tiles.push(pattern.unit.lower[index] ?? TILE.EMPTY);
      const upper = pattern.unit.upper[index] ?? TILE.EMPTY;
      upperTiles.push(upper);
      if (upper !== TILE.EMPTY) hasUpper = true;
    }
    rows.push(hasUpper ? { tiles, upperTiles } : { tiles });
  }
  return {
    id: options.id ?? `kit_${Math.random().toString(36).slice(2, 10)}`,
    kind: "section",
    name: options.name ?? autoKitName(pattern),
    width: pattern.unit.width,
    height: pattern.unit.height,
    rows,
    learnedFrom: "user-paint",
    createdAt: new Date().toISOString(),
  };
}

/** 맵 구획 → section 킷. 유저가 직접 고른 영역을 그대로 단면으로 굳힌다(성형 없음).
 * 상위 레이어 행은 내용이 있을 때만 기록 — structureKitFromPattern과 같은 직렬화 규약. */
export function structureKitFromMapRegion(
  map: GameMap,
  region: MapRegion,
  options: { readonly id?: string; readonly name?: string } = {},
): SectionStructureKitDef {
  const rows = [];
  for (let row = 0; row < region.height; row += 1) {
    const tiles: number[] = [];
    const upperTiles: number[] = [];
    let hasUpper = false;
    for (let column = 0; column < region.width; column += 1) {
      const index = (region.y + row) * map.width + (region.x + column);
      tiles.push(map.lowerTiles[index] ?? TILE.EMPTY);
      const upper = map.upperTiles[index] ?? TILE.EMPTY;
      upperTiles.push(upper);
      if (upper !== TILE.EMPTY) hasUpper = true;
    }
    rows.push(hasUpper ? { tiles, upperTiles } : { tiles });
  }
  return {
    id: options.id ?? `kit_${Math.random().toString(36).slice(2, 10)}`,
    kind: "section",
    name: options.name ?? `구조물 ${region.width}×${region.height}`,
    width: region.width,
    height: region.height,
    rows,
    learnedFrom: "user-paint",
    createdAt: new Date().toISOString(),
  };
}

const HOUSE_DOOR_TOP_TILE = 116;
const HOUSE_DOOR_BOTTOM_TILE = 146;

/** 킷 단위 크기 — section은 저장된 width/height, house는 날개 bbox. */
export function structureKitSize(kit: StructureKitDef): { readonly width: number; readonly height: number } {
  if (kit.kind === "house") {
    const width = Math.max(...kit.wings.map((wing) => wing.x + wing.w), 1);
    const height = Math.max(...kit.wings.map((wing) => wing.y + wing.h), 1);
    return { width, height };
  }
  return { width: kit.width, height: kit.height };
}

/** house 킷 전개 — 정본 stampFootprintHouseKit을 스크래치 맵에 실행해 셀 목록으로. */
export function expandHouseStructureKit(kit: HouseStructureKitDef): PaletteStampCell[] {
  if (!isHouseKitId(kit.houseKitId)) return [];
  const { width, height } = structureKitSize(kit);
  const scratch = {
    id: `scratch_${kit.id}`,
    name: kit.name ?? "집 킷",
    width,
    height,
    lowerTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    events: [],
  } as unknown as GameMap;
  const result = stampFootprintHouseKit(scratch, {
    wings: kit.wings,
    kitId: kit.houseKitId,
    ...(kit.stories ? { stories: kit.stories } : {}),
    ...(kit.lowWall ? { lowWall: true } : {}),
    ...(kit.windows !== undefined ? { windows: kit.windows } : {}),
    ...(kit.chimney ? { chimney: true } : {}),
  });
  if (!result.ok) return [];
  if (kit.door !== false && result.doorAt) {
    scratch.lowerTiles[(result.doorAt.y - 1) * width + result.doorAt.x] = HOUSE_DOOR_TOP_TILE;
    scratch.lowerTiles[result.doorAt.y * width + result.doorAt.x] = HOUSE_DOOR_BOTTOM_TILE;
  }
  const cells: PaletteStampCell[] = [];
  for (let index = 0; index < width * height; index += 1) {
    const dx = index % width;
    const dy = Math.floor(index / width);
    const lower = scratch.lowerTiles[index] ?? TILE.EMPTY;
    const upper = scratch.upperTiles[index] ?? TILE.EMPTY;
    if (lower !== TILE.EMPTY) cells.push({ dx, dy, layer: "lower", tile: lower });
    if (upper !== TILE.EMPTY) cells.push({ dx, dy, layer: "upper", tile: upper });
  }
  return cells;
}

/** 킷 단위 셀 목록 — section은 행렬 그대로, house는 정본 시공 전개. */
export function structureKitUnitCells(kit: StructureKitDef): PaletteStampCell[] {
  if (kit.kind === "house") return expandHouseStructureKit(kit);
  const cells: PaletteStampCell[] = [];
  for (let row = 0; row < kit.rows.length; row += 1) {
    const rowDef = kit.rows[row];
    if (!rowDef) continue;
    for (let column = 0; column < kit.width; column += 1) {
      const lower = rowDef.tiles[column] ?? TILE.EMPTY;
      const upper = rowDef.upperTiles?.[column] ?? TILE.EMPTY;
      if (lower !== TILE.EMPTY) cells.push({ dx: column, dy: row, layer: "lower", tile: lower });
      if (upper !== TILE.EMPTY) cells.push({ dx: column, dy: row, layer: "upper", tile: upper });
    }
  }
  return cells;
}

/**
 * 반복(가로 이어 찍기) 가능 여부.
 * ai.repeatability 가 있으면 그것이 정본 — 사람이 "한 채 완결"이라 표시한 우물·간판을
 * stamp_structure_kit 의 repeat 기본값 3 이 3개로 늘리는 것을 막는다.
 * 없으면 기존 동작(section 은 반복, house 는 한 채) 유지 — 하위 호환.
 */
export function structureKitRepeatable(kit: StructureKitDef): boolean {
  if (kit.ai?.repeatability === "fixed") return false;
  if (kit.ai?.repeatability === "repeat") return true;
  return kit.kind === "section";
}

/** 킷 → 팔레트 스탬프(기존 드래그 스탬프 페인트 경로 재사용 — TilePaintEngine.applyPaletteStamp). */
export function paletteStampFromKit(kit: StructureKitDef): PaletteStamp {
  const cells = structureKitUnitCells(kit);
  const { width, height } = structureKitSize(kit);
  const firstTile = cells[0]?.tile ?? 0;
  return {
    cells,
    height,
    width,
    kitId: kit.id,
    source: { endTile: firstTile, startTile: firstTile },
  };
}

/** 킷의 결정적 서명 — 감지 패턴 서명과 같은 규약(재제안 차단·중복 등록 차단).
 * house 킷은 전개 결과(셀 행렬)로 서명한다 — 같은 모양이면 출처가 달라도 같은 서명. */
export function structureKitSignature(kit: StructureKitDef): string {
  const { width, height } = structureKitSize(kit);
  const lower: number[] = new Array<number>(width * height).fill(TILE.EMPTY);
  const upper: number[] = new Array<number>(width * height).fill(TILE.EMPTY);
  if (kit.kind === "house") {
    for (const cell of expandHouseStructureKit(kit)) {
      const index = cell.dy * width + cell.dx;
      if (cell.layer === "lower") lower[index] = cell.tile;
      else upper[index] = cell.tile;
    }
    return sectionPatternSignature({ width, height, lower, upper });
  }
  for (let row = 0; row < height; row += 1) {
    const rowDef = kit.rows[row];
    for (let column = 0; column < width; column += 1) {
      lower[row * width + column] = rowDef?.tiles[column] ?? TILE.EMPTY;
      upper[row * width + column] = rowDef?.upperTiles?.[column] ?? TILE.EMPTY;
    }
  }
  return sectionPatternSignature({ width, height, lower, upper });
}

export function registeredKitSignatures(tileset: TilesetDef | undefined): ReadonlySet<string> {
  const signatures = new Set<string>();
  for (const kit of tileset?.structureKits ?? []) {
    signatures.add(structureKitSignature(kit));
  }
  return signatures;
}

/** 자동 이름: 단위에서 가장 흔한 타일의 타일 그림판 라벨 + "단면". LLM 없이 결정적.
 * 상위 레이어가 있으면 상위 우선 — 울타리/꽃 같은 장식 패턴은 상위가 정체성이고 하위는 받침 지면이다. */
function autoKitName(pattern: DetectedSectionPattern): string {
  const counts = new Map<number, number>();
  const upperSource = pattern.unit.upper.filter((tile) => tile !== TILE.EMPTY);
  const source = upperSource.length > 0 ? upperSource : pattern.unit.lower;
  for (const tile of source) {
    if (tile === TILE.EMPTY) continue;
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }
  let bestTile: number | null = null;
  let bestCount = -1;
  for (const [tile, count] of counts) {
    if (count > bestCount || (count === bestCount && bestTile !== null && tile < bestTile)) {
      bestTile = tile;
      bestCount = count;
    }
  }
  if (bestTile === null) return "패턴 스탬프";
  const label = describeChipsetTile(bestTile).label;
  return label ? `${label} 단면` : "패턴 스탬프";
}

/** 실내 오브젝트 셀 목록 → 팔레트 스탬프. 킷과 달리 오브젝트는 rows 가 없고 cells 가 정본이다. */
export function paletteStampFromCells(input: {
  readonly cells: readonly PaletteStampCell[];
  readonly width: number;
  readonly height: number;
  readonly kitId: string;
}): PaletteStamp {
  const firstTile = input.cells[0]?.tile ?? 0;
  return {
    cells: input.cells.map((cell) => ({ ...cell })),
    height: Math.max(1, input.height),
    width: Math.max(1, input.width),
    kitId: input.kitId,
    source: { endTile: firstTile, startTile: firstTile },
  };
}
