import { describe, expect, it } from "vitest";
import { itemEffectSummary } from "@/player/playerStatusMenuDetailRenderer";
import { createBlankProject } from "@/project/defaults";
import type { ItemRecord } from "@/project/types";

// 제작 공방 창은 산출물 효과를 자료집 아이템 값에서 가방 상세와 같은 글로 만든다(손으로 쓴 문구 없음).
// 효과가 없는 물건은 빈칸 자리표시 없이 줄 자체가 없어야 한다.
function itemWith(patch: Partial<ItemRecord>): ItemRecord {
  const project = createBlankProject();
  const base = project.database.items[0]!;
  return {
    ...base,
    hpRecovery: { flat: 0, percentMax: 0 },
    mpRecovery: { flat: 0, percentMax: 0 },
    healStateIds: [],
    stateEffects: [],
    learnedSkillId: undefined,
    activateSkillId: undefined,
    ...patch,
  } as ItemRecord;
}

describe("craft window output effect line", () => {
  const project = createBlankProject();

  it("formats recovery values from the item data", () => {
    expect(itemEffectSummary(project, itemWith({ hpRecovery: { flat: 40, percentMax: 25 } }))).toBe("HP +40 · HP 25%");
    expect(itemEffectSummary(project, itemWith({ repelSteps: 60 }))).toBe("벌레퇴치 60걸음");
  });

  it("names the state an item cures by the database name", () => {
    const state = project.database.states[0]!;
    expect(itemEffectSummary(project, itemWith({ healStateIds: [state.id] }))).toBe(`치료 ${state.name}`);
  });

  it("returns nothing for an item without effects", () => {
    expect(itemEffectSummary(project, itemWith({}))).toBeUndefined();
  });
});
