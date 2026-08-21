import { expect, test } from "@playwright/test";
import { DATABASE_TAB_SPECS, exportedProject, openDatabase, switchDatabaseTab } from "./rm2k3-database-helpers";

const SKILLS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "skills")!;
const ITEMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "items")!;

test.describe("Database skills tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
    await page.goto("/?freshProject=1");
    await openDatabase(page);
    await switchDatabaseTab(page, SKILLS_TAB);
  });

  test("CRUD round trip: add, fill fields, survive tab switch, duplicate, 2-step delete", async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByTestId("db-add-record").click();

    await page.getByTestId("db-field-name").fill("QA 스킬");
    await page.getByTestId("db-field-skill-description").fill("QA 설명");
    await page.getByTestId("db-field-skill-type").selectOption("teleport");
    await page.getByTestId("db-field-scope").selectOption("allEnemies");
    await page.getByTestId("db-field-power").fill("77");
    await page.getByTestId("db-field-skill-mp-flat").fill("5");
    await page.getByTestId("db-field-skill-mp-percent").fill("10");
    await page.getByTestId("db-field-skill-success").fill("90");
    await page.getByTestId("db-field-skill-hit-rate").fill("85");
    await page.getByTestId("db-field-skill-variance").fill("15");

    // Effect kind branching: damage exposes statistic/affects, support hides them.
    await expect(page.getByTestId("db-field-skill-effect-statistic")).toBeVisible();
    await page.getByTestId("db-field-skill-effect-kind").selectOption("support");
    await expect(page.getByTestId("db-field-skill-effect-statistic")).toHaveCount(0);
    await page.getByTestId("db-field-skill-effect-kind").selectOption("damage");
    await expect(page.getByTestId("db-field-skill-effect-statistic")).toBeVisible();

    // State effect row: add, edit, delete.
    await page.getByTestId("db-skill-state-effect-add").click();
    await expect(page.getByTestId("db-skill-state-effect-row-0")).toBeVisible();
    await page.getByTestId("db-field-skill-state-effect-chance-0").fill("35");
    await page.getByTestId("db-field-skill-state-effect-op-0").selectOption("remove");

    // Survive a tab switch away and back.
    await switchDatabaseTab(page, ITEMS_TAB);
    await switchDatabaseTab(page, SKILLS_TAB);
    await expect(page.getByTestId("db-field-name")).toHaveValue("QA 스킬");
    await expect(page.getByTestId("db-field-skill-description")).toHaveValue("QA 설명");

    const exported = await exportedProject(page);
    const created = exported.database.skills.find((skill) => skill.name === "QA 스킬");
    expect(created).toMatchObject({
      description: "QA 설명",
      type: "teleport",
      scope: "allEnemies",
      power: 77,
      mpCost: { flat: 5, percentMax: 10 },
      successRate: 90,
      hitRate: 85,
      variance: 15,
    });

    // Duplicate.
    const countBeforeDuplicate = await page.locator(".db-list-row").count();
    await page.getByText("복제", { exact: true }).click();
    await expect(page.locator(".db-list-row")).toHaveCount(countBeforeDuplicate + 1);

    // 2-step delete on the duplicate (now selected).
    await expect(page.getByTestId("db-delete-selected")).toHaveText("삭제");
    await page.getByTestId("db-delete-selected").click();
    await expect(page.getByTestId("db-delete-selected")).toHaveText("정말 삭제?");
    await page.getByTestId("db-delete-selected").click();
    await expect(page.locator(".db-list-row")).toHaveCount(countBeforeDuplicate);
  });

  test("reference guard blocks deletion of a skill an actor has learned", async ({ page }) => {
    // skill_sword_slash ("검격") is learned by the default actor "궁수" in a fresh project.
    await page.getByTestId("db-record-row-skill_sword_slash").click();
    await page.getByTestId("db-delete-selected").click();

    await expect(page.locator(".toast")).toContainText("궁수");
    await expect(page.locator(".toast")).toContainText("스킬을 사용 중입니다");
    // Blocked deletes never arm the confirm step.
    await expect(page.getByTestId("db-delete-selected")).toHaveText("삭제");

    const exported = await exportedProject(page);
    expect(exported.database.skills.some((skill) => skill.id === "skill_sword_slash")).toBe(true);
  });

  test("undo reverts the last field edit", async ({ page }) => {
    await page.getByTestId("db-record-row-skill_fire").click();
    const original = await page.getByTestId("db-field-skill-description").inputValue();

    await page.getByTestId("db-field-skill-description").fill("UNDO 테스트 설명");
    await expect(page.getByTestId("db-field-skill-description")).toHaveValue("UNDO 테스트 설명");

    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("db-field-skill-description")).toHaveValue(original);
  });
});
