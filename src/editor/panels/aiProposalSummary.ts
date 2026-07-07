import { proposalCompletenessWarningLines } from "@/ai/proposalCompleteness";
import type { ProposedCall } from "@/ai/assistantSession";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { combineDiffs } from "@/project/projectCommitLog";
import type { Project } from "@/project/types";

const HOUSE_TOOLS = new Set(["build_house", "stamp_template_house"]);
const isHouseCall = (call: { name: string; args: Record<string, unknown> }): boolean =>
  HOUSE_TOOLS.has(call.name) || (call.name === "tile_structure" && (call.args.kind === "house" || call.args.kind === "template_house"));

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFromRecord(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null;
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

export function positive(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function countFromSummary(summary: string, pattern: RegExp): number {
  const match = summary.match(pattern);
  const value = match ? Number(match[1]) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function isTreeScatter(call: ProposedCall): boolean {
  if (call.name !== "scatter_object" && call.name !== "tile_scatter" && call.name !== "place_props") return false;
  const groupId = typeof call.args.groupId === "string" ? call.args.groupId : typeof call.args.propVocabId === "string" ? call.args.propVocabId : "";
  const haystack = `${groupId} ${call.summary}`.toLowerCase();
  return /나무|tree|숲|활엽|침엽|conifer|broadleaf/u.test(haystack);
}

function countProposalHouses(calls: readonly ProposedCall[]): number {
  return calls.reduce((total, call) => {
    if (isHouseCall(call) || call.name === "build_wall") return total + 1;
    if ((call.name === "stamp_structure" || (call.name === "tile_structure" && call.args.kind === "structure")) && call.args.template !== "road") return total + 1;
    return total;
  }, 0);
}

function countProposalRoadCells(calls: readonly ProposedCall[]): number {
  return calls.reduce((total, call) => {
    if (call.name === "lay_path") {
      const fromData = positive(numberFromRecord(call.result.data, "pathCells"));
      return total + (fromData > 0 ? fromData : countFromSummary(call.summary, /길\s+(\d+)칸/u));
    }
    if (call.name === "paint_road" || call.name === "tile_road") {
      const fromData = positive(numberFromRecord(call.result.data, "tilesTouched"));
      return total + (fromData > 0 ? fromData : countFromSummary(call.summary, /도로\s+(\d+)칸/u));
    }
    if ((call.name === "stamp_structure" || call.name === "tile_structure") && call.args.template === "road") {
      return total + positive(call.result.diff?.tilesChanged);
    }
    return total;
  }, 0);
}

function countProposalTrees(calls: readonly ProposedCall[]): number {
  return calls.reduce((total, call) => {
    if (!isTreeScatter(call)) return total;
    const fromData = positive(numberFromRecord(call.result.data, "placed"));
    return total + (fromData > 0 ? fromData : countFromSummary(call.summary, /(\d+)개/u));
  }, 0);
}

function formatCount(label: string, count: number, unit: string): string | null {
  return count > 0 ? `${label} ${count}${unit}` : null;
}

function worldSummaryPart(added: number, modified: number): string | null {
  if (added > 0 && modified > 0) return `세계관 추가 ${added}/수정 ${modified}`;
  if (added > 0) return `세계관 ${added}건`;
  if (modified > 0) return `세계관 수정 ${modified}건`;
  return null;
}

function palettePresetSummaryPart(added: number, modified: number): string | null {
  if (added > 0 && modified > 0) return `프리셋 추가 ${added}/수정 ${modified}`;
  if (added > 0) return `프리셋 ${added}건`;
  if (modified > 0) return `프리셋 수정 ${modified}건`;
  return null;
}

export function fallbackDiffParts(calls: readonly ProposedCall[]): string[] {
  const diff = combineDiffs(calls.map((call) => call.result.diff));
  return [
    formatCount("타일", diff.tilesChanged, "칸"),
    formatCount("맵", diff.mapsAdded, "개"),
    diff.mapsRemoved > 0 ? `맵 삭제 ${diff.mapsRemoved}개` : null,
    formatCount("NPC", calls.filter((call) => call.name === "place_npc").length, "명"),
    formatCount("이벤트", Math.max(0, diff.eventsAdded - calls.filter((call) => call.name === "place_npc").length), "개"),
    diff.eventsModified > 0 ? `이벤트 수정 ${diff.eventsModified}개` : null,
    diff.eventsRemoved > 0 ? `이벤트 삭제 ${diff.eventsRemoved}개` : null,
    diff.dbRecordsChanged > 0 ? `DB ${diff.dbRecordsChanged}건` : null,
    diff.tilesetsChanged > 0 ? `타일셋 ${diff.tilesetsChanged}건` : null,
    diff.switchesAdded > 0 ? `스위치 ${diff.switchesAdded}개` : null,
    diff.variablesAdded > 0 ? `변수 ${diff.variablesAdded}개` : null,
    worldSummaryPart(diff.worldEntitiesAdded, diff.worldEntitiesModified),
    palettePresetSummaryPart(diff.palettePresetsAdded, diff.palettePresetsModified),
    diff.sessionChanged ? "세션 1건" : null,
    diff.systemChanged ? "시스템 1건" : null,
  ].filter((part): part is string => part !== null);
}

export function proposalHumanSummaryLine(calls: readonly ProposedCall[]): string {
  if (calls.length === 0) return "변경 제안 없음";
  const diff = combineDiffs(calls.map((call) => call.result.diff));
  const houses = countProposalHouses(calls);
  const roadCells = countProposalRoadCells(calls);
  const trees = countProposalTrees(calls);
  const semanticParts = [
    formatCount("집", houses, "채"),
    formatCount("길", roadCells, "칸"),
    formatCount("나무", trees, "그루"),
    worldSummaryPart(diff.worldEntitiesAdded, diff.worldEntitiesModified),
    palettePresetSummaryPart(diff.palettePresetsAdded, diff.palettePresetsModified),
  ].filter((part): part is string => part !== null);
  const remainingTileChanges = Math.max(0, diff.tilesChanged - roadCells);
  const parts = [
    ...semanticParts,
    ...(semanticParts.length === 0 ? fallbackDiffParts(calls) : []),
    semanticParts.length > 0 && remainingTileChanges > 0 && houses === 0 && trees === 0 ? `타일 ${remainingTileChanges}칸` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : `변경 ${calls.length}건`;
}

export function proposalSummaryLines(calls: readonly ProposedCall[], extraWarnings: readonly string[] = []): string[] {
  const summary = calls.length > 0 ? [proposalHumanSummaryLine(calls)] : [];
  return [...summary, ...proposalCompletenessWarningLines(calls, extraWarnings)];
}

export function proposalTechnicalDetailLines(calls: readonly ProposedCall[]): string[] {
  return calls.map((call) => {
    const flag = call.destructive ? "⚠️ 파괴적 " : "";
    return `${flag}${call.name} — ${call.summary}`;
  });
}

export function mapIdCreatedByCall(call: ProposedCall): string | null {
  if (call.name !== "create_map") return null;
  const fromData = isRecord(call.result.data) && typeof call.result.data.mapId === "string" ? call.result.data.mapId : null;
  return fromData ?? (typeof call.args.id === "string" ? call.args.id : null);
}

export function eventIdsCreatedByCall(call: ProposedCall): readonly string[] {
  if (call.name === "place_npc" || call.name === "place_battle_blocker") {
    const fromData = isRecord(call.result.data) && typeof call.result.data.eventId === "string" ? call.result.data.eventId : null;
    const fromArgs = typeof call.args.id === "string" ? call.args.id : null;
    return fromData ?? fromArgs ? [fromData ?? fromArgs ?? ""] : [];
  }
  if (call.name === "upsert_event" && isRecord(call.args.event) && typeof call.args.event.id === "string") return [call.args.event.id];
  if (call.name === "duplicate_event") {
    const fromData = isRecord(call.result.data) && typeof call.result.data.eventId === "string" ? call.result.data.eventId : null;
    const fromArgs = typeof call.args.newId === "string" ? call.args.newId : null;
    return fromData ?? fromArgs ? [fromData ?? fromArgs ?? ""] : [];
  }
  if (call.name === "create_transfer_pair" && isRecord(call.result.data)) {
    return [call.result.data.eventIdA, call.result.data.eventIdB].filter((value): value is string => typeof value === "string");
  }
  return [];
}

function mapIdsReferencedByValue(value: unknown, refs: Set<string>): void {
  if (!isRecord(value)) return;
  for (const key of ["mapId", "toMapId"]) {
    const ref = value[key];
    if (typeof ref === "string") refs.add(ref);
  }
  for (const key of ["a", "b"]) mapIdsReferencedByValue(value[key], refs);
  const event = value.event;
  if (isRecord(event) && typeof value.mapId === "string") refs.add(value.mapId);
}

export function mapIdsReferencedByCall(call: ProposedCall): readonly string[] {
  const refs = new Set<string>();
  mapIdsReferencedByValue(call.args, refs);
  return [...refs];
}

export function eventIdsReferencedByCall(call: ProposedCall): readonly string[] {
  const refs = new Set<string>();
  if (typeof call.args.eventId === "string") refs.add(call.args.eventId);
  if (call.name === "link_world_ref" && isRecord(call.args.ref) && call.args.ref.kind === "event" && typeof call.args.ref.id === "string") {
    refs.add(call.args.ref.id);
  }
  return [...refs];
}

export function proposalDependencyIndexes(calls: readonly ProposedCall[]): readonly (readonly number[])[] {
  const mapCreators = new Map<string, number>();
  const eventCreators = new Map<string, number>();
  return calls.map((call, index) => {
    const deps = new Set<number>();
    for (const mapId of mapIdsReferencedByCall(call)) {
      const creator = mapCreators.get(mapId);
      if (creator !== undefined && creator !== index) deps.add(creator);
    }
    for (const eventId of eventIdsReferencedByCall(call)) {
      const creator = eventCreators.get(eventId);
      if (creator !== undefined && creator !== index) deps.add(creator);
    }
    const createdMapId = mapIdCreatedByCall(call);
    if (createdMapId) mapCreators.set(createdMapId, index);
    for (const eventId of eventIdsCreatedByCall(call)) eventCreators.set(eventId, index);
    return [...deps].sort((left, right) => left - right);
  });
}

export function enforceProposalDependencies(selected: readonly boolean[], dependencies: readonly (readonly number[])[]): boolean[] {
  const next = [...selected];
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < next.length; index += 1) {
      if (!next[index]) continue;
      if (dependencies[index]?.some((dependency) => !next[dependency])) {
        next[index] = false;
        changed = true;
      }
    }
  }
  return next;
}

export function reassembleSelectedProposalProject(
  baseline: Project,
  calls: readonly ProposedCall[],
  selected: readonly boolean[]
): { ok: true; project: Project; results: readonly ToolResult[]; calls: readonly ProposedCall[] } | { ok: false; message: string; results: readonly ToolResult[] } {
  const dependencies = proposalDependencyIndexes(calls);
  const safeSelected = enforceProposalDependencies(selected, dependencies);
  const selectedCalls = calls.filter((_, index) => safeSelected[index]);
  const ctx: ToolContext = { project: structuredClone(baseline) };
  const results: ToolResult[] = [];
  for (const call of selectedCalls) {
    const result = runTool(ctx, call.name, structuredClone(call.args), { dryRun: false });
    results.push(result);
    if (!result.ok) return { ok: false, message: result.summary, results };
  }
  return { ok: true, project: ctx.project, results, calls: selectedCalls };
}
