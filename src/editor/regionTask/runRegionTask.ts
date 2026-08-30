// 영역 지정 AI 작업 오케스트레이션. 기존 AssistantSession을 그대로 재사용하되,
// 메시지에 표준 [컨텍스트] 선택 영역 footer를 붙여(스펙 게이트 구간 격리 활성화)
// 지시를 보내고, 제안을 clipMapCellsToRegion으로 사각형에 하드-클립한 뒤,
// 스냅샷 1개 + store.replace로 적용한다(undo 1개).
//
// store/세션 싱글턴 의존을 deps로 분리해 단위 테스트가 가능하다.
// 개발 편의: 감사 로그·하네스·UI 이벤트 스트림을 RegionTaskLogExport 로 묶어 export 한다.
import {
  AssistantSession,
  type AuditEntry,
  type HarnessSnapshot,
  type SessionEvent,
  type TurnResult,
} from "@/ai/assistantSession";
import { recordAiActivityFromRegionLog } from "@/ai/activityLog";
import { conversationScopeKey } from "@/ai/conversationStore";
import { distillPreferences } from "@/ai/preferenceDistiller";
import { observeTurn, shouldDistillPreferences } from "@/ai/preferenceSignals";
import { requestLikelyModifiesExisting } from "@/ai/modifyIntent";
import { configForLiteModel, loadAiConfig } from "@/ai/llmClient";
import {
  activityToolCallsFromAudit,
  type ConstructionActivityDisposition,
} from "@/editor/construction/constructionActivity";
import type { ConstructionAuditRecord } from "@/editor/construction/constructionAudit";
import { publishAiApplyCompletion } from "@/editor/aiApplyCompletion";
import {
  clearAgentGhostPreview,
  createThrottledAgentGhostPreviewUpdater,
  replaceAgentGhostPreviewFromProjectDiff,
  setAgentGhostPreviewHidden,
} from "@/editor/agentGhostPreview";
import { getInlineProposalActions, setInlineProposalActions, type InlineProposalActions } from "@/editor/proposalInlineApproval";
import {
  getMapEditHistoryMarker,
  recordProjectSnapshot,
  truncateMapEditHistoryFromMarker,
} from "@/editor/mapEditHistory";
import { getEditorMapViewport } from "@/editor/editorMapViewport";
import { BUILD_PALETTE_GROUP_IDS, ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { getTool } from "@/editor/tools";
import { store } from "@/project/store";
import { extractVocabSoftConfirm } from "@/project/tileVocabulary";
import { isBagGroupId, isBagMaterialQuery } from "@/project/materialPolicy";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { MapId, Project, TilesetDef } from "@/project/types";
import { validateLayoutPlacement } from "@/project/lint/layoutPlacementValidate";
import { clipMapCellsToRegion, inRegion, type RegionRect } from "./clipToRegion";
import { analyzeRegionBlend, describeBlendBreak, describeBlockedEntrance, expandRegion, polishRegionSeams } from "./regionBlend";
import { buildRegionPolishMessage } from "./regionPolish";
import { analyzeRegionSurroundings } from "./regionSurroundings";
import { REGION_INTENT_KEYWORDS, regionIntentGuideLines, routeRegionIntent } from "./regionIntentRouter";
import { getPendingRegionApply, setPendingRegionApply, type PendingRegionApply } from "./pendingRegionApply";
import { projectApprovalFingerprint, reviewRegionDraft, type HarnessReviewReport } from "./harnessReview";
import { dispatchRegionTaskStatus } from "./regionTaskStatus";

export const REGION_TASK_MAX_TOOL_CALLS = 24;

export interface RegionTaskSessionLike {
  sendUserMessage(
    text: string,
    onEvent?: (event: SessionEvent) => void,
    signal?: AbortSignal,
  ): Promise<TurnResult>;
  getProposedProject(): Project;
  getAuditEntries?(): readonly AuditEntry[];
  getHarnessSnapshot?(): HarnessSnapshot;
  exportAudit?(): string;
}

export interface RegionTaskDeps {
  getProject(): Project;
  applyProject(project: Project, label: string, mapId: MapId): void;
  createSession(project: Project, mapId: MapId): RegionTaskSessionLike;
}

export type RegionTaskMode = "task" | "polish";

export interface RegionTaskOptions {
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly instruction: string;
  /**
   * 기본 "task": 지시대로 만든다. "polish": 주변과 어울리게 영역 안을 전권으로 다시 짜고,
   * 경계 이음새를 결정론으로 마감한 뒤 어울림 리포트를 붙인다.
   */
  readonly mode?: RegionTaskMode;
  /** 기본 "approval": 사용자가 적용/버리기를 결정하는 상태로 멈춘다. "immediate"는 레거시 직접 적용. */
  readonly gate?: "approval" | "immediate";
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: SessionEvent) => void;
}

export interface RegionTaskUiEvent {
  readonly at: string;
  readonly type: SessionEvent["type"] | "result";
  readonly text: string;
  readonly toolName?: string;
  readonly toolOk?: boolean;
  readonly toolArgs?: Record<string, unknown>;
  readonly toolSummary?: string;
}

/** 영역 작업 한 턴의 개발용 export 페이로드. */
export interface RegionTaskLogExport {
  readonly kind: "region-task-log";
  readonly exportedAt: string;
  readonly mapId: MapId;
  readonly mapName: string;
  readonly region: RegionRect;
  readonly instruction: string;
  readonly composedMessage: string;
  readonly result: {
    readonly ok: boolean;
    readonly applied: boolean;
    readonly changedCells: number;
    readonly changedEvents: number;
    readonly clippedCells: number;
    readonly seamCells?: number;
    readonly proposedCalls: number;
    readonly assistantText: string;
    readonly error?: string;
    readonly stoppedReason?: TurnResult["stoppedReason"];
  };
  readonly toolCalls: readonly {
    readonly name: string;
    readonly args: Record<string, unknown>;
    readonly ok: boolean;
    readonly summary: string;
    readonly softConfirm?: unknown;
    readonly construction?: ConstructionAuditRecord;
  }[];
  readonly uiEvents: readonly RegionTaskUiEvent[];
  readonly audit: readonly AuditEntry[];
  readonly harness: HarnessSnapshot | null;
}

export interface RegionTaskResult {
  readonly ok: boolean;
  readonly applied: boolean;
  readonly changedCells: number; // 영역 안에서 실제 바뀐 셀 수.
  readonly changedEvents: number; // 영역 안 이벤트(NPC 등) 변경 수.
  /** 새로 추가된 맵 수(실내 파이프라인·create_map). 영역 셀 0이어도 적용 가치가 있다. */
  readonly mapsAdded?: number;
  readonly clippedCells: number; // 영역 밖에서 되돌린(막은) 셀 수.
  /** 다듬기가 경계 바로 밖 1칸에서 오토타일 변형만 고친 칸 수. */
  readonly seamCells?: number;
  readonly proposedCalls: number;
  readonly assistantText: string;
  readonly error?: string;
  /** 적용 전 진단(권고) — 구조화 이슈·게임플레이 지표. 적용을 막지 않는다. */
  readonly review?: HarnessReviewReport;
  /** 개발용 구조화 로그 — UI export / window.__oprnRegionTaskLog */
  readonly log?: RegionTaskLogExport;
  /** 사용자 결정 대기(gate: "approval") 생성 시 반환 — 적용/버리기 전까지 유효. */
  readonly pending?: PendingRegionApply;
}

function hasRegionTaskChanges(result: Pick<RegionTaskResult, "changedCells" | "changedEvents" | "mapsAdded">): boolean {
  return result.changedCells > 0 || result.changedEvents > 0 || (result.mapsAdded ?? 0) > 0;
}

function formatRegionTaskChangeParts(result: Pick<RegionTaskResult, "changedCells" | "changedEvents" | "mapsAdded">): string[] {
  const parts: string[] = [];
  if (result.changedCells > 0) parts.push(`${result.changedCells}칸 타일`);
  if (result.changedEvents > 0) parts.push(`이벤트 ${result.changedEvents}건`);
  if ((result.mapsAdded ?? 0) > 0) parts.push(`맵 ${result.mapsAdded}개 추가`);
  return parts;
}

/**
 * 승인 대기 턴의 안내 문장. 모델이 "시공했습니다" 라고 단정해도 실제로는 아직 아무것도
 * 맵에 없다 — 그 어긋남이 2026-08-29 15:41·15:44 의 "명령이 이행되지 않았다" 신고의 절반이었다.
 * 그래서 모델 문장 앞에 사실(미반영 + 대기 규모 + 다음 동작)을 먼저 박는다.
 */
export function pendingApprovalText(
  assistantText: string,
  changed: Pick<RegionTaskResult, "changedCells" | "changedEvents" | "mapsAdded">,
): string {
  const scale = formatRegionTaskChangeParts(changed).join(" · ");
  const notice = hasRegionTaskChanges(changed)
    ? `아직 맵에 반영되지 않았습니다 — ${scale} 변경안이 승인 대기 중입니다. [적용]을 누르면 반영되고, [버리기]를 누르면 사라집니다.`
    : "아직 맵에 반영되지 않았습니다 — 바뀐 칸이 없어 적용할 것이 없습니다.";
  const body = assistantText.trim();
  return body ? `${notice}\n\n${body}` : notice;
}

export function describeRegionTaskResult(result: RegionTaskResult): string {
  if (!result.ok) return `오류: ${result.error ?? "알 수 없는 오류"}`;
  // 이음새는 사용자가 허용한 "경계 1칸 변형" 이다 — 클립 수치와 섞이지 않게 따로 밝힌다.
  // 승인 대기 단계에서도 말해야 한다: 결정 전에 영역 밖이 몇 칸 손질됐는지 알아야 한다.
  const seam = (result.seamCells ?? 0) > 0 ? ` · 경계 ${result.seamCells}칸 정돈` : "";
  if (result.pending && !result.pending.settled) {
    return `승인 대기 — ${formatRegionTaskChangeParts(result).join(" · ") || "변경"}${seam} · 아직 반영되지 않았습니다`;
  }
  if (!result.applied) {
    // hasRegionTaskChanges 가 참이면 "만들어 두고 반영하지 않은 변경" 이 있다는 뜻이다.
    // 이전 판은 두 문구가 뒤집혀 있어서, 313칸이 대기 중일 때 "적용할 변경이 없습니다" 라고 답했다.
    return hasRegionTaskChanges(result)
      ? `반영하지 않았습니다 — ${formatRegionTaskChangeParts(result).join(" · ")} 변경안을 버렸습니다.`
      : "이 영역에서 바뀐 것이 없습니다.";
  }
  const parts = formatRegionTaskChangeParts(result);
  const clipped = result.clippedCells > 0 ? ` · 영역 밖 ${result.clippedCells}칸 차단` : "";
  return `적용됨 — ${parts.join(" · ") || "변경 적용"}${clipped}${seam}`;
}

/** proposed에 생기고 base에 없는 맵 수. */
export function countAddedMaps(base: Project, proposed: Project): number {
  let added = 0;
  for (const id of Object.keys(proposed.maps)) {
    if (!base.maps[id]) added += 1;
  }
  return added;
}

export function applyRegionProjectWithHistory(project: Project, label: string, mapId: MapId): void {
  // Region tasks may add maps, events, tilesets, or system data. Commit the project and its
  // single undo entry as one failure-atomic operation so a throwing store listener cannot
  // strand authored state or leave an orphan history snapshot.
  const before = structuredClone(store.getCurrent());
  const historyMarker = getMapEditHistoryMarker();
  let replaceStarted = false;
  try {
    recordProjectSnapshot(label, mapId, { kind: "project" });
    replaceStarted = true;
    // 행위 로그에 AI 소행으로 남긴다. 라벨/origin 이 없으면 영역 작업 전량이
    // `(라벨 없음)` + `origin: "human"` 으로 떨어져 사람 손편집과 구분되지 않는다.
    store.replace(project, { change: { label: `AI 영역 작업: ${label}`, origin: "ai" } });
  } catch (cause) {
    let rollbackFailure: unknown;
    if (replaceStarted) {
      try {
        // 롤백도 기록한다 — "적용됐다가 되돌아갔다" 는 조사에서 필요한 사실이다.
        store.replace(before, {
          preserveEventDrafts: false,
          change: { label: `AI 영역 작업 롤백: ${label}`, origin: "system" },
        });
      } catch (error) {
        rollbackFailure = error;
      }
    }
    try {
      truncateMapEditHistoryFromMarker(historyMarker);
    } catch (error) {
      rollbackFailure ??= error;
    }
    if (rollbackFailure !== undefined) {
      const original = cause instanceof Error ? cause.message : String(cause);
      const rollback = rollbackFailure instanceof Error ? rollbackFailure.message : String(rollbackFailure);
      throw new Error(`프로젝트 적용 실패 후 롤백에도 실패했습니다: ${original} / ${rollback}`);
    }
    throw cause;
  }
}

const defaultDeps: RegionTaskDeps = {
  getProject: () => store.getCurrent(),
  applyProject: applyRegionProjectWithHistory,
  createSession: (project, mapId) => {
    const liteConfig = configForLiteModel(loadAiConfig());
    return new AssistantSession(project, {
      config: {
        ...liteConfig,
        maxToolCalls: Math.min(liteConfig.maxToolCalls, REGION_TASK_MAX_TOOL_CALLS),
      },
      contextOptions: {
        currentMapId: mapId,
        // 프로젝트 한정 성향 조회 키. 전역 성향은 이 값과 무관하게 항상 붙는다.
        projectScopeKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
        getViewport: () => {
          const snap = getEditorMapViewport();
          return snap?.mapId === mapId ? snap : null;
        },
      },
    });
  },
};

export function buildRegionTaskLogExport(input: {
  readonly mapId: MapId;
  readonly mapName: string;
  readonly region: RegionRect;
  readonly instruction: string;
  readonly composedMessage: string;
  readonly result: Omit<RegionTaskResult, "log">;
  readonly turn?: TurnResult;
  readonly uiEvents: readonly RegionTaskUiEvent[];
  readonly session?: RegionTaskSessionLike;
}): RegionTaskLogExport {
  const audit = input.session?.getAuditEntries?.() ?? [];
  const harness = input.session?.getHarnessSnapshot?.() ?? null;
  const hasChanges = hasRegionTaskChanges(input.result);
  const disposition: ConstructionActivityDisposition = input.result.applied
    ? "applied"
    : hasChanges
      ? "pending"
      : "no-change";
  const auditedCalls = activityToolCallsFromAudit(audit, disposition);
  const proposedCalls = input.turn?.proposedCalls ?? [];
  const toolCalls = auditedCalls.length > 0
    ? auditedCalls.map((call) => {
        const proposal = proposedCalls.find((candidate) => candidate.name === call.name);
        const softConfirm = extractVocabSoftConfirm(proposal?.result.data);
        return {
          ...call,
          ...(softConfirm === null ? {} : { softConfirm }),
        };
      })
    : proposedCalls.map((call) => ({
        name: call.name,
        args: call.args,
        ok: call.result.ok,
        summary: call.summary,
        ...(extractVocabSoftConfirm(call.result.data) === null
          ? {}
          : { softConfirm: extractVocabSoftConfirm(call.result.data) }),
      }));
  return {
    kind: "region-task-log",
    exportedAt: new Date().toISOString(),
    mapId: input.mapId,
    mapName: input.mapName,
    region: input.region,
    instruction: input.instruction,
    composedMessage: input.composedMessage,
    result: {
      ok: input.result.ok,
      applied: input.result.applied,
      changedCells: input.result.changedCells,
      changedEvents: input.result.changedEvents,
      clippedCells: input.result.clippedCells,
      ...((input.result.seamCells ?? 0) > 0 ? { seamCells: input.result.seamCells } : {}),
      proposedCalls: input.result.proposedCalls,
      assistantText: input.result.assistantText,
      ...(input.result.error ? { error: input.result.error } : {}),
      ...(input.turn ? { stoppedReason: input.turn.stoppedReason } : {}),
    },
    toolCalls,
    uiEvents: input.uiEvents,
    audit: [...audit],
    harness,
  };
}

export function serializeRegionTaskLog(log: RegionTaskLogExport): string {
  return JSON.stringify(log, null, 2);
}

/** 마지막 영역 작업 로그 — 콘솔/헤드리스 디버깅용. */
export function publishRegionTaskLog(log: RegionTaskLogExport | undefined): void {
  if (typeof window === "undefined" || !log) return;
  window.__oprnRegionTaskLog = log;
  window.__oprnLastRegionTaskLog = () => log;
}

function pushUiEvent(events: RegionTaskUiEvent[], event: SessionEvent): void {
  const at = new Date().toISOString();
  if (event.type === "status") {
    events.push({ at, type: "status", text: event.text });
    return;
  }
  if (event.type === "assistant_message") {
    events.push({ at, type: "assistant_message", text: event.content });
    return;
  }
  if (event.type === "tool_call") {
    events.push({
      at,
      type: "tool_call",
      text: event.result.summary || event.name,
      toolName: event.name,
      toolOk: event.result.ok,
      toolArgs: event.args,
      toolSummary: event.result.summary,
    });
    return;
  }
  if (event.type === "phase") {
    events.push({ at, type: "phase", text: `phase:${event.value}` });
  }
}

/** Combined Town 하네스 프리셋(나무/길/물 등)을 origin:user 로 승인해 place_props가 바로 쓰이게 한다. */
export function ensureRegionPlacementHarness(tileset: TilesetDef): void {
  ensureBuildPaletteTileGroups(tileset);
}

/** 장식 박스 전용 그룹 참조(엔진 내부). 시공 public contract 는 material 라벨만. */
export const REGION_PROP_VOCAB = {
  woodBox: `${COMBINED_TOWN_HARNESS_PREFIX}wood-box`,
  fruitBox: `${COMBINED_TOWN_HARNESS_PREFIX}fruit-box`,
} as const;

/** 영역 메시지에 넣을 소품/지형 그룹 id 힌트(존재하면 soft-confirm 으로 바로 place_props 가능). */
export function formatApprovedPropVocabHint(tileset: TilesetDef | undefined): string {
  return formatMaterialLabelHint(tileset);
}

export function formatMaterialLabelHint(tileset: TilesetDef | undefined): string {
  if (!tileset) {
    return `- 소품 재료: (타일셋 없음) tile_query ask:"labels" — 예: "침엽수", "나무 상자", "과일박스" (가방·그룹 id 금지)`;
  }
  // 구체 소품 우선. 마을 소품(small-props) 가방은 시공 material 후보에서 제외.
  const preferred = [
    BUILD_PALETTE_GROUP_IDS.tree,
    REGION_PROP_VOCAB.woodBox,
    REGION_PROP_VOCAB.fruitBox,
    BUILD_PALETTE_GROUP_IDS.path,
    BUILD_PALETTE_GROUP_IDS.water,
  ];
  const groups = tileset.tileGroups ?? [];
  const preferredFound = preferred
    .map((id) => groups.find((group) => group.id === id))
    .filter((group): group is NonNullable<typeof group> => group != null && !isBagGroupId(group.id));
  const propish = groups.filter((group) => {
    if (isBagGroupId(group.id) || isBagMaterialQuery(group.name)) return false;
    return (
      group.role === "prop" || group.role === "terrain" || group.role === "water" || group.role === "fence"
      || /tree|bush|flower|fence|path|water|road|box/i.test(group.id)
    );
  });
  const ordered = [
    ...preferredFound,
    ...propish.filter((group) => !preferred.includes(group.id)),
  ];
  const unique = [...new Map(ordered.map((group) => [group.id, group])).values()].slice(0, 10);
  if (unique.length === 0) {
    return `- 소품 재료: tile_query ask:"labels" 로 라벨/설명을 찾아 place_props material 에 넣기 (가방·그룹 id 금지)`;
  }
  const list = unique.map((group) => `${group.name}(${group.role})`).join(", ");
  return `- 소품·지형 material 라벨 예(place_props/fill_region — 가방·그룹 id 금지, 미합의는 목업 확인): ${list}`;
}

/**
 * 지시 텍스트에서 집/마을 시공 의도를 감지해 공식 facade 호출 시그니처 라인을 반환.
 *
 * 마을 분기는 **수량 정규식과 무관하게** 항상 `target:{kind:"existing",mapId,bounds}` 를 못박는다
 * (2026-08-29 modify 진단 근본원인 10). 옛 구현은 `집 N채인 마을` 이 걸릴 때만 target 을 적어줬고,
 * "이 마을 좀 정리해줘" 처럼 수량이 없으면 시그니처가 아예 안 붙어 모델이 author_village 기본값
 * (= 새 맵 생성)으로 갔다. 영역 작업은 정의상 **지금 열린 맵의 선택 사각형** 이 대상이라 새 맵이
 * 정답일 수 없고, bounds 를 생략하면 스코프 검사를 통과한 채 맵 전체가 재포장된다.
 */
function constructionFacadeLine(instruction: string, mapId: MapId, region: RegionRect): string | null {
  const boundsArg = `bounds:{x:${region.x},y:${region.y},w:${region.width},h:${region.height}}`;
  const target = `target:{kind:"existing",mapId:"${mapId}",${boundsArg}}`;
  // 마을 intent: "집 N채인 마을", "N채 마을"
  const villageMatch = instruction.match(/집?\s*(\d+)채[인]?\s*마을/);
  if (villageMatch) {
    const n = parseInt(villageMatch[1]!, 10);
    return `- 마을 시공: author_village { ${target}, houseCount:${n}, countPolicy:"exact" } — 정확히 ${n}채`;
  }
  // 수량 없는 마을 언급(집 언급도 없을 때) — 새 맵 금지·선택 영역 한정만 못박는다.
  if (/마을/.test(instruction) && !/집/.test(instruction)) {
    return `- 마을 작업: author_village { ${target} } — 새 맵을 만들지 말고 이 맵 선택 영역만 대상으로`;
  }
  // 야외 집 한 채 (author_house는 regionIntentGuideLines 구조물 가이드에 이미 노출 — 시그니처만 보강)
  if (/야외\s*집\s*한\s*채|집\s*한\s*채/.test(instruction)) {
    return `- 야외 집 시공 시그니처: { kind:"single", mapId:"${mapId}" } — 정확히 1채`;
  }
  // 야외 집 N채
  const houseMatch = instruction.match(/(?:야외\s*)?집\s*(\d+)채/);
  if (houseMatch) {
    const n = parseInt(houseMatch[1]!, 10);
    return `- 야외 집 시공 시그니처: { kind:"lots", mapId:"${mapId}" } — 정확히 ${n}채`;
  }
  // bare "집지어"/"집 만들어" — 영역 작업에서 야외 집 1채 기본(되묻지 않음).
  // 영역 선택이 현재 맵 위이므로 야외 외장 의도로 간주한다(실내는 별도 표지가 있을 때만).
  // "건물"(일반 건물)은 여기서 잡지 않는다 — 탑/성벽/대장간 등은 structure 가이드가
  // build_wall/create_farm_plot 등으로 안내하고, 일반 "건물"은 가이드가 LLM에게 맡긴다.
  // (이전 /집|건물/ 은 "탑 건물"·"성벽 건물" 을 author_house 로 오경로했다.)
  if (/집/.test(instruction)) {
    return `- 야외 집 시공: author_house { kind:"single", mapId:"${mapId}" } — 선택 영역 안에 1채 시공`;
  }
  return null;
}

// aiChatPanel.contextFooter와 동일한 [컨텍스트] 라인 포맷(buildSpec.ts의 정규식이 파싱).
// 이 라인이 있어야 세션이 선택 영역을 이번 턴의 암묵적 명세로 인식한다.
// 도메인 키워드(타일/npc)를 넣어 place_props·author_house·place_npc 가 노출되게 한다.
export function buildRegionTaskMessage(
  instruction: string,
  mapName: string,
  mapId: MapId,
  region: RegionRect,
  tileset?: TilesetDef,
): string {
  const footer = `[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (${region.x},${region.y}) ${region.width}×${region.height}`;
  const categories = routeRegionIntent(instruction);
  // 실내 표지는 routeRegionIntent 결과가 아니라 키워드로 직접 본다 — 수정 요청이면 라우터가
  // "interior"(신규 시공 가이드)를 이미 떨어내므로, 결과만 보면 "실내 수정"과 "실내 무관"을
  // 구분할 수 없다.
  const mentionsInterior = REGION_INTENT_KEYWORDS.interior.some((keyword) =>
    instruction.toLowerCase().replace(/\s+/g, " ").includes(keyword),
  );
  const modifies = requestLikelyModifiesExisting(instruction);
  // 실내 요청을 신규/수정으로 쪼갠다(2026-08-29 modify 진단 근본원인 8). 옛 `wantsInterior` 하나로는
  // "이 침실 좀 고쳐줘" 가 "새 맵 전체를 시공하라" + "영역 밖 허용" 지시를 받아, 고칠 대상이 있는데도
  // 새 실내 맵을 하나 더 만드는 경로로 밀렸다.
  const wantsNewInterior = mentionsInterior && !modifies;
  const wantsInteriorEdit = mentionsInterior && modifies;
  // 영역 작업: 사용자가 현재 맵 위에 영역을 선택했으므로 "집"이라고만 해도 야외 집(현재 맵 외장)으로
  // 간주한다. 실내는 명시적 표지(실내/인테리어)가 있을 때만 실내 경로.
  // (이전: bare "집" → 야외/실내 되묻기 → "집지어"인데 아무것도 안 짓는 불만. 영역 선택 자체가
  // 현재 맵 위 야외 시공 의도의 신호다 — 실내 신축은 새 맵으로 빠져나가므로 영역 선택과 모순.)
  const bareHouse = !mentionsInterior && !modifies && /집/.test(instruction) && !/야외|외장|마을/.test(instruction);
  // 실내 요청에만 야외 구조물 가이드를 뺀다(bare 집은 이제 야외 집으로 시공하므로 structure 유지).
  const filteredCategories = mentionsInterior
    ? categories.filter((c) => c !== "structure")
    : categories;
  const intentGuides = regionIntentGuideLines(filteredCategories);
  // 신규 실내·수정 요청에는 시공 facade 시그니처를 붙이지 않는다 — 둘 다 "새로 지어라"는 신호다.
  const facadeLine = wantsNewInterior || modifies ? null : constructionFacadeLine(instruction, mapId, region);
  const toolGuide = [
    "영역 작업 도구 규칙:",
    ...(bareHouse ? ["- 집 요청(영역 선택): 선택 영역이 현재 맵 위이므로 야외 집으로 시공. 되묻지 말고 author_house(kind:\"single\")로 바로 시공하라."] : []),
    wantsNewInterior
      ? "- 실내/방: start_interior_room_session (새 mapId). 야외 시공 facade 금지. create_map만 하고 끝내지 말 것"
      : wantsInteriorEdit
        ? "- 실내 수정: 지금 열린 이 맵을 직접 편집한다(furnish_interior_space({mapId, roomId}) / fill_region / tile_erase / place_props). start_interior_room_session·run_interior_room_pipeline 금지 — 기존 맵의 타일·이벤트가 전부 삭제된다"
        : "- 집/건물(야외 외장): 공식 시공 facade 사용 (벽 타일로 직사각 채우기 금지). 실내·방 맵 요청에는 야외 시공 facade 금지 → 실내 세션 툴",
    ...(modifies
      ? [`- 대상 맵 고정: 이 작업의 대상은 \`${mapId}\` 이다. create_map·duplicate_map 으로 새 맵을 만들지 말고 이 맵을 고쳐라. 여러 맵을 오가지 말 것`]
      : []),
    ...(facadeLine ? [facadeLine] : []),
    "- 나무/바위/꽃 산포: place_props + material(타일 라벨/설명, 예 \"침엽수\"·\"꽃\"). 그룹 id·vocabId 금지. 같은 place_props는 1회",
    formatMaterialLabelHint(tileset),
    // 툴콜링 사고: "박스 2개" → small-props 가방. 구체 라벨만 허용.
    `- 장식 박스/나무상자/나무박스: place_props { material: \"나무 상자\", count:N }. 과일박스= material:\"과일박스\". 마을 소품/small-props 가방·place_chest로 대체 금지`,
    "- 보물상자(열면 아이템/골드·개봉 기억): place_chest 만. 보관/창고 상자(넣고 빼기): place_storage_chest. '박스'/'나무상자' 장식은 place_props — place_chest 금지",
    "- 지면/수역/바닥 면: fill_region { material:\"물\" 또는 \"잔디\" } + 원형·둥근은 shape=circle(필수). 그룹 id 금지. rect만 쓰면 네모. 타원=ellipse",
    "- 길/도로: paint_road { mapId, style:\"dirt\"|\"sand\", points:[{x,y},...] } — 흙길 오토타일 성형. 영역 안 동선·호수 둘레 산책로에 사용",
    "- 나무/소품: place_props — 물·호수 칸 위 금지. area는 호수 바깥 육지(통행 가능)만. 호수 채운 뒤 주변에 나무를 깔 것",
    "- 주민/NPC: place_npc 또는 make_villager — graphic 생략 시 villager 기본. 물 위 NPC 금지. 상점 NPC는 make_villager({shop}) 1회 또는 place_npc 1회(같은 역할 중복 금지)",
    `- tile_query ask:\"labels\" 는 mapId:\"${mapId}\" 를 넣어 현재 맵 타일셋 라벨만 조회(기본값=야외 타일셋 — 실내 맵에서 가로 탁자 등 오조회 주의)`,
    ...intentGuides,
    "- 지원하지 않는 요청 부분은 시도하지 말고, 마지막 응답에 '못 한 것: …' 한 줄로 명시하라",
    // "적용" 표기 금지: assistantToolMode.INTENT_KEYWORDS.battle.strong의 단음절 "적"과
    // 부분일치로 충돌해(2026-07-10 라이브 실측 수정) 이 고정 문구가 매 턴 battle+database
    // 도메인을 허위로 열고 노출 상한(40)을 잠식해 mirror_region 등 map/quest 도구를 밀어냈다.
    "- 결과는 사용자 승인 후에만 반영된다. propose_tile_vocabulary 댄스는 하지 말 것",
    wantsNewInterior
      ? "- 실내 신규: 새 맵 시공은 선택 영역 밖이어도 허용한다. 현재 맵 타일은 불필요하면 건드리지 말 것"
      : "- 영역 밖 타일·이벤트는 절대 수정하지 말 것",
  ].join("\n");
  // intent 스코핑용 키워드 — "맵" 단독 과활성은 피하고 타일/이벤트/소품 쓰기 도메인을 우선한다.
  // map/quest 등 다른 도메인 도구의 노출은 여기서 시드를 보태 여는 게 아니라, footer의
  // "현재 맵" 문구·가이드 문구 자체의 키워드(예: quest-trigger의 "퀘스트")로 이미 자연히
  // 열리고, 상한(40) 슬라이스에 밀리는 핵심 도구는 toolRegistry.PINNED_TOOLS_BY_DOMAIN이
  // 보장한다(2026-07-10 라이브 실측 수정 — 카테고리별 도메인 시드 병합은 A/B 실측상 효과가
  // 없는 죽은 복잡도로 판정돼 제거했다).
  const domainSeed = mentionsInterior
    ? "(영역 작업: 타일 실내 방 맵 인테리어 집 npc 이벤트)"
    : "(영역 작업: 타일 지형 나무 소품 집 npc 이벤트 주민)";
  const scopeLine = wantsNewInterior
    ? "이 작업은 실내/새 맵 시공이다. 선택 영역은 참고용이며 새 맵 전체를 시공하라."
    : "이 작업은 아래 선택 영역 안에서만 수행하라.";
  return `${instruction.trim()}\n\n${domainSeed}\n${toolGuide}\n\n${scopeLine}\n${footer}`;
}

// 영역 안에서 base 대비 lower/upper가 바뀐 셀 수(적용 여부 판단·요약용).
export function countInRegionChangedCells(base: Project, next: Project, mapId: MapId, region: RegionRect): number {
  const baseMap = base.maps[mapId];
  const nextMap = next.maps[mapId];
  if (!baseMap || !nextMap) return 0;
  if (baseMap.width !== nextMap.width || baseMap.height !== nextMap.height) return 0;
  const { width, height } = baseMap;
  let changed = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inRegion(x, y, region)) continue;
      const i = y * width + x;
      if (nextMap.lowerTiles[i] !== baseMap.lowerTiles[i] || nextMap.upperTiles[i] !== baseMap.upperTiles[i]) changed += 1;
    }
  }
  return changed;
}

/** 영역 안 이벤트(NPC 등) 추가·삭제·이동·이름 변경 수. */
export function countInRegionChangedEvents(base: Project, next: Project, mapId: MapId, region: RegionRect): number {
  const baseMap = base.maps[mapId];
  const nextMap = next.maps[mapId];
  if (!baseMap || !nextMap) return 0;
  const baseInside = (baseMap.events ?? []).filter((event) => inRegion(event.x, event.y, region));
  const nextInside = (nextMap.events ?? []).filter((event) => inRegion(event.x, event.y, region));
  const baseById = new Map(baseInside.map((event) => [event.id, event]));
  const nextById = new Map(nextInside.map((event) => [event.id, event]));
  let changed = 0;
  for (const [id, event] of nextById) {
    const prev = baseById.get(id);
    if (!prev) {
      changed += 1;
      continue;
    }
    const prevName = prev.pages?.[0]?.name;
    const nextName = event.pages?.[0]?.name;
    if (prev.x !== event.x || prev.y !== event.y || prevName !== nextName) changed += 1;
  }
  for (const id of baseById.keys()) {
    if (!nextById.has(id)) changed += 1;
  }
  return changed;
}

type ActiveRegionTaskRun = {
  readonly id: number;
  readonly controller: AbortController;
};

let regionTaskRunSequence = 0;
let activeRegionTaskRun: ActiveRegionTaskRun | null = null;

function beginOwnedRegionTaskRun(externalSignal?: AbortSignal): ActiveRegionTaskRun {
  // Abort listeners run synchronously. Abort the previous owner before publishing the new id so
  // it can clean only its own pending/ghost/actions without touching the new run.
  activeRegionTaskRun?.controller.abort();
  const run = { id: ++regionTaskRunSequence, controller: new AbortController() };
  activeRegionTaskRun = run;
  if (externalSignal?.aborted) run.controller.abort();
  return run;
}

export async function runRegionTask(
  opts: RegionTaskOptions,
  deps: RegionTaskDeps = defaultDeps,
): Promise<RegionTaskResult> {
  const emptyBase = {
    ok: false,
    applied: false,
    changedCells: 0,
    changedEvents: 0,
    mapsAdded: 0,
    clippedCells: 0,
    proposedCalls: 0,
    assistantText: "",
  } as const;
  const rejectBeforeRun = (error: string): RegionTaskResult => {
    const runId = ++regionTaskRunSequence;
    dispatchRegionTaskStatus({
      mapId: opts.mapId,
      region: opts.region,
      running: false,
      runId,
    });
    return { ...emptyBase, error };
  };
  const instruction = opts.instruction.trim();
  if (!instruction) return rejectBeforeRun("지시 내용이 비어 있습니다.");

  const base = deps.getProject();
  const map = base.maps[opts.mapId];
  if (!map) return rejectBeforeRun("맵을 찾을 수 없습니다.");

  const run = beginOwnedRegionTaskRun(opts.signal);
  const signal = run.controller.signal;
  const ownsRun = (): boolean => activeRegionTaskRun?.id === run.id;
  const isLiveRun = (): boolean => ownsRun() && !signal.aborted;
  let keepPendingStatus = false;
  let statusClosed = false;
  let ownedPending: PendingRegionApply | null = null;
  let regionInlineActions: InlineProposalActions | null = null;
  let ghostPreviewUpdater: ReturnType<typeof createThrottledAgentGhostPreviewUpdater> | null = null;

  const forwardExternalAbort = (): void => run.controller.abort();
  if (opts.signal && !opts.signal.aborted) {
    opts.signal.addEventListener("abort", forwardExternalAbort, { once: true });
  }
  let signalsDetached = false;
  const detachSignals = (): void => {
    if (signalsDetached) return;
    signalsDetached = true;
    opts.signal?.removeEventListener("abort", forwardExternalAbort);
    signal.removeEventListener("abort", handleAbort);
  };
  const dispatchStopped = (): void => {
    if (!ownsRun() || statusClosed) return;
    statusClosed = true;
    dispatchRegionTaskStatus({
      mapId: opts.mapId,
      region: opts.region,
      running: false,
      runId: run.id,
    });
    if (activeRegionTaskRun?.id === run.id) activeRegionTaskRun = null;
  };
  const clearOwnedSurface = (): void => {
    if (!ownsRun()) return;
    if (getInlineProposalActions() === regionInlineActions) setInlineProposalActions(null);
    regionInlineActions = null;
    setAgentGhostPreviewHidden(false);
    clearAgentGhostPreview();
    dispatchStopped();
  };
  function handleAbort(): void {
    if (!ownsRun()) return;
    ghostPreviewUpdater?.cancel();
    const pending = ownedPending;
    ownedPending = null;
    if (pending && !pending.settled) pending.discard();
    clearOwnedSurface();
    detachSignals();
  }
  signal.addEventListener("abort", handleAbort, { once: true });

  if (signal.aborted) {
    detachSignals();
    return { ...emptyBase, error: "사용자가 중단했습니다." };
  }

  dispatchRegionTaskStatus({
    mapId: opts.mapId,
    region: opts.region,
    running: true,
    phase: "running",
    runId: run.id,
  });

  try {
    if (!isLiveRun()) {
      if (!keepPendingStatus) dispatchStopped();
      return { ...emptyBase, error: "사용자가 중단했습니다." };
    }

    // 이전 pending은 이전 run의 abort listener가 먼저 정리한다. 외부 주입 pending이 남은
    // 경우에도 새 초안을 만들기 전에 해소해 전역 슬롯을 하나로 유지한다.
    getPendingRegionApply()?.discard();
    if (!isLiveRun()) {
      if (!keepPendingStatus) dispatchStopped();
      return { ...emptyBase, error: "사용자가 중단했습니다." };
    }

    const working = structuredClone(base);
    const workingMap = working.maps[opts.mapId];
    const workingTileset = workingMap ? working.tilesets[workingMap.tilesetId] : undefined;
    if (workingTileset) ensureRegionPlacementHarness(workingTileset);

    const session = deps.createSession(working, opts.mapId);
    const mode: RegionTaskMode = opts.mode ?? "task";
    const message = mode === "polish"
      ? buildRegionPolishMessage({
          instruction,
          mapName: map.name,
          mapId: opts.mapId,
          region: opts.region,
          surroundings: analyzeRegionSurroundings(base, opts.mapId, opts.region),
          materialHint: formatMaterialLabelHint(workingTileset),
          // 신축 가이드(실내·야외 구조물)는 뺀다 — 다듬기는 정의상 기존 것을 주변에 맞추는 작업이라
          // "새로 지어라" 문장이 섞이면 모델이 두 개의 상반된 지시를 받는다.
          extraGuides: regionIntentGuideLines(
            routeRegionIntent(instruction).filter((category) => category !== "interior" && category !== "structure"),
          ),
        })
      : buildRegionTaskMessage(instruction, map.name, opts.mapId, opts.region, workingTileset);
    const uiEvents: RegionTaskUiEvent[] = [];
    ghostPreviewUpdater = createThrottledAgentGhostPreviewUpdater({
      getBaseProject: () => base,
      getDraftProject: () => session.getProposedProject(),
      isWriteTool: (toolName) => getTool(toolName)?.mode === "write",
      apply: (baseProject, draftProject) => {
        if (isLiveRun()) replaceAgentGhostPreviewFromProjectDiff(baseProject, draftProject);
      },
    });
    const onEvent = (event: SessionEvent): void => {
      if (!isLiveRun()) return;
      pushUiEvent(uiEvents, event);
      opts.onEvent?.(event);
      if (!isLiveRun()) return;
      ghostPreviewUpdater?.handleToolCall(event);
    };

    const attachLog = (result: Omit<RegionTaskResult, "log">, turn?: TurnResult): RegionTaskResult => {
      if (!isLiveRun()) return result;
      const log = buildRegionTaskLogExport({
        mapId: opts.mapId,
        mapName: map.name,
        region: opts.region,
        instruction,
        composedMessage: message,
        result,
        turn,
        uiEvents,
        session,
      });
      if (!isLiveRun()) return result;
      publishRegionTaskLog(log);
      const cfg = loadAiConfig();
      void recordAiActivityFromRegionLog(log, {
        model: cfg.model,
        liteModel: cfg.liteModel,
      }).catch(() => {
        /* ignore persistence failures */
      });
      // 성향 관측 + 증류(채팅 패널과 같은 자리·같은 규칙). 영역 작업에는 변경 카드가 없어
      // 되돌리기 신호가 오지 않으므로, 여기서 잡히는 것은 정정 발화·명시 선언·무사 통과다.
      const signalState = observeTurn({
        instruction,
        toolNames: log.toolCalls.map((call) => call.name),
        changed: log.result.proposedCalls > 0,
      });
      if (shouldDistillPreferences(signalState)) {
        void distillPreferences().catch(() => {
          /* ignore — 증류 실패는 preferenceSignals 가 자체 카운터로 처리한다. */
        });
      }
      return { ...result, log };
    };

    let turn: TurnResult;
    try {
      turn = await session.sendUserMessage(message, onEvent, signal);
    } catch (cause) {
      ghostPreviewUpdater.cancel();
      if (!isLiveRun()) return { ...emptyBase, error: "사용자가 중단했습니다." };
      clearAgentGhostPreview();
      const error = cause instanceof Error ? cause.message : String(cause);
      return attachLog({ ...emptyBase, error });
    }

    if (!isLiveRun()) {
      ghostPreviewUpdater.cancel();
      return {
        ...emptyBase,
        proposedCalls: turn.proposedCalls.length,
        assistantText: turn.assistantText,
        error: "사용자가 중단했습니다.",
      };
    }

    if (turn.stoppedReason === "error" || turn.stoppedReason === "aborted") {
      ghostPreviewUpdater.cancel();
      if (isLiveRun()) clearAgentGhostPreview();
    } else {
      ghostPreviewUpdater.flush();
    }

    if (!isLiveRun() || turn.stoppedReason === "aborted") {
      return {
        ...emptyBase,
        proposedCalls: turn.proposedCalls.length,
        assistantText: turn.assistantText,
        error: turn.error ?? "사용자가 중단했습니다.",
      };
    }

    if (turn.stoppedReason === "error") {
      return attachLog({
        ...emptyBase,
        proposedCalls: turn.proposedCalls.length,
        assistantText: turn.assistantText,
        error: turn.error ?? "AI 처리 오류",
      }, turn);
    }

    const proposed = session.getProposedProject();
    if (!isLiveRun()) return { ...emptyBase, error: "사용자가 중단했습니다." };
    // 영역 경로에서는 soft 재료를 origin:user 로 자동 승격하지 않는다.
    // (영구 합의 스탬프는 채팅 적용 경로가 찍는다 — markSoftVocabApprovalsOnProject)
    // 실내/새 맵: clip은 현재 맵 영역 밖 타일만 되돌리고 다른 맵은 통과(clipToRegion 계약).
    // 다만 셀 0 + 맵 추가만 있으면 예전엔 통째로 폐기했다 → mapsAdded를 적용 조건에 포함한다.
    const clippedResult = clipMapCellsToRegion(base, proposed, opts.mapId, opts.region);
    let clipped = clippedResult.project;
    const clippedCells = clippedResult.clippedCells;
    let changedCells = countInRegionChangedCells(base, clipped, opts.mapId, opts.region);
    let changedEvents = countInRegionChangedEvents(base, clipped, opts.mapId, opts.region);
    let mapsAdded = countAddedMaps(base, clipped);

    if (!hasRegionTaskChanges({ changedCells, changedEvents, mapsAdded })) {
      if (isLiveRun()) clearAgentGhostPreview();
      return attachLog({
        ok: true,
        applied: false,
        changedCells: 0,
        changedEvents: 0,
        mapsAdded: 0,
        clippedCells,
        proposedCalls: turn.proposedCalls.length,
        assistantText: turn.assistantText,
      }, turn);
    }

    // 분리 초안 진단. 게이트가 아니다 — 사실만 모아 검토 UI 에 보이게 하고, 초안은 그대로 둔다.
    // pendingRegionApply 가 적용 진입점마다 다시 부른다(진단값·유령 미리보기 갱신 목적).
    // 다듬기는 경계 바로 밖 1칸의 오토타일 **변형**까지 손댄다(사용자 승인 결정). 그래서 스코프
    // 검사에는 1칸 넓힌 사각형을 준다 — 안 그러면 방금 만든 이음새가 region-scope-violation
    // error 로 잡혀 적용 자체가 차단된다. 고립·도달·일정 검사는 원래 영역 기준을 그대로 쓴다.
    const scopeRegion = mode === "polish"
      ? expandRegion(opts.region, 1, map)
      : opts.region;
    const blendBefore = mode === "polish"
      ? analyzeRegionBlend({ project: base, mapId: opts.mapId, region: opts.region })
      : null;
    let seamCells = 0;
    const reviewCandidate = (project: Project) => {
      let candidate = project;
      if (mode === "polish") {
        const seams = polishRegionSeams(candidate, opts.mapId, opts.region);
        candidate = seams.project;
        seamCells = seams.seamCells;
      }
      const harness = reviewRegionDraft({
        base,
        draft: candidate,
        mapId: opts.mapId,
        region: opts.region,
        scopeRegion,
      });
      const layoutIssues = validateLayoutPlacement(harness.project, {
        mapId: opts.mapId,
        region: { x: opts.region.x, y: opts.region.y, width: opts.region.width, height: opts.region.height },
        instruction,
        toolNames: turn.proposedCalls.map((call) => call.name),
      });
      const structuredLayoutIssues = layoutIssues.map((issue) => ({
        code: issue.code,
        severity: issue.severity === "error" ? "error" as const : "warning" as const,
        message: issue.message,
        ...(issue.mapId ? { mapId: issue.mapId } : {}),
        ...(issue.x === undefined ? {} : { x: issue.x }),
        ...(issue.y === undefined ? {} : { y: issue.y }),
      }));
      // 어울림은 **경고만** 이다 — blockers 에 넣지 않는다. 경계가 조금 어긋난 초안조차 적용을
      // 막으면 사용자가 아무것도 못 하게 된다. 사실을 보여 주고 결정은 사람이 한다.
      // (배치 규칙 error 도 같은 이유로 blockers 에 넣지 않는다 — 영역작업 검증게이트 배제, 2026-08-30.)
      const blend = mode === "polish"
        ? analyzeRegionBlend({ project: harness.project, mapId: opts.mapId, region: opts.region, base })
        : null;
      const blendIssues = blend
        ? [
            ...blend.brokenCrossings.slice(0, 3).map((point) => ({
              code: "region-blend-break",
              severity: "warning" as const,
              message: describeBlendBreak(point),
              mapId: opts.mapId,
              x: point.x,
              y: point.y,
            })),
            ...blend.newlyBlockedEntrances.slice(0, 2).map((point) => ({
              code: "region-blend-entrance-blocked",
              severity: "warning" as const,
              message: describeBlockedEntrance(point),
              mapId: opts.mapId,
              x: point.x,
              y: point.y,
            })),
          ]
        : [];
      return {
        project: harness.project,
        report: {
          ...harness.report,
          issues: [...harness.report.issues, ...structuredLayoutIssues, ...blendIssues],
          metrics: {
            ...harness.report.metrics,
            ...(blend
              ? {
                  blendScore: blend.score,
                  brokenCrossings: blend.brokenCrossings.length,
                  blockedEntrances: blend.newlyBlockedEntrances.length,
                  seamCells,
                  ...(blendBefore ? { blendScoreBefore: blendBefore.score } : {}),
                }
              : {}),
          },
        },
      };
    };
    // 진단이 터져도 AI 작업물은 살린다. 예전에는 이 자리에서 예외가 나면 턴 전체가 오류로 끝나
    // 사용자에게 아무것도 남지 않았다 — 그 실패 모드를 없애는 것이 이 변경의 목적이다.
    let reviewed: { readonly project: Project; readonly report?: HarnessReviewReport } = { project: clipped };
    try {
      reviewed = reviewCandidate(clipped);
    } catch (cause) {
      console.warn("[regionTask] 진단 실행에 실패했지만 초안은 유지합니다:", cause);
    }
    clipped = reviewed.project;
    changedCells = countInRegionChangedCells(base, clipped, opts.mapId, opts.region);
    changedEvents = countInRegionChangedEvents(base, clipped, opts.mapId, opts.region);
    mapsAdded = countAddedMaps(base, clipped);

    // 배치 검증·게임플레이 사전검사는 전부 진단이다. 적용을 막지도, 초안을 고치지도 않는다 —
    // 유령 미리보기에서 본 것이 그대로 적용된다(영역작업 검증게이트 배제, 2026-08-30).

    const gate = opts.gate ?? "approval";
    const label = `${mode === "polish" ? "다듬기" : "영역 작업"}: ${instruction.slice(0, 40)}`;
    // seamCells 는 reviewCandidate 첫 패스가 채운다(적용 시 재검토도 같은 값으로 수렴 — 멱등).
    const seamPart = seamCells > 0 ? { seamCells } : {};
    const completionSummary = formatRegionTaskChangeParts({ changedCells, changedEvents, mapsAdded }).join(" · ") || "영역 변경";
    // 단일 저장 경로. 저장 후 완료 스트립에 알려 사용자가 적용 결과를 바로 확인한다.
    const applyOwnedProject = (project: Project): void => {
      deps.applyProject(project, label, opts.mapId);
      publishAiApplyCompletion({
        mapId: opts.mapId,
        selection: {
          mapId: opts.mapId,
          x: opts.region.x,
          y: opts.region.y,
          width: opts.region.width,
          height: opts.region.height,
        },
        instruction,
        summary: completionSummary,
      });
    };
    if (gate === "immediate") {
      clearAgentGhostPreview();
      // 유질하는 거부 사유는 기준 프로젝트 변경 하나다 — 그러지 않으면 그상이에 한 사용자 편집을 덮어쓴다.
      if (projectApprovalFingerprint(deps.getProject()) !== projectApprovalFingerprint(base)) {
        return attachLog({
          ok: false,
          applied: false,
          changedCells,
          changedEvents,
          mapsAdded,
          clippedCells,
          ...seamPart,
          proposedCalls: turn.proposedCalls.length,
          assistantText: turn.assistantText,
          error: "기준 프로젝트가 변경되었습니다. 새 기준으로 다시 생성하세요.",
          review: reviewed.report,
        }, turn);
      }
      applyOwnedProject(clipped);
      return attachLog({
        ok: true,
        applied: true,
        changedCells,
        changedEvents,
        mapsAdded,
        clippedCells,
        ...seamPart,
        proposedCalls: turn.proposedCalls.length,
        assistantText: turn.assistantText,
        review: reviewed.report,
      }, turn);
    }

    if (!isLiveRun()) return { ...emptyBase, error: "사용자가 중단했습니다." };
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: clipped,
      mapId: opts.mapId,
      region: opts.region,
      changedCells,
      changedEvents,
      instruction,
      report: reviewed.report,
      getCurrentProject: deps.getProject,
      reviewProject: reviewCandidate,
      onApply: applyOwnedProject,
      // no-op: 아직 store에 아무 것도 반영하지 않았으므로(pending은 clipped를 들고만 있음) 되돌릴 것이 없다.
      onDiscard: () => {},
      onSettle: () => {
        ownedPending = null;
        clearOwnedSurface();
        detachSignals();
      },
    });
    ownedPending = pending;
    keepPendingStatus = true;
    regionInlineActions = {
      accept: () => {
        if (isLiveRun() && !pending.settled) pending.apply();
      },
      reject: () => {
        if (ownsRun() && !pending.settled) pending.discard();
      },
      holdOrigin: {
        label: "원본 보기",
        start: () => {
          if (isLiveRun() && !pending.settled) setAgentGhostPreviewHidden(true);
        },
        end: () => {
          if (isLiveRun() && !pending.settled) setAgentGhostPreviewHidden(false);
        },
      },
    };
    if (!isLiveRun()) {
      pending.discard();
      return { ...emptyBase, error: "사용자가 중단했습니다." };
    }
    setInlineProposalActions(regionInlineActions);
    dispatchRegionTaskStatus({
      mapId: opts.mapId,
      region: opts.region,
      running: true,
      phase: "pending",
      runId: run.id,
    });
    const gated = attachLog({
      ok: true,
      applied: false,
      changedCells,
      changedEvents,
      mapsAdded,
      clippedCells,
      ...seamPart,
      proposedCalls: turn.proposedCalls.length,
      // 모델 문장만 그대로 흘리면 "시공했습니다" 가 마지막 말이 되어 이미 반영된 것처럼 읽힌다.
      assistantText: pendingApprovalText(turn.assistantText, { changedCells, changedEvents, mapsAdded }),
      review: reviewed.report,
    }, turn);
    return { ...gated, pending };
  } finally {
    ghostPreviewUpdater?.cancel();
    detachSignals();
    if (!keepPendingStatus) dispatchStopped();
  }
}
