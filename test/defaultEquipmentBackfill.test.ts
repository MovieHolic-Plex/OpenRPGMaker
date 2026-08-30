import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults";
import { defaultEquipmentRecords } from "@/project/defaults/defaultDatabaseEquipmentRecords";
import { ensureDefaultDatabaseIconResources } from "@/project/defaults/defaultDatabaseIconResources";

describe("default equipment backfill", () => {
  it("adds every missing default equipment record without overwriting existing records", () => {
    const project = createSampleAdventureProject();
    const existingEquipment = project.database.equipment[0];
    if (existingEquipment === undefined) throw new Error("sample project has no equipment");
    existingEquipment.name = "사용자 편집 장비";

    expect(ensureDefaultDatabaseIconResources(project)).toBe(true);
    expect(project.database.equipment.find((equipment) => equipment.id === existingEquipment.id)?.name).toBe(
      "사용자 편집 장비",
    );

    const equipmentIds = new Set(project.database.equipment.map((equipment) => equipment.id));
    const missingDefaultIds = defaultEquipmentRecords()
      .map((equipment) => equipment.id)
      .filter((id) => !equipmentIds.has(id));
    expect(missingDefaultIds).toEqual([]);
  });
});
