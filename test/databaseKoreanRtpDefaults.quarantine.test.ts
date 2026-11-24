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
      ["sword", "검"],
      ["spear", "창"],
      ["hit", "타격"],
      ["bow", "활"],
      ["fire", "화염"],
      ["ice", "빙결"],
      ["thunder", "번개"],
      ["water", "물"],
      ["earth", "대지"],
      ["wind", "바람"],
      ["holy", "신성"],
      ["dark", "암흑"],
      ["atk", "공격력"],
      ["def", "방어력"],
      ["int", "지력"],
      ["agi", "민첩"],
      ["absorb", "흡수"],
    ]);
    expect(project.database.terrains?.map((terrain) => [terrain.id, terrain.name])).toEqual([
      ["terrain_water", "물"],
      ["terrain_sand", "모래"],
      ["terrain_snow", "눈"],
      ["terrain_stone", "돌"],
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
