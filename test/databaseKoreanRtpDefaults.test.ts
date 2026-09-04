import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";

type FsReader = {
  readonly readFileSync: (path: string, encoding: "utf8") => string;
};

const loadFs = async (): Promise<FsReader> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as FsReader;
};

const uiFiles = [
  "src/editor/panels/database.ts",
  "src/editor/panels/databaseRecordViews.ts",
  "src/editor/panels/databaseAdvancedRecordViews.ts",
  "src/editor/panels/databaseUtilityRecordViews.ts",
  "src/editor/panels/databaseAnimationRecordView.ts",
  "src/editor/panels/databaseControls.ts",
  "src/editor/panels/databaseBasicRecordFields.ts",
] as const;

const requiredUiLabels = [
  "주인공",
  "직업",
  "스킬",
  "아이템",
  "장비",
  "몬스터",
  "적 그룹",
  "속성",
  "상태",
  "전투 애니메이션",
  "배틀러 애니메이션",
  "전투 화면",
  "전투 명령",
  "지형 효과",
  "타일셋",
  "공용 이벤트",
  "시스템",
  "용어",
  "스위치",
  "변수",
  "설정...",
] as const;

const forbiddenVisibleEnglish = [
  "Actors",
  "Classes",
  "Skills",
  "Items",
  "Equipment",
  "Enemies",
  "Troops",
  "States",
  "Animations",
  "Tilesets",
  "Common Events",
  "Switches",
  "Variables",
  "Elements",
  "Terrain",
  "Battle Screen",
  "Battle Commands",
  "Battler Anim.",
  "Maximum Number",
  " records",
  "Name",
  "Set...",
  "Select resource",
] as const;

function matchingForbiddenStrings(source: string): string[] {
  return forbiddenVisibleEnglish.filter((phrase) => {
    const matcher = new RegExp(`(^|[^A-Za-z])${escapeRegExp(phrase)}($|[^A-Za-z])`);
    return stringLiterals(source).some((literal) => matcher.test(literal));
  });
}

function stringLiterals(source: string): string[] {
  const literals: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) literals.push(match[1] ?? match[2] ?? match[3] ?? "");
  return literals;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("database Korean localization and EasyRPG RTP defaults", () => {
  it("keeps database editor chrome in readable Korean", async () => {
    const { readFileSync } = await loadFs();
    const sourceByFile = uiFiles.map((file) => [file, readFileSync(file, "utf8")] as const);
    const combinedSource = sourceByFile.map(([, source]) => source).join("\n");
    const hits: string[] = [];

    for (const [file, source] of sourceByFile) {
      for (const phrase of matchingForbiddenStrings(source)) hits.push(`${file}: ${phrase}`);
    }

    for (const label of requiredUiLabels) expect(combinedSource).toContain(label);
    expect(hits).toEqual([]);
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
