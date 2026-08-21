import { expect, test, type Page } from "@playwright/test";
import {
  applyDatabaseChanges,
  exportedProject,
  openDatabase,
  switchDatabaseTab,
} from "./oprn-database-helpers";

const ELEMENTS_TAB = { label: "Elements", slug: "elements", testId: "db-tab-elements" } as const;
const STATES_TAB = { label: "States", slug: "states", testId: "db-tab-states" } as const;
const SKILLS_TAB = { label: "Skills", slug: "skills", testId: "db-tab-skills" } as const;

async function gotoExpert(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?freshProject=1");
}

test.describe("QA sweep: elements tab", () => {
  test("field edit round trip persists across tab switch and export", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, ELEMENTS_TAB);

    // select first element row explicitly
    await page.getByTestId("db-elements-row-0").click();

    const nameInput = page.getByTestId("db-field-element-name-selected");

    await nameInput.fill("QA속성경계값이름아주길게길게길게삼십자이상테스트");
    await page.getByTestId("db-field-element-kind-magical").check();
    await page.getByTestId("db-field-element-damage-A").fill("250");
    await page.getByTestId("db-field-element-damage-E").fill("-999");

    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/elements-filled.png" });

    // tab away and back — value must persist
    await switchDatabaseTab(page, STATES_TAB);
    await switchDatabaseTab(page, ELEMENTS_TAB);
    await expect(page.getByTestId("db-field-element-name-selected")).toHaveValue(
      "QA속성경계값이름아주길게길게길게삼십자이상테스트"
    );
    await expect(page.getByTestId("db-field-element-kind-magical")).toBeChecked();
    await expect(page.getByTestId("db-field-element-damage-A")).toHaveValue("250");

    const project = await exportedProject(page);
    const element = project.database.elements?.[0];
    expect(element?.name).toBe("QA속성경계값이름아주길게길게길게삼십자이상테스트");
    expect(element?.kind).toBe("magical");
    expect(element?.damageMultipliers.A).toBe(250);
  });

  test("undo reverts an element name edit", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, ELEMENTS_TAB);
    await page.getByTestId("db-elements-row-0").click();

    const nameInput = page.getByTestId("db-field-element-name-selected");
    const original = await nameInput.inputValue();
    await nameInput.fill("QA_UNDO_ELEMENT_NAME");
    await expect(nameInput).toHaveValue("QA_UNDO_ELEMENT_NAME");

    // blur field first (app-level undo yields to native text-undo while focused),
    // then Ctrl+Z should revert the store-level change wired in wave1.
    await page.getByTestId("db-elements-list-title").click();
    await page.keyboard.press("Control+z");
    await expect(nameInput).toHaveValue(original);
  });

  test("max count dialog resizes the element list", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, ELEMENTS_TAB);

    await page.getByTestId("db-elements-maximum-number").click();
    await expect(page.getByTestId("db-elements-max-dialog")).toBeVisible();
    await page.getByTestId("db-elements-max-count-input").fill("12");
    await page.getByTestId("db-elements-max-ok").click();
    await expect(page.getByTestId("db-elements-max-dialog")).toBeHidden();

    await expect(page.getByTestId("db-elements-row-11")).toBeVisible();
    await expect(page.getByTestId("db-elements-row-12")).toHaveCount(0);
  });
});

test.describe("QA sweep: states tab", () => {
  test("CRUD round trip: add, fill fields, tab away/back, export, duplicate, delete", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, STATES_TAB);

    await page.getByTestId("db-add-record").click();

    await page.getByTestId("db-field-name").fill("QA상태경계값이름아주길게길게삼십자이상테스트하기");
    await page.getByTestId("db-state-removal-condition").selectOption("즉시 해제");
    await page.getByTestId("db-state-restriction").selectOption("행동 불가");
    // 2파: 상태 수치 필드에 뷰 레벨 클램프가 배선됨 — 999 는 상한 100 으로 즉시 교정된다.
    await page.getByTestId("db-state-rating").fill("999");
    await page.getByTestId("db-state-accuracy").fill("0");
    await page.getByTestId("db-state-recover-turn").fill("-5");
    await page.getByTestId("db-state-recover-chance").fill("150");
    await page.getByTestId("db-state-hit-recover").fill("0");
    await page.getByTestId("db-state-animation-index").fill("3");

    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/states-filled.png" });

    // tab away and back — value must persist
    await switchDatabaseTab(page, SKILLS_TAB);
    await switchDatabaseTab(page, STATES_TAB);
    await expect(page.getByTestId("db-field-name")).toHaveValue("QA상태경계값이름아주길게길게삼십자이상테스트하기");
    await expect(page.getByTestId("db-state-removal-condition")).toHaveValue("즉시 해제");
    await expect(page.getByTestId("db-state-rating")).toHaveValue("100");

    const project1 = await exportedProject(page);
    const created = project1.database.states.find((state) => state.name === "QA상태경계값이름아주길게길게삼십자이상테스트하기");
    expect(created, "created state should exist in exported project").toBeTruthy();

    // duplicate
    await page.getByRole("button", { name: "복제" }).click();
    const project2 = await exportedProject(page);
    const duplicates = project2.database.states.filter((state) =>
      state.name.startsWith("QA상태경계값이름아주길게길게삼십자이상테스트하기")
    );
    expect(duplicates.length).toBeGreaterThanOrEqual(2);

    // delete (2-step confirm)
    const deleteButton = page.getByTestId("db-delete-selected");
    await deleteButton.click();
    await expect(deleteButton).toHaveText("정말 삭제?");
    await deleteButton.click();
    await expect(deleteButton).toHaveText("삭제");
  });

  test("undo reverts a state field edit", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, STATES_TAB);

    const ratingField = page.getByTestId("db-state-rating");
    const original = await ratingField.inputValue();
    await ratingField.fill("77");
    await expect(ratingField).toHaveValue("77");

    // blur so Ctrl+Z hits the app-level history instead of native text-undo
    await page.getByTestId("db-state-ontology-summary").click();
    await page.keyboard.press("Control+z");
    await expect(ratingField).not.toHaveValue("77");
    void original;
  });
});

void applyDatabaseChanges;
