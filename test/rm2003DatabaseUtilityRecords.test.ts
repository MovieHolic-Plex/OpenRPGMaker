import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

describe("RM2003 database utility records", () => {
  it("ships first-class elements, terrains, and global battle commands", () => {
    const project = createBlankProject();
    const database = project.database;

    expect(database.elements?.[0]).toMatchObject({
      id: "sword",
      name: "Sword",
      kind: "physical",
      rateLabels: ["A", "B", "C", "D", "E"],
      damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 },
    });
    expect(database.elements?.map((element) => element.name)).toEqual([
      "Sword",
      "Spear",
      "Hit",
      "Bow",
      "Fire",
      "Ice",
      "Thunder",
      "Water",
      "Earth",
      "Wind",
      "Holy",
      "Dark",
      "ATK",
      "DEF",
      "INT",
      "AGI",
      "Absorb",
    ]);
    expect(database.terrains?.[0]).toMatchObject({
      id: "terrain_grassland",
      name: "초원",
      damage: 0,
      encounterRatePercent: 100,
      battleBackgroundResourceId: "easyrpg-backdrop-dawn1",
    });
    expect(database.battleCommands?.map((command) => command.name)).toEqual(["공격", "스킬", "방어", "아이템"]);
  });

  it("normalizes malformed utility records into RPG2003-safe defaults", () => {
    const project = createBlankProject();
    // Retain unrelated reference targets while corrupting the utility row under test.
    if (!project.database.elements) throw new Error("Fixture needs element records");
    project.database.elements = project.database.elements.filter((element) => element.id !== "fire");
    const rawProject = JSON.parse(serialize(project)) as Record<string, unknown>;
    const rawDatabase = rawProject.database as Record<string, unknown>;
    rawDatabase.elements = [{ id: "fire", name: "Fire", kind: "nonsense", rateLabels: ["weak"], damageMultipliers: { A: 250, B: 125, E: -100 } }, ...project.database.elements];
    rawDatabase.terrains = [{ id: "terrain_bad", name: "Bad", damage: -9, encounterRatePercent: 999 }];
    rawDatabase.battleCommands = [{ id: "cmd_bad", name: "", kind: "bogus" }];

    const normalized = deserialize(JSON.stringify(rawProject)).database;

    expect(normalized.elements?.[0]).toMatchObject({
      id: "fire",
      name: "Fire",
      kind: "magical",
      rateLabels: ["A", "B", "C", "D", "E"],
      damageMultipliers: { A: 250, B: 125, C: 100, D: 50, E: -100 },
    });
    expect(normalized.terrains?.[0]).toMatchObject({
      id: "terrain_bad",
      name: "Bad",
      damage: 0,
      encounterRatePercent: 500,
    });
    expect(normalized.battleCommands?.[0]).toMatchObject({
      id: "cmd_bad",
      name: "명령",
      kind: "attack",
    });
  });
});
