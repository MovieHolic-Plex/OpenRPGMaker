// Single editor-memory approval gate for region drafts. Full, partial, inline and headless apply
// entry points all pass the stale-base check before one store-history mutation.
//
// 진단(reviewRegionDraft)은 적용을 막지 않는다 — 영역작업(AI) 뒤의 검증게이트는 배제됐다(2026-08-30).
// 남은 거부 사유는 단 둘이다: 기준 프로젝트가 바뀌었거나(다른 편집을 덮어쓰게 된다),
// 상태 전이 오류(이미 처리됨·적용 중)다.
import { replaceAgentGhostPreviewFromProjectDiff } from "@/editor/agentGhostPreview";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import {
  listRoomDrafts,
  rerollRoomDraft,
  setRoomDraftLock,
  type RoomDraftSummary,
  type RoomRerollResult,
} from "@/editor/roomHarness/facade";
import type { MapId, Project } from "@/project/types";
import type { RegionRect } from "./clipToRegion";
import {
  projectApprovalFingerprint,
  reviewRegionDraft,
  type HarnessReviewReport,
  type HarnessReviewResult,
} from "./harnessReview";

export interface PendingApplyOutcome {
  readonly ok: boolean;
  readonly applied: boolean;
  readonly error?: string;
}

export type NpcScheduleResolution = "enable-time" | "keep-fixed";

export interface PendingRegionApplyInput {
  readonly baseProject: Project;
  readonly clippedProject: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly changedCells: number;
  readonly changedEvents: number;
  readonly instruction: string;
  readonly report?: HarnessReviewReport;
  /** Current authored state; stale-base comparison is mandatory at click time. */
  readonly getCurrentProject: () => Project;
  /** Optional caller-specific diagnostics; the default is reviewRegionDraft. Advisory only. */
  readonly reviewProject?: (project: Project) => HarnessReviewResult;
  /** Exactly one store-history apply. */
  readonly onApply: (project: Project) => void;
  readonly onDiscard: () => void;
  readonly onSettle: () => void;
}

export interface PendingRegionApply {
  readonly baseProject: Project;
  readonly clippedProject: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly changedCells: number;
  readonly changedEvents: number;
  readonly instruction: string;
  readonly settled: boolean;
  readonly report?: HarnessReviewReport;
  readonly lastApplyError?: string;
  readonly roomDrafts: readonly RoomDraftSummary[];
  apply(): PendingApplyOutcome;
  applyProject(project: Project): PendingApplyOutcome;
  discard(): void;
  resolveNpcSchedules(resolution: NpcScheduleResolution): HarnessReviewReport | undefined;
  setRoomLocked(sessionId: string, roomId: string, locked: boolean): void;
  rerollRoom(sessionId: string, roomId: string, seed: number): RoomRerollResult;
}

let current: PendingRegionApply | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getPendingRegionApply(): PendingRegionApply | null {
  return current;
}

export function subscribePendingRegionApply(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setPendingRegionApply(input: PendingRegionApplyInput): PendingRegionApply {
  current?.discard();
  let settled = false;
  let applying = false;
  let candidate = input.clippedProject;
  let report = input.report;
  let lastApplyError: string | undefined;
  const baseFingerprint = projectApprovalFingerprint(input.baseProject);
  const reviewProject = input.reviewProject ?? ((project: Project) => reviewRegionDraft({
    base: input.baseProject,
    draft: project,
    mapId: input.mapId,
    region: input.region,
  }));

  const finishSettlement = (): void => {
    settled = true;
    try {
      input.onSettle();
    } finally {
      if (current === pending) current = null;
      emit();
    }
  };

  const discard = (): void => {
    if (settled || applying) return;
    applying = true;
    try {
      input.onDiscard();
      applying = false;
      finishSettlement();
    } catch (cause) {
      applying = false;
      lastApplyError = cause instanceof Error ? cause.message : String(cause);
      emit();
      throw cause;
    }
  };

  const reviewCandidate = (): void => {
    const reviewed = reviewProject(candidate);
    candidate = reviewed.project;
    report = reviewed.report;
    replaceAgentGhostPreviewFromProjectDiff(input.baseProject, candidate);
  };

  const applyCandidate = (requested: Project): PendingApplyOutcome => {
    if (settled) return { ok: false, applied: false, error: "이미 처리된 제안입니다." };
    if (applying) return { ok: false, applied: false, error: "제안을 처리 중입니다." };
    const live = input.getCurrentProject();
    if (projectApprovalFingerprint(live) !== baseFingerprint) {
      lastApplyError = "기준 프로젝트가 변경되었습니다. 새 기준으로 다시 생성하세요.";
      emit();
      return { ok: false, applied: false, error: lastApplyError };
    }
    candidate = requested;
    // 진단은 보고서만 갱실한다. 진단기가 통으로 티지도 적용은 계속한다 — 진단 실패가
    // AI 작업물을 볼모하는 것이지 사용자 작업물을 볼모하는 것이 아니다.
    try {
      reviewCandidate();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      console.warn("[regionTask] 진단 실행에 실패했지만 적용은 진행합니다:", detail);
    }

    applying = true;
    lastApplyError = undefined;
    try {
      input.onApply(candidate);
    } catch (cause) {
      applying = false;
      const detail = cause instanceof Error ? cause.message : String(cause);
      lastApplyError = `프로젝트 적용에 실패했습니다: ${detail}`;
      emit();
      return { ok: false, applied: false, error: lastApplyError };
    }
    applying = false;
    finishSettlement();
    return { ok: true, applied: true };
  };

  const pending: PendingRegionApply = {
    baseProject: input.baseProject,
    get clippedProject() { return candidate; },
    mapId: input.mapId,
    region: input.region,
    changedCells: input.changedCells,
    changedEvents: input.changedEvents,
    instruction: input.instruction,
    get settled() { return settled; },
    get report() { return report; },
    get lastApplyError() { return lastApplyError; },
    get roomDrafts() { return listRoomDrafts(candidate); },
    apply: () => applyCandidate(candidate),
    applyProject: (project) => applyCandidate(project),
    discard,
    resolveNpcSchedules(resolution): HarnessReviewReport | undefined {
      if (settled) return report;
      candidate = cloneDetachedDraft(candidate);
      if (resolution === "enable-time") {
        candidate.system.timeSystem = {
          ...(candidate.system.timeSystem ?? {}),
          enabled: true,
        };
      } else {
        for (const [mapId, map] of Object.entries(candidate.maps)) {
          const baseEvents = new Map((input.baseProject.maps[mapId]?.events ?? []).map((event) => [event.id, event]));
          map.events = map.events.map((event) => {
            const baseSchedule = baseEvents.get(event.id)?.schedule;
            if (JSON.stringify(event.schedule ?? null) === JSON.stringify(baseSchedule ?? null)) return event;
            const next = structuredClone(event);
            if (baseSchedule) next.schedule = structuredClone(baseSchedule);
            else delete next.schedule;
            return next;
          });
        }
      }
      reviewCandidate();
      lastApplyError = undefined;
      emit();
      return report;
    },
    setRoomLocked(sessionId, roomId, locked): void {
      setRoomDraftLock(candidate, sessionId, roomId, locked);
      emit();
    },
    rerollRoom(sessionId, roomId, seed): RoomRerollResult {
      const result = rerollRoomDraft(candidate, sessionId, roomId, seed);
      reviewCandidate();
      lastApplyError = undefined;
      emit();
      return result;
    },
  };
  current = pending;
  replaceAgentGhostPreviewFromProjectDiff(input.baseProject, candidate);
  publishHeadlessHook();
  emit();
  return pending;
}

export function __clearPendingRegionApplyForTest(): void {
  current = null;
  listeners.clear();
}

function publishHeadlessHook(): void {
  if (typeof window === "undefined") return;
  window.__oprnRegionTaskPending = {
    get: () => current
      ? {
          mapId: current.mapId,
          region: current.region,
          changedCells: current.changedCells,
          changedEvents: current.changedEvents,
          settled: current.settled,
          metrics: current.report?.metrics,
        }
      : null,
    apply: () => current?.apply(),
    discard: () => current?.discard(),
  };
}
