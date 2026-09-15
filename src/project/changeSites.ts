// 변경 지점(change site) — AI 실행의 before→after 를 「사진 한 쌍이 말할 수 있는 단위」로 묶는다.
//
// 기존 보고(openWideChangeViewer)는 맵 하나의 전체 diff bbox 한 장이었다. AI 가 한 맵의 북쪽과
// 남쪽을 같이 고치면 bbox 가 맵 전체가 되어 "어디가 바뀌었나" 를 사진이 말하지 못한다. 여기서는
// 바뀐 칸(타일 diff + 이벤트 추가/삭제/이동 좌표)을 **가까운 것끼리 뭉쳐**(체비셰프 거리 ≤ gap)
// 지점 목록으로 만든다 — 보고서 모달이 지점마다 before/after 한 쌍을 그린다.
//
// 순수 모듈이다: src/editor 를 import 하지 않는다(레이어). RegionRect 와 구조가 같은 SiteRect 를
// 지역 정의한다 — 구조적 타이핑으로 렌더러(RegionRect)에 그대로 넘어간다.
// 타일 비교는 lowerTiles/upperTiles 만 본다(기존 computeMapTileChangeBounds 와 같은 시야) —
// 스택·속성 변경은 그림에 안 나오므로 지점이 아니라 내역(ledger)의 몫이다.
import type { GameMap, Project } from "@/project/types";

export interface SiteRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type ChangeSiteKind = "tiles" | "events" | "mixed" | "map-added" | "map-removed" | "map-resized";

export interface ChangeSite {
  readonly mapId: string;
  readonly mapName: string;
  readonly kind: ChangeSiteKind;
  /** pad 포함, 맵 경계로 클램프된 렌더 영역. */
  readonly region: SiteRect;
  readonly tilesChanged: number;
  readonly eventsAdded: number;
  readonly eventsRemoved: number;
  readonly eventsMoved: number;
  /** 사람이 읽는 자리 표기 — 「(13,5) 8×6」. 맵 이름은 호출자가 머리에 단다. */
  readonly placeLabel: string;
  /** 사람이 읽는 규모 표기 — 「타일 41 · 이벤트 +1」. */
  readonly statsLabel: string;
}

export interface ChangeSiteOptions {
  /** 뭉친 칸들의 bbox 에 두르는 여백(타일). 기본 3 — 기존 변경 카드 crop 과 같다. */
  readonly pad?: number;
  /** 이 거리(체비셰프) 이하로 떨어진 변경 칸은 한 지점으로 뭉친다. 기본 4. */
  readonly gap?: number;
  /** 지점 상한. 넘치면 gap 을 두 배씩 키워 다시 뭉치고, 그래도 넘치면 맵당 한 지점으로 접는다. 기본 12. */
  readonly maxSites?: number;
}

interface CellDiff {
  readonly cells: Set<number>; // y * width + x
  readonly tileCells: Set<number>;
  readonly eventMarks: readonly { readonly x: number; readonly y: number; readonly change: "added" | "removed" | "moved" }[];
}

function collectCellDiff(base: GameMap, next: GameMap): CellDiff {
  const cells = new Set<number>();
  const tileCells = new Set<number>();
  for (let i = 0; i < base.width * base.height; i += 1) {
    if (base.lowerTiles[i] !== next.lowerTiles[i] || base.upperTiles[i] !== next.upperTiles[i]) {
      cells.add(i);
      tileCells.add(i);
    }
  }
  const mark = (x: number, y: number): void => {
    if (x >= 0 && y >= 0 && x < base.width && y < base.height) cells.add(y * base.width + x);
  };
  const eventMarks: { x: number; y: number; change: "added" | "removed" | "moved" }[] = [];
  const beforeEvents = new Map(base.events.map((event) => [event.id, event]));
  const afterEvents = new Map(next.events.map((event) => [event.id, event]));
  for (const [id, event] of afterEvents) {
    const prior = beforeEvents.get(id);
    if (!prior) {
      eventMarks.push({ x: event.x, y: event.y, change: "added" });
      mark(event.x, event.y);
    } else if (prior.x !== event.x || prior.y !== event.y) {
      // 이동은 출발지와 도착지 둘 다 지점이다 — 한쪽만 찍으면 "사라졌다/생겼다" 로 읽힌다.
      eventMarks.push({ x: event.x, y: event.y, change: "moved" });
      mark(prior.x, prior.y);
      mark(event.x, event.y);
    }
  }
  for (const [id, event] of beforeEvents) {
    if (!afterEvents.has(id)) {
      eventMarks.push({ x: event.x, y: event.y, change: "removed" });
      mark(event.x, event.y);
    }
  }
  return { cells, tileCells, eventMarks };
}

/** 체비셰프 거리 ≤ gap 인 칸끼리 잇는 연결 성분 — BFS. 성분마다 칸 목록을 돌려준다. */
function clusterCells(cells: ReadonlySet<number>, width: number, height: number, gap: number): number[][] {
  const clusters: number[][] = [];
  const seen = new Set<number>();
  for (const seed of cells) {
    if (seen.has(seed)) continue;
    const cluster: number[] = [];
    const queue: number[] = [seed];
    seen.add(seed);
    while (queue.length > 0) {
      const cell = queue.pop()!;
      cluster.push(cell);
      const cx = cell % width;
      const cy = Math.floor(cell / width);
      for (let dy = -gap; dy <= gap; dy += 1) {
        const y = cy + dy;
        if (y < 0 || y >= height) continue;
        for (let dx = -gap; dx <= gap; dx += 1) {
          const x = cx + dx;
          if (x < 0 || x >= width) continue;
          const neighbor = y * width + x;
          if (!seen.has(neighbor) && cells.has(neighbor)) {
            seen.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function paddedBounds(cluster: readonly number[], map: GameMap, pad: number): SiteRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of cluster) {
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(map.width - 1, maxX + pad);
  const y1 = Math.min(map.height - 1, maxY + pad);
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

const inRect = (rect: SiteRect, x: number, y: number): boolean =>
  x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;

function statsLabelOf(tiles: number, added: number, removed: number, moved: number): string {
  const parts: string[] = [];
  if (tiles > 0) parts.push(`타일 ${tiles}`);
  if (added > 0) parts.push(`이벤트 +${added}`);
  if (removed > 0) parts.push(`이벤트 −${removed}`);
  if (moved > 0) parts.push(`이벤트 이동 ${moved}`);
  return parts.join(" · ");
}

function fullMapSite(map: GameMap, kind: ChangeSiteKind, statsLabel: string): ChangeSite {
  return {
    mapId: map.id,
    mapName: map.name,
    kind,
    region: { x: 0, y: 0, width: map.width, height: map.height },
    tilesChanged: 0,
    eventsAdded: 0,
    eventsRemoved: 0,
    eventsMoved: 0,
    placeLabel: `전체 ${map.width}×${map.height}`,
    statsLabel,
  };
}

function siteOf(cluster: readonly number[], diff: CellDiff, map: GameMap, pad: number): ChangeSite {
  const region = paddedBounds(cluster, map, pad);
  let tiles = 0;
  for (const cell of cluster) if (diff.tileCells.has(cell)) tiles += 1;
  let added = 0;
  let removed = 0;
  let moved = 0;
  for (const markEntry of diff.eventMarks) {
    if (!inRect(region, markEntry.x, markEntry.y)) continue;
    if (markEntry.change === "added") added += 1;
    else if (markEntry.change === "removed") removed += 1;
    else moved += 1;
  }
  const kind: ChangeSiteKind = tiles > 0 && added + removed + moved > 0 ? "mixed" : tiles > 0 ? "tiles" : "events";
  return {
    mapId: map.id,
    mapName: map.name,
    kind,
    region,
    tilesChanged: tiles,
    eventsAdded: added,
    eventsRemoved: removed,
    eventsMoved: moved,
    placeLabel: `(${region.x},${region.y}) ${region.width}×${region.height}`,
    statsLabel: statsLabelOf(tiles, added, removed, moved),
  };
}

/**
 * before→after 를 변경 지점 목록으로. 순서는 after 의 맵 순서(삭제된 맵은 맨 뒤), 맵 안에서는
 * 위→아래, 왼쪽→오른쪽. 지점이 maxSites 를 넘으면 gap 을 두 배씩 키워 다시 뭉친다 — 지점을
 * 자르는 것보다 굵게 뭉치는 쪽이 정직하다(안 보여주는 변경이 없다).
 */
export function computeChangeSites(before: Project, after: Project, options: ChangeSiteOptions = {}): ChangeSite[] {
  const pad = options.pad ?? 3;
  const baseGap = options.gap ?? 4;
  const maxSites = options.maxSites ?? 12;

  interface MapWork { readonly map: GameMap; readonly diff: CellDiff }
  const fixed: ChangeSite[] = [];
  const work: MapWork[] = [];

  for (const mapId of Object.keys(after.maps)) {
    const next = after.maps[mapId]!;
    const base = before.maps[mapId];
    if (!base) {
      fixed.push(fullMapSite(next, "map-added", "맵 추가"));
      continue;
    }
    if (base.width !== next.width || base.height !== next.height) {
      fixed.push(fullMapSite(next, "map-resized", `크기 ${base.width}×${base.height} → ${next.width}×${next.height}`));
      continue;
    }
    const diff = collectCellDiff(base, next);
    if (diff.cells.size > 0) work.push({ map: next, diff });
  }
  for (const mapId of Object.keys(before.maps)) {
    if (!after.maps[mapId]) fixed.push(fullMapSite(before.maps[mapId]!, "map-removed", "맵 삭제"));
  }

  const build = (gap: number): ChangeSite[] => {
    const sites: ChangeSite[] = [];
    for (const { map, diff } of work) {
      const clusters = clusterCells(diff.cells, map.width, map.height, gap);
      const mapSites = clusters.map((cluster) => siteOf(cluster, diff, map, pad));
      mapSites.sort((a, b) => a.region.y - b.region.y || a.region.x - b.region.x);
      sites.push(...mapSites);
    }
    return sites;
  };

  let gap = baseGap;
  let sites = build(gap);
  // 상한 초과 → 더 굵게 뭉친다. gap 이 맵 최대 변보다 커지면 맵당 한 지점으로 수렴하므로 종료한다.
  const largestSide = work.reduce((acc, item) => Math.max(acc, item.map.width, item.map.height), 0);
  while (fixed.length + sites.length > maxSites && gap < largestSide) {
    gap *= 2;
    sites = build(gap);
  }
  return [...fixed, ...sites];
}
