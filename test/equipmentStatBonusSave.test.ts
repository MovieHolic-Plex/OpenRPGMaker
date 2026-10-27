import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";

describe("equipment stat penalties survive project save", () => {
  it("keeps a negative agility penalty through normalize and a save round trip", () => {
    const heavy = normalizeEquipmentRecord({
      id: "equip_heavy_spear",
      name: "무거운 창",
      slot: "weapon",
      statBonuses: { attack: 22, defense: 0, mind: -4, agility: -3 },
    });
    expect(heavy.statBonuses).toEqual({ attack: 22, defense: 0, mind: -4, agility: -3 });

    const clamped = normalizeEquipmentRecord({
      id: "equip_clamp",
      name: "한계",
      slot: "weapon",
      statBonuses: { attack: 99_999, defense: -99_999, mind: 1.8, agility: -1.2 },
    });
    expect(clamped.statBonuses).toEqual({ attack: 9999, defense: -9999, mind: 1, agility: -1 });

    const project = createBlankProject();
    project.database.equipment.push(heavy);
    const loaded = deserialize(serialize(project));
    expect(loaded.database.equipment.find((row) => row.id === "equip_heavy_spear")?.statBonuses).toEqual({
      attack: 22,
      defense: 0,
      mind: -4,
      agility: -3,
    });
  });
});
