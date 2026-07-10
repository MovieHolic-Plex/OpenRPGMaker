import { describe, expect, it, beforeEach } from "vitest";
import {
  getPendingRegionApply,
  setPendingRegionApply,
  subscribePendingRegionApply,
  __clearPendingRegionApplyForTest,
  type PendingRegionApplyInput,
} from "@/editor/regionTask/pendingRegionApply";
import type { Project } from "@/project/types";

const fakeProject = { maps: {} } as unknown as Project;

function input(overrides: Partial<PendingRegionApplyInput> = {}): PendingRegionApplyInput {
  return {
    baseProject: fakeProject,
    clippedProject: fakeProject,
    mapId: "map_1",
    region: { x: 1, y: 2, width: 3, height: 4 },
    changedCells: 5,
    changedEvents: 1,
    instruction: "테스트",
    onApply: () => {},
    onDiscard: () => {},
    onSettle: () => {},
    ...overrides,
  };
}

describe("pendingRegionApply", () => {
  beforeEach(() => __clearPendingRegionApplyForTest());

  it("set 후 get으로 조회되고 apply는 onApply→onSettle 순서로 1회만 부른다", () => {
    const calls: string[] = [];
    const pending = setPendingRegionApply(input({
      onApply: () => calls.push("apply"),
      onSettle: () => calls.push("settle"),
    }));
    expect(getPendingRegionApply()).toBe(pending);
    expect(pending.settled).toBe(false);
    pending.apply();
    pending.apply(); // 두 번째는 no-op
    expect(calls).toEqual(["apply", "settle"]);
    expect(pending.settled).toBe(true);
    expect(getPendingRegionApply()).toBeNull();
  });

  it("discard는 onDiscard→onSettle을 부르고 이후 apply는 no-op", () => {
    const calls: string[] = [];
    const pending = setPendingRegionApply(input({
      onApply: () => calls.push("apply"),
      onDiscard: () => calls.push("discard"),
      onSettle: () => calls.push("settle"),
    }));
    pending.discard();
    pending.apply();
    expect(calls).toEqual(["discard", "settle"]);
    expect(getPendingRegionApply()).toBeNull();
  });

  it("새 pending 설정 시 기존 미해소 pending을 자동 discard 한다", () => {
    const calls: string[] = [];
    setPendingRegionApply(input({ onDiscard: () => calls.push("old-discard") }));
    const next = setPendingRegionApply(input({ instruction: "새 작업" }));
    expect(calls).toEqual(["old-discard"]);
    expect(getPendingRegionApply()).toBe(next);
  });

  it("구독자는 set/settle 때 호출된다", () => {
    let notified = 0;
    const unsubscribe = subscribePendingRegionApply(() => { notified += 1; });
    const pending = setPendingRegionApply(input());
    pending.discard();
    unsubscribe();
    setPendingRegionApply(input());
    expect(notified).toBe(2); // set 1회 + discard(settle) 1회
  });
});
