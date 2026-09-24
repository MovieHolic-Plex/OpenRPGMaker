// ai/buildSpec.ts
// 스펙 게이트 순수 헬퍼: 모델이 낸 밑그림(BuildSpec)을 코드가 검증하고,
// 공간 쓰기 툴 호출이 그 할당 영역 안에 있는지 판정한다. 브라우저/API 의존 없음.

import type { GameMap, Project, TilesetDef } from "@/project/types";
import { TILE } from "@/project/defaults/constants";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { tilePassability } from "@/project/collision";
import { roleCapabilities } from "@/project/tileRoles";
import { parseContextFooter } from "./contextFooter";

export interface SpecAsset {
  id: string; kind: string;
  x: number; y: number; w: number; h: number;
  layer?: "lower" | "upper";
  style?: string;
  note?: string;
  /** 면 채우기 형태 힌트 — terrain/수역 원형은 circle. fill_region.shape 와 맞출 것. */
  shape?: "rect" | "ellipse" | "circle";
  // 파괴(clear) 의도를 명시적으로 확인. 기존 구조물을 덮는 clear는 이 플래그가 있어야 통과한다.
  confirmDestroy?: boolean;
  // 배치(비-clear) 에셋 자리·주변에 기본 타일이 아닌 것이 있을 때, 모델이 정리 방침을 선언한다.
  // "clear"(정리하고 배치) 또는 "keep"(그대로 위에 배치). 없으면 배치가 거부된다.
  overExisting?: "clear" | "keep";
}

// clear 영역이 이 칸 수 이상의 '지어진' 칸을 덮으면 구조물로 간주해 confirmDestroy를 요구한다.
// (잔해 1~2칸 정리는 통과, 집 같은 구조물은 차단 — "집 주변 청소"가 집을 지워버린 사고 방지.)
const STRUCTURE_MIN_CELLS = 6;
// 배치 에셋 자리+주변(1칸 테두리)에 이 칸 수 이상의 기본-아닌 타일이 있으면 정리 방침(overExisting)을 요구한다.
const PLACEMENT_CONFLICT_MIN = 4;
// Event-like point assets do not overwrite map tiles. Requiring a terrain cleanup decision for an NPC,
// transfer, or event merely because it sits on a road produces false conflicts and retry loops.
const NON_TILE_ASSET_KINDS: ReadonlySet<string> = new Set(["event", "npc", "transfer"]);
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
  /**
   * 이 밑그림이 전제하는 맵 차원 — planned-map descriptor.
   *
   * 두 가지를 같은 필드로 선언한다:
   *  1. 아직 생성되지 않은 맵의 합성 차원(create_map/author_village(kind:"new") 직전).
   *  2. **기존 맵을 resize_map 으로 키운 뒤의 차원**(2026-09-15). 기존 맵에서는 현재 크기 이상만
   *     받는다 — 축소는 이벤트·시작 좌표 가드가 필요해서 resize_map 본체가 따로 거부한다.
   *
   * 왜 2번이 필요한가(실측): 기존 맵은 검증이 `map.width` 로 고정돼 있어 "맵을 키우고 거기에 놓겠다"는
   * 밑그림을 **제출할 방법 자체가 없었다**. 모델은 경계 밖 에셋 오류를 받고 가장 싼 수리(에셋을 안쪽으로
   * 밀거나 줄이기)를 택했고, 그래서 "마을 좀 넓혀줘" 가 맵 크기를 한 번도 바꾸지 않았다.
   */
  plannedMap?: { mapId: string; width: number; height: number };
}

export interface SpecIssue {
  severity: "error" | "warning";
  code?: "spec-new-plan-overlap" | "spec-existing-content" | "spec-destroy-confirmation"
    | "spec-asset-out-of-map" | "spec-planned-shrink";
  message: string;
}

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

// 게이트는 두 계약으로 갈린다(2026-09-03): **스코프**(밑그림 필수 + 빈 땅 자동 확장)는 이 목록만 받고,
// **기존 내용 보호**(기준선 맵의 구조물·물·절벽을 선언 없이 덮지 않음)는 타일을 쓰는 모든 툴이 받는다
// (아래 TILE_WRITE_TOOLS 포함). v3 공정 프리미티브(build_wall 등)는 승인 어휘 자체가 명세라 스코프는 요구하지
// 않고(2026-07-07 타일 시공 흐름 재설계 §2.1.1, resolveVocabForBuild soft-allow) 보호만 받는다.
// 단, fill_region은 넓은 지형 쓰기라 스펙 자동 확장 관례를 탄다. 레지스트리에 없는 이름은 두지 않는다 —
// 옛 tile_* v2 4종이 여기 남아 있어 목록이 살아 있는 것처럼 보였다.
export const SPATIAL_BUILD_TOOLS: ReadonlySet<string> = new Set([
  "paint_tiles", "paint_road", "build_house", "build_village", "stamp_structure",
  "clear_region", "place_npc", "place_battle_blocker",
  // canonical construction facades
  "author_house", "author_village",
  // 타일 v3 영역 채우기
  "fill_region",
]);

// 밑그림(스코프)은 요구하지 않지만 **기존 내용 보호**는 받는 타일 쓰기 툴 — v3 시공 프리미티브.
// v3 는 승인 어휘가 곧 명세라 set_build_spec 없이 빈 땅에 그릴 수 있어야 한다(soft-allow). 그러나
// 기준선(사용자 맵)에 이미 있는 구조물·물·절벽을 선언 없이 덮는 것은 밑그림 툴과 같은 기준으로 막는다.
// 2026-09-03 실측: 시스템 프롬프트가 정리용으로 권하는 tile_erase 가 게이트 밖이라 절벽 능선 6칸을
// 아무 검사 없이 바닥으로 바꿨고, 구조물 보호는 deprecated 된 clear_region 에만 걸려 있었다.
export const TILE_WRITE_TOOLS: ReadonlySet<string> = new Set([
  "tile_erase", "place_props", "build_wall", "lay_path", "place_door", "place_window", "build_roof",
  // MZ 4층 블록 찍기 — 1·3층 칸도 덮으므로 기존 내용 보호를 받는다(그림자만 쓰는 paint_shadow 는 덮지 않는다).
  "stamp_layer_block",
]);

// 밑그림 툴 중 타일을 덮어쓰지 않는 점 배치 — 기존 내용 보호 대상이 아니다.
// 덮어쓰는 것이 없으므로 "밑그림이 없다" 는 이유로만 막을 근거도 없다(F2) — 경계·plannedMap 검사는 그대로 받는다.
export const NON_TILE_SPATIAL_TOOLS: ReadonlySet<string> = new Set(["place_npc", "place_battle_blocker"]);

/** 이 툴 호출이 맵 타일을 덮어쓰는가 — 기존 내용 보호를 적용할지 정한다. */
export function toolWritesTiles(toolName: string): boolean {
  if (TILE_WRITE_TOOLS.has(toolName)) return true;
  return SPATIAL_BUILD_TOOLS.has(toolName) && !NON_TILE_SPATIAL_TOOLS.has(toolName);
}

export const SPEC_BOUNDARY_SLACK_TOOLS: ReadonlySet<string> = new Set([
  "paint_tiles", "paint_road", "build_house", "build_village", "stamp_structure",
  "author_house", "author_village",
  "place_npc", "place_battle_blocker",
  "fill_region",
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

/**
 * 검증을 통과한 밑그림을 세션이 **저장하기 전에** 좌표를 정수로 굳힌다.
 *
 * set_build_spec 은 세션이 직접 처리해 runTool 의 스키마 정규화를 안 거치므로 모델이 좌표를 "22" 같은
 * 문자열로 보낼 수 있다. 검증기(checkAsset)는 그 값을 수용하지만, 원본을 그대로 activeSpec 에 두면
 * 게이트의 `x + w` 가 문자열 결합("2"+"4"="24")이 되어 4칸짜리 에셋이 24칸을 덮는 것으로 계산됐다 —
 * 밑그림 밖 구조물 정리가 그대로 통과했다(2026-09-03 적대적 리뷰 P1). 경계에서 한 번 파싱한다.
 */
export function normalizeBuildSpec(spec: BuildSpec): BuildSpec {
  const assets = spec.assets.map((asset) => ({
    ...asset,
    x: coerceCoordinate(asset.x),
    y: coerceCoordinate(asset.y),
    w: coerceCoordinate(asset.w),
    h: coerceCoordinate(asset.h),
  }));
  const plannedMap = spec.plannedMap
    ? { ...spec.plannedMap, width: coerceCoordinate(spec.plannedMap.width), height: coerceCoordinate(spec.plannedMap.height) }
    : undefined;
  return plannedMap === undefined ? { ...spec, assets } : { ...spec, assets, plannedMap };
}

function coerceCoordinate(value: number): number {
  const coerced = coerceInteger(value);
  return typeof coerced === "number" ? coerced : value;
}

/**
 * planned-map descriptor 검사. 새 맵은 합성 차원을 그대로, 기존 맵은 **확장만** 받는다.
 * 축소를 여기서 거부하는 이유: 작아진 밑그림은 경계 밖 이벤트·시작 좌표를 조용히 버리는 계획이 되고,
 * 그 가드는 resize_map 본체에만 있다. 줄이려면 move_event/remove_event 로 먼저 정리하게 한다.
 */
function checkPlannedMap(
  plannedMap: Record<string, unknown>,
  mapId: string,
  map: GameMap | undefined,
  issues: SpecIssue[],
): { width: number; height: number } | null {
  const plannedId = typeof plannedMap.mapId === "string" ? plannedMap.mapId : null;
  const pw = Number.isInteger(plannedMap.width) ? (plannedMap.width as number) : null;
  const ph = Number.isInteger(plannedMap.height) ? (plannedMap.height as number) : null;
  if (plannedId === null || plannedId !== mapId) {
    issues.push({ severity: "error", message: `plannedMap.mapId('${plannedId ?? "?"}')가 BuildSpec.mapId('${mapId}')와 다릅니다.` });
    return null;
  }
  if (pw === null || ph === null || pw < 1 || ph < 1) {
    issues.push({ severity: "error", message: "plannedMap.width/height는 1 이상의 정수여야 합니다." });
    return null;
  }
  if (map !== undefined && (pw < map.width || ph < map.height)) {
    issues.push({
      severity: "error",
      code: "spec-planned-shrink",
      message:
        `plannedMap ${pw}×${ph}가 기존 맵 '${mapId}' ${map.width}×${map.height}보다 작습니다. `
        + "기존 맵의 plannedMap 은 확장(현재 크기 이상)만 선언할 수 있습니다 — 줄이려면 경계 밖 이벤트를 먼저 "
        + "move_event/remove_event 로 정리한 뒤 resize_map 을 직접 호출하세요.",
    });
    return null;
  }
  return { width: pw, height: ph };
}

/**
 * 이 밑그림이 요구하는 최소 맵 크기 — 경계 밖 에셋이 있을 때 "얼마로 키우면 되는가"를 코드가 계산한다.
 * 모델이 숨은 숫자를 다시 발명하지 않게 거부 응답이 이 값을 그대로 실어 보낸다. 확장이 필요 없으면 null.
 */
export function plannedGrowthForSpec(
  map: Pick<GameMap, "width" | "height">,
  spec: Pick<BuildSpec, "assets">,
): { width: number; height: number } | null {
  let width = map.width;
  let height = map.height;
  for (const asset of spec.assets) {
    const x = coerceCoordinate(asset.x);
    const y = coerceCoordinate(asset.y);
    const w = coerceCoordinate(asset.w);
    const h = coerceCoordinate(asset.h);
    if (![x, y, w, h].every((value) => Number.isInteger(value))) continue;
    if (x < 0 || y < 0) continue; // 음수 좌표는 확장으로 풀 수 없다 — 좌표 자체가 틀렸다.
    width = Math.max(width, x + w);
    height = Math.max(height, y + h);
  }
  if (width <= map.width && height <= map.height) return null;
  if (width > MAX_TOOL_MAP_DIMENSION || height > MAX_TOOL_MAP_DIMENSION) return null;
  return { width, height };
}

export function validateBuildSpec(project: Project, spec: unknown): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const rawSpec: unknown = spec;
  if (!isRecord(rawSpec)) return [{ severity: "error", message: "BuildSpec는 객체여야 합니다." }];

  const mapId = typeof rawSpec.mapId === "string" ? rawSpec.mapId : null;
  const map = mapId === null ? undefined : project.maps[mapId];
  // planned-map descriptor: 새 맵의 합성 차원, 또는 기존 맵을 키운 뒤의 차원을 제공하면
  // 에셋 경계 검증에 사용한다. mapId 불일치/차원 오류/기존 맵 축소는 error.
  const plannedMap = isRecord(rawSpec.plannedMap) ? rawSpec.plannedMap : null;
  let effectiveWidth: number | undefined;
  let effectiveHeight: number | undefined;
  if (mapId === null) {
    issues.push({ severity: "error", message: "BuildSpec.mapId는 문자열이어야 합니다." });
  } else if (plannedMap !== null) {
    const planned = checkPlannedMap(plannedMap, mapId, map, issues);
    if (planned !== null) {
      effectiveWidth = planned.width;
      effectiveHeight = planned.height;
    } else if (map !== undefined) {
      // 잘못된 planned 선언이 기존 맵의 경계 검증까지 꺼 버리면 안 된다 — 현재 크기로 계속 잰다.
      effectiveWidth = map.width;
      effectiveHeight = map.height;
    }
  } else if (map !== undefined) {
    effectiveWidth = map.width;
    effectiveHeight = map.height;
  } else {
    issues.push({ severity: "error", message: `맵 '${mapId}'을 찾을 수 없습니다.` });
  }

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

    if (effectiveWidth !== undefined && effectiveHeight !== undefined && !insideMap(checked, effectiveWidth, effectiveHeight)) {
      issues.push({
        severity: "error",
        code: "spec-asset-out-of-map",
        message: `에셋 '${checked.id}' 영역(${checked.x},${checked.y}) ${checked.w}×${checked.h}가 맵 크기 ${effectiveWidth}×${effectiveHeight} 밖입니다.`,
      });
    }
    checkedAssets.push(checked);
  });

  if (buildOrder !== null) checkBuildOrderCoverage(buildOrder, checkedAssets, issues);

  for (let left = 0; left < checkedAssets.length; left += 1) {
    for (let right = left + 1; right < checkedAssets.length; right += 1) {
      const a = checkedAssets[left];
      const b = checkedAssets[right];
      if (a === undefined || b === undefined || overlapAllowed(a, b, buildOrder)) continue;
      const rect = intersection(a, b);
      if (rect === null) continue;
      issues.push({ severity: "error", code: "spec-new-plan-overlap", message: `에셋 '${a.id}'와 '${b.id}'가 교차합니다: (${rect.x},${rect.y}) ${rect.w}×${rect.h}.` });
    }
  }

  // 구조물 보호: clear 에셋이 기존 구조물(지어진 칸)을 덮으면 confirmDestroy 없이는 거부한다.
  // "집 주변 청소"가 집 자체를 지워버린 사고 방지 — 맵의 실제 내용을 근거로 판정한다.
  if (map !== undefined) {
    const currentMap = map;
    const tileset = project.tilesets[currentMap.tilesetId];
    const ground = groundProfileFor(currentMap, tileset);
    const clearAssets = checkedAssets.filter((asset) => asset.kind === "clear");
    for (const asset of checkedAssets) {
      if (asset.kind === "clear") {
        if (asset.confirmDestroy) continue;
        const built = builtCellsInRegions(currentMap, [{ mapId: currentMap.id, x: asset.x, y: asset.y, w: asset.w, h: asset.h }], tileset);
        if (built.count >= STRUCTURE_MIN_CELLS) {
          const at = built.sample ? ` 예: (${built.sample.x},${built.sample.y})` : "";
          issues.push({
            severity: "error",
            code: "spec-destroy-confirmation",
            message:
              `clear 에셋 '${asset.id}'가 기존 구조물·비잔디 지형(호수/물·길·나무 등)을 덮습니다(${built.count}칸${at}). ` +
              `호수·물·길을 치우는 요청이면 이 에셋에 confirmDestroy:true를 넣고 set_build_spec을 재제출하세요. ` +
              `'주변만' 청소면 구조물·물을 피해 영역을 좁히세요.`,
          });
        }
        continue;
      }
      // 배치(비-clear) 에셋: 자리+주변에 기본 타일이 아닌 것이 있으면 overExisting으로 정리 방침을 선언해야 한다.
      if (asset.overExisting || NON_TILE_ASSET_KINDS.has(asset.kind)) continue;
      const conflict = placementConflict(currentMap, asset, clearAssets, ground);
      if (conflict.count >= PLACEMENT_CONFLICT_MIN) {
        const at = conflict.sample ? ` 예: (${conflict.sample.x},${conflict.sample.y})` : "";
        issues.push({
          severity: "error",
          code: "spec-existing-content",
          message: `에셋 '${asset.id}' 자리·주변에 기본 타일이 아닌 것이 ${conflict.count}칸 있습니다${at}. 그 위에 그냥 놓을지 스스로 판단해 이 에셋에 overExisting:"clear"(정리하고 배치) 또는 "keep"(그대로 위에 배치)을 넣어 재제출하세요.`,
        });
      }
    }
  }

  return issues;
}

// 배치 에셋 자리 + 1칸 테두리에서 '지어진'(기본-아닌) 칸 수를 센다. 단, 같은 스펙의 clear 에셋이
// 덮는 칸은 정리될 예정이므로 제외한다. 계획된 다른 에셋은 맵에 아직 없으므로 세지 않는다(오탐 방지).
function placementConflict(map: GameMap, asset: CheckedAsset, clearAssets: readonly CheckedAsset[], ground: GroundProfile): { count: number; sample?: { x: number; y: number } } {
  let count = 0;
  let sample: { x: number; y: number } | undefined;
  for (let y = Math.max(0, asset.y - 1); y <= Math.min(map.height - 1, asset.y + asset.h); y += 1) {
    for (let x = Math.max(0, asset.x - 1); x <= Math.min(map.width - 1, asset.x + asset.w); x += 1) {
      if (!isBuiltCell(map, x, y, ground)) continue;
      if (clearAssets.some((clear) => containsCell(clear, x, y))) continue;
      count += 1;
      sample ??= { x, y };
    }
  }
  return sample === undefined ? { count } : { count, sample };
}

export function affectedRegions(toolName: string, args: Record<string, unknown>): AffectedRegion[] {
  const mapId = typeof args.mapId === "string" ? args.mapId : null;

  // canonical construction facades — nested target 구조에서 mapId와 영역을 추출한다.
  if (toolName === "author_house") {
    const effectiveMapId = mapId ?? nestedTargetMapId(args.target);
    if (effectiveMapId === null) return [];
    if (args.kind === "lots" && Array.isArray(args.houses)) {
      const lotWings = houseLotWings(args.houses);
      const lotRegions = wingsRegions(effectiveMapId, lotWings, "yard");
      if (lotRegions !== null) return lotRegions;
    }
    const wingRegionsForKit = wingsRegions(effectiveMapId, args.wings, "door");
    if (wingRegionsForKit !== null) return wingRegionsForKit;
    return [{ mapId: effectiveMapId, x: 0, y: 0, w: 0, h: 0 }];
  }
  if (toolName === "author_village") {
    const targetMapId = nestedTargetMapId(args.target);
    if (targetMapId === null) return [];
    const bounds = nestedTargetBounds(args.target);
    if (bounds !== null) return [bounds.mapId === targetMapId ? bounds : { ...bounds, mapId: targetMapId }];
    return [{ mapId: targetMapId, x: 0, y: 0, w: 0, h: 0 }];
  }

  if (mapId === null) return [];

  // stamp_layer_block: {x,y} + 층별 2차원 배열 — 가장 큰 배열이 덮는 상자.
  if (toolName === "stamp_layer_block") {
    const block = layerBlockRegion(mapId, args);
    if (block !== null) return [block];
  }

  const cellRegions = pointRegions(mapId, args.cells);
  if (cellRegions !== null) return cellRegions;

  const pointRegionsForRoad = pointRegions(mapId, args.points);
  if (pointRegionsForRoad !== null) return pointRegionsForRoad;

  const cornerRect = rectFromCorners(mapId, args.from, args.to);
  if (cornerRect !== null) return [cornerRect];

  const rectArg = rectFromObject(mapId, args.rect);
  if (rectArg !== null) return [rectArg];

  // v3 시공 프리미티브의 좌표 wrapper — place_props(area) · build_roof(wallRect) · place_door/place_window(at).
  // 이 키를 읽지 않으면 면적 0 폴백으로 떨어져 기존 내용 보호 검사를 통째로 건너뛴다.
  const areaRect = rectFromObject(mapId, args.area);
  if (areaRect !== null) return [areaRect];
  const wallRect = rectFromObject(mapId, args.wallRect);
  if (wallRect !== null) return [wallRect];
  if (isPoint(args.at)) return [{ mapId, x: args.at.x, y: args.at.y, w: 1, h: 1 }];

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

export function uncoveredRegionsBySpec(assets: readonly SpecAsset[], regions: readonly AffectedRegion[]): AffectedRegion[] {
  const uncovered: AffectedRegion[] = [];
  for (const region of regions) {
    if (region.w <= 0 || region.h <= 0) continue;
    for (let y = region.y; y < region.y + region.h; y += 1) {
      for (let x = region.x; x < region.x + region.w; x += 1) {
        if (assets.some((asset) => containsCell(asset, x, y))) continue;
        uncovered.push({ mapId: region.mapId, x, y, w: 1, h: 1 });
      }
    }
  }
  return uncovered;
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
// 상위 타일이 비어있지 않거나, 하위 타일이 그 맵의 자연 바닥이 아니면 무언가 지어진 것으로 본다.
export function builtCellsInRegions(map: GameMap, regions: readonly AffectedRegion[], tileset?: TilesetDef): { count: number; sample?: { x: number; y: number } } {
  const ground = groundProfileFor(map, tileset);
  let count = 0;
  let sample: { x: number; y: number } | undefined;
  for (const region of regions) {
    if (region.w <= 0 || region.h <= 0) continue;
    for (let y = Math.max(0, region.y); y < Math.min(map.height, region.y + region.h); y += 1) {
      for (let x = Math.max(0, region.x); x < Math.min(map.width, region.x + region.w); x += 1) {
        if (!isBuiltCell(map, x, y, ground)) continue;
        count += 1;
        sample ??= { x, y };
      }
    }
  }
  return sample === undefined ? { count } : { count, sample };
}

/**
 * 호출 영역 안에서 **기준선(사용자 맵)에 이미 있던** 지어진 칸 중, 밑그림이 덮어쓰기를 허가하지 않은 칸.
 *
 * 허가는 에셋의 선언이다 — `clear` 에셋의 `confirmDestroy:true`(철거) 또는 배치 에셋의 `overExisting`
 * (정리하고 배치 / 그대로 위에 배치). 밑그림 안이라도 선언이 없으면 기존 내용은 덮지 않는다.
 * 이 일반 허가는 완성된 집 보호를 해제하지 않는다. toolRunner의 현재 프로젝트 기반
 * 메타데이터·셀 불변식은 선택 영역과 이 선언을 받지 않으며 모든 쓰기에 별도로 적용된다.
 * 2026-09-03 적대적 리뷰: 구조물 보호가 제출 시점에만 돌아 밑그림 안에 지은 집을 같은 턴의 clear 가
 * 무검사로 지웠고, 밑그림 확정 뒤 사용자가 판 호수를 다음 턴의 채우기가 덮었다.
 */
export function protectedCellsInRegions(
  baselineMap: GameMap,
  regions: readonly AffectedRegion[],
  assets: readonly SpecAsset[],
  tileset?: TilesetDef,
): { count: number; sample?: { x: number; y: number } } {
  const ground = groundProfileFor(baselineMap, tileset);
  const permits = assets.filter(assetPermitsOverwrite);
  let count = 0;
  let sample: { x: number; y: number } | undefined;
  for (const region of regions) {
    if (region.w <= 0 || region.h <= 0) continue;
    for (let y = Math.max(0, region.y); y < Math.min(baselineMap.height, region.y + region.h); y += 1) {
      for (let x = Math.max(0, region.x); x < Math.min(baselineMap.width, region.x + region.w); x += 1) {
        if (!isBuiltCell(baselineMap, x, y, ground)) continue;
        if (permits.some((asset) => containsCell(asset, x, y))) continue;
        count += 1;
        sample ??= { x, y };
      }
    }
  }
  return sample === undefined ? { count } : { count, sample };
}

function assetPermitsOverwrite(asset: SpecAsset): boolean {
  // 사용자가 맵에서 직접 지목한 선택 영역(암묵 스펙, 이 턴 한정)은 그 안의 기존 내용을 고쳐도 좋다는 뜻이다 —
  // 「이 침실 가구 배치 좀 고쳐줘」의 지우고 다시 놓기가 여기 해당한다(test/assistantMapPreservationGuard).
  if (asset.kind === SELECTION_ASSET_KIND) return true;
  if (asset.kind === "clear") return asset.confirmDestroy === true;
  return asset.overExisting === "clear" || asset.overExisting === "keep";
}

/** 맵의 '자연 바닥' 판정 — 타일셋 어휘로 정한다. */
interface GroundProfile {
  readonly isGround: (lower: number) => boolean;
  /** 최외곽 링이 전부 WALL 인 생성 테두리면 링은 구조물 판정에서 제외한다. */
  readonly ringIsGeneratedBorder: boolean;
}

/**
 * 어떤 하위 타일이 '지어진 것'이 아니라 자연 바닥인가.
 *
 * 잔디(240) 리터럴만 바닥으로 보던 시절에는 모래·눈·실내 바닥·짙은 잔디 맵의 모든 칸이 구조물이 되어
 * 모든 배치가 overExisting, 모든 정리가 confirmDestroy 를 요구했다(얼음 대평원 62×62 = 3844칸 전부).
 * 실제 턴에서 눈밭 위 집·길이 「기존 구조물 N칸」으로 5회 차단됐고, 모델은 통과하려고 28×22 파괴
 * 선언을 냈다(2026-09-03 실측). 타일셋 그룹 역할의 능력이 `naturalGround`(tileRoles 표: terrain·ground·path)이고
 * 통행 가능한 하위 타일이 바닥이다 — 물(water)·벽·절벽(wall)·나무(prop)·통행 불가 미분류 타일은 그대로 지어진
 * 것으로 남는다. 역할 이름을 직접 비교하지 않는 이유는 A-2 게이트(test/roleNameComparisonGate)다.
 * 타일셋을 모르면 예전 판정(빈칸·잔디)으로 물러난다.
 */
function groundProfileFor(map: GameMap, tileset: TilesetDef | undefined): GroundProfile {
  const terrainTiles = new Set<number>();
  if (tileset) {
    for (const group of tileset.tileGroups ?? []) {
      if (!roleCapabilities(tileset, group.role).naturalGround) continue;
      for (const tile of group.tileIds ?? []) terrainTiles.add(tile);
    }
  }
  const passableCache = new Map<number, boolean>();
  const isPassable = (lower: number): boolean => {
    if (!tileset) return false;
    const cached = passableCache.get(lower);
    if (cached !== undefined) return cached;
    const pass = tilePassability(tileset, lower, TILE.EMPTY);
    const passable = pass.up && pass.down && pass.left && pass.right;
    passableCache.set(lower, passable);
    return passable;
  };
  return {
    isGround: (lower) => lower === TILE.EMPTY || lower === TILE.GRASS || (terrainTiles.has(lower) && isPassable(lower)),
    ringIsGeneratedBorder: ringIsUniformWall(map),
  };
}

function ringIsUniformWall(map: GameMap): boolean {
  if (map.width < 3 || map.height < 3) return false;
  for (let x = 0; x < map.width; x += 1) {
    if (map.lowerTiles[x] !== TILE.WALL || map.lowerTiles[(map.height - 1) * map.width + x] !== TILE.WALL) return false;
  }
  for (let y = 0; y < map.height; y += 1) {
    if (map.lowerTiles[y * map.width] !== TILE.WALL || map.lowerTiles[y * map.width + map.width - 1] !== TILE.WALL) return false;
  }
  return true;
}

function isBuiltCell(map: GameMap, x: number, y: number, ground: GroundProfile): boolean {
  // 생성된 WALL 테두리(옛 create_map 기본값)는 구조물이 아니다. 사용자가 가장자리에 세운 벽은 보호한다.
  if (ground.ringIsGeneratedBorder && (x <= 0 || y <= 0 || x >= map.width - 1 || y >= map.height - 1)) return false;
  const index = y * map.width + x;
  const upper = map.upperTiles[index] ?? TILE.EMPTY;
  if (upper !== TILE.EMPTY) return true;
  const lower = map.lowerTiles[index] ?? TILE.EMPTY;
  return !ground.isGround(lower);
}

/** 암묵 스펙(사용자 선택 영역) 에셋의 kind — 게이트는 이 영역 안의 기존 내용 덮어쓰기를 사용자 허가로 본다. */
export const SELECTION_ASSET_KIND = "selection";

export function implicitSpecFromContext(text: string): BuildSpec | null {
  const footer = parseContextFooter(text);
  if (footer === null || footer.mapId === null || footer.selection === null) return null;
  const { x, y, w, h } = footer.selection;
  return {
    mapId: footer.mapId,
    title: "사용자 선택 영역",
    assets: [{ id: "선택 영역", kind: SELECTION_ASSET_KIND, x, y, w, h }],
  };
}

/** 패널이 구조화해 넘긴 선택 영역(sendUserMessage opts.scope)을 암묵 스펙으로. */
export function implicitSpecFromScope(scope: { readonly mapId: string; readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } } | null | undefined): BuildSpec | null {
  if (!scope || scope.region.width < 1 || scope.region.height < 1) return null;
  return {
    mapId: scope.mapId,
    title: "사용자 선택 영역",
    assets: [{ id: "선택 영역", kind: SELECTION_ASSET_KIND, x: scope.region.x, y: scope.region.y, w: scope.region.width, h: scope.region.height }],
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
  // set_build_spec은 세션이 직접 처리해 runTool의 스키마 정규화를 안 거친다 —
  // 모델이 좌표를 "22" 같은 숫자 문자열로 보내는 케이스를 여기서 수용한다.
  const x = coerceInteger(rawAsset.x);
  const y = coerceInteger(rawAsset.y);
  const w = coerceInteger(rawAsset.w);
  const h = coerceInteger(rawAsset.h);
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

function coerceInteger(value: unknown): unknown {
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return value;
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

function rectFromObject(mapId: string, value: unknown): AffectedRegion | null {
  if (!isRecord(value)) return null;
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !isFiniteNumber(value.w) || !isFiniteNumber(value.h)) return null;
  return { mapId, x: value.x, y: value.y, w: value.w, h: value.h };
}

function layerBlockRegion(mapId: string, args: Record<string, unknown>): AffectedRegion | null {
  if (!isFiniteNumber(args.x) || !isFiniteNumber(args.y) || typeof args.layers !== "object" || args.layers === null) return null;
  let w = 0;
  let h = 0;
  for (const grid of Object.values(args.layers as Record<string, unknown>)) {
    if (!Array.isArray(grid)) continue;
    h = Math.max(h, grid.length);
    for (const row of grid) if (Array.isArray(row)) w = Math.max(w, row.length);
  }
  return w > 0 && h > 0 ? { mapId, x: args.x, y: args.y, w, h } : null;
}

function rectFromXY(mapId: string, args: Record<string, unknown>): AffectedRegion | null {
  if (!isFiniteNumber(args.x) || !isFiniteNumber(args.y)) return null;
  if (isFiniteNumber(args.w) && isFiniteNumber(args.h)) return { mapId, x: args.x, y: args.y, w: args.w, h: args.h };
  if (isFiniteNumber(args.width) && isFiniteNumber(args.height)) return { mapId, x: args.x, y: args.y, w: args.width, h: args.height };
  return { mapId, x: args.x, y: args.y, w: 1, h: 1 };
}

/** author_house kind=lots 의 houses[].wings 를 flat wings 배열로. */
function houseLotWings(houses: unknown): unknown[] {
  if (!Array.isArray(houses)) return [];
  const wings: unknown[] = [];
  for (const house of houses) {
    if (typeof house !== "object" || house === null) continue;
    const list = (house as Record<string, unknown>).wings;
    if (!Array.isArray(list)) continue;
    wings.push(...list);
  }
  return wings;
}

function wingsRegions(
  mapId: string,
  value: unknown,
  front: false | "door" | "yard",
): AffectedRegion[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const regions: AffectedRegion[] = [];
  for (const wing of value) {
    if (typeof wing !== "object" || wing === null || Array.isArray(wing)) return null;
    const record = wing as Record<string, unknown>;
    if (!isFiniteNumber(record.x) || !isFiniteNumber(record.y) || !isFiniteNumber(record.w) || !isFiniteNumber(record.h)) return null;
    regions.push({ mapId, x: record.x, y: record.y, w: record.w, h: record.h });
    if (front === "door") {
      regions.push({ mapId, x: record.x + Math.floor((record.w - 1) / 2), y: record.y + record.h, w: 1, h: 1 });
    } else if (front === "yard") {
      // 문 앞 마당 깊이 3칸 (author_house lots 마당 산포 영역)
      regions.push({ mapId, x: record.x, y: record.y + record.h, w: record.w, h: 3 });
    }
  }
  return regions;
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

function overlapAllowed(a: CheckedAsset, b: CheckedAsset, buildOrder: readonly string[] | null): boolean {
  return (
    // 타일을 쓰지 않는 점 에셋(주민·이벤트·이동)은 길 위·집 문앞에 서는 게 정상이다 — 교차가 아니다.
    NON_TILE_ASSET_KINDS.has(a.kind) || NON_TILE_ASSET_KINDS.has(b.kind) ||
    (a.layer === "upper") !== (b.layer === "upper") ||
    (a.kind === "road" && b.kind === "road") ||
    clearThenBuildOverlapAllowed(a, b, buildOrder) ||
    terrainThenRoadOverlapAllowed(a, b, buildOrder)
  );
}

function terrainThenRoadOverlapAllowed(a: CheckedAsset, b: CheckedAsset, buildOrder: readonly string[] | null): boolean {
  if (!buildOrder || !((a.kind === "terrain" && b.kind === "road") || (a.kind === "road" && b.kind === "terrain"))) return false;
  const terrainRank = buildOrder.indexOf("terrain");
  const roadRank = buildOrder.indexOf("road");
  return terrainRank >= 0 && roadRank > terrainRank;
}

function clearThenBuildOverlapAllowed(a: CheckedAsset, b: CheckedAsset, buildOrder: readonly string[] | null): boolean {
  if (buildOrder === null) return false;
  const clear = a.kind === "clear" ? a : b.kind === "clear" ? b : null;
  const other = clear === a ? b : clear === b ? a : null;
  if (clear === null || other === null || other.kind === "clear") return false;
  const clearRank = buildOrder.indexOf("clear");
  const otherRank = buildOrder.indexOf(other.kind);
  return clearRank >= 0 && otherRank >= 0 && clearRank < otherRank;
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

/** canonical construction nested target에서 mapId 추출. */
function nestedTargetMapId(target: unknown): string | null {
  if (!isRecord(target)) return null;
  return typeof target.mapId === "string" && target.mapId.length > 0 ? target.mapId : null;
}

/** canonical construction nested target에서 bounds 추출 (existing bounds 또는 plannedMap dimensions). */
function nestedTargetBounds(target: unknown): AffectedRegion | null {
  if (!isRecord(target)) return null;
  const mapId = nestedTargetMapId(target);
  if (mapId === null) return null;
  if (isRecord(target.bounds)) {
    const b = target.bounds;
    if (isFiniteNumber(b.x) && isFiniteNumber(b.y) && isFiniteNumber(b.w) && isFiniteNumber(b.h)) {
      return { mapId, x: b.x, y: b.y, w: b.w, h: b.h };
    }
  }
  if (isRecord(target.plannedMap)) {
    const pm = target.plannedMap;
    if (isFiniteNumber(pm.width) && isFiniteNumber(pm.height)) {
      return { mapId, x: 0, y: 0, w: pm.width, h: pm.height };
    }
  }
  if (isFiniteNumber(target.width) && isFiniteNumber(target.height)) {
    return { mapId, x: 0, y: 0, w: target.width, h: target.height };
  }
  return null;
}

function isPoint(value: unknown): value is { x: number; y: number } { return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y); }

function isInteger(value: unknown): value is number { return Number.isInteger(value); }

function isFiniteNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
