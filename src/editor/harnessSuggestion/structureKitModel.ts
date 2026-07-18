// harnessSuggestion/structureKitModel.ts
// 구조 킷 순수 변환 계층 — 감지 패턴 ↔ 저장 스키마 ↔ 팔레트 스탬프. store 의존 없음(유닛 테스트 대상).

import { sectionPatternSignature, type DetectedSectionPattern } from "@/editor/harnessSuggestion/patternDetect";
import type { PaletteStamp, PaletteStampCell } from "@/editor/tilePaletteStamp";
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type { StructureKitDef, TilesetDef } from "@/project/types";

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

/** 킷 → 팔레트 스탬프(기존 드래그 스탬프 페인트 경로 재사용 — TilePaintEngine.applyPaletteStamp). */
export function paletteStampFromKit(kit: StructureKitDef): PaletteStamp {
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
  const firstTile = cells[0]?.tile ?? 0;
  return {
    cells,
    height: kit.height,
    width: kit.width,
    kitId: kit.id,
    source: { endTile: firstTile, startTile: firstTile },
  };
}

/** 킷의 결정적 서명 — 감지 패턴 서명과 같은 규약(재제안 차단·중복 등록 차단). */
export function structureKitSignature(kit: StructureKitDef): string {
  const lower: number[] = [];
  const upper: number[] = [];
  for (let row = 0; row < kit.height; row += 1) {
    const rowDef = kit.rows[row];
    for (let column = 0; column < kit.width; column += 1) {
      lower.push(rowDef?.tiles[column] ?? TILE.EMPTY);
      upper.push(rowDef?.upperTiles?.[column] ?? TILE.EMPTY);
    }
  }
  return sectionPatternSignature({ width: kit.width, height: kit.height, lower, upper });
}

export function registeredKitSignatures(tileset: TilesetDef | undefined): ReadonlySet<string> {
  const signatures = new Set<string>();
  for (const kit of tileset?.structureKits ?? []) {
    signatures.add(structureKitSignature(kit));
  }
  return signatures;
}

/** 자동 이름: 단위에서 가장 흔한 타일의 칩셋 라벨 + "단면". LLM 없이 결정적.
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
