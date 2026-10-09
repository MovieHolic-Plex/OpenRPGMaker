// 영역 AI 작업 진행 상태 브로드캐스트 — EditScene 배지(스펙 §3 2-C)가 구독한다.
import type { RegionRect } from "./clipToRegion";

export const REGION_TASK_STATUS_EVENT = "oprn:region-task-status";

export interface RegionTaskStatusDetail {
  readonly mapId: string;
  readonly region: RegionRect;
  readonly running: boolean;
  /** 같은 mapId의 새 실행이 이전 running:false를 무시하도록 하는 실행 소유권 번호. */
  readonly runId?: number;
  /** running=true일 때 세부 단계 — 생략 시 "running"으로 간주. */
  readonly phase?: "running" | "pending";
}

export function dispatchRegionTaskStatus(detail: RegionTaskStatusDetail): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  if (typeof CustomEvent === "function") {
    window.dispatchEvent(new CustomEvent<RegionTaskStatusDetail>(REGION_TASK_STATUS_EVENT, { detail }));
    return;
  }
  const event = new Event(REGION_TASK_STATUS_EVENT);
  Object.defineProperty(event, "detail", { configurable: true, value: detail });
  window.dispatchEvent(event);
}

export function regionTaskStatusDetail(event: Event): RegionTaskStatusDetail | null {
  const detail = (event as CustomEvent<unknown>).detail;
  if (typeof detail !== "object" || detail === null) return null;
  const candidate = detail as Partial<RegionTaskStatusDetail>;
  const region = candidate.region as Partial<RegionRect> | undefined;
  if (
    typeof candidate.mapId !== "string" ||
    typeof candidate.running !== "boolean" ||
    !region ||
    !Number.isInteger(region.x) || !Number.isInteger(region.y) ||
    !Number.isInteger(region.width) || !Number.isInteger(region.height)
  ) return null;
  const phase = candidate.phase === "running" || candidate.phase === "pending" ? candidate.phase : undefined;
  const runId = typeof candidate.runId === "number" && Number.isInteger(candidate.runId) ? candidate.runId : undefined;
  return {
    mapId: candidate.mapId,
    region: region as RegionRect,
    running: candidate.running,
    ...(runId !== undefined ? { runId } : {}),
    ...(phase ? { phase } : {}),
  };
}
