import { expect, test } from "@playwright/test";
import { exportedProject } from "./rm2k3-database-helpers";

test("Database Items tab follows RM2K3 item types and Korean type-specific panels", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await page.getByTestId("db-tab-items").click();

  await expect(page.getByTestId("db-items-rm2k3-workbench")).toBeVisible();
  await expect(page.getByTestId("db-field-item-type")).toContainText("무기");
  await expect(page.getByTestId("db-field-item-type")).toContainText("방패");
  await expect(page.getByTestId("db-field-item-type")).toContainText("약");
  await expect(page.getByTestId("db-field-item-type")).toContainText("스위치");

  await page.getByTestId("db-field-name").fill("QA 회복약");
  await page.getByTestId("db-field-item-type").selectOption("medicine");
  await page.getByTestId("db-field-item-consumption-limit").selectOption("1");
  await page.getByTestId("db-field-item-scope").selectOption("allAllies");
  await page.getByTestId("db-field-item-hp-percent").fill("10");
  await page.getByTestId("db-field-item-hp-flat").fill("50");
  await page.getByTestId("db-field-item-mp-percent").fill("25");
  await page.getByTestId("db-field-item-only-menu").check();
  await expect(page.getByTestId("db-items-medicine-panel")).toContainText("HP 회복");
  await expect(page.getByTestId("db-items-medicine-panel")).toContainText("사용 가능");

  await page.getByTestId("db-field-item-type").selectOption("special");
  await page.getByTestId("db-picker-item-activate-skill").selectOption({ label: "치유" });
  await page.getByTestId("db-field-item-usage-message").selectOption("skill");
  await expect(page.getByTestId("db-items-special-panel")).toContainText("발동 스킬");

  await page.getByTestId("db-field-item-type").selectOption("switch");
  await page.getByTestId("db-picker-item-switch").selectOption({ index: 1 });
  await page.getByTestId("db-field-item-occasion-field").check();
  await page.getByTestId("db-field-item-occasion-battle").check();
  await expect(page.getByTestId("db-items-switch-panel")).toContainText("스위치 토글 ON/OFF");
  await page.getByTestId("database-modal").screenshot({
    path: "C:/Users/hyeon/Downloads/rpg-zzu/.omo/ulw-loop/items-db-ko-20260627203458/evidence/items-tab-switch-panel.png",
  });

  await page.getByTestId("db-field-item-type").selectOption("weapon");
  await page.getByTestId("db-field-item-wield-type").selectOption("twoHanded");
  await page.getByTestId("db-field-item-equipment-attack").fill("7");
  await page.getByTestId("db-field-item-equipment-defense").fill("3");
  await page.getByTestId("db-field-item-mp-cost").fill("2");
  await page.getByTestId("db-field-item-accuracy").fill("95");
  await page.getByTestId("db-field-item-usable-actor-actor_hero").check();
  await page.getByTestId("db-field-item-usable-actor-actor_guardian").check();
  await page.getByTestId("db-field-item-attackElementIds-sword").check();
  await page.getByTestId("db-field-item-attackElementIds-fire").check();
  await page.getByTestId("db-field-item-stateInflictIds-state_poison").check();
  await page.getByTestId("db-field-item-stateInflictIds-state_sleep").check();

  const project = await exportedProject(page);
  const item = project.database.items.find((record) => record.name === "QA 회복약");
  expect(item).toMatchObject({
    type: "weapon",
    occasion: "always",
    consumptionLimit: 1,
    scope: "allAllies",
    hpRecovery: { percentMax: 10, flat: 50 },
    mpRecovery: { percentMax: 25, flat: 0 },
    onlyUsableInMenu: true,
    usageMessage: "skill",
  });
  expect(item?.skillId).toBe("skill_heal");
  expect(item?.switchId).toBeTruthy();
  expect(item?.equipmentProfile).toMatchObject({
    twoHanded: true,
    mpCost: 2,
    accuracy: 95,
    statBonuses: { attack: 7, defense: 3 },
    equippableActorIds: ["actor_hero", "actor_guardian"],
    attackElementIds: ["sword", "fire"],
    stateInflictIds: ["state_poison", "state_sleep"],
  });

  await page.getByTestId("database-modal").screenshot({
    path: "C:/Users/hyeon/Downloads/rpg-zzu/.omo/ulw-loop/items-db-ko-20260627203458/evidence/items-tab-weapon-panel.png",
  });
  await page.screenshot({ path: testInfo.outputPath("database-items-rm2k3.png"), fullPage: true });
});
