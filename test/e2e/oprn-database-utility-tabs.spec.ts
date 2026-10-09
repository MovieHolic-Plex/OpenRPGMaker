import { expect, test } from "@playwright/test";
import { exportedProject } from "./oprn-database-helpers";

test.setTimeout(60_000);

test("RM2K3 database modal exposes manual parity surface tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();

  const parityTabs = [
    { id: "db-tab-elements", marker: "속성" },
    { id: "db-tab-terrain", marker: "지형 효과" },
    { id: "db-tab-battle-screen", marker: "전투 화면" },
    { id: "db-tab-battle-commands", marker: "전투 명령" },
    { id: "db-tab-battler-animations", marker: "배틀러 애니메이션" },
  ] as const;

  for (const tab of parityTabs) {
    await page.getByTestId(tab.id).click();
    await expect(page.getByTestId("db-detail-form")).toBeVisible();
    await expect(page.getByTestId("db-detail-form")).toContainText(tab.marker);
  }

  await page.getByTestId("db-tab-elements").click();
  await expect(page.getByTestId("db-elements-classic")).toBeVisible();
  await expect(page.getByTestId("db-elements-row-5")).toHaveClass(/is-selected/);
  await expect(page.getByTestId("db-field-element-name-selected")).toHaveValue("Ice");
  await expect(page.getByTestId("db-field-element-damage-D")).toHaveValue("50");
  await page.getByTestId("db-elements-row-0").click();
  await expect(page.getByTestId("db-field-element-name-selected")).toHaveValue("Sword");
  await page.getByTestId("db-field-element-name-selected").fill("Strike");
  await page.getByTestId("db-field-element-damage-A").fill("250");
  await page.getByTestId("db-field-element-damage-B").fill("175");
  await page.getByTestId("db-field-element-damage-C").fill("100");
  await page.getByTestId("db-field-element-damage-D").fill("25");
  await page.getByTestId("db-field-element-damage-E").fill("-100");

  await page.getByTestId("db-tab-terrain").click();
  await expect(page.getByTestId("db-detail-form")).not.toContainText("database.terrains");
  await expect(page.getByTestId("db-field-terrain-name-0")).toHaveValue("물");
  await page.getByTestId("db-field-terrain-damage-0").fill("7");
  await page.getByTestId("db-field-terrain-encounter-0").fill("33");
  await page.getByTestId("db-field-terrain-footstep-0").fill("easyrpg-sound-water1");
  await page.getByTestId("db-field-terrain-display-0").selectOption("transparent");
  await page.getByTestId("db-field-terrain-boat-0").check();
  await page.getByTestId("db-field-terrain-ship-0").check();

  await page.getByTestId("db-tab-battle-commands").click();
  await expect(page.getByTestId("db-detail-form")).not.toContainText("database.battleCommands");
  await expect(page.getByTestId("db-field-battle-command-name-0")).toHaveValue("공격");
  await page.getByTestId("db-field-battle-command-name-1").focus();
  await expect(page.getByTestId("db-workbench-status")).toHaveCount(0);
  await expect(page.getByTestId("db-field-battle-command-name-1")).toBeFocused();
  await page.getByTestId("db-field-battle-command-name-0").fill("Fight");
  await page.getByTestId("db-field-battle-command-kind-0").selectOption("skillSubset");
  await page.getByTestId("db-field-battle-command-subset-0").fill("Sword Arts");
  await page.getByTestId("db-field-battle-command-skill-0").fill("skill_sword_slash");

  const project = await exportedProject(page);
  expect(project.database.elements?.[0]).toMatchObject({
    id: "sword",
    kind: "physical",
    name: "Strike",
    rateLabels: ["A", "B", "C", "D", "E"],
    damageMultipliers: { A: 250, B: 175, C: 100, D: 25, E: -100 },
  });
  expect(project.database.terrains?.[0]).toMatchObject({
    battleBackgroundResourceId: "easyrpg-backdrop-sky1",
    characterDisplay: "transparent",
    damage: 7,
    encounterRatePercent: 33,
    footstepSoundResourceId: "easyrpg-sound-water1",
    id: "terrain_grassland",
    vehiclePassage: { airshipLand: true, boat: true, ship: true },
  });
  expect(project.database.battleCommands?.[0]).toMatchObject({
    kind: "skillSubset",
    name: "Fight",
    skillId: "skill_sword_slash",
    skillSubsetName: "Sword Arts",
  });
});
