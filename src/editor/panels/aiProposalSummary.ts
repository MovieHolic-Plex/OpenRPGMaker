import { proposalCompletenessWarningLines } from "@/ai/proposalCompleteness";
import type { ProposedCall } from "@/ai/assistantSession";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { TILE } from "@/project/defaults/constants";
import { combineDiffs } from "@/project/projectCommitLog";
import type { Project } from "@/project/types";

const HOUSE_TOOLS = new Set(["build_house", "author_house"]);
const WATER_LABEL = /호수|연못|하천|수역|강가|water|river|lake|pond|(^|[^가-힣])(물|강)([^가-힣]|$)/iu;
const isHouseCall = (call: { name: string; args: Record<string, unknown> }): boolean =>
  HOUSE_TOOLS.has(call.name) || (call.name === "tile_structure" && call.args.kind === "house");

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
  const groupId = typeof call.args.groupId === "string" ? call.args.groupId : typeof call.args.material === "string" ? call.args.material : typeof call.args.propVocabId === "string" ? call.args.propVocabId : "";
  const haystack = `${groupId} ${call.summary}`.toLowerCase();
  return /나무|tree|숲|활엽|침엽|conifer|broadleaf/u.test(haystack);
}

function countHousesInCall(call: ProposedCall): number {
  if (Array.isArray(call.args.houses) && call.args.houses.length > 0) return call.args.houses.length;
  if (call.name === "author_village") {
    const fromData = positive(numberFromRecord(call.result.data, "houseCount"));
    if (fromData > 0) return fromData;
    return positive(typeof call.args.houseCount === "number" ? call.args.houseCount : null);
  }
  if (isHouseCall(call) || call.name === "build_wall") return 1;
  if ((call.name === "stamp_structure" || (call.name === "tile_structure" && call.args.kind === "structure")) && call.args.template !== "road") return 1;
  return 0;
}

function countProposalHouses(calls: readonly ProposedCall[]): number {
  return calls.reduce((total, call) => total + countHousesInCall(call), 0);
}

function looksLikeWaterLabel(value: string): boolean {
  const label = value.trim();
  if (!label || /건물/u.test(label)) return false;
  if (label === "물" || label === "강") return true;
  return WATER_LABEL.test(label);
}

function isRiverCall(call: ProposedCall): boolean {
  if (isHouseCall(call) || call.name === "author_village" || call.name === "build_wall") return false;
  if (call.args.tile === TILE.WATER) return true;
  const material = typeof call.args.material === "string" ? call.args.material : "";
  const groupId = typeof call.args.groupId === "string" ? call.args.groupId : "";
  if (looksLikeWaterLabel(material) || looksLikeWaterLabel(groupId)) return true;
  return (call.name === "fill_region" || call.name === "paint_tiles" || call.name === "tile_paint") && looksLikeWaterLabel(call.summary);
}

function hasRiverNoun(calls: readonly ProposedCall[]): boolean {
  return calls.some(isRiverCall);
}

function houseHasYard(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.fence === true) return true;
  return Array.isArray(value.yard) && value.yard.length > 0;
}

function hasYardNoun(calls: readonly ProposedCall[]): boolean {
  return calls.some((call) => {
    if (call.args.fence === true) return true;
    if (Array.isArray(call.args.yard) && call.args.yard.length > 0) return true;
    if (Array.isArray(call.args.houses) && call.args.houses.some(houseHasYard)) return true;
    return /앞마당|울타리/u.test(call.summary);
  });
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

function nounCount(label: string, count: number): string | null {
  return count > 0 ? `${label} ${count}` : null;
}

function nounPresence(label: string, present: boolean): string | null {
  return present ? label : null;
}

function worldSummaryPart(added: number, modified: number): string | null {
  if (added > 0 && modified > 0) return `세계관 추가 ${added}/수정 ${modified}`;
  if (added > 0) return `세계관 ${added}`;
  if (modified > 0) return `세계관 수정 ${modified}`;
  return null;
}

function palettePresetSummaryPart(added: number, modified: number): string | null {
  if (added > 0 && modified > 0) return `프리셋 추가 ${added}/수정 ${modified}`;
  if (added > 0) return `프리셋 ${added}`;
  if (modified > 0) return `프리셋 수정 ${modified}`;
  return null;
}

export function fallbackDiffParts(calls: readonly ProposedCall[]): string[] {
  const diff = combineDiffs(calls.map((call) => call.result.diff));
  const npcCount = calls.filter((call) => call.name === "place_npc").length;
  return [
    nounCount("타일", diff.tilesChanged),
    nounCount("맵 설정", diff.mapPropertiesChanged ?? 0),
    nounCount("오디오 설명", diff.audioDescriptionsChanged ?? 0),
    nounCount("맵", diff.mapsAdded),
    nounCount("맵 삭제", diff.mapsRemoved),
    nounCount("NPC", npcCount),
    nounCount("이벤트", Math.max(0, diff.eventsAdded - npcCount)),
    nounCount("이벤트 수정", diff.eventsModified),
    nounCount("이벤트 삭제", diff.eventsRemoved),
    nounCount("DB", diff.dbRecordsChanged),
    nounCount("타일셋", diff.tilesetsChanged),
    nounCount("스위치", diff.switchesAdded),
    nounCount("변수", diff.variablesAdded),
    worldSummaryPart(diff.worldEntitiesAdded, diff.worldEntitiesModified),
    palettePresetSummaryPart(diff.palettePresetsAdded, diff.palettePresetsModified),
    nounCount("엔딩", diff.endingsChanged),
    nounPresence("세션", diff.sessionChanged),
    nounPresence("시스템", diff.systemChanged),
  ].filter((part): part is string => part !== null);
}

export function proposalHumanSummaryLine(calls: readonly ProposedCall[]): string {
  if (calls.length === 0) return "변경 제안 없음";
  if (calls.some((call) => call.name === "reset_project")) return "현재 프로젝트 전체를 새 프로젝트로 교체";
  const diff = combineDiffs(calls.map((call) => call.result.diff));
  const houses = countProposalHouses(calls);
  const roadCells = countProposalRoadCells(calls);
  const trees = countProposalTrees(calls);
  const river = hasRiverNoun(calls);
  const yard = hasYardNoun(calls);
  const semanticParts = [
    nounCount("집", houses),
    nounPresence("강", river),
    nounPresence("앞마당", yard),
    nounCount("길", roadCells),
    nounCount("나무", trees),
    worldSummaryPart(diff.worldEntitiesAdded, diff.worldEntitiesModified),
    palettePresetSummaryPart(diff.palettePresetsAdded, diff.palettePresetsModified),
  ].filter((part): part is string => part !== null);
  const remainingTileChanges = Math.max(0, diff.tilesChanged - roadCells);
  const parts = [
    ...semanticParts,
    ...(semanticParts.length === 0 ? fallbackDiffParts(calls) : []),
    semanticParts.length > 0 && remainingTileChanges > 0 && houses === 0 && trees === 0 && !river && !yard
      ? `타일 ${remainingTileChanges}`
      : null,
    semanticParts.length > 0 ? nounCount("오디오 설명", diff.audioDescriptionsChanged ?? 0) : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : `변경 ${calls.length}`;
}

const TOOLISH_HEADLINE = /[_]|paint_|build_|upsert_|place_|scatter_|create_|set_|query_|run_/u;
const CHATTY_HEADLINE = /습니다|입니다|해요|할게요|주세요|제안합니다/u;

function firstAssistantHeadline(text: string): string | null {
  const raw = text.trim().split(/\n+/u)[0]?.trim() ?? "";
  if (!raw) return null;
  const line = raw.replace(/[.。!！?？]+$/u, "").trim();
  if (line.length < 2 || line.length > 28) return null;
  if (TOOLISH_HEADLINE.test(line) || CHATTY_HEADLINE.test(line)) return null;
  return line;
}

/** 결정 카드 한 문장. 채팅체·툴 id는 버리고, 없으면 사람 요약. */
export function proposalDecisionTitle(calls: readonly ProposedCall[], assistantText = ""): string {
  return firstAssistantHeadline(assistantText) ?? proposalHumanSummaryLine(calls);
}

export function proposalDetailsToggleLabel(itemCount: number): string {
  return `${itemCount}개 항목 · 자세히`;
}

export function proposalSummaryLines(calls: readonly ProposedCall[], extraWarnings: readonly string[] = []): string[] {
  const summary = calls.length > 0 ? [proposalHumanSummaryLine(calls)] : [];
  return [...summary, ...proposalCompletenessWarningLines(calls, extraWarnings)];
}

export function proposalTechnicalDetailLines(calls: readonly ProposedCall[]): string[] {
  return calls.map((call) => {
    const flag = call.destructive ? "파괴적 " : "";
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

const CANONICAL_CONSTRUCTION_TOOLS = new Set(["author_house", "author_village"]);

export function reassembleSelectedProposalProject(
  baseline: Project,
  calls: readonly ProposedCall[],
  selected: readonly boolean[]
): { ok: true; project: Project; results: readonly ToolResult[]; calls: readonly ProposedCall[] } | { ok: false; message: string; results: readonly ToolResult[] } {
  const resetIndex = calls.findIndex((call) => call.name === "reset_project");
  if (resetIndex >= 0 && selected.some((value, index) => value !== selected[resetIndex] || (index !== resetIndex && !value))) {
    return { ok: false, message: "프로젝트 교체 제안은 reset_project와 후속 변경을 모두 함께 수락해야 합니다.", results: [] };
  }
  const dependencies = proposalDependencyIndexes(calls);
  const safeSelected = enforceProposalDependencies(selected, dependencies);
  const selectedCalls = calls.filter((_, index) => safeSelected[index]);
  // canonical facade는 preview 드래프트를 커밋해야지 재실행하면 안 된다.
  const canonicalCall = selectedCalls.find((call) => CANONICAL_CONSTRUCTION_TOOLS.has(call.name));
  if (canonicalCall) {
    return {
      ok: false,
      message: `canonical construction '${canonicalCall.name}'는 preview 드래프트를 직접 수락해야 합니다. 재실행(reassembly)은 지원되지 않습니다.`,
      results: [],
    };
  }
  const ctx: ToolContext = { project: structuredClone(baseline) };
  const results: ToolResult[] = [];
  for (const call of selectedCalls) {
    const result = runTool(ctx, call.name, structuredClone(call.args), { dryRun: false });
    results.push(result);
    if (!result.ok) return { ok: false, message: result.summary, results };
  }
  return { ok: true, project: ctx.project, results, calls: selectedCalls };
}
