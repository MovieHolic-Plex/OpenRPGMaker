// 배치 완료 후 시맨틱 검증 — 툴 단위 projectLint 와 별도로, "다 깐 뒤" 한 번 검사한다.
// 순수 함수(브라우저/헤드리스 공용). throw 하지 않고 LintIssue[] 반환.
import { isPassable } from "@/project/collision";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, MapId, Project } from "@/project/types";
import type { LintIssue } from "./projectLint";

export type LayoutRegion = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type LayoutValidateOptions = {
  readonly mapId?: MapId;
  /** 검사 사각형. 없으면 맵 전체. */
  readonly region?: LayoutRegion;
  /** 사용자 지시 — 나무 기대 여부 추론. */
  readonly instruction?: string;
  /** 이번 턴 툴 이름 — place_props 등. */
  readonly toolNames?: readonly string[];
};

export const LAYOUT_TREE_TILE_IDS = new Set<number>([
  260, 290, 261, 291,
  262, 263, 292, 293, // 활엽수 2×2
  259, // 가지
  289, // 덤불
]);
const TREE_TILE_IDS = LAYOUT_TREE_TILE_IDS;

export const LAYOUT_TREE_CANOPY_IDS = new Set([260, 261, 262, 263]);
export const LAYOUT_TREE_TRUNK_IDS = new Set([290, 291, 292, 293]);

const TREE_INTENT = /나무|침엽|숲|수목|tree|forest|conifer|broadleaf/i;
const PROP_TOOLS = new Set(["place_props", "scatter_object", "tile_scatter"]);

export function validateLayoutPlacement(project: Project, opts: LayoutValidateOptions = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  const mapIds = opts.mapId ? [opts.mapId] : Object.keys(project.maps);
  for (const mapId of mapIds) {
    const map = project.maps[mapId];
    if (!map) continue;
    const region = clampRegion(map, opts.region);
    checkPropsOnWater(project, map, mapId, region, issues);
    checkTreesOnImpassable(project, map, mapId, region, issues);
    checkVerticalTreePairs(map, mapId, region, issues);
    checkTreeExpectation(project, map, mapId, region, opts, issues);
  }
  return issues;
}

export function layoutValidationBlocking(issues: readonly LintIssue[]): readonly LintIssue[] {
  return issues.filter((issue) => issue.severity === "error");
}

/**
 * 배치 충돌 정리 — validateLayoutPlacement 가 error 로 보는 칸을 실제로 지운다.
 * 마을 파이프라인 마지막(또는 fill_region 등 후속 지형 시공 직후)에 불러,
 * "스캐터 시점엔 잔디였는데 나중에 물/벽이 깔려 게이트에 걸리는" 순서 결함을 청소한다.
 * 규칙 소스는 검증기와 동일(TREE_TILE_IDS·isLakeAutotileTile·isPassable).
 */
export function scrubPlacementConflicts(project: Project, map: GameMap): { propsOnWater: number; treesOnImpassable: number } {
  let propsOnWater = 0;
  let treesOnImpassable = 0;
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    const lower = map.lowerTiles[index];
    const upper = map.upperTiles[index];
    if (upper === TILE.EMPTY || upper < 0) continue;
    // 1) 물 위 upper 소품/수관 — checkPropsOnWater 규칙.
    if (isLakeAutotileTile(lower)) {
      map.upperTiles[index] = TILE.EMPTY;
      propsOnWater += 1;
      continue;
    }
    // 2) 통행 불가 하층 위 나무 수관 — checkTreesOnImpassable 규칙(밑동 겹침·물 제외 동일).
    if (!TREE_TILE_IDS.has(upper)) continue;
    if (TREE_TILE_IDS.has(lower)) continue;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    if (lower !== TILE.WALL && lower !== TILE.EMPTY && isLowerTerrainPassable(project, map, x, y)) continue;
    map.upperTiles[index] = TILE.EMPTY;
    treesOnImpassable += 1;
  }
  return { propsOnWater, treesOnImpassable };
}

export function formatLayoutValidationSummary(issues: readonly LintIssue[]): string {
  if (issues.length === 0) return "배치 검증 통과";
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const head = issues.slice(0, 3).map((i) => i.message).join(" · ");
  const more = issues.length > 3 ? ` 외 ${issues.length - 3}건` : "";
  // error 가 없으면 적용을 막지 않았다 — "실패" 로 쓰면 깔린 배치를 사용자가 안 깔린 것으로 오인한다.
  const label = errors > 0 ? `배치 검증 실패(error ${errors}/warning ${warnings})` : `배치 검증 경고(warning ${warnings})`;
  return `${label}: ${head}${more}`;
}

function clampRegion(map: GameMap, region?: LayoutRegion): LayoutRegion {
  if (!region) return { x: 0, y: 0, width: map.width, height: map.height };
  const x = Math.max(0, Math.min(map.width - 1, region.x));
  const y = Math.max(0, Math.min(map.height - 1, region.y));
  const width = Math.max(1, Math.min(map.width - x, region.width));
  const height = Math.max(1, Math.min(map.height - y, region.height));
  return { x, y, width, height };
}

function forEachCell(region: LayoutRegion, fn: (x: number, y: number, index: number, map: GameMap) => void, map: GameMap): void {
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      fn(x, y, y * map.width + x, map);
    }
  }
}

/** 물 위 upper 소품(나무 포함) — error */
function checkPropsOnWater(
  _project: Project,
  map: GameMap,
  mapId: string,
  region: LayoutRegion,
  issues: LintIssue[],
): void {
  let count = 0;
  let sample: { x: number; y: number } | undefined;
  forEachCell(region, (x, y, index) => {
    if (!isLakeAutotileTile(map.lowerTiles[index])) return;
    if (map.upperTiles[index] === TILE.EMPTY || map.upperTiles[index] < 0) return;
    count += 1;
    if (!sample) sample = { x, y };
  }, map);
  if (count === 0) return;
  issues.push({
    severity: "error",
    code: "layout-prop-on-water",
    mapId,
    x: sample?.x,
    y: sample?.y,
    message: `물 타일 위에 소품/나무가 ${count}칸 있습니다(예: (${sample?.x},${sample?.y})). 호수 위 배치는 실패입니다.`,
  });
}

/** 통행 불가 하층(물 제외 — prop-on-water에서 처리) 위 나무 — error */
function checkTreesOnImpassable(
  project: Project,
  map: GameMap,
  mapId: string,
  region: LayoutRegion,
  issues: LintIssue[],
): void {
  let count = 0;
  let sample: { x: number; y: number; tile: number } | undefined;
  forEachCell(region, (x, y, index) => {
    const upper = map.upperTiles[index];
    const lower = map.lowerTiles[index];
    // 수관(upper) 또는 레거시 upper 나무만 검사. 밑동(lower solid)은 정상.
    if (!TREE_TILE_IDS.has(upper)) return;
    if (isLakeAutotileTile(lower)) return;
    // 밑동 위에 수관이 겹친 숲 칸: lower 가 나무 밑동이면 통행 불가 지형 오류로 보지 않음
    if (TREE_TILE_IDS.has(lower)) return;
    if (lower === TILE.WALL || lower === TILE.EMPTY) {
      count += 1;
      if (!sample) sample = { x, y, tile: upper };
      return;
    }
    if (!isLowerTerrainPassable(project, map, x, y)) {
      count += 1;
      if (!sample) sample = { x, y, tile: upper };
    }
  }, map);
  if (count === 0) return;
  issues.push({
    severity: "error",
    code: "layout-tree-on-impassable",
    mapId,
    x: sample?.x,
    y: sample?.y,
    message: `통행 불가 지형 위에 나무 타일이 ${count}칸 있습니다(예: (${sample?.x},${sample?.y}) tile ${sample?.tile}).`,
  });
}

export function isLowerTerrainPassable(project: Project, map: GameMap, x: number, y: number): boolean {
  const index = y * map.width + x;
  const saved = map.upperTiles[index];
  map.upperTiles[index] = TILE.EMPTY;
  try {
    return isPassable(project, map, x, y);
  } finally {
    map.upperTiles[index] = saved;
  }
}

/** 수관 아래 밑동 없음 — error. 숲 겹침(lower 밑동+upper 수관)과 레거시 upper 밑동 모두 인정. */
function checkVerticalTreePairs(map: GameMap, mapId: string, region: LayoutRegion, issues: LintIssue[]): void {
  let broken = 0;
  let sample: { x: number; y: number; name: string } | undefined;
  forEachCell(region, (x, y, index) => {
    const upper = map.upperTiles[index];
    if (!LAYOUT_TREE_CANOPY_IDS.has(upper)) return;
    if (y + 1 >= map.height) {
      broken += 1;
      if (!sample) sample = { x, y, name: "나무" };
      return;
    }
    const belowIndex = (y + 1) * map.width + x;
    const belowLower = map.lowerTiles[belowIndex];
    const belowUpper = map.upperTiles[belowIndex];
    if (!LAYOUT_TREE_TRUNK_IDS.has(belowLower) && !LAYOUT_TREE_TRUNK_IDS.has(belowUpper)) {
      broken += 1;
      if (!sample) sample = { x, y, name: "나무" };
    }
  }, map);
  if (broken === 0) return;
  issues.push({
    severity: "error",
    code: "layout-tree-incomplete",
    mapId,
    x: sample?.x,
    y: sample?.y,
    message: `나무 수관 아래 밑동이 없는 칸이 ${broken}곳 있습니다(예: ${sample?.name} @(${sample?.x},${sample?.y})). 수관(upper)+밑동(lower) 세로 2칸이 한 그루입니다.`,
  });
}

/**
 * 지시에 나무가 있는데 영역 안 나무 0 — **warning**(적용을 막지 않는다).
 *
 * 이 판정은 문자열/하드코딩 타일 id 기반이라 구조적으로 오탐한다: "나무 상자"·"나무 바닥" 같은
 * 부분일치, 맵 이름이 실린 `[컨텍스트]` footer, TREE_TILE_IDS 밖의 타일셋(world 계열 318/319 등)이
 * 모두 "나무 0그루"로 보인다. error 로 두면 실제로 타일을 깐 제안까지 통째로 반려돼 사용자에게
 * 아무것도 남지 않았다. 신호는 남기고 배치는 통과시킨다.
 */
function checkTreeExpectation(
  _project: Project,
  map: GameMap,
  mapId: string,
  region: LayoutRegion,
  opts: LayoutValidateOptions,
  issues: LintIssue[],
): void {
  if (!TREE_INTENT.test(opts.instruction ?? "")) return;

  let treeCells = 0;
  forEachCell(region, (_x, _y, index) => {
    const u = map.upperTiles[index];
    const l = map.lowerTiles[index];
    if (TREE_TILE_IDS.has(u) || TREE_TILE_IDS.has(l)) treeCells += 1;
  }, map);

  if (treeCells > 0) return;

  const propToolUsed = (opts.toolNames ?? []).some((name) => PROP_TOOLS.has(name));
  issues.push({
    severity: "warning",
    code: "layout-tree-missing",
    mapId,
    message: propToolUsed
      ? `지시에 나무가 있고 place_props를 호출했으나 검사 영역 안에 나무 타일이 없습니다(물 위 스킵·영역 밖 등으로 0그루).`
      : `지시에 나무가 포함되어 있으나 검사 영역 안에 나무 타일이 없습니다. place_props로 육지에 배치해야 합니다.`,
  });
}
