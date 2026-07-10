import { describe, expect, it } from "vitest";
import {
  dispatchRegionTaskStatus,
  REGION_TASK_STATUS_EVENT,
  regionTaskStatusDetail,
  type RegionTaskStatusDetail,
} from "@/editor/regionTask/regionTaskStatus";

// window 스텁 — 이 파일은 fakeDom 없이 이벤트 버스만 필요하므로 최소 구현.
function installFakeWindow(): () => void {
  const listeners = new Map<string, EventListener[]>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener));
      },
      dispatchEvent: (event: Event) => {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
        return true;
      },
    },
  });
  return () => Reflect.deleteProperty(globalThis, "window");
}

describe("regionTaskStatusDetail", () => {
  it("유효한 detail을 통과시키고 불량 payload는 null", () => {
    const good = { detail: { mapId: "m1", region: { x: 1, y: 2, width: 3, height: 4 }, running: true } } as unknown as Event;
    expect(regionTaskStatusDetail(good)).toEqual({ mapId: "m1", region: { x: 1, y: 2, width: 3, height: 4 }, running: true });
    const bad = { detail: { mapId: 5 } } as unknown as Event;
    expect(regionTaskStatusDetail(bad)).toBeNull();
    expect(regionTaskStatusDetail({} as Event)).toBeNull();
  });

  it("phase 필드를 그대로 전달하고, 없으면 undefined", () => {
    const restoreWindow = installFakeWindow();
    try {
      const events: (RegionTaskStatusDetail | null)[] = [];
      const listener = (event: Event): void => { events.push(regionTaskStatusDetail(event)); };
      window.addEventListener(REGION_TASK_STATUS_EVENT, listener);
      dispatchRegionTaskStatus({ mapId: "m1", region: { x: 0, y: 0, width: 1, height: 1 }, running: true, phase: "pending" });
      dispatchRegionTaskStatus({ mapId: "m1", region: { x: 0, y: 0, width: 1, height: 1 }, running: true });
      window.removeEventListener(REGION_TASK_STATUS_EVENT, listener);
      expect(events[0]?.phase).toBe("pending");
      expect(events[1]?.phase).toBeUndefined();
    } finally {
      restoreWindow();
    }
  });
});
