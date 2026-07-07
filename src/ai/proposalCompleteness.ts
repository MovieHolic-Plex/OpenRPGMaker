// ai/proposalCompleteness.ts
// Proposal-time completeness lint. Keep this conservative: deterministic BuildSpec
// coverage first, then only low-risk request/count heuristics when there is no spec.

import { affectedRegions, type AffectedRegion, type BuildSpec, type SpecAsset } from "./buildSpec";
import type { ChangeSummary } from "@/editor/tools/types";

export const PROPOSAL_COMPLETENESS_WARNING_PREFIX = "⚠ 미이행:";
export const PROPOSAL_SCOPE_WARNING_PREFIX = "⚠ 범위:";

const TEMPLATE_HOUSE_FOOTPRINT = { w: 18, h: 16 } as const;

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
  readonly buildSpec?: BuildSpec | null;
  readonly calls: readonly ProposalCompletenessCall[];
}

export function proposalCompletenessWarnings(input: ProposalCompletenessInput): string[] {
  const base = input.buildSpec
    ? buildSpecCompletenessWarnings(input.buildSpec, input.calls)
    : heuristicCompletenessWarnings(input.requestText ?? "", input.calls);
  return dedupe([...base, ...worldCompletenessWarnings(input.calls)]);
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

function heuristicCompletenessWarnings(requestText: string, calls: readonly ProposalCompletenessCall[]): string[] {
  const changedCalls = calls.filter((call) => call.result.ok && hasMeaningfulDiff(call.result.diff));
  const requestedCount = requestedPlacementCount(requestText);
  if (changedCalls.length === 0) {
    return requestLikelyExpectsChange(requestText) || requestedCount !== null
      ? [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} 실제 변경이 없습니다(체인지셋 0건).`]
      : [];
  }

  if (requestedCount === null) return [];
  const actualCount = actualPlacementCount(changedCalls);
  if (!isClearlyShort(requestedCount, actualCount)) return [];
  return [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} 요청 수량 ${requestedCount}개 대비 실제 배치 ${actualCount}개입니다.`];
}

function worldCompletenessWarnings(calls: readonly ProposalCompletenessCall[]): string[] {
  const changedCalls = calls.filter((call) => call.result.ok && hasMeaningfulDiff(call.result.diff));
  if (changedCalls.length === 0) return [];
  if (changedCalls.some((call) => call.name === "upsert_world_entities" || call.name === "link_world_ref")) return [];
  const missingKinds = [
    changedCalls.some(isNpcWorldRelevantCall) ? "NPC" : null,
    changedCalls.some(isMapWorldRelevantCall) ? "맵" : null,
    changedCalls.some(isItemWorldRelevantCall) ? "아이템" : null,
  ].filter((kind): kind is string => kind !== null);
  if (missingKinds.length === 0) return [];
  return [`${PROPOSAL_COMPLETENESS_WARNING_PREFIX} 세계관 미기재 — ${missingKinds.join("/")} 생성·수정 제안에 세계관 업데이트가 없습니다.`];
}

function isNpcWorldRelevantCall(call: ProposalCompletenessCall): boolean {
  if (call.name === "place_npc") return (call.result.diff?.eventsAdded ?? 0) + (call.result.diff?.eventsModified ?? 0) > 0;
  if (call.name !== "upsert_event") return false;
  if ((call.result.diff?.eventsAdded ?? 0) + (call.result.diff?.eventsModified ?? 0) <= 0) return false;
  const event = isRecord(call.args.event) ? call.args.event : null;
  return event !== null && eventHasNamedNpcPage(event);
}

function isMapWorldRelevantCall(call: ProposalCompletenessCall): boolean {
  return (call.name === "create_map" || call.name === "generate_map") && (call.result.diff?.mapsAdded ?? 0) > 0;
}

function isItemWorldRelevantCall(call: ProposalCompletenessCall): boolean {
  if (call.name !== "upsert_item" || (call.result.diff?.dbRecordsChanged ?? 0) <= 0) return false;
  const item = isRecord(call.args.item) ? call.args.item : null;
  return typeof item?.name === "string" && item.name.trim().length > 0;
}

function eventHasNamedNpcPage(event: Record<string, unknown>): boolean {
  const pages = Array.isArray(event.pages) ? event.pages : [];
  return pages.some((page) => {
    if (!isRecord(page)) return false;
    const name = typeof page.name === "string" ? page.name.trim() : "";
    if (!name || /^(페이지|page)\s*\d+$/iu.test(name)) return false;
    const graphic = isRecord(page.graphic) ? page.graphic : null;
    return graphic !== null && graphic.transparent !== true && isRecord(graphic.sprite);
  });
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

  if (call.name === "paint_road" || call.name === "tile_road" || call.name === "lay_path") return roadRegions(mapId, call.args.points);
  // 타일 v3 공정 프리미티브(V3B): rect/자동 감지 영역은 result.data가 실측 영역을 준다.
  if (call.name === "build_wall") return rectRegion(mapId, call.args.rect);
  if (call.name === "build_roof") return v3DataRegion(mapId, call.result.data, "roofRegion") ?? rectRegion(mapId, call.args.wallRect);
  if (call.name === "place_door" || call.name === "place_window") {
    const at = pointValue(call.args.at);
    return at === null ? [] : [{ mapId, x: at.x, y: at.y, w: 1, h: 1 }];
  }
  if (call.name === "place_props") return scatterRegions(mapId, call.args, call.result.data);
  if (call.name === "build_house") return originRect(mapId, call.args, numberValue(call.args.width), numberValue(call.args.height));
  // 타일 v2: tile_structure는 kind로 v1 4종을 통합한다.
  if (call.name === "tile_structure") {
    const kind = stringValue(call.args.kind);
    if (kind === "house") return originRect(mapId, call.args, numberValue(call.args.width), numberValue(call.args.height));
    if (kind === "template_house") return originRect(mapId, call.args, TEMPLATE_HOUSE_FOOTPRINT.w, TEMPLATE_HOUSE_FOOTPRINT.h);
    return originRect(mapId, call.args, 1, 1);
  }
  if (call.name === "stamp_template_house") return originRect(mapId, call.args, TEMPLATE_HOUSE_FOOTPRINT.w, TEMPLATE_HOUSE_FOOTPRINT.h);
  if (call.name === "stamp_structure" || call.name === "stamp_terrain_template") return originRect(mapId, call.args, 1, 1);
  if (call.name === "scatter_object" || call.name === "tile_scatter") return scatterRegions(mapId, call.args, call.result.data);
  if (call.name === "place_npc") return [actualPointRegion(mapId, call)];
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
  if (call.name === "place_npc" || call.name === "place_battle_blocker") return call.result.diff?.eventsAdded ?? 1;
  if (call.name === "build_house" || call.name === "stamp_template_house" || call.name === "stamp_structure" || call.name === "stamp_terrain_template" || call.name === "tile_structure" || call.name === "build_wall") return 1;
  if ((call.name === "paint_tiles" || call.name === "tile_paint") && call.args.mode === "cells" && Array.isArray(call.args.cells)) return call.args.cells.length;
  return 0;
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

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}
