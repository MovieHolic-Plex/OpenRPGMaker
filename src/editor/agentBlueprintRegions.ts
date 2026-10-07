// editor/agentBlueprintRegions.ts
// 청사진 진행 판정 전용 영역 추출 — 툴콜 인자에서 "이번 호출이 건드린 칸"을 뽑는다.
//
// 왜 `affectedRegions`(ai/buildSpec)를 그대로 쓰지 않는가: 그 함수는 **스펙 게이트**의 것이고
// fail-closed 계약을 갖는다 — 사각형을 못 뽑으면 `{x:0,y:0,w:0,h:0}` 을 내고 게이트는 면적 0 을
// 건너뛴다(checkRegionsAgainstSpecBoundary). 게이트에는 그게 맞다(모르는 호출을 막지 않는다).
// 그런데 좌표를 wrapper 키에 담는 쓰기 툴이 많다 — place_props 의 `area`, place_door/place_window 의
// `at`, build_roof 의 `wallRect`, build_castle 의 `bounds`, stamp_structure 의 `origin`,
// place_examine_hotspots 의 `hotspots[].at`. 청사진이 그 폴백을 그대로 받으면 "위치를 모르면
// 침묵한다" 규칙에 걸려 진행이 한 칸도 움직이지 않는다.
//
// 2026-08-29 실측(가장 아픈 경로): 시스템 프롬프트가 마을을 만들 때 쓰라고 **글자 그대로** 지시하는
// `author_village(target:{kind:"existing",mapId})` 는 `bounds` 가 선택이라(스키마·파서·
// invalidArgsExample 모두 생략) 인자에 좌표가 없다. 마을이 다 지어져도 청사진은 100% planned
// (파랑)로 남고 진행 갱신(markAgentBlueprintProgress)은 올릴 칸을 하나도 찾지 못했다.
//
// 게이트 판정을 흔들면 안 되므로 `affectedRegions` 는 **손대지 않는다**. 여기서 그 결과를 먼저
// 쓰고, 면적 0 폴백으로 떨어진 경우에만 이 모듈의 추가 규약으로 다시 읽는다.
//
// 순수 모듈이다(브라우저·Phaser·store·툴 레지스트리 비의존) — agentBlueprint.ts 와 같은 규약.

import { affectedRegions, type AffectedRegion } from "@/ai/buildSpec";
import {
  proposalCallChangedSomething,
  proposalChangedRegions,
  type ProposalCompletenessCall,
} from "@/ai/proposalCompleteness";

/** 턴 정산에 넘길 "실제로 들어간 것" — 영역 + 대상 전체를 지은 파사드의 맵 id. */
export interface AppliedBlueprintRegions {
  readonly regions: readonly AffectedRegion[];
  /** 대상 맵 전체를 시공하고 적용된 파사드의 맵 id — 영역을 인자에서 뽑을 수 없는 경우다. */
  readonly wholeTargetMapIds: readonly string[];
}

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
 * deprecated 라 tool_call 이벤트로 올 수 없으므로 넣지 않는다.
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

/**
 * 좌표 배열을 담는 키(cells/points 는 affectedRegions 가 이미 읽는다).
 *
 * 실측으로 도달 가능한 것만 남긴다 — 커버리지를 주장하는 죽은 목록은 다음 사람을 속인다.
 * - `hotspots`: place_examine_hotspots(쓰기, 최상위 mapId + `{at:{x,y},…}[]`). 항목 안의 좌표
 *   wrapper 를 벗겨야 읽힌다(아래 rectFromEntry) — 벗기지 않던 시절에는 전량 포기 규칙에 걸려
 *   `regions: []` 로 조용히 떨어졌다.
 * - `wings`: 게이트(affectedRegions)가 author_house 에서 먼저 소비하므로 오늘은
 *   이 폴백까지 오지 않는다. 모양이 맞는 유일한 예비 항목이라 새 집 파사드용으로 남긴다.
 *
 * 빼낸 것: `spots`(configure_fishing) · `areas`(configure_seasonal_forage) 는 최상위 mapId 가
 * 없고(스키마 additionalProperties:false) 맵 id 를 **항목마다** 들고 있어 callMapId 가 null 을 내며
 * 이 모듈이 먼저 빠져나간다 — 게다가 둘 다 타일을 칠하지 않는 system 설정 툴이라 청사진 진행의
 * 대상이 아니다. `regions`/`rects` 는 이 이름으로 인자를 받는 등록된 쓰기 툴이 하나도 없었다.
 */
const RECT_LIST_KEYS: readonly string[] = ["hotspots", "wings"];

/**
 * 최상위 `width`/`height` 가 **새 맵 크기**인 툴 — 발자국으로 읽으면 맵 전체가 한 칸이 된다.
 *
 * 오늘은 이 8종 중 `origin` 을 같이 받는 툴이 없어 아래 origin 분기에 닿지 않지만, 둘을 같이
 * 보내는 파사드가 하나 생기는 순간 origin 을 좌상단으로 하는 맵 크기짜리 영역이 조용히 나온다 —
 * 그 영역은 IoU 로 맵 전체를 덮는 `clear` 칸을 이기고 나머지 칸을 전부 done 으로 밀어낸다.
 */
const MAP_DIMENSION_TOOLS: ReadonlySet<string> = new Set([
  "create_map", "resize_map", "generate_map",
]);

export function blueprintRegionsForToolCall(toolName: string, args: Record<string, unknown>): BlueprintCallRegions {
  const wholeTarget = WHOLE_TARGET_FACADES.has(toolName);
  // 게이트가 이미 진짜 사각형을 뽑았으면 그것이 정본이다(wings·cells·points·rect·from/to·x/y).
  const gateRegions = affectedRegions(toolName, args).filter((region) => region.w > 0 && region.h > 0);
  if (gateRegions.length > 0) {
    return { mapId: gateRegions[0].mapId, regions: gateRegions, wholeTarget };
  }
  const mapId = callMapId(args);
  if (mapId === null) return { mapId: null, regions: [], wholeTarget: false };

  // origin{x,y} + 최상위 width/height — 구조물 스탬프·집 계열의 모양이다. 맵 크기를 뜻하는
  // width/height 는 발자국이 아니므로 읽지 않는다(MAP_DIMENSION_TOOLS 주석).
  const origin = rectFromRecord(mapId, args.origin);
  if (origin !== null) {
    const footprint = MAP_DIMENSION_TOOLS.has(toolName) ? null : args;
    const width = footprint === null ? null : positiveSize(footprint.width ?? footprint.w);
    const height = footprint === null ? null : positiveSize(footprint.height ?? footprint.h);
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
    const rect = rectFromEntry(mapId, entry);
    if (rect === null) return null;
    rects.push(rect);
  }
  return rects;
}

/**
 * 배열 항목 하나 — 좌표가 항목 바로 밑에 있거나 한 겹 더 들어가 있다.
 *
 * 실측: place_examine_hotspots 의 스키마는 항목마다 `required:["at"]` 이라 좌표가 `at` 안에 있다
 * (`{at:{x,y}, name, lines?, …}`). 최상위 x/y 만 보던 시절에는 스키마대로 온 인자가 전량 포기
 * 규칙(하나라도 아니면 null)에 걸려 `regions: []` 이 됐고, 살아 있는 쓰기 툴 하나가 청사진에서
 * 조용히 사라졌다 — 이 모듈이 애초에 없애려던 그 침묵이다.
 */
function rectFromEntry(mapId: string, entry: unknown): AffectedRegion | null {
  const direct = rectFromRecord(mapId, entry);
  if (direct !== null) return direct;
  if (!isRecord(entry)) return null;
  for (const key of RECT_KEYS) {
    const nested = rectFromRecord(mapId, entry[key]);
    if (nested !== null) return nested;
  }
  return null;
}

/**
 * 이번 턴에 **저장소로 들어간** 영역 — 청사진 턴 정산(agentBlueprint.settleAgentBlueprintTurn)의 근거.
 *
 * 기준은 완성도 린트가 쓰는 함수다(proposalChangedRegions). 정산이 아무 근거로나 계산하면 한
 * 화면에서 채팅은 "⚠ 미이행", 맵은 "완료 ✓" 가 되어 사용자가 어느 쪽을 믿을지 알 수 없다.
 *
 * 그런데 린트의 추출은 **이 모듈이 존재하는 이유인 바로 그 fail-closed 추출**로 떨어진다
 * (proposalCompleteness.changedRegionsForCall → affectedRegions). 즉 진행을 올리려면 이 모듈의
 * 풍부한 추출이 필요했던 쓰기 툴은 전부 정산에서 "아무것도 안 들어갔다" 로 판정돼 planned 로
 * 되돌아갔다. 실측(같은 호출을 진행 → 정산까지 통과시켰다):
 *   place_examine_hotspots  진행영역 2 · 정산영역 0 → grove   building → **planned**
 *   stamp_structure         진행영역 1 · 정산영역 0 → house_a building → **planned**
 *   build_castle            진행영역 1 · 정산영역 0 → house_a building → **planned**
 * 레지스트리 훑기로 같은 함정에 빠지는 쓰기 툴이 11종이다 — build_castle · stamp_structure ·
 * plant_tree_clusters · create_farm_plot · make_hunting_ground · make_gallery_room ·
 * make_horror_loop · place_examine_hotspots · set_lighting_volume · author_story_arc ·
 * compile_puzzle. 앞의 셋은 핵심 공간 시공이다. 사용자가 보는 것: `plant_tree_clusters` 로 숲을
 * 심고 턴이 정상 적용되고 타일이 **실제로** 바뀌는데 맵은 짓는 중을 파랑 계획으로 되감는다
 * (46f64610 대비 행위 회귀 — 그 시절엔 done 으로 끝났고 그게 사실이었다).
 *
 * 그래서 `author_village` 에만 있던 예외를 규칙으로 올린다: 호출이 **실제로 무언가를 바꿨는데**
 * (proposalCallChangedSomething = 성공 + 의미 있는 diff) 린트가 영역을 한 장도 못 뽑으면 이
 * 모듈의 추출로 되읽는다. 무변경을 done 으로 만들 수 없는 이유가 그 게이트다 — diff 가 비면
 * 폴백에 닿지 않으므로 영역이 없고, 정산은 그 칸을 planned 로 되돌린다.
 *
 * 남은 비대칭은 하나다: 채팅의 "⚠ 미이행" 은 여전히 린트 추출만 보므로 위 11종에 대해 경고를
 * 낼 수 있다. 그 경우 **맵이 맞고 채팅이 틀렸다**. 린트 쪽을 같이 고치려면 ai/proposalCompleteness
 * 가 editor/agentBlueprintRegions 를 import 해야 하는데 이 모듈이 이미 그쪽을 import 하므로
 * 순환이 된다 — 층을 뒤집는 일이라 별도 변경으로 미룬다.
 *
 * `bounds` 없는 `author_village` 는 여전히 특별하다: 대상 맵 전체를 지었는데 인자에 사각형이
 * 아예 없어(스키마·파서·invalidArgsExample 모두에서 bounds 는 선택) 어느 추출도 영역을 못 만든다.
 * 그 파사드가 실제 변경을 내고 적용됐으면 대상 맵 id 를 따로 알려 준다 — 6f3342df 가 고친
 * "마을을 지어도 100% 파랑" 의 재발을 막는다.
 */
export function appliedBlueprintRegions(calls: readonly ProposalCompletenessCall[]): AppliedBlueprintRegions {
  const wholeTargetMapIds: string[] = [];
  const regions: AffectedRegion[] = [];
  for (const call of calls) {
    const changedSomething = proposalCallChangedSomething(call);
    // 한 호출씩 본다 — 어느 호출이 영역을 못 냈는지 알아야 그 호출만 되읽을 수 있다.
    const lintRegions = proposalChangedRegions([call]);
    if (lintRegions.length > 0) {
      regions.push(...lintRegions);
    } else if (changedSomething) {
      regions.push(...blueprintRegionsForToolCall(call.name, call.args).regions);
    }
    if (!WHOLE_TARGET_FACADES.has(call.name) || !changedSomething) continue;
    const targetMapId = blueprintRegionsForToolCall(call.name, call.args).mapId;
    if (targetMapId !== null) wholeTargetMapIds.push(targetMapId);
  }
  return { regions, wholeTargetMapIds };
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
