import { expect, test } from "@playwright/test";

type ExportedProject = {
  database: {
    actors: {
      name: string;
      nickname: string;
      classId: string;
      learnedSkills: { level: number; skillId: string }[];
      options: { dualWield: boolean };
      faceResourceId?: string;
      characterTransparent: boolean;
    }[];
    classes: { name: string; learnedSkills: { level: number; skillId: string }[]; battleCommands: { name: string; kind: string }[] }[];
    skills: { id: string; name: string; description: string; mpCost: { flat: number; percentMax: number }; successRate: number }[];
    items: { id: string; name: string; skillId?: string; description: string; type: string; occasion: string; consumable: boolean }[];
    equipment: { name: string; description: string; statBonuses: { attack: number; defense: number }; cursed: boolean; usableAsItemSkillId?: string }[];
    enemies: { id: string; name: string; stats: { maxHp: number; attack: number }; rewards: { exp: number; dropItemId?: string }; actions: { skillId: string }[] }[];
    troops: { name: string; enemyIds: string[]; members?: { enemyId: string; x: number; y: number; hidden?: boolean }[]; previewBackgroundResourceId?: string }[];
    states: { name: string }[];
    battleAnimations: { name: string }[];
  };
  meta: { terms: { gold: string; skill?: string; item?: string } };
  system: { titleResourceId?: string };
};

async function exportedProject(page: import("@playwright/test").Page): Promise<ExportedProject> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export json");
  const debug = JSON.parse(text) as { project: ExportedProject };
  return debug.project;
}

test("RM2K3 database editor edits records, updates dependent pickers, and blocks referenced deletes", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  const recordSearch = page.locator(".db-search input").first();
  await recordSearch.pressSequentially("Hero");
  await expect(recordSearch).toBeFocused();
  await expect(recordSearch).toHaveValue("Hero");
  for (const id of [
    "db-tab-actors",
    "db-tab-classes",
    "db-tab-skills",
    "db-tab-items",
    "db-tab-equipment",
    "db-tab-enemies",
    "db-tab-troops",
    "db-tab-states",
    "db-tab-animations",
    "db-tab-tilesets",
    "db-tab-common-events",
    "db-tab-system",
    "db-tab-terms",
    "db-tab-switches",
    "db-tab-variables",
  ]) {
    await page.getByTestId(id).click();
    await expect(page.getByTestId("db-detail-form")).toBeVisible();
  }

  await page.getByTestId("db-tab-skills").click();
  await page.getByTestId("db-add-record").click();
  await page.getByTestId("db-field-name").fill("Spark QA");
  await page.getByTestId("db-field-power").fill("41");
  await page.getByTestId("db-field-skill-description").fill("Spark test skill");
  await page.getByTestId("db-field-skill-mp-flat").fill("8");
  await page.getByTestId("db-field-skill-mp-percent").fill("12");
  await page.getByTestId("db-field-skill-success").fill("96");
  await expect(page.getByTestId("db-field-scope")).toContainText("적 전체");
  await page.getByTestId("db-tab-classes").click();
  await expect(page.getByTestId("db-picker-class-skill")).toContainText("Spark QA");

  await page.getByTestId("db-tab-actors").click();
  await page.getByTestId("db-field-name").fill("Actor QA");
  await page.getByTestId("db-field-actor-nickname").fill("Tester");
  await page.getByTestId("db-field-initial-level").fill("0");
  await page.getByTestId("db-field-max-level").fill("120");
  await page.getByTestId("db-field-face-resource").fill("hero");
  await page.getByTestId("db-field-character-transparent").check();
  await page.getByTestId("db-field-actor-option-dualWield").check();
  await page.getByTestId("db-field-actor-skill-level-0").fill("7");
  await page.getByTestId("db-picker-actor-skill-0").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-classes").click();
  await page.getByTestId("db-field-name").fill("Class QA");
  await page.getByTestId("db-field-class-command-name").fill("Arts");
  await page.getByTestId("db-field-class-command-kind").selectOption("skill");
  await page.getByTestId("db-field-class-skill-level").fill("12");
  await page.getByTestId("db-picker-class-skill").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-field-name").fill("Item QA");
  await page.getByTestId("db-field-item-description").fill("Potion with battle metadata");
  await page.getByTestId("db-field-item-type").selectOption("key");
  await page.getByTestId("db-field-item-occasion").selectOption("field");
  await page.getByTestId("db-field-item-consumable").uncheck();
  await page.getByTestId("db-picker-skill").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-equipment").click();
  await page.getByTestId("db-field-name").fill("Equipment QA");
  await page.getByTestId("db-field-equipment-description").fill("Cursed blade");
  await page.getByTestId("db-field-equipment-attack").fill("77");
  await page.getByTestId("db-field-equipment-defense").fill("22");
  await page.getByTestId("db-field-equipment-cursed").check();
  await page.getByTestId("db-picker-equipment-use-skill").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-enemies").click();
  await page.getByTestId("db-add-record").click();
  await page.getByTestId("db-field-name").fill("Enemy QA");
  await page.getByTestId("db-field-enemy-max-hp").fill("4321");
  await page.getByTestId("db-field-enemy-exp").fill("55");
  await page.getByTestId("db-picker-enemy-drop").selectOption({ label: "Item QA" });
  await page.getByTestId("db-picker-enemy-action-skill").selectOption({ label: "Spark QA" });

  await page.getByTestId("db-tab-troops").click();
  await page.getByTestId("db-field-name").fill("Troop QA");
  await page.getByTestId("db-picker-troop-member-enemy").selectOption({ label: "Enemy QA" });
  await page.getByTestId("db-field-troop-member-x").fill("144");
  await page.getByTestId("db-field-troop-member-y").fill("88");
  await page.getByTestId("db-field-troop-member-hidden").check();
  await page.getByTestId("db-field-troop-backdrop").fill("battleback_qa");

  await page.getByTestId("db-tab-states").click();
  await page.getByTestId("db-field-name").fill("State QA");
  await page.getByTestId("db-tab-animations").click();
  await page.getByTestId("db-field-name").fill("Animation QA");
  await page.getByTestId("db-tab-system").click();
  await page.getByTestId("db-field-title-resource").fill("title_qa");
  await page.getByTestId("db-tab-terms").click();
  await page.getByTestId("db-field-gold").fill("Zenny");
  await page.getByTestId("db-field-skill-term").fill("Arts");

  await page.getByTestId("db-tab-skills").click();
  await page.getByTestId("db-delete-selected").click();
  await expect(page.getByTestId("toast")).toContainText("주인공이 이 스킬을 사용 중입니다.");
  await page.getByTestId("db-tab-enemies").click();
  await page.locator(".db-search input").fill("");
  await page.getByRole("button", { name: /Enemy QA/ }).click();
  await page.getByTestId("db-delete-selected").click();

  const project = await exportedProject(page);
  const actor = project.database.actors.find((record) => record.name === "Actor QA");
  expect(actor?.nickname).toBe("Tester");
  expect(actor?.learnedSkills).toEqual([{ level: 7, skillId: project.database.skills.find((skill) => skill.name === "Spark QA")?.id }]);
  expect(actor?.options.dualWield).toBe(true);
  expect(actor?.faceResourceId).toBe("hero");
  expect(actor?.characterTransparent).toBe(true);
  expect(project.database.classes.some((record) => record.name === "Class QA")).toBe(true);
  const klass = project.database.classes.find((record) => record.name === "Class QA");
  const skill = project.database.skills.find((record) => record.name === "Spark QA");
  const item = project.database.items.find((record) => record.name === "Item QA");
  const equipment = project.database.equipment.find((record) => record.name === "Equipment QA");
  const enemy = project.database.enemies.find((record) => record.name === "Enemy QA");
  const troop = project.database.troops.find((record) => record.name === "Troop QA");
  expect(klass?.battleCommands[0]).toMatchObject({ name: "Arts", kind: "skill" });
  expect(klass?.learnedSkills[0]).toMatchObject({ level: 12, skillId: skill?.id });
  expect(skill).toMatchObject({ description: "Spark test skill", mpCost: { flat: 8, percentMax: 12 }, successRate: 96 });
  expect(item).toMatchObject({ description: "Potion with battle metadata", type: "key", occasion: "field", consumable: false });
  expect(equipment).toMatchObject({ description: "Cursed blade", statBonuses: { attack: 77, defense: 22 }, cursed: true, usableAsItemSkillId: skill?.id });
  expect(enemy).toMatchObject({ stats: { maxHp: 4321, attack: 10 }, rewards: { exp: 55, dropItemId: item?.id }, actions: [{ skillId: skill?.id }] });
  expect(troop).toMatchObject({ members: [{ enemyId: enemy?.id, x: 144, y: 88, hidden: true }], previewBackgroundResourceId: "battleback_qa" });
  expect(project.database.states.some((record) => record.name === "State QA")).toBe(true);
  expect(project.database.battleAnimations.some((record) => record.name === "Animation QA")).toBe(true);
  expect(project.meta.terms.gold).toBe("Zenny");
  expect(project.meta.terms.skill).toBe("Arts");
  await page.screenshot({ path: testInfo.outputPath("database-editor.png"), fullPage: true });
});
