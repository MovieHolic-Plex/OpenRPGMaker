import type { ProposedCall } from "@/ai/assistantSession";
import type { ChangeSummary } from "@/editor/tools";
import type { MapId, Project } from "@/project/types";
import { extractVocabSoftConfirm } from "@/project/tileVocabulary";

export const LOW_RISK_SPATIAL_TOOLS: ReadonlySet<string> = new Set([
  "paint_tiles",
  "fill_region",
  "paint_road",
  "place_props",
  "scatter_object",
]);

const KNOWN_DIFF_KEYS: ReadonlySet<keyof ChangeSummary> = new Set([
  "tilesChanged",
  "eventsAdded",
  "eventsModified",
  "eventsRemoved",
  "mapsAdded",
  "mapsRemoved",
  "dbRecordsChanged",
  "tilesetsChanged",
  "switchesAdded",
  "variablesAdded",
  "worldEntitiesAdded",
  "worldEntitiesModified",
  "palettePresetsAdded",
  "palettePresetsModified",
  "endingsChanged",
  "sessionChanged",
  "systemChanged",
  "warnings",
]);

const ZERO_COUNT_KEYS: readonly (keyof ChangeSummary)[] = [
  "eventsAdded",
  "eventsModified",
  "eventsRemoved",
  "mapsAdded",
  "mapsRemoved",
  "dbRecordsChanged",
  "tilesetsChanged",
  "switchesAdded",
  "variablesAdded",
  "worldEntitiesAdded",
  "worldEntitiesModified",
  "palettePresetsAdded",
  "palettePresetsModified",
  "endingsChanged",
];

export interface ProposalSafetyInput {
  readonly calls: readonly ProposedCall[];
  readonly before: Project;
  readonly after: Project;
  readonly currentMapId: MapId | null | undefined;
  /** 완성도 린트처럼 툴 결과 밖에서 붙은 경고도 안전 분류를 막는다. */
  readonly warnings?: readonly string[];
}

export type ProposalSafetyKind = "low-risk-spatial" | "review-required";

export interface ProposalSafetyClassification {
  readonly kind: ProposalSafetyKind;
  readonly safe: boolean;
  readonly reasons: readonly string[];
}

/**
 * before/after 사이에서 현재 맵의 같은 길이 lowerTiles/upperTiles 값만 바뀌었는지 증명한다.
 * 맵 크기, 스택, 이벤트, 타일셋, DB, 세션 등 다른 필드가 하나라도 달라지면 false다.
 */
export function proposalChangesOnlyCurrentMapTiles(
  before: Project,
  after: Project,
  currentMapId: MapId | null | undefined,
): boolean {
  if (!currentMapId) return false;
  const beforeMap = before.maps[currentMapId];
  const afterMap = after.maps[currentMapId];
  if (!beforeMap || !afterMap) return false;
  if (beforeMap.width !== afterMap.width || beforeMap.height !== afterMap.height) return false;
  if (
    beforeMap.lowerTiles.length !== afterMap.lowerTiles.length ||
    beforeMap.upperTiles.length !== afterMap.upperTiles.length
  ) return false;

  let changed = false;
  for (let index = 0; index < beforeMap.lowerTiles.length; index += 1) {
    if (beforeMap.lowerTiles[index] !== afterMap.lowerTiles[index]) {
      changed = true;
      break;
    }
  }
  if (!changed) {
    for (let index = 0; index < beforeMap.upperTiles.length; index += 1) {
      if (beforeMap.upperTiles[index] !== afterMap.upperTiles[index]) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) return false;

  const normalizedAfter = structuredClone(after);
  normalizedAfter.maps[currentMapId].lowerTiles = [...beforeMap.lowerTiles];
  normalizedAfter.maps[currentMapId].upperTiles = [...beforeMap.upperTiles];
  return stableStringify(before) === stableStringify(normalizedAfter);
}

export function classifyProposalSafety(input: ProposalSafetyInput): ProposalSafetyClassification;
export function classifyProposalSafety(
  calls: readonly ProposedCall[],
  before: Project,
  after: Project,
  currentMapId: MapId | null | undefined,
  warnings?: readonly string[],
): ProposalSafetyClassification;
export function classifyProposalSafety(
  inputOrCalls: ProposalSafetyInput | readonly ProposedCall[],
  before?: Project,
  after?: Project,
  currentMapId?: MapId | null,
  warnings: readonly string[] = [],
): ProposalSafetyClassification {
  const input = normalizeInput(inputOrCalls, before, after, currentMapId, warnings);
  const reasons: string[] = [];
  if (!input) return reviewRequired(["프로젝트 비교 정보가 없습니다."]);
  if (input.calls.length === 0) reasons.push("적용할 변경이 없습니다.");
  if ((input.warnings ?? []).some((warning) => warning.trim().length > 0)) {
    reasons.push("제안에 확인할 경고가 있습니다.");
  }

  for (const call of input.calls) {
    if (!LOW_RISK_SPATIAL_TOOLS.has(call.name)) {
      reasons.push(`안전 목록 밖 도구: ${call.name}`);
      continue;
    }
    if (!call.result.ok) reasons.push(`${call.name} 실행 결과가 성공이 아닙니다.`);
    if (call.destructive) reasons.push(`${call.name}에 삭제·파괴 표시가 있습니다.`);
    if (call.requiresApproval || Boolean(call.approvalWarning?.trim())) {
      reasons.push(`${call.name}에 사용자 확인이 필요합니다.`);
    }
    if (extractVocabSoftConfirm(call.result.data) !== null) {
      reasons.push(`${call.name}에 아직 합의하지 않은 재료가 있습니다.`);
    }
    if ((call.result.warnings ?? []).some((warning) => warning.trim().length > 0)) {
      reasons.push(`${call.name} 결과에 경고가 있습니다.`);
    }
    if ((call.result.issues ?? []).some((issue) => issue.severity === "warning" || issue.severity === "error")) {
      reasons.push(`${call.name} 결과에 확인할 문제가 있습니다.`);
    }
    if (!isPositiveTileOnlyDiff(call.result.diff)) {
      reasons.push(`${call.name} 변경 요약이 타일만 바꾼 안전한 결과가 아닙니다.`);
    }
  }

  if (!proposalChangesOnlyCurrentMapTiles(input.before, input.after, input.currentMapId)) {
    reasons.push("현재 맵의 같은 크기 타일 배열만 바뀌었다고 확인할 수 없습니다.");
  }

  return reasons.length === 0
    ? { kind: "low-risk-spatial", safe: true, reasons: [] }
    : reviewRequired(reasons);
}

export function canAutoApplyProposal(input: ProposalSafetyInput): boolean;
export function canAutoApplyProposal(
  calls: readonly ProposedCall[],
  before: Project,
  after: Project,
  currentMapId: MapId | null | undefined,
  warnings?: readonly string[],
): boolean;
export function canAutoApplyProposal(
  inputOrCalls: ProposalSafetyInput | readonly ProposedCall[],
  before?: Project,
  after?: Project,
  currentMapId?: MapId | null,
  warnings: readonly string[] = [],
): boolean {
  return (Array.isArray(inputOrCalls)
    ? classifyProposalSafety(inputOrCalls, before as Project, after as Project, currentMapId, warnings)
    : classifyProposalSafety(inputOrCalls as ProposalSafetyInput)).safe;
}

export function canUseCanvasFirstReview(input: ProposalSafetyInput): boolean;
export function canUseCanvasFirstReview(
  calls: readonly ProposedCall[],
  before: Project,
  after: Project,
  currentMapId: MapId | null | undefined,
  warnings?: readonly string[],
): boolean;
export function canUseCanvasFirstReview(
  inputOrCalls: ProposalSafetyInput | readonly ProposedCall[],
  before?: Project,
  after?: Project,
  currentMapId?: MapId | null,
  warnings: readonly string[] = [],
): boolean {
  return (Array.isArray(inputOrCalls)
    ? classifyProposalSafety(inputOrCalls, before as Project, after as Project, currentMapId, warnings)
    : classifyProposalSafety(inputOrCalls as ProposalSafetyInput)).safe;
}

function normalizeInput(
  inputOrCalls: ProposalSafetyInput | readonly ProposedCall[],
  before: Project | undefined,
  after: Project | undefined,
  currentMapId: MapId | null | undefined,
  warnings: readonly string[],
): ProposalSafetyInput | null {
  if (!Array.isArray(inputOrCalls)) return inputOrCalls as ProposalSafetyInput;
  if (!before || !after) return null;
  return { calls: inputOrCalls, before, after, currentMapId, warnings };
}

function isPositiveTileOnlyDiff(diff: ChangeSummary | undefined): boolean {
  if (!diff || !Number.isFinite(diff.tilesChanged) || diff.tilesChanged <= 0) return false;
  if (Object.keys(diff).some((key) => !KNOWN_DIFF_KEYS.has(key as keyof ChangeSummary))) return false;
  if (ZERO_COUNT_KEYS.some((key) => diff[key] !== 0)) return false;
  if (diff.sessionChanged !== false || diff.systemChanged !== false) return false;
  if ((diff.warnings ?? []).some((warning) => warning.trim().length > 0)) return false;
  return true;
}

function reviewRequired(reasons: readonly string[]): ProposalSafetyClassification {
  return { kind: "review-required", safe: false, reasons: [...new Set(reasons)] };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
