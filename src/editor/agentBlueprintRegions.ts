// editor/agentBlueprintRegions.ts
// 청사진 진행 판정 전용 영역 추출 — 툴콜 인자에서 "이번 호출이 건드린 칸"을 뽑는다.
//
// 왜 `affectedRegions`(ai/buildSpec)를 그대로 쓰지 않는가: 그 함수는 **스펙 게이트**의 것이고
// fail-closed 계약을 갖는다 — 사각형을 못 뽑으면 `{x:0,y:0,w:0,h:0}` 을 내고 게이트는 면적 0 을
// 건너뛴다(checkRegionsAgainstSpecBoundary). 게이트에는 그게 맞다(모르는 호출을 막지 않는다).
// 그런데 좌표를 wrapper 키에 담는 쓰기 툴이 많다 — place_props 의 `area`, place_door/place_window 의
// `at`, build_roof 의 `wallRect`, build_castle 의 `bounds`, stamp_structure_kit 의 `origin`,
// place_examine_hotspots 의 `hotspots`. 청사진이 그 폴백을 그대로 받으면 "위치를 모르면 침묵한다"
// 규칙에 걸려 진행이 한 칸도 움직이지 않는다.
//
// 2026-08-29 실측(가장 아픈 경로): 시스템 프롬프트가 마을을 만들 때 쓰라고 **글자 그대로** 지시하는
// `author_village(target:{kind:"existing",mapId})` 는 `bounds` 가 선택이라(스키마·파서·
// invalidArgsExample 모두 생략) 인자에 좌표가 없다. 마을이 다 지어져도 청사진은 100% planned
// (파랑)로 남고 finishAgentBlueprint 는 building 이 없어 아무것도 안 했다.
//
// 게이트 판정을 흔들면 안 되므로 `affectedRegions` 는 **손대지 않는다**. 여기서 그 결과를 먼저
// 쓰고, 면적 0 폴백으로 떨어진 경우에만 이 모듈의 추가 규약으로 다시 읽는다.
//
// 순수 모듈이다(브라우저·Phaser·store·툴 레지스트리 비의존) — agentBlueprint.ts 와 같은 규약.

import { affectedRegions, type AffectedRegion } from "@/ai/buildSpec";

export interface BlueprintCallRegions {
  /** 이 호출이 건드린 맵(최상위 mapId 또는 nested target.mapId). 모르면 null. */
  readonly mapId: string | null;
  /** 면적이 있는 영역만. 비어 있으면 "위치를 모른다"(침묵 대상). */
  readonly regions: readonly AffectedRegion[];
  /** 대상 전체를 한 번에 시공하는 파사드인가 — 한 칸으로 귀속하면 안 된다(아래 주석). */
  readonly wholeTarget: boolean;
}

/**
 * 대상 전체를 한 호출로 시공하는 파사드.
 *
 * 이 호출은 정리·길·집·소품·주민을 전부 만든다. 그래서 사각형 하나로 귀속하면(맵 사각형을
 * 대신 넣든 bounds 를 쓰든) 맵 전체를 덮는 `clear` 칸이 IoU 로 이기고 나머지 칸은 계획 상태로
 * 남는다 — 1차 리뷰에서 고친 바로 그 결함이다. 그래서 파사드는 **걸리는 planned 칸 전부**를
 * 짓는 중으로 올린다(agentBlueprint.advanceAllPlanned). 실제로 그 호출이 한 일과 같다.
 *
 * 레거시 마을 파사드(build_village/plan_village/run_village_pipeline …)는 전부
 * CONSTRUCTION_WRITE_SUPERSEDED = deprecated 라 tool_call 이벤트로 올 수 없으므로 넣지 않는다.
 */
const WHOLE_TARGET_FACADES: ReadonlySet<string> = new Set(["author_village"]);

/**
 * 좌표를 담는 wrapper 키. jsonSchema.ts 의 COORDINATE_WRAPPER_KEYS(rect·region·area·bounds·
 * at·pos·point)와 같은 어휘에 실제 쓰기 툴이 쓰는 키를 더했다 — 새 툴이 이 관례를 따르면
 * 이 모듈을 고치지 않아도 진행이 잡힌다. 순서가 우선순위다(구체적인 시공 영역 먼저).
 */
const RECT_KEYS: readonly string[] = [
  "rect", "wallRect", "area", "region", "bounds", "at", "pos", "point", "position", "cell",
];

/** 점·사각형 배열을 담는 키(cells/points 는 affectedRegions 가 이미 읽는다). */
const RECT_LIST_KEYS: readonly string[] = ["hotspots", "spots", "areas", "regions", "rects", "wings"];

export function blueprintRegionsForToolCall(toolName: string, args: Record<string, unknown>): BlueprintCallRegions {
  const wholeTarget = WHOLE_TARGET_FACADES.has(toolName);
  // 게이트가 이미 진짜 사각형을 뽑았으면 그것이 정본이다(wings·cells·points·rect·from/to·x/y).
  const gateRegions = affectedRegions(toolName, args).filter((region) => region.w > 0 && region.h > 0);
  if (gateRegions.length > 0) {
    return { mapId: gateRegions[0].mapId, regions: gateRegions, wholeTarget };
  }
  const mapId = callMapId(args);
  if (mapId === null) return { mapId: null, regions: [], wholeTarget: false };

  // origin{x,y} + 최상위 width/height — 구조물 스탬프·집 계열의 모양이다.
  const origin = rectFromRecord(mapId, args.origin);
  if (origin !== null) {
    const width = positiveSize(args.width ?? args.w);
    const height = positiveSize(args.height ?? args.h);
    return { mapId, regions: [{ ...origin, w: width ?? origin.w, h: height ?? origin.h }], wholeTarget };
  }

  for (const key of RECT_KEYS) {
    const rect = rectFromRecord(mapId, args[key]);
    if (rect !== null) return { mapId, regions: [rect], wholeTarget };
  }
  for (const key of RECT_LIST_KEYS) {
    const rects = rectsFromArray(mapId, args[key]);
    if (rects !== null) return { mapId, regions: rects, wholeTarget };
  }

  // 위치를 모른다. 파사드면 "대상 전체"라는 뜻이고(bounds 없는 author_village), 그 외에는 침묵한다
  // (wallRect 없는 build_roof 처럼 툴이 맵을 스캔해 스스로 자리를 찾는 호출).
  return { mapId, regions: [], wholeTarget };
}

/** 최상위 mapId, 없으면 canonical construction 의 nested target.mapId. */
function callMapId(args: Record<string, unknown>): string | null {
  if (typeof args.mapId === "string" && args.mapId.length > 0) return args.mapId;
  const target = args.target;
  if (isRecord(target) && typeof target.mapId === "string" && target.mapId.length > 0) return target.mapId;
  return null;
}

/** {x,y} 는 1×1, {x,y,w,h}·{x,y,width,height} 는 사각형. 정수로 자른다(라벨·겹침 계산은 칸 단위). */
function rectFromRecord(mapId: string, value: unknown): AffectedRegion | null {
  if (!isRecord(value)) return null;
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;
  const w = positiveSize(value.w ?? value.width) ?? 1;
  const h = positiveSize(value.h ?? value.height) ?? 1;
  return { mapId, x: Math.trunc(value.x), y: Math.trunc(value.y), w, h };
}

/** 전부 좌표를 가진 배열만 받는다 — 하나라도 아니면 모양을 잘못 읽은 것이므로 포기한다. */
function rectsFromArray(mapId: string, value: unknown): AffectedRegion[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rects: AffectedRegion[] = [];
  for (const entry of value) {
    const rect = rectFromRecord(mapId, entry);
    if (rect === null) return null;
    rects.push(rect);
  }
  return rects;
}

function positiveSize(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  const size = Math.trunc(value);
  return size > 0 ? size : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
