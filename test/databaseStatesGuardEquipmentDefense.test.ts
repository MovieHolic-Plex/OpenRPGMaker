import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databaseReferenceMessage } from "@/editor/databaseReferences";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

/** States delete guard must cover equipment.stateDefenseIds, not just stateInflictIds —
 *  otherwise deleting a defended-against state leaves a dangling ref with no warning. */
describe("states delete guard covers equipment defense", () => {
  it("blocks deleting a state referenced only by equipment.stateDefenseIds", () => {
    const project = store.getCurrent();
    const state = project.database.states[1] ?? project.database.states[0];
    if (!state) throw new Error("no states in fixture");
    const stateId = state.id;
    store.update((draft) => {
      for (const skill of draft.database.skills) {
        skill.stateEffects = (skill.stateEffects ?? []).filter((effect) => effect.stateId !== stateId);
      }
      for (const item of draft.database.items) {
        item.stateEffects = (item.stateEffects ?? []).filter((effect) => effect.stateId !== stateId);
        item.healStateIds = (item.healStateIds ?? []).filter((id) => id !== stateId);
        item.equipmentProfile.stateInflictIds = item.equipmentProfile.stateInflictIds.filter((id) => id !== stateId);
        item.equipmentProfile.stateDefenseIds = item.equipmentProfile.stateDefenseIds.filter((id) => id !== stateId);
      }
      for (const equip of draft.database.equipment) {
        equip.stateInflictIds = equip.stateInflictIds.filter((id) => id !== stateId);
        equip.stateDefenseIds = equip.stateDefenseIds.filter((id) => id !== stateId);
      }
      draft.database.equipment[0]!.stateDefenseIds = [stateId];
    });
    expect(databaseReferenceMessage("states", stateId)).not.toBeNull();
  });
});
