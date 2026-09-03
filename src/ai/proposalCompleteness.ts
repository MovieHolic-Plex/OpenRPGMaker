// ai/proposalCompleteness.ts
// Proposal-time completeness lint. Keep this conservative: deterministic BuildSpec
// coverage first, then only low-risk request/count heuristics when there is no spec.

import { affectedRegions, type AffectedRegion, type BuildSpec, type SpecAsset } from "./buildSpec";
import type { IntentDeclaration } from "./intentDeclaration";
import { QUICK_REPLY_MARKER } from "./interviewPrompt";
import type { ChangeSummary } from "@/editor/tools/types";

export const PROPOSAL_COMPLETENESS_WARNING_PREFIX = "⚠ 미이행:";
export const PROPOSAL_SCOPE_WARNING_PREFIX = "⚠ 범위:";

export interface ProposalCompletenessCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result: {
    readonly ok: boolean;
    readonly diff?: ChangeSummary;
    readonly data?: unknown;
  };
}

export interface ProposalCompletenessInput {
  readonly requestText?: string;
  readonly assistantText?: string;
  readonly buildSpec?: BuildSpec | null;
  /**
   * 이번 턴의 의도 선언(모델이 읽은 것). 있으면 「변경을 기대하는 요청인가」「실내 신축인가」「수정인가」를
   * 선언 필드로 판정한다. 없을 때만(선언자 없는 세션·단독 테스트) 문장 휴리스틱으로 떨어진다.
   */
  readonly intent?: IntentDeclaration | null;
  readonly calls: readonly ProposalCompletenessCall[];
}

export function proposalCompletenessWarnings(input: ProposalCompletenessInput): string[] {
  const intent = input.intent && input.intent.source === "llm" ? input.intent : null;
  const base = input.buildSpec
    ? buildSpecCompletenessWarnings(input.buildSpec, input.calls)
    : heuristicCompletenessWarnings(input.requestText ?? "", input.calls, input.assistantText ?? "", intent);
  return dedupe([
    ...base,
    ...interiorCompletenessWarnings(input.requestText ?? "", input.calls, intent),
    ...questGraphCompletenessWarnings(input.calls),
  ]);
}

export function proposalCompletenessWarningLines(
  calls: readonly ProposalCompletenessCall[],
  extraWarnings: readonly string[] = []
): string[] {
  return dedupe([
    ...calls.flatMap((call) => call.result.diff?.warnings ?? []),
    ...extraWarnings,
  ].filter(isProposalCompletenessWarning));
}

export function isProposalCompletenessWarning(warning: string): boolean {
  return (
    warning.startsWith(PROPOSAL_COMPLETENESS_WARNING_PREFIX) ||
    warning.startsWith(PROPOSAL_SCOPE_WARNING_PREFIX) ||
    /^잠긴 항목 \d+개 보존됨$/u.test(warning)
  );
}

export function proposalScopeCarryoverWarning(planLabel: string): string {
  return `${PROPOSAL_SCOPE_WARNING_PREFIX} 이 제안에는 이전 계획(${planLabel})이 포함되어 있습니다.`;
}

export function proposalHasChangedMap(calls: readonly ProposalCompletenessCall[], mapId: string): boolean {
  return calls.some((call) => changedRegionsForCall(call).some((region) => region.mapId === mapId));
}

/**
 * 이 호출들이 실제로 바꾼 영역 — "⚠ 미이행" 경고가 밑그림 에셋 이행을 판정할 때 쓰는 그 신호다.
 *
 * 청사진 턴 정산(editor/agentBlueprintRegions.appliedBlueprintRegions)이 같은 함수를 쓴다.
 * 두 표면이 서로 다른 계산으로 "이 에셋은 지어졌나" 를 답하면 한 화면에서 채팅은 "미이행",
 * 맵은 "완료 ✓" 가 되어 사용자가 어느 쪽을 믿을지 알 수 없다.
 */
export function proposalChangedRegions(calls: readonly ProposalCompletenessCall[]): AffectedRegion[] {
  return calls.flatMap(changedRegionsForCall);
}

/** 이 호출이 무언가를 바꿨는가 — 성공 + 의미 있는 diff. 영역을 못 뽑는 호출과 구분해야 한다. */
export function proposalCallChangedSomething(call: ProposalCompletenessCall): boolean {
  return call.result.ok && hasMeaningfulDiff(call.result.diff);
}

export function requestLikelyExpectsChange(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (/\b(create|add|place|build|paint|draw|decorate|remove|delete|clear|set|make)\b/.test(normalized)) return true;
  return /(해줘|해주세요|만들|생성|추가|배치|놓아|놔|꾸며|장식|칠해|그려|지어|파줘|깔아|정리|삭제|수정|바꿔|설정)/.test(normalized);
}

function buildSpecCompletenessWarnings(buildSpec: BuildSpec, calls: readonly ProposalCompletenessCall[]): string[] {
  const touchedRegions = calls.flatMap(changedRegionsForCall);
  const missing = buildSpec.assets.filter((asset) => !assetTouched(buildSpec.mapId, asset, touchedRegions));
  if (missing.length === 0) return [];
  return [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} ${formatMissingSpecAssets(missing)}`];
}

function heuristicCompletenessWarnings(
  requestText: string,
  calls: readonly ProposalCompletenessCall[],
  assistantText: string,
  intent: IntentDeclaration | null,
): string[] {
  const changedCalls = calls.filter((call) => call.result.ok && hasMeaningfulDiff(call.result.diff));
  const requestedCount = requestedPlacementCount(requestText);
  if (changedCalls.length === 0) {
    // 의도 확인 질문(선택지)은 0-변경이 정상 — 미이행으로 보지 않는다.
    if (assistantTextLooksLikeIntentClarify(assistantText)) return [];
    const promised = endsWithProgressPromise(assistantText);
    if (promised) {
      return [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} 진행을 약속했지만 실제 변경이 없습니다(체인지셋 0건). 질문 대신 실행했어야 합니다.`];
    }
    const proceedInstruction = isProceedInstruction(requestText);
    const expectsChange = intent ? intent.mode === "create" || intent.mode === "modify" : requestLikelyExpectsChange(requestText);
    if (!proceedInstruction && !expectsChange && requestedCount === null) return [];
    const hint = proceedInstruction ? " 진행 지시였으므로 질문 대신 실행했어야 합니다." : "";
    return [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} 실제 변경이 없습니다(체인지셋 0건).${hint}`];
  }

  if (requestedCount === null) return [];
  const actualCount = actualPlacementCount(changedCalls);
  if (!isClearlyShort(requestedCount, actualCount)) return [];
  return [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} 요청 수량 ${requestedCount}개 대비 실제 배치 ${actualCount}개입니다.`];
}

const INTERIOR_ROOM_TOOL_NAMES = new Set([
  "place_concept",
  "start_interior_room_session",
  "run_interior_room_pipeline",
  "advance_interior_room_build",
  "evaluate_interior_room",
  "furnish_interior_space",
]);

function interiorCompletenessWarnings(
  _requestText: string,
  calls: readonly ProposalCompletenessCall[],
  intent: IntentDeclaration | null,
): string[] {
  // 실내 신축 여부는 선언이 정한다. 선언이 없으면 이 경고를 내지 않는다 — 「여관」「침실」 낱말 정규식으로
  // 실내를 추측하던 경로가 수정 요청에 「새 실내 맵을 시공하세요」를 붙여 신축을 밀어붙였다(2026-08-29).
  if (!intent || intent.space !== "interior" || intent.mode !== "create") return [];
  const okCalls = calls.filter((call) => call.result.ok);
  if (okCalls.some((call) => INTERIOR_ROOM_TOOL_NAMES.has(call.name))) return [];
  const usedOutdoorHouse = okCalls.some((call) =>
    call.name === "author_house" || call.name === "build_house_kit" || call.name === "build_house_lots");
  if (usedOutdoorHouse) {
    return [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} 실내 요청인데 야외 집 외장(author_house)만 시공했습니다. 새 실내 맵이 필요하면 start_interior_room_session/run_interior_room_pipeline(새 mapId), 기존 실내 맵을 고치는 것이면 furnish_interior_space({mapId, roomId})를 쓰세요.`];
  }
  const onlyEmptyMap =
    okCalls.length > 0
    && okCalls.every((call) => call.name === "create_map" || call.name === "generate_map" || call.name === "set_build_spec")
    && okCalls.some((call) => call.name === "create_map" || call.name === "generate_map");
  if (onlyEmptyMap) {
    return [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} 실내 요청인데 빈 맵만 만들었습니다. 실내 세션 툴로 방·가구까지 시공하세요.`];
  }
  return [];
}

function questGraphCompletenessWarnings(calls: readonly ProposalCompletenessCall[]): string[] {
  if (calls.some((call) => call.result.ok && call.name === "define_quest")) return [];
  const newStoryFlags = calls.filter((call) => {
    if (!call.result.ok || call.name !== "declare_story_flag") return false;
    const action = typeof call.args.action === "string" ? call.args.action : "declare";
    return action === "declare";
  }).length;
  if (newStoryFlags < 3) return [];
  return [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} 퀘스트 그래프 등록 권장 — 이번 턴에서 storyFlag ${newStoryFlags}개를 새로 등록했지만 define_quest가 없습니다.`];
}

function formatMissingSpecAssets(missing: readonly SpecAsset[]): string {
  const listed = missing.slice(0, 3).map(describeAsset);
  const suffix = missing.length > listed.length ? ` 외 ${missing.length - listed.length}개` : "";
  return `밑그림 에셋 ${listed.join(", ")}${suffix} 영역을 변경하지 않았습니다.`;
}

function describeAsset(asset: SpecAsset): string {
  return `'${asset.id}'(${asset.kind}) (${asset.x},${asset.y}) ${asset.w}×${asset.h}`;
}

function assetTouched(mapId: string, asset: SpecAsset, touchedRegions: readonly AffectedRegion[]): boolean {
  const assetRegion: AffectedRegion = { mapId, x: asset.x, y: asset.y, w: asset.w, h: asset.h };
  return touchedRegions.some((region) => intersects(assetRegion, region));
}

function changedRegionsForCall(call: ProposalCompletenessCall): AffectedRegion[] {
  if (!call.result.ok || !hasMeaningfulDiff(call.result.diff)) return [];
  const known = regionsFromKnownCall(call);
  if (known !== null) return known.filter(isNonEmptyRegion);
  return affectedRegions(call.name, call.args).filter(isNonEmptyRegion);
}

function regionsFromKnownCall(call: ProposalCompletenessCall): AffectedRegion[] | null {
  const mapId = stringValue(call.args.mapId);
  if (mapId === null) return null;

  // paint_tiles는 from/to 두 모서리로 사각형을 친다 ([from,to] inclusive)
  if (call.name === "paint_tiles") {
    const from = call.args.from as unknown as { readonly x?: unknown; readonly y?: unknown } | undefined;
    const to = call.args.to as unknown as { readonly x?: unknown; readonly y?: unknown } | undefined;
    if (from && to && typeof from.x === "number" && typeof from.y === "number" && typeof to.x === "number" && typeof to.y === "number") {
      const rx = Math.min(from.x, to.x);
      const ry = Math.min(from.y, to.y);
      const rw = Math.abs(to.x - from.x) + 1;
      const rh = Math.abs(to.y - from.y) + 1;
      return [{ mapId, x: rx, y: ry, w: rw, h: rh }];
    }
    return [{ mapId, x: 0, y: 0, w: 1, h: 1 }]; // 유효 좌표가 없어도 같은 맵 쓰기는 carryover 대상
  }
  if (call.name === "paint_road" || call.name === "tile_road" || call.name === "lay_path") return roadRegions(mapId, call.args.points);
  // 타일 v3 공정 프리미티브(V3B): rect/자동 감지 영역은 result.data가 실측 영역을 준다.
  if (call.name === "build_wall") return rectRegion(mapId, call.args.rect);
  if (call.name === "build_roof") return v3DataRegion(mapId, call.result.data, "roofRegion") ?? rectRegion(mapId, call.args.wallRect);
  if (call.name === "place_door" || call.name === "place_window") {
    const at = pointValue(call.args.at);
    return at === null ? [] : [{ mapId, x: at.x, y: at.y, w: 1, h: 1 }];
  }
  if (call.name === "place_props") return scatterRegions(mapId, call.args, call.result.data);
  if (call.name === "fill_region" || call.name === "tile_erase") return rectRegion(mapId, call.args.rect);
  if (call.name === "build_house") return originRect(mapId, call.args, numberValue(call.args.width), numberValue(call.args.height));
  if (call.name === "build_house_kit") return wingRegions(mapId, call.args.wings);
  if (call.name === "build_house_lots") return houseLotRegions(mapId, call.args.houses);
  // canonical construction facades
  if (call.name === "author_house") {
    const effectiveMapId = mapId ?? nestedTargetMapId(call.args.target);
    if (effectiveMapId === null) return [];
    if (call.args.kind === "lots" && Array.isArray(call.args.houses)) return houseLotRegions(effectiveMapId, call.args.houses);
    return wingRegions(effectiveMapId, call.args.wings);
  }
  if (call.name === "author_village") {
    const targetMapId = nestedTargetMapId(call.args.target);
    if (targetMapId === null) return [];
    const bounds = nestedTargetRegion(targetMapId, call.args.target);
    return bounds !== null ? [bounds] : [];
  }
  // 타일 v2: tile_structure는 kind로 v1 4종을 통합한다.
  if (call.name === "tile_structure") {
    const kind = stringValue(call.args.kind);
    if (kind === "house") return originRect(mapId, call.args, numberValue(call.args.width), numberValue(call.args.height));
    return originRect(mapId, call.args, 1, 1);
  }
  if (call.name === "stamp_structure") return originRect(mapId, call.args, 1, 1);
  if (call.name === "scatter_object" || call.name === "tile_scatter") return scatterRegions(mapId, call.args, call.result.data);
  if (call.name === "place_npc" || call.name === "make_villager") return [actualPointRegion(mapId, call)];
  if (call.name === "place_battle_blocker") return pointRegion(mapId, call.args.x, call.args.y);

  // create_map/generate_map are intentionally not treated as fulfilling BuildSpec
  // assets: a full-map grass/wall initialization should not hide missing houses,
  // ponds, roads, or decorations.
  if (call.name === "create_map" || call.name === "generate_map") return [];
  return null;
}

function originRect(mapId: string, args: Record<string, unknown>, w: number | null, h: number | null): AffectedRegion[] {
  const origin = pointValue(args.origin);
  if (origin === null || w === null || h === null) return [];
  return [{ mapId, x: origin.x, y: origin.y, w, h }];
}

function houseLotRegions(mapId: string, houses: unknown): AffectedRegion[] {
  if (!Array.isArray(houses)) return [];
  const regions: AffectedRegion[] = [];
  for (const house of houses) {
    if (!isRecord(house)) continue;
    regions.push(...wingRegions(mapId, house.wings));
  }
  return regions;
}

function wingRegions(mapId: string, value: unknown): AffectedRegion[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const wing of value) {
    if (!isRecord(wing)) return [];
    const x = numberValue(wing.x);
    const y = numberValue(wing.y);
    const w = numberValue(wing.w);
    const h = numberValue(wing.h);
    if (x === null || y === null || w === null || h === null) return [];
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  }
  return [{ mapId, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }];
}

// {x,y,w,h} 값(인자 rect/데이터 영역)을 AffectedRegion으로. 형식이 아니면 빈 배열.
function rectRegion(mapId: string, value: unknown): AffectedRegion[] {
  if (!isRecord(value)) return [];
  const x = numberValue(value.x);
  const y = numberValue(value.y);
  const w = numberValue(value.w);
  const h = numberValue(value.h);
  return x === null || y === null || w === null || h === null ? [] : [{ mapId, x, y, w, h }];
}

// v3 프리미티브 result.data의 실측 영역(예: build_roof data.roofRegion). 없으면 null.
function v3DataRegion(mapId: string, data: unknown, key: string): AffectedRegion[] | null {
  if (!isRecord(data)) return null;
  const region = rectRegion(mapId, data[key]);
  return region.length > 0 ? region : null;
}

function scatterRegions(mapId: string, args: Record<string, unknown>, data: unknown): AffectedRegion[] {
  const placed = isRecord(data) && typeof data.placed === "number" ? data.placed : 1;
  if (placed <= 0) return [];
  const area = isRecord(args.area) ? args.area : null;
  if (area === null) return [];
  const x = numberValue(area.x);
  const y = numberValue(area.y);
  const w = numberValue(area.w);
  const h = numberValue(area.h);
  return x === null || y === null || w === null || h === null ? [] : [{ mapId, x, y, w, h }];
}

function actualPointRegion(mapId: string, call: ProposalCompletenessCall): AffectedRegion {
  const data = isRecord(call.result.data) ? call.result.data : null;
  const x = data ? numberValue(data.x) ?? call.args.x : call.args.x;
  const y = data ? numberValue(data.y) ?? call.args.y : call.args.y;
  return pointRegion(mapId, x, y)[0] ?? { mapId, x: 0, y: 0, w: 0, h: 0 };
}

function pointRegion(mapId: string, xValue: unknown, yValue: unknown): AffectedRegion[] {
  const x = numberValue(xValue);
  const y = numberValue(yValue);
  return x === null || y === null ? [] : [{ mapId, x, y, w: 1, h: 1 }];
}

function roadRegions(mapId: string, pointsValue: unknown): AffectedRegion[] {
  if (!Array.isArray(pointsValue)) return [];
  const points = pointsValue.map(pointValue);
  if (points.some((point) => point === null)) return [];
  const typed = points as { x: number; y: number }[];
  if (typed.length === 0) return [];
  const regions: AffectedRegion[] = [];
  for (let i = 0; i < typed.length; i += 1) {
    const cells = i === 0 ? [typed[0]] : lineCells(typed[i - 1], typed[i]);
    for (const cell of cells) regions.push({ mapId, x: cell.x, y: cell.y, w: 1, h: 1 });
  }
  return regions;
}

function lineCells(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;
  while (true) {
    cells.push({ x, y });
    if (x === to.x && y === to.y) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

function hasMeaningfulDiff(diff: ChangeSummary | undefined): boolean {
  if (!diff) return false;
  return (
    diff.tilesChanged > 0 ||
    (diff.mapPropertiesChanged ?? 0) > 0 ||
    diff.eventsAdded > 0 ||
    diff.eventsModified > 0 ||
    diff.eventsRemoved > 0 ||
    diff.mapsAdded > 0 ||
    diff.mapsRemoved > 0 ||
    diff.dbRecordsChanged > 0 ||
    diff.tilesetsChanged > 0 ||
    diff.switchesAdded > 0 ||
    diff.variablesAdded > 0 ||
    diff.worldEntitiesAdded > 0 ||
    diff.worldEntitiesModified > 0 ||
    diff.palettePresetsAdded > 0 ||
    diff.palettePresetsModified > 0 ||
    diff.endingsChanged > 0 ||
    diff.sessionChanged ||
    diff.systemChanged
  );
}

function requestedPlacementCount(text: string): number | null {
  const withoutDimensions = text.replace(/\d+\s*(?:x|×)\s*\d+/gi, " ");
  const matches = [...withoutDimensions.matchAll(/(\d{1,3})\s*(개체|그루|송이|마리|채|명|곳|개|대)/g)];
  const counts = matches
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter((count) => Number.isInteger(count) && count > 0);
  if (counts.length === 0) return null;
  return counts.reduce((total, count) => total + count, 0);
}

function actualPlacementCount(calls: readonly ProposalCompletenessCall[]): number {
  return calls.reduce((total, call) => total + actualPlacementCountForCall(call), 0);
}

function actualPlacementCountForCall(call: ProposalCompletenessCall): number {
  if (call.name === "scatter_object" || call.name === "tile_scatter" || call.name === "place_props") {
    const data = isRecord(call.result.data) ? call.result.data : null;
    return typeof data?.placed === "number" && data.placed > 0 ? data.placed : 0;
  }
  if (call.name === "place_npc" || call.name === "make_villager" || call.name === "place_battle_blocker") return call.result.diff?.eventsAdded ?? 1;
  // canonical construction: outcome의 actual count를 사용한다.
  if (call.name === "author_house" || call.name === "author_village") {
    const data = isRecord(call.result.data) ? call.result.data : null;
    const construction = data && isRecord(data.construction) ? data.construction : null;
    const counts = construction && isRecord(construction.counts) ? construction.counts : null;
    const actual = counts && typeof counts.actual === "number" ? counts.actual : 0;
    return actual > 0 ? actual : 1;
  }
  if (call.name === "build_house" || call.name === "build_house_kit" || call.name === "build_house_lots" || call.name === "build_village" || call.name === "stamp_structure" || call.name === "tile_structure" || call.name === "build_wall") return 1;
  if ((call.name === "paint_tiles" || call.name === "tile_paint") && call.args.mode === "cells" && Array.isArray(call.args.cells)) return call.args.cells.length;
  return 0;
}

function isProceedInstruction(text: string): boolean {
  const normalized = text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return /(?:진행해|진행하라고|계속해|계속 진행|이어(?:서)? 해|그대로 해|좋아 진행|오케이 진행|ok 진행|정리하고 만들어)/u.test(normalized);
}

function endsWithProgressPromise(text: string): boolean {
  return /(?:잠시만\s*기다려\s*주세요|잠시만요|다시\s*설계하겠습니다|설계하겠습니다|진행하겠습니다|처리하겠습니다|만들겠습니다|하겠습니다|하겠어요)[.!?。…\s]*$/u.test(text.trim());
}

/** 집 vs 실내 등 의도 확인 턴 — 체인지셋 0건 경고 면제. */
function assistantTextLooksLikeIntentClarify(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // 원탭 선택지를 붙인 되묻기(의도 선언의 clarify)는 변경 0건이 정상이다.
  return trimmed.includes(QUICK_REPLY_MARKER);
}

function isClearlyShort(expected: number, actual: number): boolean {
  if (actual >= expected) return false;
  if (expected <= 3) return expected - actual >= 1;
  return expected - actual >= 2 && actual < Math.ceil(expected * 0.6);
}

function intersects(a: AffectedRegion, b: AffectedRegion): boolean {
  if (a.mapId !== b.mapId) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function isNonEmptyRegion(region: AffectedRegion): boolean {
  return region.w > 0 && region.h > 0;
}

function pointValue(value: unknown): { x: number; y: number } | null {
  if (!isRecord(value)) return null;
  const x = numberValue(value.x);
  const y = numberValue(value.y);
  return x === null || y === null ? null : { x, y };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nestedTargetMapId(target: unknown): string | null {
  if (!isRecord(target)) return null;
  return stringValue(target.mapId);
}

function nestedTargetRegion(mapId: string, target: unknown): AffectedRegion | null {
  if (!isRecord(target)) return null;
  if (isRecord(target.bounds)) {
    const b = target.bounds;
    const x = numberValue(b.x);
    const y = numberValue(b.y);
    const w = numberValue(b.w);
    const h = numberValue(b.h);
    if (x !== null && y !== null && w !== null && h !== null) return { mapId, x, y, w, h };
  }
  if (isRecord(target.plannedMap)) {
    const pm = target.plannedMap;
    const w = numberValue(pm.width);
    const h = numberValue(pm.height);
    if (w !== null && h !== null) return { mapId, x: 0, y: 0, w, h };
  }
  const w = numberValue(target.width);
  const h = numberValue(target.height);
  if (w !== null && h !== null) return { mapId, x: 0, y: 0, w, h };
  return null;
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}
