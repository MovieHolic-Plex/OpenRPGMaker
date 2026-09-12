// 로케이션과 이벤트가 겹칠 때의 클릭 소유권 (2026-09-12 적대적 리뷰 후속).
import { describe, expect, it } from "vitest";
import {
  LOCATION_DOUBLE_CLICK_MS,
  LOCATION_OPEN_EVENT_CLICK_COUNT,
  locationClickCount,
  resolveLocationOverlapPointer,
} from "@/editor/locationPointerPriority";

const base = { locationLayerEnabled: true, eventIdAtPoint: "ev_npc", altKey: false, clickCount: 1 };

describe("location vs event pointer priority", () => {
  it("레이어가 꺼져 있으면 판정에 끼어들지 않는다", () => {
    expect(resolveLocationOverlapPointer({ ...base, locationLayerEnabled: false, altKey: true, clickCount: 2 }))
      .toEqual({ kind: "draw" });
  });

  it("겹치는 이벤트가 없으면 언제나 그리기다", () => {
    expect(resolveLocationOverlapPointer({ ...base, eventIdAtPoint: null, altKey: true, clickCount: 3 }))
      .toEqual({ kind: "draw" });
  });

  it("한 번 클릭은 그리기다 — 면을 칠하려는 사람이 NPC 때문에 막히지 않는다", () => {
    expect(resolveLocationOverlapPointer(base)).toEqual({ kind: "draw" });
  });

  it("Alt+클릭은 이벤트를 연다", () => {
    expect(resolveLocationOverlapPointer({ ...base, altKey: true })).toEqual({ kind: "openEvent", eventId: "ev_npc" });
  });

  it("더블클릭은 이벤트를 연다", () => {
    expect(resolveLocationOverlapPointer({ ...base, clickCount: LOCATION_OPEN_EVENT_CLICK_COUNT }))
      .toEqual({ kind: "openEvent", eventId: "ev_npc" });
  });
});

describe("same-tile click counting", () => {
  const trace = (x: number, y: number, at: number) => ({ mapId: "map_a", x, y, at });

  it("첫 클릭은 1이다", () => {
    expect(locationClickCount(null, trace(4, 5, 1000))).toBe(1);
  });

  it("같은 칸을 창 안에 두 번 누르면 2다", () => {
    expect(locationClickCount(trace(4, 5, 1000), trace(4, 5, 1000 + LOCATION_DOUBLE_CLICK_MS))).toBe(2);
  });

  it("다른 칸이면 다시 1이다", () => {
    expect(locationClickCount(trace(4, 5, 1000), trace(5, 5, 1100))).toBe(1);
  });

  it("창을 넘기면 1로 돌아간다", () => {
    expect(locationClickCount(trace(4, 5, 1000), trace(4, 5, 1001 + LOCATION_DOUBLE_CLICK_MS))).toBe(1);
  });

  it("시계가 뒤로 가도 더블클릭으로 오독하지 않는다", () => {
    expect(locationClickCount(trace(4, 5, 5000), trace(4, 5, 1000))).toBe(1);
  });

  it("다른 맵의 같은 좌표는 다른 클릭이다 — loc1 과 같은 함정", () => {
    expect(locationClickCount({ mapId: "map_a", x: 4, y: 5, at: 1000 }, { mapId: "map_b", x: 4, y: 5, at: 1050 }))
      .toBe(1);
  });
});
