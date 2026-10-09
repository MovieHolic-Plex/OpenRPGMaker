import { expect, test } from "@playwright/test";
import { openRecoveredDatabase } from "./recovered-database-harness";
import { switchDatabaseTab } from "./oprn-database-helpers";

test("selected monster action stays the skill editor target across mouse, keyboard and structural edits", async ({ page, baseURL }, info) => {
  test.setTimeout(300_000);
  if (!baseURL) throw new Error("Missing worktree URL");
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRecoveredDatabase(page, baseURL);
  const fixture = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const [{ store }, { updateDatabaseRecord }] = await Promise.all([
      load("/src/project/store.ts"), load("/src/editor/databaseActions.ts"),
    ]);
    const enemy = store.getCurrent().database.enemies[0];
    const skills: string[] = store.getCurrent().database.skills.slice(0, 3).map((entry: { readonly id: string }) => entry.id);
    updateDatabaseRecord("enemies", enemy.id, { name: "Selection trust fixture", actions: skills.slice(0, 2).map((skillId, index) => ({
      skillId, priority: index === 0 ? 10 : 90, condition: { kind: "always" },
      switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false },
    })) });
    return { enemyId: enemy.id, skills, before: store.getCurrent().database.enemies[0].actions };
  });
  await switchDatabaseTab(page, { label: "몬스터", slug: "enemies", testId: "db-tab-enemies" });
  // Keep the authored catalog intact, but avoid reloading 106 unrelated thumbnails on every edit.
  await page.locator(".oprn-record-enemies .db-search input").fill("Selection trust fixture");
  await expect(page.locator(".oprn-record-enemies .db-list-row")).toHaveCount(1);
  const picker = page.getByTestId("db-picker-enemy-action-skill");
  const row = (index: number) => page.getByTestId(`db-enemy-action-row-${index}`);
  const actions = () => page.evaluate(async (enemyId) => {
    const load = (path: string) => import(/* @vite-ignore */ path);
    const { store }: typeof import("../../src/project/store") = await load("/src/project/store.ts");
    const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) throw new Error("Missing fixture enemy");
    return enemy.actions;
  }, fixture.enemyId);

  expect(await page.locator("[data-action-index]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-action-index")))).toEqual(["1", "0"]);
  await row(1).click();
  await expect(picker).toHaveValue(fixture.skills[1]);
  await picker.selectOption(fixture.skills[2]);
  expect(await actions()).toEqual([fixture.before[0], { ...fixture.before[1], skillId: fixture.skills[2] }]);
  await expect(row(1)).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: info.outputPath("selected-original-row-1-1280.png") });

  await row(0).focus();
  await page.keyboard.press("Shift+Tab"); // Reverse tab order follows the priority-sorted display.
  await expect(row(1)).toBeFocused();
  await expect(picker).toHaveValue(fixture.skills[2]);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("db-enemy-action-rating")).toHaveValue("90");
  await page.getByTestId("db-enemy-action-cancel").click();
  await expect(row(1)).toBeFocused();
  await row(1).dblclick();
  await expect(page.getByTestId("db-enemy-action-dialog")).toBeVisible();
  await page.getByTestId("db-enemy-action-cancel").click();

  await page.getByTestId("db-enemy-action-duplicate").click();
  await expect(row(2)).toHaveAttribute("aria-pressed", "true");
  await picker.selectOption(fixture.skills[1]);
  expect((await actions()).map((entry) => entry.skillId)).toEqual([fixture.skills[0], fixture.skills[2], fixture.skills[1]]);
  await page.getByTestId("db-enemy-action-add").click();
  await expect(row(3)).toHaveAttribute("aria-pressed", "true");
  await picker.selectOption(fixture.skills[2]);
  expect((await actions())[3]?.skillId).toBe(fixture.skills[2]);
  await page.getByTestId("db-enemy-action-delete").click();
  await expect(row(2)).toHaveAttribute("aria-pressed", "true");
  await expect(picker).toHaveValue(fixture.skills[1]);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: info.outputPath("selected-duplicate-1024.png") });

  for (let remaining = 3; remaining > 0; remaining -= 1) {
    await page.getByTestId("db-enemy-action-delete").click();
    await expect(page.locator("[data-action-index]")).toHaveCount(remaining - 1);
  }
  await expect(picker).toBeDisabled();
  await expect(picker).toHaveValue("");
  await expect(page.getByTestId("db-enemy-action-duplicate")).toBeDisabled();
  await expect(page.getByTestId("db-enemy-action-delete")).toBeDisabled();
  expect(await actions()).toEqual([]);
  await page.screenshot({ path: info.outputPath("empty-actions-1024.png") });
  await page.getByTestId("db-enemy-action-add").click();
  await expect(row(0)).toHaveAttribute("aria-pressed", "true");
  await expect(picker).toBeEnabled();
});
