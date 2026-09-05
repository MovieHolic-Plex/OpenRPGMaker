import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults";
import { ensureDefaultDatabaseIconResources } from "@/project/defaults/defaultDatabaseIconResources";

describe("default equipment backfill", () => {
  it("preserves the existing equipment catalog without adding missing defaults", () => {
    const project = createSampleAdventureProject();
    const existingEquipment = project.database.equipment[0];
    if (existingEquipment === undefined) throw new Error("sample project has no equipment");
    existingEquipment.name = "사용자 편집 장비";

    const before = project.database.equipment.map((entry) => entry.id);
    ensureDefaultDatabaseIconResources(project);
    expect(project.database.equipment.find((equipment) => equipment.id === existingEquipment.id)?.name).toBe(
      "사용자 편집 장비",
    );

    expect(project.database.equipment.map((entry) => entry.id)).toEqual(before);
  });
});
