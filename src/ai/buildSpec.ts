// ai/buildSpec.ts
// 스펙 게이트 순수 헬퍼: 모델이 낸 밑그림(BuildSpec)을 코드가 검증하고,
// 공간 쓰기 툴 호출이 그 할당 영역 안에 있는지 판정한다. 브라우저/API 의존 없음.

import type { GameMap, Project } from "@/project/types";
import { TILE } from "@/project/defaults/constants";

export interface SpecAsset {
  id: string; kind: string;
  x: number; y: number; w: number; h: number;
  layer?: "lower" | "upper";
  style?: string;
  note?: string;
  // 파괴(clear) 의도를 명시적으로 확인. 기존 구조물을 덮는 clear는 이 플래그가 있어야 통과한다.
  confirmDestroy?: boolean;
  // 배치(비-clear) 에셋 자리·주변에 기본 타일이 아닌 것이 있을 때, 사용자에게 정리 여부를 확인했다는 선언.
  // "clear"(정리하고 배치) 또는 "keep"(그대로 위에 배치). 없으면 배치가 거부된다.
  overExisting?: "clear" | "keep";
}

// clear 영역이 이 칸 수 이상의 '지어진' 칸을 덮으면 구조물로 간주해 confirmDestroy를 요구한다.
// (잔해 1~2칸 정리는 통과, 집 같은 구조물은 차단 — "집 주변 청소"가 집을 지워버린 사고 방지.)
const STRUCTURE_MIN_CELLS = 6;
// 배치 에셋 자리+주변(1칸 테두리)에 이 칸 수 이상의 기본-아닌 타일이 있으면 정리 확인(overExisting)을 요구한다.
const PLACEMENT_CONFLICT_MIN = 4;
// 모델이 선형 도로/페인트를 경계에 딱 붙여 칠할 때 흔한 1~2칸 오차는 재계획 대신 경고로 흡수한다.
// 구조물 삭제·기존 타일 보호 규칙에는 적용하지 않는, 확정 밑그림 대비 공간 쓰기 호출 경계 전용 slack이다.
export const SPEC_BOUNDARY_SLACK_CELLS = 2;

export interface BuildSpec {
  mapId: string; title?: string;
  assets: SpecAsset[];
  buildOrder?: string[];
  pathWidth?: number;
  density?: "spacious" | "normal" | "dense";
  layoutStyle?: "straight" | "curved" | "random";
}

export interface SpecIssue { severity: "error" | "warning"; message: string; }

export interface AffectedRegion {
  mapId: string; x: number; y: number; w: number; h: number;
}

export interface SpecBoundaryCheck {
  covered: boolean;
  outsideCells: number;
  withinSlack: boolean;
  beyondSlackCells: number;
  sample?: { x: number; y: number };
  slackWarning?: string;
}

interface CheckedAsset {
  id: string; kind: string;
  x: number; y: number; w: number; h: number;
  layer?: "lower" | "upper";
  confirmDestroy: boolean;
  overExisting?: "clear" | "keep";
}

// v3 공정 프리미티브(build_wall 등 6종)는 여기 넣지 않는다(2026-07-07 타일 시공 흐름 재설계 §2.1.1):
// v3는 승인 어휘 자체가 명세이므로 set_build_spec 게이트가 불필요하고, 미승인 하드 차단은
// 프리미티브 내부(assertApprovedOrFail)가 그대로 수행한다. 레거시 배치 툴만 게이트를 탄다.
export const SPATIAL_BUILD_TOOLS: ReadonlySet<string> = new Set([
  "paint_tiles", "paint_road", "build_house", "build_house_kit", "build_village", "stamp_structure",
  "clear_region", "place_npc", "place_battle_blocker",
  // 타일 v2 (2026-07-07 재구축)
  "tile_paint", "tile_road", "tile_scatter", "tile_structure",
]);

export const SPEC_BOUNDARY_SLACK_TOOLS: ReadonlySet<string> = new Set([
  "paint_tiles", "paint_road", "build_house", "build_house_kit", "build_village", "stamp_structure",
  "place_npc", "place_battle_blocker",
  "tile_paint", "tile_road", "tile_scatter", "tile_structure",
]);

export function boundarySlackForTool(toolName: string): number {
  return SPEC_BOUNDARY_SLACK_TOOLS.has(toolName) ? SPEC_BOUNDARY_SLACK_CELLS : 0;
}

export function orderedAssets(spec: BuildSpec): SpecAsset[] {
  if (spec.buildOrder === undefined) return [...spec.assets];

  const kindOrder = new Map<string, number>();
  spec.buildOrder.forEach((kind, index) => {
    if (!kindOrder.has(kind)) kindOrder.set(kind, index);
  });
  const unlistedRank = spec.buildOrder.length;

  return spec.assets
    .map((asset, index) => ({ asset, index, rank: kindOrder.get(asset.kind) ?? unlistedRank }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ asset }) => asset);
}

export function validateBuildSpec(project: Project, spec: unknown): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const rawSpec: unknown = spec;
  if (!isRecord(rawSpec)) return [{ severity: "error", message: "BuildSpec는 객체여야 합니다." }];

  const mapId = typeof rawSpec.mapId === "string" ? rawSpec.mapId : null;
  const map = mapId === null ? undefined : project.maps[mapId];
  if (mapId === null) issues.push({ severity: "error", message: "BuildSpec.mapId는 문자열이어야 합니다." });
  else if (map === undefined) issues.push({ severity: "error", message: `맵 '${mapId}'을 찾을 수 없습니다.` });

  const buildOrder = checkBuildOrder(rawSpec.buildOrder, issues);

  const rawAssets = rawSpec.assets;
  if (!Array.isArray(rawAssets) || rawAssets.length === 0) {
    issues.push({ severity: "error", message: "assets는 비어 있지 않은 배열이어야 합니다." });
    return issues;
  }

  const seenIds = new Set<string>();
  const checkedAssets: CheckedAsset[] = [];
  rawAssets.forEach((rawAsset, index) => {
    const checked = checkAsset(rawAsset, index, issues);
    if (checked === null) return;

    if (seenIds.has(checked.id)) issues.push({ severity: "error", message: `중복 asset id '${checked.id}'가 있습니다.` });
    seenIds.add(checked.id);

    if (map !== undefined && !insideMap(checked, map.width, map.height)) {
      issues.push({ severity: "error", message: `에셋 '${checked.id}' 영역(${checked.x},${checked.y}) ${checked.w}×${checked.h}가 맵 크기 ${map.width}×${map.height} 밖입니다.` });
    }
    checkedAssets.push(checked);
  });

  if (buildOrder !== null) checkBuildOrderCoverage(buildOrder, checkedAssets, issues);

  for (let left = 0; left < checkedAssets.length; left += 1) {
    for (let right = left + 1; right < checkedAssets.length; right += 1) {
      const a = checkedAssets[left];
      const b = checkedAssets[right];
      if (a === undefined || b === undefined || overlapAllowed(a, b)) continue;
      const rect = intersection(a, b);
      if (rect === null) continue;
      issues.push({ severity: "error", message: `에셋 '${a.id}'와 '${b.id}'가 교차합니다: (${rect.x},${rect.y}) ${rect.w}×${rect.h}.` });
    }
  }

  // 구조물 보호: clear 에셋이 기존 구조물(지어진 칸)을 덮으면 confirmDestroy 없이는 거부한다.
  // "집 주변 청소"가 집 자체를 지워버린 사고 방지 — 맵의 실제 내용을 근거로 판정한다.
  if (map !== undefined) {
    const currentMap = map;
    const clearAssets = checkedAssets.filter((asset) => asset.kind === "clear");
    for (const asset of checkedAssets) {
      if (asset.kind === "clear") {
        if (asset.confirmDestroy) continue;
        const built = builtCellsInRegions(currentMap, [{ mapId: currentMap.id, x: asset.x, y: asset.y, w: asset.w, h: asset.h }]);
        if (built.count >= STRUCTURE_MIN_CELLS) {
          const at = built.sample ? ` 예: (${built.sample.x},${built.sample.y})` : "";
          issues.push({
            severity: "error",
            message: `clear 에셋 '${asset.id}'가 기존 구조물을 덮습니다(${built.count}칸${at}). '주변만' 청소하려면 구조물을 피해 영역을 좁히고, 정말 철거하려면 confirmDestroy:true를 넣으세요.`,
          });
        }
        continue;
      }
      // 배치(비-clear) 에셋: 자리+주변에 기본 타일이 아닌 것이 있으면 사용자에게 정리 여부를 확인(overExisting)해야 한다.
      if (asset.overExisting) continue;
      const conflict = placementConflict(currentMap, asset, clearAssets);
      if (conflict.count >= PLACEMENT_CONFLICT_MIN) {
        const at = conflict.sample ? ` 예: (${conflict.sample.x},${conflict.sample.y})` : "";
        issues.push({
          severity: "error",
          message: `에셋 '${asset.id}' 자리·주변에 기본 타일이 아닌 것이 ${conflict.count}칸 있습니다${at}. 그 위에 그냥 놓지 말고 사용자에게 정리할지 물어본 뒤, 이 에셋에 overExisting:"clear"(정리하고 배치) 또는 "keep"(그대로 위에 배치)을 넣어 재제출하세요.`,
        });
      }
    }
  }

  return issues;
}

// 배치 에셋 자리 + 1칸 테두리에서 '지어진'(기본-아닌) 칸 수를 센다. 단, 같은 스펙의 clear 에셋이
// 덮는 칸은 정리될 예정이므로 제외한다. 계획된 다른 에셋은 맵에 아직 없으므로 세지 않는다(오탐 방지).
function placementConflict(map: GameMap, asset: CheckedAsset, clearAssets: readonly CheckedAsset[]): { count: number; sample?: { x: number; y: number } } {
  let count = 0;
  let sample: { x: number; y: number } | undefined;
  for (let y = Math.max(0, asset.y - 1); y <= Math.min(map.height - 1, asset.y + asset.h); y += 1) {
    for (let x = Math.max(0, asset.x - 1); x <= Math.min(map.width - 1, asset.x + asset.w); x += 1) {
      if (!isBuiltCell(map, x, y)) continue;
      if (clearAssets.some((clear) => containsCell(clear, x, y))) continue;
      count += 1;
      sample ??= { x, y };
    }
  }
  return sample === undefined ? { count } : { count, sample };
}

export function affectedRegions(toolName: string, args: Record<string, unknown>): AffectedRegion[] {
  void toolName;
  const mapId = typeof args.mapId === "string" ? args.mapId : null;
  if (mapId === null) return [];

  const wingRegion = wingsRegion(mapId, args.wings);
  if (wingRegion !== null) return [wingRegion];

  const cellRegions = pointRegions(mapId, args.cells);
  if (cellRegions !== null) return cellRegions;

  const pointRegionsForRoad = pointRegions(mapId, args.points);
  if (pointRegionsForRoad !== null) return pointRegionsForRoad;

  const cornerRect = rectFromCorners(mapId, args.from, args.to);
  if (cornerRect !== null) return [cornerRect];

  const xyRect = rectFromXY(mapId, args);
  if (xyRect !== null) return [xyRect];

  return [{ mapId, x: 0, y: 0, w: 0, h: 0 }];
}

export function regionsCoveredBySpec(assets: readonly SpecAsset[], regions: readonly AffectedRegion[]): { covered: boolean; outsideCells: number; sample?: { x: number; y: number } } {
  let outsideCells = 0;
  let sample: { x: number; y: number } | undefined;

  for (const region of regions) {
    if (region.w <= 0 || region.h <= 0) continue;
    for (let y = region.y; y < region.y + region.h; y += 1) {
      for (let x = region.x; x < region.x + region.w; x += 1) {
        if (assets.some((asset) => containsCell(asset, x, y))) continue;
        outsideCells += 1;
        sample ??= { x, y };
      }
    }
  }

  return sample === undefined ? { covered: true, outsideCells } : { covered: false, outsideCells, sample };
}

export function checkRegionsAgainstSpecBoundary(
  assets: readonly SpecAsset[],
  regions: readonly AffectedRegion[],
  slackCells = SPEC_BOUNDARY_SLACK_CELLS
): SpecBoundaryCheck {
  let outsideCells = 0;
  let beyondSlackCells = 0;
  let sample: { x: number; y: number } | undefined;
  let beyondSample: { x: number; y: number } | undefined;
  const slackDetails = new Map<string, SlackDetail>();

  for (const region of regions) {
    if (region.w <= 0 || region.h <= 0) continue;
    for (let y = region.y; y < region.y + region.h; y += 1) {
      for (let x = region.x; x < region.x + region.w; x += 1) {
        if (assets.some((asset) => containsCell(asset, x, y))) continue;
        outsideCells += 1;
        sample ??= { x, y };
        const detail = bestSlackDetail(assets, x, y, slackCells);
        if (detail === null) {
          beyondSlackCells += 1;
          beyondSample ??= { x, y };
          continue;
        }
        mergeSlackDetail(slackDetails, detail);
      }
    }
  }

  if (outsideCells === 0) return { covered: true, outsideCells, withinSlack: true, beyondSlackCells };
  if (beyondSlackCells > 0) {
    const failureSample = beyondSample ?? sample;
    return failureSample === undefined
      ? { covered: false, outsideCells, withinSlack: false, beyondSlackCells }
      : { covered: false, outsideCells, withinSlack: false, beyondSlackCells, sample: failureSample };
  }
  return {
    covered: false,
    outsideCells,
    withinSlack: true,
    beyondSlackCells,
    ...(sample === undefined ? {} : { sample }),
    slackWarning: formatSlackWarning([...slackDetails.values()], slackCells),
  };
}

// 영역 안에서 '지어진'(자연 지형이 아닌) 칸 수를 센다. 구조물 존재의 근거 —
// 상위 타일이 비어있지 않거나, 하위 타일이 잔디/빈칸이 아니면 무언가 지어진 것으로 본다.
export function builtCellsInRegions(map: GameMap, regions: readonly AffectedRegion[]): { count: number; sample?: { x: number; y: number } } {
  let count = 0;
  let sample: { x: number; y: number } | undefined;
  for (const region of regions) {
    if (region.w <= 0 || region.h <= 0) continue;
    for (let y = Math.max(0, region.y); y < Math.min(map.height, region.y + region.h); y += 1) {
      for (let x = Math.max(0, region.x); x < Math.min(map.width, region.x + region.w); x += 1) {
        if (!isBuiltCell(map, x, y)) continue;
        count += 1;
        sample ??= { x, y };
      }
    }
  }
  return sample === undefined ? { count } : { count, sample };
}

function isBuiltCell(map: GameMap, x: number, y: number): boolean {
  // 맵 바깥 가장자리는 생성 옵션/기본 맵별 테두리와 무관하게 구조물 판정에서 제외한다.
  if (x <= 0 || y <= 0 || x >= map.width - 1 || y >= map.height - 1) return false;
  const index = y * map.width + x;
  const upper = map.upperTiles[index] ?? TILE.EMPTY;
  if (upper !== TILE.EMPTY) return true;
  const lower = map.lowerTiles[index] ?? TILE.EMPTY;
  return lower !== TILE.EMPTY && lower !== TILE.GRASS;
}

export function implicitSpecFromContext(text: string): BuildSpec | null {
  const footerPattern =
    /^\[컨텍스트\] 현재 맵: .+ \(([^)]+)\)(?: · 사용자 선택 영역: \((-?\d+),(-?\d+)\) ([1-9]\d*)×([1-9]\d*))?$/gm;
  let lastMatch: RegExpExecArray | null = null;
  let match = footerPattern.exec(text);
  while (match !== null) {
    lastMatch = match;
    match = footerPattern.exec(text);
  }
  if (lastMatch === null) return null;

  const [mapId, xText, yText, wText, hText] = lastMatch.slice(1);
  if (mapId === undefined || xText === undefined || yText === undefined || wText === undefined || hText === undefined) {
    return null;
  }

  return {
    mapId,
    title: "사용자 선택 영역",
    assets: [{ id: "선택 영역", kind: "selection", x: Number.parseInt(xText, 10), y: Number.parseInt(yText, 10), w: Number.parseInt(wText, 10), h: Number.parseInt(hText, 10) }],
  };
}

function checkAsset(rawAsset: unknown, index: number, issues: SpecIssue[]): CheckedAsset | null {
  const label = assetLabel(rawAsset, index);
  if (!isRecord(rawAsset)) {
    issues.push({ severity: "error", message: `${label}: 에셋은 객체여야 합니다.` });
    return null;
  }

  const missing: string[] = [];
  const id = typeof rawAsset.id === "string" ? rawAsset.id : null;
  const kind = typeof rawAsset.kind === "string" ? rawAsset.kind : null;
  const x = rawAsset.x;
  const y = rawAsset.y;
  const w = rawAsset.w;
  const h = rawAsset.h;
  if (id === null) missing.push("id");
  if (kind === null) missing.push("kind");
  if (!isInteger(x)) missing.push("x");
  if (!isInteger(y)) missing.push("y");
  if (!isInteger(w) || w < 1) missing.push("w");
  if (!isInteger(h) || h < 1) missing.push("h");
  if (missing.length > 0 || id === null || kind === null || !isInteger(x) || !isInteger(y) || !isInteger(w) || !isInteger(h)) {
    issues.push({ severity: "error", message: `${label}: 필수 필드 오류(${missing.join(", ")}).` });
    return null;
  }

  const overExisting = rawAsset.overExisting === "clear" || rawAsset.overExisting === "keep" ? rawAsset.overExisting : undefined;
  return { id, kind, x, y, w, h, layer: rawAsset.layer === "upper" ? "upper" : "lower", confirmDestroy: rawAsset.confirmDestroy === true, overExisting };
}

function checkBuildOrder(rawBuildOrder: unknown, issues: SpecIssue[]): string[] | null {
  if (rawBuildOrder === undefined) return null;
  if (!Array.isArray(rawBuildOrder) || rawBuildOrder.some((kind) => typeof kind !== "string")) {
    issues.push({ severity: "error", message: "buildOrder는 문자열 배열이어야 합니다." });
    return null;
  }
  return rawBuildOrder;
}

function checkBuildOrderCoverage(buildOrder: readonly string[], assets: readonly CheckedAsset[], issues: SpecIssue[]): void {
  const assetKinds = new Set(assets.map((asset) => asset.kind));
  const warnedMissingKinds = new Set<string>();
  for (const kind of buildOrder) {
    if (assetKinds.has(kind) || warnedMissingKinds.has(kind)) continue;
    warnedMissingKinds.add(kind);
    issues.push({ severity: "warning", message: `buildOrder의 '${kind}'에 해당하는 에셋이 없습니다` });
  }

  if (buildOrder.length === 0) return;
  const orderedKinds = new Set(buildOrder);
  for (const asset of assets) {
    if (orderedKinds.has(asset.kind)) continue;
    issues.push({ severity: "warning", message: `에셋 '${asset.id}'(${asset.kind})가 buildOrder에 없어 마지막에 배치됩니다` });
  }
}

function pointRegions(mapId: string, value: unknown): AffectedRegion[] | null {
  if (!Array.isArray(value)) return null;
  const regions: AffectedRegion[] = [];
  for (const point of value) {
    if (!isPoint(point)) return null;
    regions.push({ mapId, x: point.x, y: point.y, w: 1, h: 1 });
  }
  return regions;
}

function rectFromCorners(mapId: string, from: unknown, to: unknown): AffectedRegion | null {
  if (!isPoint(from) || !isPoint(to)) return null;
  return { mapId, x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(from.x - to.x) + 1, h: Math.abs(from.y - to.y) + 1 };
}

function rectFromXY(mapId: string, args: Record<string, unknown>): AffectedRegion | null {
  if (!isFiniteNumber(args.x) || !isFiniteNumber(args.y)) return null;
  if (isFiniteNumber(args.w) && isFiniteNumber(args.h)) return { mapId, x: args.x, y: args.y, w: args.w, h: args.h };
  if (isFiniteNumber(args.width) && isFiniteNumber(args.height)) return { mapId, x: args.x, y: args.y, w: args.width, h: args.height };
  return { mapId, x: args.x, y: args.y, w: 1, h: 1 };
}

function wingsRegion(mapId: string, value: unknown): AffectedRegion | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const wing of value) {
    if (typeof wing !== "object" || wing === null || Array.isArray(wing)) return null;
    const record = wing as Record<string, unknown>;
    if (!isFiniteNumber(record.x) || !isFiniteNumber(record.y) || !isFiniteNumber(record.w) || !isFiniteNumber(record.h)) return null;
    x0 = Math.min(x0, record.x);
    y0 = Math.min(y0, record.y);
    x1 = Math.max(x1, record.x + record.w);
    y1 = Math.max(y1, record.y + record.h);
  }
  return { mapId, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function intersection(a: CheckedAsset, b: CheckedAsset): AffectedRegion | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return x < right && y < bottom ? { mapId: "", x, y, w: right - x, h: bottom - y } : null;
}

function insideMap(asset: CheckedAsset, width: number, height: number): boolean {
  return asset.x >= 0 && asset.y >= 0 && asset.x + asset.w <= width && asset.y + asset.h <= height;
}

function overlapAllowed(a: CheckedAsset, b: CheckedAsset): boolean {
  return (a.layer === "upper") !== (b.layer === "upper") || (a.kind === "road" && b.kind === "road");
}

function containsCell(asset: SpecAsset, x: number, y: number): boolean {
  return x >= asset.x && y >= asset.y && x < asset.x + asset.w && y < asset.y + asset.h;
}

interface SlackDetail {
  asset: SpecAsset;
  west: number;
  east: number;
  north: number;
  south: number;
}

function bestSlackDetail(assets: readonly SpecAsset[], x: number, y: number, slackCells: number): SlackDetail | null {
  let best: (SlackDetail & { max: number; total: number }) | null = null;
  for (const asset of assets) {
    const detail = slackDetailForCell(asset, x, y, slackCells);
    if (detail === null) continue;
    const max = Math.max(detail.west, detail.east, detail.north, detail.south);
    const total = detail.west + detail.east + detail.north + detail.south;
    if (best === null || max < best.max || (max === best.max && total < best.total)) {
      best = { ...detail, max, total };
    }
  }
  return best === null ? null : { asset: best.asset, west: best.west, east: best.east, north: best.north, south: best.south };
}

function slackDetailForCell(asset: SpecAsset, x: number, y: number, slackCells: number): SlackDetail | null {
  const left = asset.x;
  const top = asset.y;
  const right = asset.x + asset.w - 1;
  const bottom = asset.y + asset.h - 1;
  if (x < left - slackCells || x > right + slackCells || y < top - slackCells || y > bottom + slackCells) return null;
  const west = Math.max(0, left - x);
  const east = Math.max(0, x - right);
  const north = Math.max(0, top - y);
  const south = Math.max(0, y - bottom);
  if (west === 0 && east === 0 && north === 0 && south === 0) return null;
  return { asset, west, east, north, south };
}

function mergeSlackDetail(details: Map<string, SlackDetail>, next: SlackDetail): void {
  const key = `${next.asset.id}:${next.asset.x}:${next.asset.y}:${next.asset.w}:${next.asset.h}`;
  const current = details.get(key);
  if (current === undefined) {
    details.set(key, next);
    return;
  }
  current.west = Math.max(current.west, next.west);
  current.east = Math.max(current.east, next.east);
  current.north = Math.max(current.north, next.north);
  current.south = Math.max(current.south, next.south);
}

function formatSlackWarning(details: readonly SlackDetail[], slackCells: number): string {
  const clauses = details.slice(0, 2).map((detail) => {
    const asset = detail.asset;
    const bounds = `(${asset.x},${asset.y})~(${asset.x + asset.w - 1},${asset.y + asset.h - 1})`;
    const label = asset.id.length > 0 ? ` '${asset.id}'` : "";
    return `밑그림${label} ${bounds} 대비 ${directionText(detail)} 초과`;
  });
  const extra = details.length > clauses.length ? ` 외 ${details.length - clauses.length}개` : "";
  return `${clauses.join("; ")}${extra} — slack 허용(±${slackCells}칸)`;
}

function directionText(detail: SlackDetail): string {
  const entries: string[] = [];
  if (detail.west > 0) entries.push(`서쪽 ${detail.west}칸`);
  if (detail.east > 0) entries.push(`동쪽 ${detail.east}칸`);
  if (detail.north > 0) entries.push(`북쪽 ${detail.north}칸`);
  if (detail.south > 0) entries.push(`남쪽 ${detail.south}칸`);
  return entries.join(", ");
}

function assetLabel(rawAsset: unknown, index: number): string {
  return isRecord(rawAsset) && typeof rawAsset.id === "string" && rawAsset.id.length > 0 ? `에셋 '${rawAsset.id}'` : `에셋 #${index + 1}`;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }

function isPoint(value: unknown): value is { x: number; y: number } { return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y); }

function isInteger(value: unknown): value is number { return Number.isInteger(value); }

function isFiniteNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
