import { expect, test } from "@playwright/test";
import { applyDatabaseChanges, exportedProject, openDatabase } from "./rm2k3-database-helpers";

test.setTimeout(120_000);

test("database six surfaces persist real edits through project export", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("toolbar-database")).toBeVisible();
  // project-export-json is filled on a 150ms debounce after store load.
  await expect.poll(async () => (await page.getByTestId("project-export-json").textContent())?.trim() ?? "").not.toBe("");
  await openDatabase(page);

  // (6) 속성 최대 개수
  await page.getByTestId("db-tab-elements").click();
  const beforeElements = (await exportedProject(page)).database.elements?.length ?? 0;
  await page.getByTestId("db-elements-maximum-number").click();
  await expect(page.getByTestId("db-elements-max-dialog")).toBeVisible();
  await page.getByTestId("db-elements-max-count-input").fill(String(beforeElements + 1));
  await page.getByTestId("db-elements-max-ok").click();
  await expect(page.getByTestId("db-elements-max-dialog")).toHaveCount(0);
  const afterElements = (await exportedProject(page)).database.elements?.length ?? 0;
  expect(afterElements).toBe(beforeElements + 1);

  // (3) 직업 전투명령 순서
  await page.getByTestId("db-tab-classes").click();
  const classBefore = (await exportedProject(page)).database.classes[0]?.battleCommands.map((entry) => entry.name) ?? [];
  await page.getByTestId("db-class-command-order-open").click();
  await expect(page.getByTestId("db-class-command-order-dialog")).toBeVisible();
  await page.getByTestId("db-class-command-order-down-0").click();
  await page.getByTestId("db-class-command-order-ok").click();
  const classAfter = (await exportedProject(page)).database.classes[0]?.battleCommands.map((entry) => entry.name) ?? [];
  if (classBefore.length >= 2) {
    expect(classAfter[0]).toBe(classBefore[1]);
    expect(classAfter[1]).toBe(classBefore[0]);
  }
  expect(classAfter.at(-1)).toBe("교체");

  // (1) 전투 화면
  await page.getByTestId("db-tab-battle-screen").click();
  await page.getByTestId("db-field-battle-system-resource").fill("easyrpg-system2-system2-a");
  await page.getByTestId("db-field-battle-screen-flow").selectOption("strict");
  await page.getByTestId("db-field-battle-screen-active-slots").fill("3");

  // (2) 배틀러 애니메이션
  await page.getByTestId("db-tab-battler-animations").click();
  await page.getByTestId("db-field-battler-animation-name-0").fill("Six Surface Battler");
  await page.getByTestId("db-field-battler-animation-attack-duration-0").fill("321");

  // (4) 전투 애니메이션 셀 일괄
  await page.getByTestId("db-tab-animations").click();
  await expect(page.getByTestId("db-animation-cell-batch")).toBeEnabled();
  await page.getByTestId("db-animation-cell-batch").click();
  await expect(page.getByTestId("db-animation-cell-batch-dialog")).toBeVisible();
  await page.getByTestId("db-animation-batch-zoom").fill("160");
  await page.getByTestId("db-animation-batch-opacity").fill("180");
  await page.getByTestId("db-animation-cell-batch-ok").click();
  await expect(page.getByTestId("db-animation-cell-batch-dialog")).toHaveCount(0);

  // Ensure interpolate button is live (needs middle frame; duplicate to create neighbors if needed)
  await expect(page.getByTestId("db-animation-cell-interpolate")).toBeEnabled();

  // (5) 몬스터 행동 기본/스킬 — 행 위 인라인 select가 dblclick을 가로채므로 Enter로 연다.
  await page.getByTestId("db-tab-enemies").click();
  const actionRow = page.getByTestId("db-enemy-action-row-0");
  await expect(actionRow).toBeVisible();
  await actionRow.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("db-enemy-action-dialog")).toBeVisible();
  await page.getByTestId("db-enemy-action-mode-basic").check();
  await expect(page.getByTestId("db-picker-enemy-action-skill")).toBeDisabled();
  await page.getByTestId("db-enemy-action-mode-skill").check();
  const skillSelect = page.getByTestId("db-picker-enemy-action-skill");
  await expect(skillSelect).toBeEnabled();
  const skillValue = await skillSelect.locator("option").nth(1).getAttribute("value");
  expect(skillValue).toBeTruthy();
  await skillSelect.selectOption(skillValue!);
  await page.getByTestId("db-enemy-action-ok").click();
  await expect(page.getByTestId("db-enemy-action-dialog")).toHaveCount(0);

  await applyDatabaseChanges(page);
  const project = await exportedProject(page);
  const system = project.system as {
    battleSystemResourceId?: string;
    battleFlow?: string;
    activeSlots?: number;
  };

  expect(project.database.elements?.length).toBe(afterElements);
  expect(system.battleSystemResourceId).toBe("easyrpg-system2-system2-a");
  expect(system.battleFlow).toBe("strict");
  expect(system.activeSlots).toBe(3);
  expect(project.database.battlerAnimations?.[0]).toMatchObject({
    name: "Six Surface Battler",
  });
  const attackPose = project.database.battlerAnimations?.[0]?.poses.find((pose) => pose.pose === "attack");
  expect(attackPose?.frames[0]?.durationMs).toBe(321);

  const animationRecord = project.database.battleAnimations[0] as {
    frames?: { cells?: { zoom?: number; opacity?: number }[] }[];
  };
  const animationCells = animationRecord.frames?.[0]?.cells ?? [];
  expect(animationCells.length).toBeGreaterThan(0);
  expect(animationCells.every((cell) => cell.zoom === 160 && cell.opacity === 180)).toBe(true);

  const firstEnemy = project.database.enemies[0] as { actions?: { skillId?: string }[] };
  expect(firstEnemy.actions?.[0]?.skillId).toBeTruthy();
});
