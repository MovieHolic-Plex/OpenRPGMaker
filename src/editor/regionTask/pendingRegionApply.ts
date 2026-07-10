// 영역 작업 승인 게이트의 pending 보관소 — 전역 단일. 새 작업이 기존 pending을
// 자동 discard 하고, apply/discard는 1회만 유효하다(스펙 §2-A).
import type { MapId, Project } from "@/project/types";
import type { RegionRect } from "./clipToRegion";

export interface PendingRegionApplyInput {
  readonly baseProject: Project;
  readonly clippedProject: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly changedCells: number;
  readonly changedEvents: number;
  readonly instruction: string;
  /** store 반영(undo 스냅샷 포함) — runRegionTask가 주입. */
  readonly onApply: () => void;
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
  apply(): void;
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
    action();
    input.onSettle();
    if (current === pending) current = null;
    emit();
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
    apply: () => settle(input.onApply),
    discard: () => settle(input.onDiscard),
  };
  current = pending;
  publishHeadlessHook();
  emit();
  return pending;
}

/** 테스트 전용 — 리스너/pending 초기화. */
export function __clearPendingRegionApplyForTest(): void {
  current = null;
  listeners.clear();
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
