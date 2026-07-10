// 영역 AI 작업 진행 상태 브로드캐스트 — EditScene 배지(스펙 §3 2-C)가 구독한다.
import type { RegionRect } from "./clipToRegion";

export const REGION_TASK_STATUS_EVENT = "rpgzzu:region-task-status";

export interface RegionTaskStatusDetail {
  readonly mapId: string;
  readonly region: RegionRect;
  readonly running: boolean;
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
  return { mapId: candidate.mapId, region: region as RegionRect, running: candidate.running };
}
