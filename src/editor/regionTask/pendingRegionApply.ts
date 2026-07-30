// 영역 작업 승인 게이트의 pending 보관소 — 전역 단일. 새 작업이 기존 pending을
// 자동 discard 하고, apply/discard는 1회만 유효하다(스펙 §2-A).
import type { MapId, Project } from "@/project/types";
import type { RegionRect } from "./clipToRegion";

export interface PendingRegionApplyOverride {
  /** 부분 적용처럼 기본 clippedProject 대신 반영할 프로젝트. */
  readonly project?: Project;
  readonly label?: string;
  /** 테스트/호스트가 쓰는 저장 경로. 생략하면 runRegionTask 기본 applier를 쓴다. */
  readonly applier?: (project: Project, label: string, mapId: MapId) => void;
}

export interface PendingRegionApplyInput {
  readonly baseProject: Project;
  readonly clippedProject: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly changedCells: number;
  readonly changedEvents: number;
  readonly instruction: string;
  /** store 반영(undo 스냅샷 포함) — runRegionTask가 주입. */
  readonly onApply: (override?: PendingRegionApplyOverride) => void;
  readonly onDiscard: () => void;
  /** apply/discard 공통 후처리(고스트 정리 등). */
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
  apply(override?: PendingRegionApplyOverride): void;
  discard(): void;
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
  current?.discard(); // 미해소 pending은 새 작업이 대체(전역 단일)
  let settled = false;
  const settle = (action: () => void): void => {
    if (settled) return;
    settled = true;
    try {
      action();
    } finally {
      input.onSettle();
      if (current === pending) current = null;
      emit();
    }
  };
  const pending: PendingRegionApply = {
    baseProject: input.baseProject,
    clippedProject: input.clippedProject,
    mapId: input.mapId,
    region: input.region,
    changedCells: input.changedCells,
    changedEvents: input.changedEvents,
    instruction: input.instruction,
    get settled() {
      return settled;
    },
    apply: (override) => settle(() => input.onApply(override)),
    discard: () => settle(input.onDiscard),
  };
  current = pending;
  publishHeadlessHook();
  emit();
  return pending;
}

/** 테스트 전용 — pending을 정상 settle해 실행 소유 surface까지 정리한 뒤 리스너를 초기화. */
export function __clearPendingRegionApplyForTest(): void {
  const pending = current;
  current = null;
  listeners.clear();
  if (pending && !pending.settled) pending.discard();
}

// 헤드리스 훅(E2E/디버깅): window.__rpgzzuRegionTaskPending
function publishHeadlessHook(): void {
  if (typeof window === "undefined") return;
  window.__rpgzzuRegionTaskPending = {
    get: () =>
      current
        ? {
            mapId: current.mapId,
            region: current.region,
            changedCells: current.changedCells,
            changedEvents: current.changedEvents,
            settled: current.settled,
          }
        : null,
    apply: () => current?.apply(),
    discard: () => current?.discard(),
  };
}
