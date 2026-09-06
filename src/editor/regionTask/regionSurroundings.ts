// 영역 주변 브리핑 — "이 사각형 밖에 무엇이 있는가" 를 구조화해서 AI 메시지에 넣는다.
//
// 왜 필요한가: buildRegionTaskMessage 가 모델에게 주는 공간 정보는 `선택 영역: (x,y) w×h`
// 한 줄뿐이었다. 주변이 잔디인지 모래인지, 길이 어느 좌표로 들어오는지, 물가가 어느 변에
// 붙었는지 모른 채 영역 안을 채웠다 — 그래서 "주변과 어울리게" 라는 요청을 이행할 근거 자체가
// 없었다. get_map_region 은 #/./~/T/E 시맨틱 문자라 재질(잔디 vs 모래 vs 흙길)을 구분하지 못한다.
//
// 순수 함수 — store/DOM 의존 없음. regionContextSuggestions 의 카테고리 분류를 재사용한다
// (추천 칩과 브리핑이 같은 눈으로 주변을 보게 한다).
import { TILE } from "@/project/defaults/constants";
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { isPassable } from "@/project/collision";
import { eventDisplayName } from "@/project/eventDisplayName";
import type { GameMap, MapId, Project, TilesetDef } from "@/project/types";
import type { RegionRect } from "./clipToRegion";
import { inRegion } from "./clipToRegion";
import {
  categorizeTileForContext,
  categorizeTileset,
  type ContextTileCategory,
} from "./regionContextSuggestions";
import type { TilesetCategory } from "./suggestedCommands";
import { summarizeRegionTiles, type RegionTileStats } from "./regionTileStats";

/** 영역의 네 변. 좌표축 기준으로 north = y 가 작은 쪽. */
export type RegionEdge = "north" | "east" | "south" | "west";

export const REGION_EDGE_LABELS: Readonly<Record<RegionEdge, string>> = {
  north: "위쪽",
  east: "오른쪽",
  south: "아래쪽",
  west: "왼쪽",
};

export interface RegionMaterialCount {
  readonly label: string;
  readonly count: number;
}

export interface RegionEdgeProfile {
  readonly edge: RegionEdge;
  /** 띠에서 실제로 센 칸 수(맵 밖은 제외). 0 이면 이 변은 맵 경계다. */
  readonly cells: number;
  /** 바닥(lower) 재료 상위 3개. */
  readonly materials: readonly RegionMaterialCount[];
  /** 상층(upper) 소품 상위 3개 — 나무·울타리·지붕이 여기 있다. */
  readonly props: readonly RegionMaterialCount[];
  readonly categories: Readonly<Record<ContextTileCategory, number>>;
}

/** 영역 안에서 반드시 이어야 하는 지점 — 바깥 이웃이 길/물인 경계 셀. */
export interface RegionCrossing {
  /** 영역 **안쪽** 경계 셀. 여기를 길/물로 이어야 끊기지 않는다. */
  readonly x: number;
  readonly y: number;
  readonly edge: RegionEdge;
  readonly kind: "road" | "water";
}

/** 바깥에서 걸어 들어올 수 있는 경계 셀 — 벽으로 막으면 진입이 끊긴다. */
export interface RegionEntrance {
  readonly x: number;
  readonly y: number;
  readonly edge: RegionEdge;
}

export interface RegionSurroundingEvent {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

export interface RegionSurroundings {
  readonly mapId: MapId;
  readonly region: RegionRect;
  /** 분석한 바깥 띠의 두께(칸). */
  readonly margin: number;
  readonly tilesetId: string;
  readonly tilesetCategory: TilesetCategory;
  readonly edges: readonly RegionEdgeProfile[];
  readonly crossings: readonly RegionCrossing[];
  readonly entrances: readonly RegionEntrance[];
  /** 바깥 띠 전체의 카테고리 합계. */
  readonly outsideCategories: Readonly<Record<ContextTileCategory, number>>;
  /** 영역 밖 margin 범위 안의 이벤트(좌표순). */
  readonly neighborEvents: readonly RegionSurroundingEvent[];
  /** 영역 안 이벤트(좌표순) — 재배치 대상 목록. */
  readonly insideEvents: readonly RegionSurroundingEvent[];
  readonly insideTiles: RegionTileStats;
}

const EDGE_ORDER: readonly RegionEdge[] = ["north", "east", "south", "west"];
const MIN_MARGIN = 2;
const MAX_MARGIN = 6;

/** 영역 크기에 비례한 바깥 띠 두께 — 작은 영역에 8칸을 보면 무관한 지형이 우세해진다. */
export function regionSurroundingMargin(region: RegionRect): number {
  const span = Math.max(region.width, region.height);
  return Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, Math.ceil(span / 3)));
}

function emptyCategories(): Record<ContextTileCategory, number> {
  return { water: 0, road: 0, forest: 0, building: 0, other: 0 };
}

function bump(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function topLabels(counts: Map<string, number>, limit = 3): RegionMaterialCount[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    // 같은 개수면 라벨 사전순 — 같은 입력에 같은 브리핑(스냅샷 안정성).
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function tileLabel(tileId: number): string {
  const descriptor = describeChipsetTile(tileId);
  return (descriptor.label || `타일 ${tileId}`).trim();
}

function isEmptyTile(tileId: number | undefined): boolean {
  return tileId === undefined || tileId === TILE.EMPTY || tileId < 0;
}

/**
 * 한 칸의 카테고리 — 상층 소품(나무·지붕)이 있으면 그쪽을 우선한다.
 * categorizeTileForContext 는 lower 한 장만 보므로, 상층에 얹힌 나무·지붕이 "other" 로 떨어진다.
 */
export function categorizeRegionCell(map: GameMap, index: number, tileset: TilesetDef | undefined): ContextTileCategory {
  const upper = map.upperTiles[index];
  if (!isEmptyTile(upper)) {
    const category = categorizeTileForContext(upper, tileset);
    if (category !== "other") return category;
  }
  const lower = map.lowerTiles[index];
  if (isEmptyTile(lower)) return "other";
  return categorizeTileForContext(lower, tileset);
}

/** 변별 바깥 띠의 사각형. 모서리는 어느 변에도 넣지 않는다(양쪽에서 두 번 세는 것을 피한다). */
function edgeBand(region: RegionRect, edge: RegionEdge, margin: number): RegionRect {
  if (edge === "north") return { x: region.x, y: region.y - margin, width: region.width, height: margin };
  if (edge === "south") return { x: region.x, y: region.y + region.height, width: region.width, height: margin };
  if (edge === "west") return { x: region.x - margin, y: region.y, width: margin, height: region.height };
  return { x: region.x + region.width, y: region.y, width: margin, height: region.height };
}

function profileEdge(
  map: GameMap,
  region: RegionRect,
  edge: RegionEdge,
  margin: number,
  tileset: TilesetDef | undefined,
): RegionEdgeProfile {
  const band = edgeBand(region, edge, margin);
  const materials = new Map<string, number>();
  const props = new Map<string, number>();
  const categories = emptyCategories();
  let cells = 0;
  for (let y = band.y; y < band.y + band.height; y += 1) {
    for (let x = band.x; x < band.x + band.width; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      cells += 1;
      const index = y * map.width + x;
      const lower = map.lowerTiles[index];
      const upper = map.upperTiles[index];
      if (isEmptyTile(lower)) bump(materials, "빈");
      else bump(materials, tileLabel(lower));
      if (!isEmptyTile(upper)) bump(props, tileLabel(upper));
      categories[categorizeRegionCell(map, index, tileset)] += 1;
    }
  }
  return {
    edge,
    cells,
    materials: topLabels(materials),
    props: topLabels(props),
    categories,
  };
}

/** 경계 안쪽 셀과 그 바로 밖 이웃 쌍. 맵 밖으로 나가는 쌍은 만들지 않는다. */
export function regionBorderPairs(
  map: Pick<GameMap, "width" | "height">,
  region: RegionRect,
): { readonly inside: { x: number; y: number }; readonly outside: { x: number; y: number }; readonly edge: RegionEdge }[] {
  const pairs: { inside: { x: number; y: number }; outside: { x: number; y: number }; edge: RegionEdge }[] = [];
  const push = (ix: number, iy: number, ox: number, oy: number, edge: RegionEdge): void => {
    if (ix < 0 || iy < 0 || ix >= map.width || iy >= map.height) return;
    if (ox < 0 || oy < 0 || ox >= map.width || oy >= map.height) return;
    pairs.push({ inside: { x: ix, y: iy }, outside: { x: ox, y: oy }, edge });
  };
  for (let x = region.x; x < region.x + region.width; x += 1) {
    push(x, region.y, x, region.y - 1, "north");
    push(x, region.y + region.height - 1, x, region.y + region.height, "south");
  }
  for (let y = region.y; y < region.y + region.height; y += 1) {
    push(region.x, y, region.x - 1, y, "west");
    push(region.x + region.width - 1, y, region.x + region.width, y, "east");
  }
  return pairs;
}

/**
 * 영역 밖 상황 + 영역 안 현황을 한 구조체로. 맵이 없으면 null.
 * 좌표는 모두 절대 맵 좌표다(모델이 그대로 도구 인자에 쓸 수 있게).
 */
export function analyzeRegionSurroundings(
  project: Project,
  mapId: MapId,
  region: RegionRect,
): RegionSurroundings | null {
  const map = project.maps[mapId];
  if (!map) return null;
  const tileset = project.tilesets[map.tilesetId];
  const margin = regionSurroundingMargin(region);
  const edges = EDGE_ORDER.map((edge) => profileEdge(map, region, edge, margin, tileset));
  const outsideCategories = emptyCategories();
  for (const profile of edges) {
    for (const key of Object.keys(outsideCategories) as ContextTileCategory[]) {
      outsideCategories[key] += profile.categories[key];
    }
  }

  const crossings: RegionCrossing[] = [];
  const entrances: RegionEntrance[] = [];
  for (const pair of regionBorderPairs(map, region)) {
    const outsideIndex = pair.outside.y * map.width + pair.outside.x;
    const category = categorizeRegionCell(map, outsideIndex, tileset);
    if (category === "road" || category === "water") {
      crossings.push({ x: pair.inside.x, y: pair.inside.y, edge: pair.edge, kind: category });
    }
    if (isPassable(project, map, pair.outside.x, pair.outside.y)) {
      entrances.push({ x: pair.inside.x, y: pair.inside.y, edge: pair.edge });
    }
  }

  const byPosition = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    (a.y - b.y) || (a.x - b.x);
  const insideEvents: RegionSurroundingEvent[] = [];
  const neighborEvents: RegionSurroundingEvent[] = [];
  const outerBox: RegionRect = {
    x: region.x - margin,
    y: region.y - margin,
    width: region.width + margin * 2,
    height: region.height + margin * 2,
  };
  for (const event of map.events ?? []) {
    const entry = { id: event.id, name: eventDisplayName(event), x: event.x, y: event.y };
    if (inRegion(event.x, event.y, region)) insideEvents.push(entry);
    else if (inRegion(event.x, event.y, outerBox)) neighborEvents.push(entry);
  }
  insideEvents.sort(byPosition);
  neighborEvents.sort(byPosition);

  return {
    mapId,
    region,
    margin,
    tilesetId: map.tilesetId,
    tilesetCategory: categorizeTileset(map.tilesetId),
    edges,
    crossings,
    entrances,
    outsideCategories,
    neighborEvents,
    insideEvents,
    insideTiles: summarizeRegionTiles(map, region),
  };
}

function formatCounts(entries: readonly RegionMaterialCount[]): string {
  return entries.map((entry) => `${entry.label} ${entry.count}칸`).join(", ");
}

/** 좌표 목록을 상한까지 나열하고 나머지는 개수로 접는다. */
function formatPoints(points: readonly { readonly x: number; readonly y: number }[], limit: number): string {
  const shown = points.slice(0, limit).map((point) => `(${point.x},${point.y})`).join(" ");
  const rest = points.length - Math.min(points.length, limit);
  return rest > 0 ? `${shown} …외 ${rest}곳` : shown;
}

const CROSSING_KIND_LABEL: Readonly<Record<RegionCrossing["kind"], string>> = {
  road: "길",
  water: "물",
};

/**
 * 브리핑 텍스트. 좌표 나열은 상한을 두어 컨텍스트를 갉아먹지 않게 한다
 * (물가를 한 변 전체가 접하면 crossings 가 수십 개가 된다).
 */
export function formatRegionSurroundingsBrief(surroundings: RegionSurroundings): string {
  const lines: string[] = [`주변 상황 (영역 밖 ${surroundings.margin}칸 띠, 좌표는 절대 맵 좌표):`];
  for (const profile of surroundings.edges) {
    const label = REGION_EDGE_LABELS[profile.edge];
    if (profile.cells === 0) {
      lines.push(`- ${label}: 맵 경계 (바깥이 없다)`);
      continue;
    }
    const material = formatCounts(profile.materials) || "알 수 없음";
    const props = profile.props.length > 0 ? ` · 위층: ${formatCounts(profile.props)}` : "";
    lines.push(`- ${label}: ${material}${props}`);
  }

  for (const kind of ["road", "water"] as const) {
    const points = surroundings.crossings.filter((crossing) => crossing.kind === kind);
    if (points.length === 0) continue;
    lines.push(
      `- ${CROSSING_KIND_LABEL[kind]}이 영역과 맞닿는 칸(안쪽 좌표) — 영역 안에서 끊지 말고 이어라: ${formatPoints(points, 6)}`,
    );
  }
  if (surroundings.entrances.length > 0) {
    lines.push(`- 바깥에서 걸어 들어오는 칸(막지 말 것): ${formatPoints(surroundings.entrances, 8)}`);
  }
  if (surroundings.neighborEvents.length > 0) {
    const shown = surroundings.neighborEvents.slice(0, 8)
      .map((event) => `${event.name}(${event.x},${event.y})`)
      .join(", ");
    const rest = surroundings.neighborEvents.length - Math.min(surroundings.neighborEvents.length, 8);
    lines.push(`- 주변 이벤트: ${shown}${rest > 0 ? ` …외 ${rest}건` : ""}`);
  }

  const stats = surroundings.insideTiles;
  const inside = stats.top.map((entry) => `${entry.label} ${entry.count}칸`).join(", ");
  lines.push(
    `현재 영역 안 (${surroundings.region.width}×${surroundings.region.height}=${stats.totalCells}칸): ${inside || "빈 칸"}`,
  );
  if (surroundings.insideEvents.length > 0) {
    const shown = surroundings.insideEvents.slice(0, 10)
      .map((event) => `${event.name}[${event.id}](${event.x},${event.y})`)
      .join(", ");
    const rest = surroundings.insideEvents.length - Math.min(surroundings.insideEvents.length, 10);
    lines.push(`- 영역 안 이벤트 ${surroundings.insideEvents.length}건: ${shown}${rest > 0 ? ` …외 ${rest}건` : ""}`);
  } else {
    lines.push("- 영역 안 이벤트: 없음");
  }
  return lines.join("\n");
}
