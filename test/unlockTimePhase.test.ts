// 「밤에만 열리는 길」: lock_door·create_time_gate 의 unlockWhen 이 시간대 조건을 받는다(사냥꾼 계약 데모에서 손으로 짠 낮 막이를 대신한다).
import { describe, expect, it } from "vitest";
import { unlockCondition } from "@/editor/tools/timeGateTools";
import { createBlankProject } from "@/project/defaults";

describe("unlockWhen timePhase", () => {
  it("turns {timePhase} into a timePhase page condition", () => {
    const project = createBlankProject();
    const parsed = unlockCondition(project, { timePhase: "night" });
    expect(parsed.condition).toEqual({ kind: "timePhase", phase: "night" });
  });
  it("warns when the time system is off", () => {
    const project = createBlankProject();
    project.system.timeSystem = undefined;
    expect(unlockCondition(project, { timePhase: "night" }).note).toMatch(/configure_time_system/u);
    project.system.timeSystem = { enabled: true };
    expect(unlockCondition(project, { timePhase: "night" }).note).toBeUndefined();
  });
  it("rejects unknown phases and mixing with a switch", () => {
    const project = createBlankProject();
    expect(() => unlockCondition(project, { timePhase: "midnight" })).toThrow(/timePhase/u);
    expect(() => unlockCondition(project, { timePhase: "night", switchId: "sw_x" })).toThrow(/정확히 하나/u);
  });
});
