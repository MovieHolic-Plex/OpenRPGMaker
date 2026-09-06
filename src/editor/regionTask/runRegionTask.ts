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
  type SessionTurnOptions,
} from "@/ai/assistantSession";
import { recordAiActivityFromRegionLog } from "@/ai/activityLog";
import { conversationScopeKey } from "@/ai/conversationStore";
import { distillPreferences } from "@/ai/preferenceDistiller";
import { observeTurn, shouldDistillPreferences } from "@/ai/preferenceSignals";
import { REGION_SURFACE_MAX_TOOL_CALLS, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { loadAiConfig } from "@/ai/llmClient";
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
import { editorState } from "@/editor/editorState";
import { clearSelection } from "@/editor/mapClipboard";
import { getInlineProposalActions, setInlineProposalActions, type InlineProposalActions } from "@/editor/proposalInlineApproval";
import {
  getMapEditHistoryMarker,
  recordProjectSnapshot,
  truncateMapEditHistoryFromMarker,
} from "@/editor/mapEditHistory";
import { getEditorMapViewport } from "@/editor/editorMapViewport";
import { ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { getTool } from "@/editor/tools";
import { assertHouseProtection, captureHouseProtection, newlyBuiltHouseSnapshots } from "@/editor/tools/houseProtection";
import { store } from "@/project/store";
import { extractVocabSoftConfirm } from "@/project/tileVocabulary";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { MapId, Project, TilesetDef } from "@/project/types";
import { validateLayoutPlacement } from "@/project/lint/layoutPlacementValidate";
import { clipMapCellsToRegion, inRegion, type RegionRect } from "./clipToRegion";
import { analyzeRegionBlend, describeBlendBreak, describeBlockedEntrance, expandRegion, polishRegionSeams } from "./regionBlend";
import { buildRegionPolishMessage } from "./regionPolish";
import { analyzeRegionSurroundings } from "./regionSurroundings";
// 재료 라벨 힌트(현재 맵 타일셋의 사실)의 정본은 turnGuide 다. 기존 수입자(test/materialPolicy.test.ts,
// regionPolish)를 깨지 않도록 여기서 재수출한다. 도구 규칙 가이드는 없다 — 규칙은 툴 설명에 있다.
import { formatMaterialLabelHint } from "@/ai/turnGuide";
import { createLlmIntentDeclarer } from "@/ai/intentDeclarationClient";
import { createProjectWikiCoordinator } from "@/editor/projectWikiCoordinator";

export { formatMaterialLabelHint };
import { getPendingRegionApply, setPendingRegionApply, type PendingRegionApply } from "./pendingRegionApply";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { projectApprovalFingerprint, reviewRegionDraft, type HarnessReviewReport } from "./harnessReview";
import { dispatchRegionTaskStatus } from "./regionTaskStatus";

// 상한 값 자체는 표면 정책(assistantEndpoint)이 소유한다. 이 이름은 진행 표시("도구 3/2000")를
// 그리는 regionTaskModal 이 쓰고 있어 그대로 재노출한다.
export const REGION_TASK_MAX_TOOL_CALLS = REGION_SURFACE_MAX_TOOL_CALLS;

export interface RegionTaskSessionLike {
  sendUserMessage(
    text: string,
    onEvent?: (event: SessionEvent) => void,
    signal?: AbortSignal,
    opts?: SessionTurnOptions,
  ): Promise<TurnResult>;
  getProposedProject(): Project;
  setReviewDraftTransform?(transform: (project: Project) => Project): void;
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
    readonly reason?: string;
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

/**
 * 클립이 제안을 전부 버린 턴의 조수 문장 앞에 사실을 박는다 — pendingApprovalText 와 같은 원칙.
 * 모델은 툴 요약(「25칸 채움」)만 보고 「채웠습니다」라고 말하지만, 하드 클립 뒤 맵은 그대로다.
 */
export function clippedNoticeText(
  assistantText: string,
  result: Pick<RegionTaskResult, "applied" | "changedCells" | "changedEvents" | "mapsAdded" | "clippedCells">,
): string {
  if (result.applied || hasRegionTaskChanges(result) || result.clippedCells <= 0) return assistantText;
  const notice = `맵은 바뀌지 않았습니다 — 제안 ${result.clippedCells}칸이 모두 선택 영역 밖이라 차단했습니다. 영역 밖을 편집하려면 선택 칩의 ×로 해제하거나 그 자리를 다시 선택하세요.`;
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
    if (hasRegionTaskChanges(result)) {
      return `반영하지 않았습니다 — ${formatRegionTaskChangeParts(result).join(" · ")} 변경안을 버렸습니다.`;
    }
    // 0칸의 이유가 클립이면 그 사실을 말한다 — 2026-09-03 실측: 툴은 「25/25칸 채움」, 맵은 0칸, 조수는 「채웠습니다」.
    return result.clippedCells > 0
      ? `이 영역에서 바뀐 것이 없습니다 — 제안 ${result.clippedCells}칸이 모두 영역 밖이라 차단했습니다. 영역 밖을 편집하려면 선택 칩의 ×로 해제하거나 그 자리를 다시 선택하세요.`
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
  // Review can polish the candidate after tool guards. Enforce the live house baseline
  // outside advisory diagnostics, before any history or store mutation (full and partial apply).
  assertHouseProtection(captureHouseProtection(store.getCurrent()), project, []);
  // Region tasks may add maps, events, tilesets, or system data. Commit the project and its
  // single undo entry as one failure-atomic operation so a throwing store listener cannot
  // strand authored state or leave an orphan history snapshot.
  const before = structuredClone(store.getCurrent());
  const appliedProject = { ...project };
  if (before.world) appliedProject.world = structuredClone(before.world);
  else delete appliedProject.world;
  const historyMarker = getMapEditHistoryMarker();
  let replaceStarted = false;
  try {
    recordProjectSnapshot(label, mapId, { kind: "project" });
    replaceStarted = true;
    // 행위 로그에 AI 소행으로 남긴다. 라벨/origin 이 없으면 영역 작업 전량이
    // `(라벨 없음)` + `origin: "human"` 으로 떨어져 사람 손편집과 구분되지 않는다.
    store.replace(appliedProject, { change: { label: `AI 영역 작업: ${label}`, origin: "ai" } });
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
  // 드래그 선택은 이 적용의 **대상 범위**였다. 적용이 끝난 뒤에도 그 사각형이 남아 있으면
  // 「지금 무엇을 고를지」가 아니라 「방금 무엇이 바뀌었는지」를 가리키는 낡은 표시가 되고,
  // 그 위에 선택 액션 칩(복사·지우기·구조물로 저장)이 계속 떠 있어서 다음 클릭이 새로 만들어진
  // 내용에 대한 지시로 오인된다. (실측 신고: 「영역 작업으로 AI 작업을 한 뒤에도 드래그한 것이
  // 그대로 남아 있다」) 적용된 맵의 선택만 푼다 — 다른 맵에서 고른 영역은 이 적용과 무관하다.
  if (editorState.get().selection?.mapId === mapId) clearSelection();
}

const defaultDeps: RegionTaskDeps = {
  getProject: () => store.getCurrent(),
  applyProject: applyRegionProjectWithHistory,
  createSession: (project, mapId) => {
    return new AssistantSession(project, {
      config: resolveSurfaceAiConfig("region"),
      reviewConfig: resolveSurfaceAiConfig("chat"),
      renderImages: renderToolImages,
      prepareProjectWiki: createProjectWikiCoordinator({ getConfig: () => resolveSurfaceAiConfig("region") }).prepare,
      declareIntent: createLlmIntentDeclarer(),
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
        ...(call.reason ? { reason: call.reason } : {}),
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

// aiChatPanel.contextFooter와 동일한 [컨텍스트] 라인 포맷(buildSpec.ts의 정규식이 파싱).
// 이 라인이 있어야 세션이 선택 영역을 이번 턴의 암묵적 명세로 인식한다.
// 사용자 발화 + 사실(현재 맵·선택 영역·재료 라벨 예)만 싣는다. 도구 규칙은 툴 설명에, 영역 경계는 세션이
// 스코프 인자(sendUserMessage opts.scope)로 받아 의도 선언에 맞춰 붙인다.
export function buildRegionTaskMessage(
  instruction: string,
  mapName: string,
  mapId: MapId,
  region: RegionRect,
  tileset?: TilesetDef,
): string {
  const material = tileset ? ` · ${formatMaterialLabelHint(tileset).replace(/^- /, "")}` : "";
  const footer = `[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (${region.x},${region.y}) ${region.width}×${region.height}${material}`;
  return `${instruction.trim()}\n\n${footer}`;
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
    let preparedForReview = false;
    let preparedClippedCells = 0;
    let preparedSeamCells = 0;
    session.setReviewDraftTransform?.(draft => {
      const protection = captureHouseProtection(base);
      const completed = newlyBuiltHouseSnapshots(draft, protection);
      const clipped = clipMapCellsToRegion(base, draft, opts.mapId, opts.region);
      preparedClippedCells += clipped.clippedCells;
      const polished = mode === "polish" ? polishRegionSeams(clipped.project, opts.mapId, opts.region)
        : { project: clipped.project, seamCells: 0 };
      preparedSeamCells = Math.max(preparedSeamCells, polished.seamCells);
      assertHouseProtection(protection, polished.project, completed);
      preparedForReview = true;
      return polished.project;
    });
    const message = mode === "polish"
      ? buildRegionPolishMessage({
          instruction,
          mapName: map.name,
          mapId: opts.mapId,
          region: opts.region,
          surroundings: analyzeRegionSurroundings(base, opts.mapId, opts.region),
          materialHint: formatMaterialLabelHint(workingTileset),
          // 카테고리 가이드는 없다 — 도구 사용 규칙은 툴 설명에 있다.
          extraGuides: [],
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
      turn = await session.sendUserMessage(message, onEvent, signal, {
        instruction,
        scope: { mapId: opts.mapId, region: opts.region },
      });
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

    if (turn.stoppedReason === "error" || (turn.proposedCalls.length > 0
      && (turn.stoppedReason !== "final" || turn.review?.status !== "approved"))) {
      return attachLog({
        ...emptyBase,
        proposedCalls: turn.proposedCalls.length,
        assistantText: turn.assistantText,
        error: turn.error ?? "독립 검수가 승인되지 않아 초안을 적용하지 않았습니다.",
      }, turn);
    }

    const proposed = session.getProposedProject();
    if (!isLiveRun()) return { ...emptyBase, error: "사용자가 중단했습니다." };
    // Seal completed new houses before clipping/review can damage them. Never refresh from
    // a partial or polished candidate: ownership and the full north ridge must survive together.
    const completedHouses = newlyBuiltHouseSnapshots(proposed, captureHouseProtection(base));
    // 영역 경로에서는 soft 재료를 origin:user 로 자동 승격하지 않는다.
    // (영구 합의 스탬프는 채팅 적용 경로가 찍는다 — markSoftVocabApprovalsOnProject)
    // 실내/새 맵: clip은 현재 맵 영역 밖 타일만 되돌리고 다른 맵은 통과(clipToRegion 계약).
    // 다만 셀 0 + 맵 추가만 있으면 예전엔 통째로 폐기했다 → mapsAdded를 적용 조건에 포함한다.
    const clippedResult = preparedForReview ? { project: proposed, clippedCells: preparedClippedCells }
      : clipMapCellsToRegion(base, proposed, opts.mapId, opts.region);
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
    if (turn.stoppedReason !== "final" || turn.review?.status !== "approved") {
      return attachLog({ ...emptyBase, assistantText: turn.assistantText,
        error: "독립 검수가 승인되지 않아 초안을 적용하지 않았습니다." }, turn);
    }
    const scopeRegion = mode === "polish"
      ? expandRegion(opts.region, 1, map)
      : opts.region;
    const blendBefore = mode === "polish"
      ? analyzeRegionBlend({ project: base, mapId: opts.mapId, region: opts.region })
      : null;
    let seamCells = preparedSeamCells;
    const reviewCandidate = (project: Project) => {
      let candidate = project;
      if (mode === "polish") {
        const seams = polishRegionSeams(candidate, opts.mapId, opts.region);
        candidate = seams.project;
        seamCells = Math.max(seamCells, seams.seamCells);
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
    if (projectApprovalFingerprint(clipped) !== projectApprovalFingerprint(proposed)) {
      return attachLog({ ...emptyBase, proposedCalls: turn.proposedCalls.length,
        assistantText: turn.assistantText, error: "영역 자르기/다듬기로 검수한 초안이 바뀌어 적용하지 않았습니다. 영역 안에서 다시 요청해 주세요." }, turn);
    }
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
      // Full, partial (including re-polish), and immediate apply converge here after diagnostics.
      // This invariant is not advisory and must fail before any history/store mutation.
      if (signal?.aborted || turn.review?.status !== "approved"
        || projectApprovalFingerprint(project) !== projectApprovalFingerprint(proposed)) {
        throw new Error("독립 검수 이후 초안이 바뀌었거나 중단되어 적용하지 않았습니다.");
      }
      assertHouseProtection(captureHouseProtection(deps.getProject()), project, completedHouses);
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
