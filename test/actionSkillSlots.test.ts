// 액션 스킬 슬롯 규칙.
// 예전에는 tryActionSkillCast 가 배운 스킬 중 actionSkill 프로필이 있는 **첫 번째**를
// find 로 집었다. 스킬을 두 개 배워도 두 번째는 영원히 못 쓴다. 슬롯 해석 + 순환 +
// "활성 슬롯으로 캐스트" 를 순수 규칙으로 고정한다.
import { describe, expect, it } from "vitest";

import {
  ACTION_SKILL_SLOT_MAX,
  activeActionSkillId,
  cycleActionSkillSlot,
  resolveActionSkillSlots,
} from "@/battle/action/skillSlots";
import { RuntimeKeyHoldTracker } from "@/player/input";
import { isSkillCycleKey, isSkillKey } from "@/player/keyBindings";

const HAS_ACTION = (id: string): boolean => id.startsWith("act_");

describe("resolveActionSkillSlots", () => {
  it("keeps only action skills, in learned order", () => {
    expect(resolveActionSkillSlots(["heal", "act_fire", "buff", "act_ice"], HAS_ACTION)).toEqual([
      "act_fire",
      "act_ice",
    ]);
  });

  it("caps the slot count and drops duplicates", () => {
    const slots = resolveActionSkillSlots(
      ["act_a", "act_a", "act_b", "act_c", "act_d", "act_e"],
      HAS_ACTION
    );
    expect(slots).toEqual(["act_a", "act_b", "act_c"]);
    expect(slots.length).toBe(ACTION_SKILL_SLOT_MAX);
    expect(ACTION_SKILL_SLOT_MAX).toBeGreaterThanOrEqual(2);
  });

  it("returns an empty slot list when nothing is castable", () => {
    expect(resolveActionSkillSlots(["heal", "buff"], HAS_ACTION)).toEqual([]);
    expect(resolveActionSkillSlots([], HAS_ACTION)).toEqual([]);
  });
});

describe("cycleActionSkillSlot", () => {
  it("wraps forward through every slot", () => {
    expect(cycleActionSkillSlot(0, 3)).toBe(1);
    expect(cycleActionSkillSlot(1, 3)).toBe(2);
    expect(cycleActionSkillSlot(2, 3)).toBe(0);
  });

  it("cycles backward and clamps a stale index back into range", () => {
    expect(cycleActionSkillSlot(0, 3, -1)).toBe(2);
    expect(cycleActionSkillSlot(9, 2)).toBe(0);
    expect(cycleActionSkillSlot(-4, 2)).toBe(0);
  });

  it("stays at zero with zero or one slot", () => {
    expect(cycleActionSkillSlot(0, 0)).toBe(0);
    expect(cycleActionSkillSlot(0, 1)).toBe(0);
  });
});

describe("activeActionSkillId", () => {
  it("casts the active slot, not the first learned skill", () => {
    const slots = resolveActionSkillSlots(["act_fire", "act_ice", "act_bolt"], HAS_ACTION);
    expect(activeActionSkillId(slots, 0)).toBe("act_fire");
    const next = cycleActionSkillSlot(0, slots.length);
    expect(activeActionSkillId(slots, next)).toBe("act_ice");
    expect(activeActionSkillId(slots, cycleActionSkillSlot(next, slots.length))).toBe("act_bolt");
  });

  it("is undefined without slots and clamps an out-of-range index", () => {
    expect(activeActionSkillId([], 0)).toBeUndefined();
    expect(activeActionSkillId(["act_fire"], 7)).toBe("act_fire");
  });
});

describe("slot cycle input", () => {
  it("binds a cycle key that does not collide with cast/move/confirm keys", () => {
    expect(isSkillCycleKey("r")).toBe(true);
    expect(isSkillCycleKey("R")).toBe(true);
    for (const key of ["q", "z", "x", "Enter", " ", "w", "a", "s", "d", "Shift", "f"]) {
      expect(isSkillCycleKey(key), key).toBe(false);
    }
    expect(isSkillKey("r")).toBe(false);
  });

  it("raises exactly one cycle edge per press and ignores OS key repeat", () => {
    const tracker = new RuntimeKeyHoldTracker();
    tracker.keyDown("r");
    expect(tracker.consumeSkillCycleEdge()).toBe(true);
    expect(tracker.consumeSkillCycleEdge()).toBe(false);
    tracker.keyDown("r", true);
    expect(tracker.consumeSkillCycleEdge()).toBe(false);
    tracker.keyUp("r");
    tracker.keyDown("r");
    expect(tracker.consumeSkillCycleEdge()).toBe(true);
  });

  it("releaseAll drops a pending cycle edge (focus loss)", () => {
    const tracker = new RuntimeKeyHoldTracker();
    tracker.keyDown("r");
    tracker.releaseAll();
    expect(tracker.consumeSkillCycleEdge()).toBe(false);
  });
});
