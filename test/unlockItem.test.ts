// 「옥상 열쇠가 있어야 열리는 철문」: lock_door·create_time_gate 의 unlockWhen 이 아이템 조건을 받는다(「이상 없음」 옥상 철문을 손으로 짜던 것).
import { describe, expect, it } from "vitest";
import { unlockCondition } from "@/editor/tools/timeGateTools";
import { createBlankProject } from "@/project/defaults";

describe("unlockWhen itemId", () => {
  it("turns {itemId} into an item page condition", () => {
    const project = createBlankProject();
    const itemId = project.database.items[0]!.id;
    expect(unlockCondition(project, { itemId }).condition).toEqual({ kind: "item", itemId, present: true });
  });
  it("rejects an unknown item and mixing with a switch", () => {
    const project = createBlankProject();
    expect(() => unlockCondition(project, { itemId: "item_no_such" })).toThrow(/item_no_such/u);
    expect(() => unlockCondition(project, { itemId: project.database.items[0]!.id, switchId: "sw_x" })).toThrow(/정확히 하나/u);
  });
});
