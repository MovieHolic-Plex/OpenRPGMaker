import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { equipmentSlotManager } from "@/editor/panels/equipmentSlotManager";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: () => void;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  resetMapEditHistory();
  restoreDom();
});

function control(root: FakeElement, id: string): FakeElement {
  const found = findByTestId(root, id);
  if (!found) throw new Error(`Missing control: ${id}`);
  return found;
}

describe("equipment slot authoring history", () => {
  it.each(["add", "rename", "remove"])("undoes the complete %s operation", (operation) => {
    // Given an unused custom slot and the selected equipment's original assignment.
    store.update((project) => {
      project.database.equipmentSlots = [{ id: "slot_boots", label: "Boots" }];
    });
    const before = structuredClone(store.getCurrent().database);
    const equipmentId = before.equipment[0]!.id;
    const manager = equipmentSlotManager(equipmentId, () => undefined) as unknown as FakeElement;

    // When one catalog operation is performed through its real editor control.
    switch (operation) {
      case "add":
        control(manager, "db-equipment-slot-new-label").value = "Cloak";
        control(manager, "db-equipment-slot-add").click();
        break;
      case "rename": {
        const input = control(manager, "db-equipment-slot-label-slot_boots");
        input.value = "Greaves";
        input.dispatchEvent(new Event("change"));
        break;
      }
      case "remove":
        control(manager, "db-equipment-slot-remove-slot_boots").click();
        break;
    }

    // Then undo restores both the catalog and the selected equipment atomically.
    expect(store.getCurrent().database).not.toEqual(before);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().database).toEqual(before);
  });
});
