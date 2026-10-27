import { describe, expect, it } from "vitest";
import { DEFAULT_STATE_ID } from "@/project/defaults";
import { editorProject, updateDatabaseRecord } from "./parity/parityRig";

describe("state slot loss and battle aura across save", () => {
  it("keeps the equipment slot and aura the database form wrote", () => {
    const project = editorProject(() => {
      updateDatabaseRecord("states", DEFAULT_STATE_ID, {
        disablesEquipSlot: "weapon",
        battleAura: "dark-fog",
      });
    });
    const state = project.database.states.find((entry) => entry.id === DEFAULT_STATE_ID);
    expect(state?.name).toBe("독");
    expect(state?.disablesEquipSlot).toBe("weapon");
    expect(state?.battleAura).toBe("dark-fog");
  });

  it("clears both when the form sends an empty value", () => {
    const project = editorProject(() => {
      updateDatabaseRecord("states", DEFAULT_STATE_ID, {
        disablesEquipSlot: "weapon",
        battleAura: "dark-fog",
      });
      updateDatabaseRecord("states", DEFAULT_STATE_ID, {
        disablesEquipSlot: undefined,
        battleAura: undefined,
      });
    });
    const state = project.database.states.find((entry) => entry.id === DEFAULT_STATE_ID);
    expect(state?.disablesEquipSlot).toBeUndefined();
    expect(state?.battleAura).toBeUndefined();
    expect(state?.restriction).toBe("없음");
  });
});
