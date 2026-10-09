// 영역 내 현재 타일 분포 요약 — 모달 header 의 통계 칩이 표시.
// 순수 함수. describeChipsetTile 로 라벨링, top N 카테고리 + 개수.
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";
import type { RegionRect } from "./clipToRegion";

export interface RegionTileStatEntry {
  readonly label: string;
  readonly count: number;
}

export interface RegionTileStats {
  /** 상위 3개 타일 카테고리 (빈도순). */
  readonly top: readonly RegionTileStatEntry[];
  /** 영역 전체 셀 수. */
  readonly totalCells: number;
  /** 빈(EMPTY) 셀 수. */
  readonly emptyCells: number;
}

/** 영역의 lower 타일 분포를 요약. upper 는 보조 정보로 같이 계산하되 표현은 lower 위주.
 *  동일 셀에 lower/upper 가 겹치면 lower 카테고리를 우선. */
export function summarizeRegionTiles(map: GameMap, region: RegionRect): RegionTileStats {
  const { x, y, width: rw, height: rh } = region;
  const totalCells = rw * rh;
  const counts = new Map<string, number>();
  let emptyCells = 0;

  for (let dy = 0; dy < rh; dy += 1) {
    for (let dx = 0; dx < rw; dx += 1) {
      const mapX = x + dx;
      const mapY = y + dy;
      if (mapX < 0 || mapY < 0 || mapX >= map.width || mapY >= map.height) continue;
      const idx = mapY * map.width + mapX;
      const lower = map.lowerTiles[idx] ?? TILE.EMPTY;
      if (lower === TILE.EMPTY || lower < 0) {
        emptyCells += 1;
        bump(counts, "빈");
        continue;
      }
      const descriptor = describeChipsetTile(lower);
      const label = (descriptor.label || `타일 ${lower}`).trim();
      bump(counts, label);
    }
  }

  const top = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { top, totalCells, emptyCells };
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** 통계 칩용 컴팩트 문자열 — "잔디6·물3·빈3". */
export function formatRegionTileStatsCompact(stats: RegionTileStats): string {
  if (stats.top.length === 0) return "";
  return stats.top.map((e) => `${e.label}${e.count}`).join("·");
}
