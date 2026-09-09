import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TAB_GROUPS, databaseTabLabel, databaseTabPath } from "@/editor/panels/database";

describe("database Korean localization and EasyRPG RTP defaults", () => {
  it("keeps database editor chrome in readable Korean", () => {
    // Inspect the shipped navigation registry, not strings in former renderer files.
    const tabs = TAB_GROUPS.flatMap((group) => group.tabs);
    expect(new Set(tabs).size).toBe(tabs.length);
    expect(tabs).toEqual(expect.arrayContaining([
      "actors", "classes", "skills", "items", "enemies", "troops", "elements",
      "states", "animations", "battleScreen", "battleCommands", "tilesets",
      "commonEvents", "system", "terms", "switches", "variables",
    ]));
    for (const tab of tabs) {
      expect(databaseTabLabel(tab), tab).toMatch(/[가-힣]/u);
      expect(databaseTabLabel(tab), tab).not.toMatch(/\uFFFD/u);
    }
    expect(databaseTabLabel("equipment")).toBe(databaseTabLabel("items"));
    expect(databaseTabPath("terrain")).toEqual(["tilesets", "terrain"]);
  });

  it("ships RM2003 utility database names while preserving stable ids", () => {
    const project = createBlankProject();

    expect(project.database.elements?.map((element) => [element.id, element.name])).toEqual([
      ["sword", "Sword"],
      ["spear", "Spear"],
      ["hit", "Hit"],
      ["bow", "Bow"],
      ["fire", "Fire"],
      ["ice", "Ice"],
      ["thunder", "Thunder"],
      ["water", "Water"],
      ["earth", "Earth"],
      ["wind", "Wind"],
      ["holy", "Holy"],
      ["dark", "Dark"],
      ["atk", "ATK"],
      ["def", "DEF"],
      ["int", "INT"],
      ["agi", "AGI"],
      ["absorb", "Absorb"],
    ]);
    expect(project.database.terrains?.map((terrain) => [terrain.id, terrain.name])).toEqual([
      ["terrain_grassland", "초원"],
      ["terrain_road", "숲"],
      ["terrain_water", "사막"],
    ]);
    expect(project.database.battleCommands?.map((command) => [command.id, command.name])).toEqual([
      ["cmd_attack", "공격"],
      ["cmd_skill", "스킬"],
      ["cmd_defend", "방어"],
      ["cmd_item", "아이템"],
    ]);
  });

  it("does not claim EasyRPG RTP provides item/equipment icons or class seeds", () => {
    const project = createBlankProject();
    const itemOrEquipmentResources = [
      ...project.database.items.flatMap((item) => [item.imageResourceId, item.iconResourceId]),
      ...project.database.equipment.flatMap((equipment) => [equipment.imageResourceId, equipment.iconResourceId]),
    ].filter((id): id is string => typeof id === "string" && id.length > 0);

    expect(itemOrEquipmentResources.every((id) => id.startsWith("cc0-jetrel-"))).toBe(true);
    expect(itemOrEquipmentResources.every((id) => !id.startsWith("easyrpg-"))).toBe(true);
    expect(project.database.classes.map((record) => record.name)).toEqual(["전사", "수호자", "마도사", "정찰병", "성직자", "궁수"]);
  });
});
