// 영역 내 base ↔ clipped 의 타일 변경을 4-연결성 청크로 묶는다.
// 모달의 부분 적용 UI(레이어 + 구역 덩어리)가 소비한다.
// 순수 함수 — store/세션 의존 없음. 유닛 테스트 대상.
//
// chunk = 같은 레이어에서 인접(상하좌우)한 변경 셀의 연결 성분.
// 라벨은 청크 내 가장 빈도 높은 타일의 describeChipsetTile 이름 + 셀 수.
// (예: "집 1동(5칸)", "길 3칸". 커스텀 타일은 "타일 240(5칸)" 폴백.)
import type { TilesetDef, MapId, Project } from "@/project/types";
import type { RegionRect } from "./clipToRegion";
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";

export type RegionLayer = "lower" | "upper";

export interface RegionChunkCell {
  readonly x: number;
  readonly y: number;
  /** map.lowerTiles/upperTiles 인덱스 — composePartialProject 가 바로 쓴다. */
  readonly index: number;
}

export interface RegionChunk {
  readonly id: string;
  readonly layer: RegionLayer;
  readonly cells: readonly RegionChunkCell[];
  /** 청크 내 대표(가장 많은) 타일 id — 라벨링용. */
  readonly dominantTile: number;
  readonly label: string;
}

export interface RegionChangeGroups {
  readonly lower: readonly RegionChunk[];
  readonly upper: readonly RegionChunk[];
  readonly unchangedCells: number;
}

type TileStacks = Readonly<Record<number, readonly number[]>>;

function stacksEqual(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function layerCellChanged(
  index: number,
  baseArr: readonly number[],
  clippedArr: readonly number[],
  baseStacks: TileStacks | undefined,
  clippedStacks: TileStacks | undefined,
): boolean {
  return (baseArr[index] ?? -1) !== (clippedArr[index] ?? -1)
    || !stacksEqual(baseStacks?.[index], clippedStacks?.[index]);
}

/** 같은 레이어에서 인접(상하좌우)한 변경 셀을 BFS 로 묶는다.
 *  변경 판정은 (base[i] ?? -1) !== (clipped[i] ?? -1) — undefined 도 -1 로 정규화. */
function groupLayerChanges(
  map: { readonly width: number; readonly height: number },
  region: RegionRect,
  baseArr: readonly number[],
  clippedArr: readonly number[],
  baseStacks: TileStacks | undefined,
  clippedStacks: TileStacks | undefined,
  layer: RegionLayer,
  idPrefix: string,
): RegionChunk[] {
  const { x: rx, y: ry, width: rw, height: rh } = region;
  const visited = new Set<string>();
  const chunks: RegionChunk[] = [];
  let chunkCounter = 0;

  for (let dy = 0; dy < rh; dy += 1) {
    for (let dx = 0; dx < rw; dx += 1) {
      const localKey = `${dx},${dy}`;
      if (visited.has(localKey)) continue;
      const mapX = rx + dx;
      const mapY = ry + dy;
      if (mapX < 0 || mapY < 0 || mapX >= map.width || mapY >= map.height) continue;
      const mapIndex = mapY * map.width + mapX;
      if (!layerCellChanged(mapIndex, baseArr, clippedArr, baseStacks, clippedStacks)) continue;

      // BFS 로 연결 성분 수집
      const queue: Array<{ dx: number; dy: number; mapIndex: number }> = [{ dx, dy, mapIndex }];
      visited.add(localKey);
      const cells: RegionChunkCell[] = [];
      const tileCounts = new Map<number, number>();
      while (queue.length > 0) {
        const cur = queue.shift()!;
        cells.push({ x: cur.dx, y: cur.dy, index: cur.mapIndex });
        const t = clippedArr[cur.mapIndex] ?? -1;
        tileCounts.set(t, (tileCounts.get(t) ?? 0) + 1);
        const neighbors = [
          { dx: cur.dx, dy: cur.dy - 1 },
          { dx: cur.dx, dy: cur.dy + 1 },
          { dx: cur.dx - 1, dy: cur.dy },
          { dx: cur.dx + 1, dy: cur.dy },
        ];
        for (const n of neighbors) {
          if (n.dx < 0 || n.dy < 0 || n.dx >= rw || n.dy >= rh) continue;
          const nKey = `${n.dx},${n.dy}`;
          if (visited.has(nKey)) continue;
          const nMapX = rx + n.dx;
          const nMapY = ry + n.dy;
          if (nMapX < 0 || nMapY < 0 || nMapX >= map.width || nMapY >= map.height) continue;
          const nMapIndex = nMapY * map.width + nMapX;
          if (!layerCellChanged(nMapIndex, baseArr, clippedArr, baseStacks, clippedStacks)) continue;
          visited.add(nKey);
          queue.push({ dx: n.dx, dy: n.dy, mapIndex: nMapIndex });
        }
      }

      let dominantTile = -1;
      let maxCount = -1;
      for (const [tile, count] of tileCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominantTile = tile;
        }
      }
      chunks.push({
        id: `${idPrefix}-${layer}-${chunkCounter}`,
        layer,
        cells,
        dominantTile,
        label: "",
      });
      chunkCounter += 1;
    }
  }
  return chunks;
}

/** base ↔ clipped 의 영역 변경을 청크로 묶는다. 순수 함수. */
export function groupRegionChanges(
  base: Project,
  clipped: Project,
  mapId: MapId,
  region: RegionRect,
): RegionChangeGroups {
  const baseMap = base.maps[mapId];
  const clippedMap = clipped.maps[mapId];
  if (!baseMap || !clippedMap) return { lower: [], upper: [], unchangedCells: 0 };
  const { width: rw, height: rh } = region;
  const totalCells = rw * rh;

  const lower = groupLayerChanges(
    baseMap,
    region,
    baseMap.lowerTiles,
    clippedMap.lowerTiles,
    baseMap.lowerTileStacks,
    clippedMap.lowerTileStacks,
    "lower",
    "chunk",
  );
  const upper = groupLayerChanges(
    baseMap,
    region,
    baseMap.upperTiles,
    clippedMap.upperTiles,
    baseMap.upperTileStacks,
    clippedMap.upperTileStacks,
    "upper",
    "chunk",
  );

  // unchangedCells = lower/upper 어느 쪽에서도 변경되지 않은 셀의 대략적 수.
  // chunk 는 레이어별 독립이므로 max(lowerCells, upperCells) 를 변경 셀 수로 본다.
  const lowerCells = lower.reduce((acc, c) => acc + c.cells.length, 0);
  const upperCells = upper.reduce((acc, c) => acc + c.cells.length, 0);
  const unchangedCells = Math.max(0, totalCells - Math.max(lowerCells, upperCells));

  return { lower, upper, unchangedCells };
}

/** 청크 라벨: 대표 타일의 chipset 라벨 + 셀 수.
 * 라벨이 빈 문자열이면 "타일 N" 폴백. 라벨 끝에 "(M칸)" 을 붙인다. */
export function labelRegionChunk(chunk: RegionChunk, tileset: TilesetDef | undefined): string {
  void tileset; // 현재는 describeChipsetTile 만 사용. 향후 tileset.tileMeta 반영 여지.
  const descriptor = describeChipsetTile(chunk.dominantTile);
  const baseName = (descriptor.label || `타일 ${chunk.dominantTile}`).trim();
  return `${baseName}(${chunk.cells.length}칸)`;
}

/**
 * 청크가 영역 안에서 어느 쪽에 있는지 사람 말로. 셀 무게중심을 영역의 3×3 구획에 떨어뜨린다.
 *
 * 왜 필요한가: 라벨은 대표 타일 이름이라 같은 타일로 된 서로 다른 덩어리가 완전히 같은 문자열이
 * 된다("Stone floor(3칸)" 이 두 줄). 목록만 보고는 어느 것이 어느 덩어리인지 구분할 수 없었다.
 * 위치를 붙이면 클릭하지 않고도 고를 수 있다.
 */
export function describeChunkPosition(chunk: RegionChunk, region: RegionRect): string {
  if (chunk.cells.length === 0) return "";
  let sumX = 0;
  let sumY = 0;
  for (const cell of chunk.cells) {
    sumX += cell.x;
    sumY += cell.y;
  }
  // cells 의 x/y 는 영역 원점 기준 로컬 좌표(groupLayerChanges 가 dx/dy 로 채운다).
  const cx = sumX / chunk.cells.length;
  const cy = sumY / chunk.cells.length;
  const sector = (value: number, extent: number): 0 | 1 | 2 => {
    if (!Number.isFinite(extent) || extent <= 0) return 1;
    const ratio = value / extent;
    if (ratio < 1 / 3) return 0;
    if (ratio < 2 / 3) return 1;
    return 2;
  };
  const col = sector(cx, region.width);
  const row = sector(cy, region.height);
  const NAMES = [
    ["좌상단", "위쪽", "우상단"],
    ["왼쪽", "가운데", "오른쪽"],
    ["좌하단", "아래쪽", "우하단"],
  ] as const;
  return NAMES[row]![col]!;
}

/** 모든 청크의 라벨을 채운 새 groups 를 반환(불변). */
export function withChunkLabels(
  groups: RegionChangeGroups,
  tileset: TilesetDef | undefined,
): RegionChangeGroups {
  const labelAll = (chunks: readonly RegionChunk[]) =>
    chunks.map((c) => ({ ...c, label: labelRegionChunk(c, tileset) }));
  return {
    lower: labelAll(groups.lower),
    upper: labelAll(groups.upper),
    unchangedCells: groups.unchangedCells,
  };
}
