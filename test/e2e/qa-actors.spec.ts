import { expect, test, type Page } from "@playwright/test";
import {
  DATABASE_TAB_SPECS,
  applyDatabaseChanges,
  exportedProject,
  openDatabase,
  switchDatabaseTab,
} from "./rm2k3-database-helpers";

const ACTORS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "actors")!;
const CLASSES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "classes")!;

async function gotoExpertDatabase(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await openDatabase(page);
  await switchDatabaseTab(page, ACTORS_TAB);
}

async function selectedActorId(page: Page): Promise<string> {
  const row = page.locator(".db-list-row.active");
  await expect(row).toBeVisible();
  const id = await row.getAttribute("data-record-id");
  if (!id) throw new Error("no selected actor row");
  return id;
}

async function addActor(page: Page): Promise<string> {
  await page.getByTestId("db-add-record").click();
  return selectedActorId(page);
}

// BUG (Critical, see report): at the default desktop viewport (>=901px), the actor sheet's
// center column (능력치 곡선 / parameter curves + 경험치 곡선 / exp curve) and the inspector
// jump-nav are both `display:none` via src/styles/database/actors.css:616-618 and :782-784.
// There is no UI path to reach them at that width. We drop just under the 901px breakpoint
// here so this spec can actually exercise those dialogs (they work correctly once visible —
// this is a pure CSS regression, not a functional break in the dialog logic).
async function useSubBreakpointViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 880, height: 960 });
}

test.describe("QA — actors tab", () => {
  test.beforeEach(async ({ page }) => {
    await gotoExpertDatabase(page);
  });

  test("recon: full sheet screenshot + panel inventory", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.location().url.includes("17831") && !msg.text().includes("17831")) {
        consoleErrors.push(msg.text());
      }
    });

    await page.screenshot({ path: ".superpowers/sdd/qa-shots/actors-initial-list.png" });
    // select first actor (hero) to inspect default sheet
    await page.locator(".db-list-row").first().click();
    await expect(page.getByTestId("db-detail-form")).toBeVisible();
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/actors-default-sheet.png", fullPage: true });

    const panelIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-testid^='actor-panel-']")).map((node) => (node as HTMLElement).dataset.testid)
    );
    console.log("ACTOR PANELS:", panelIds.join(", "));

    // BUG: at >=901px (default desktop viewport) the inspector jump-nav is CSS-hidden
    // (src/styles/database/actors.css:782-784, inside the `@media (min-width: 901px)` block,
    // a duplicate `.actor-inspector-tabs` selector sets display:none and wins the cascade
    // over the base display:flex rule at line 366). Documented in the report; not exercised
    // as a working interaction here since it is not actually clickable at this viewport.
    const inspectorTabsBox = await page.getByTestId("db-actor-inspector-tabs").boundingBox();
    console.log("INSPECTOR TABS BOUNDING BOX AT DESKTOP WIDTH:", JSON.stringify(inspectorTabsBox));

    // Confirm the underlying scroll-required layout the jump-nav was meant to address:
    // the classic sheet is significantly taller than its scroll viewport at desktop width.
    const scrollMetrics = await page.evaluate(() => {
      const sheet = document.querySelector(".actor-classic-sheet");
      if (!(sheet instanceof HTMLElement)) return null;
      return { clientHeight: sheet.clientHeight, scrollHeight: sheet.scrollHeight };
    });
    console.log("CLASSIC SHEET SCROLL METRICS:", JSON.stringify(scrollMetrics));

    // scroll the sheet down manually to capture the curve editor area (brief: "스크롤 아래")
    await page.evaluate(() => document.querySelector(".actor-classic-sheet")?.scrollTo({ top: 400 }));
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/actors-scrolled-curves.png" });

    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("CRUD round trip: add, fill every control, tab away/back, export, duplicate, delete", async ({ page }) => {
    test.setTimeout(90_000);
    await useSubBreakpointViewport(page);
    const id = await addActor(page);
    await expect(page.getByTestId("db-detail-form")).toBeVisible();

    // identity
    await page.getByTestId("db-field-name").fill("QA 액터");
    await page.getByTestId("db-field-actor-nickname").fill("QA닉");
    await page.getByTestId("db-field-initial-level").fill("5");
    await page.getByTestId("db-field-max-level").fill("50");
    await page.getByTestId("db-field-actor-critical-enabled").uncheck();
    // BUG (Major, see report): identityPanel's checkboxControl/numberControl for
    // critical.{enabled,chanceDenominator} both close over the same render-time `actor`
    // snapshot and spread `...actor.critical` (actorRecordView.ts identityPanel, ~L61-66) —
    // unlike battlePanel/ratesPanel which already use a `currentActor()` live re-fetch.
    // Editing both fields in the same render pass makes the second edit clobber the first
    // back to its pre-edit value. We force a full re-render (tab switch) between the two
    // edits here so this spec exercises the working path instead of the data-loss path.
    await switchDatabaseTab(page, CLASSES_TAB);
    await switchDatabaseTab(page, ACTORS_TAB);
    await page.getByTestId("db-field-actor-critical-rate").fill("42");

    // class picker
    const classSelect = page.getByTestId("db-picker-class");
    const classOptions = await classSelect.locator("option").all();
    if (classOptions.length > 1) {
      const secondValue = await classOptions[1].getAttribute("value");
      if (secondValue) await classSelect.selectOption(secondValue);
    }

    // graphics: face resource dialog
    await openAndConfirmResourceDialog(page, "db-field-face-resource");
    // graphics: character resource dialog
    await openAndConfirmResourceDialog(page, "db-field-character-resource");
    await page.getByTestId("db-field-character-transparent").check();
    // graphics: battle character resource dialog
    await openAndConfirmResourceDialog(page, "db-field-battle-character-resource");

    await page.screenshot({ path: ".superpowers/sdd/qa-shots/actors-crud-graphics-filled.png" });

    // initial equipment: 5 dropdowns
    const equipmentSlots = ["weapon", "shield", "helmet", "armor", "accessory"];
    for (const slot of equipmentSlots) {
      const select = page.getByTestId(`db-picker-actor-equipment-${slot}`);
      const options = await select.locator("option").all();
      if (options.length > 1) {
        const value = await options[1].getAttribute("value");
        if (value) await select.selectOption(value);
      }
    }

    // options checkboxes x4
    for (const key of ["dualWield", "autoBattle", "fixedEquipment", "mightyGuard"]) {
      await page.getByTestId(`db-field-actor-option-${key}`).check();
    }

    // skills: add two, edit level, delete one
    await page.getByTestId("db-add-actor-skill").click();
    await page.getByTestId("db-add-actor-skill").click();
    await expect(page.getByTestId("db-field-actor-skill-level-0")).toBeVisible();
    await page.getByTestId("db-field-actor-skill-level-0").fill("10");
    await page.locator(".actor-skill-row").nth(1).getByRole("button", { name: "삭제" }).click();

    // rates: state + element grades
    await page.getByTestId("db-picker-actor-state-rate-state_death").selectOption("A");
    await page.locator(".actor-rate-row select").last().selectOption("E");

    await page.screenshot({ path: ".superpowers/sdd/qa-shots/actors-crud-battle-filled.png", fullPage: true });

    // curve editor dialog: attack
    await page.getByTestId("db-actor-curve-edit-attack").click();
    await expect(page.getByTestId("db-actor-parameter-dialog")).toBeVisible();
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/actors-curve-dialog.png" });
    await page.getByTestId("db-actor-parameter-level").fill("10");
    await page.getByTestId("db-actor-parameter-value").fill("777");
    await page.getByTestId("db-actor-parameter-apply").click();
    await page.getByTestId("db-actor-parameter-close").click();
    await expect(page.getByTestId("db-actor-parameter-dialog")).toBeHidden();

    // exp curve dialog
    await page.getByTestId("db-actor-exp-edit").click();
    await expect(page.getByTestId("db-actor-exp-dialog")).toBeVisible();
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/actors-exp-dialog.png" });
    // exp dialog inputs commit on native "change" (blur), not "input" — Tab to blur each
    // (see boundary-values test for a note on why this differs from every other number field).
    await page.getByTestId("db-actor-exp-base").fill("100");
    await page.getByTestId("db-actor-exp-base").press("Tab");
    await page.getByTestId("db-actor-exp-extra").fill("500");
    await page.getByTestId("db-actor-exp-extra").press("Tab");
    await page.getByTestId("db-actor-exp-acceleration").fill("20");
    await page.getByTestId("db-actor-exp-acceleration").press("Tab");
    await page.getByTestId("db-actor-exp-close").click();
    await expect(page.getByTestId("db-actor-exp-dialog")).toBeHidden();
    // BUG (Major, see report): the "경험치 곡선" panel summary span does NOT live-refresh when
    // the exp dialog closes (openActorExperienceDialog never calls the outer rerender()), so the
    // panel still shows the pre-edit values here. The underlying data IS correct — confirmed
    // below after a tab switch forces a full re-render, and via exportedProject().

    // switch tab away and back, verify persistence in UI
    await switchDatabaseTab(page, CLASSES_TAB);
    await switchDatabaseTab(page, ACTORS_TAB);
    await expect(page.getByTestId(`db-record-row-${id}`)).toHaveClass(/active/);
    await expect(page.getByTestId("db-field-name")).toHaveValue("QA 액터");
    await expect(page.getByTestId("db-field-actor-nickname")).toHaveValue("QA닉");
    await expect(page.getByTestId("db-field-initial-level")).toHaveValue("5");
    await expect(page.getByTestId("db-field-max-level")).toHaveValue("50");
    await expect(page.getByTestId("db-field-actor-critical-enabled")).not.toBeChecked();
    await expect(page.getByTestId("db-field-actor-critical-rate")).toHaveValue("42");
    await expect(page.getByTestId("db-actor-exp-summary")).toContainText("기본=100");

    // exportedProject: verify actual project state reflects the edits
    const project = await exportedProject(page);
    const actor = project.database.actors.find((entry) => entry.name === "QA 액터");
    expect(actor, "exported actor QA 액터 should exist").toBeTruthy();
    expect(actor?.nickname).toBe("QA닉");
    expect(actor?.characterTransparent).toBe(true);
    expect(actor?.options.dualWield).toBe(true);
    expect(actor?.options.autoBattle).toBe(true);
    expect(actor?.options.fixedEquipment).toBe(true);
    expect(actor?.options.mightyGuard).toBe(true);
    expect(actor?.expCurve).toEqual({ base: 100, extra: 500, acceleration: 20 });
    expect(actor?.parameterCurves.attack[9]).toBe(777);
    expect(actor?.learnedSkills.length).toBe(1);
    expect(actor?.stateRates.state_death).toBe("A");

    // duplicate
    await page.locator(".btn.small", { hasText: "복제" }).click();
    const duplicatedId = await selectedActorId(page);
    expect(duplicatedId).not.toBe(id);
    await expect(page.getByTestId("db-field-name")).toHaveValue("QA 액터 사본");

    // delete: two-step confirm
    const deleteButton = page.getByTestId("db-delete-selected");
    await deleteButton.click();
    await expect(deleteButton).toHaveText("정말 삭제?");
    await expect(page.getByTestId(`db-record-row-${duplicatedId}`)).toBeVisible();
    await deleteButton.click();
    await expect(page.getByTestId(`db-record-row-${duplicatedId}`)).toBeHidden();

    // apply + confirm project persisted (footer autosave contract, already known-good)
    await applyDatabaseChanges(page);
  });

  test("boundary values: empty name, level clamp, long name, critical clamp, exp clamp, curve clamp", async ({ page }) => {
    test.setTimeout(60_000);
    await useSubBreakpointViewport(page);
    const id = await addActor(page);

    // empty name
    await page.getByTestId("db-field-name").fill("");
    await switchDatabaseTab(page, CLASSES_TAB);
    await switchDatabaseTab(page, ACTORS_TAB);
    await expect(page.getByTestId(`db-record-row-${id}`)).toContainText("(이름 없음)");

    // long name (40 chars)
    const longName = "가".repeat(40);
    await page.getByTestId("db-field-name").fill(longName);
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/actors-boundary-long-name.png" });

    // negative / over-max level clamp
    await page.getByTestId("db-field-initial-level").fill("-5");
    await page.getByTestId("db-field-max-level").fill("99999");
    await switchDatabaseTab(page, CLASSES_TAB);
    await switchDatabaseTab(page, ACTORS_TAB);
    await expect(page.getByTestId("db-field-initial-level")).toHaveValue("1");
    await expect(page.getByTestId("db-field-max-level")).toHaveValue("99");

    // critical chance denominator clamp: 0 -> 1, 5000 -> 100
    await page.getByTestId("db-field-actor-critical-rate").fill("0");
    await switchDatabaseTab(page, CLASSES_TAB);
    await switchDatabaseTab(page, ACTORS_TAB);
    await expect(page.getByTestId("db-field-actor-critical-rate")).toHaveValue("1");
    await page.getByTestId("db-field-actor-critical-rate").fill("5000");
    await switchDatabaseTab(page, CLASSES_TAB);
    await switchDatabaseTab(page, ACTORS_TAB);
    await expect(page.getByTestId("db-field-actor-critical-rate")).toHaveValue("100");

    // exp curve clamp: negative -> 0, huge -> 999999
    await page.getByTestId("db-actor-exp-edit").click();
    await page.getByTestId("db-actor-exp-base").fill("-100");
    await page.getByTestId("db-actor-exp-base").press("Tab");
    await page.getByTestId("db-actor-exp-close").click();
    // (panel summary is stale immediately after close — see CRUD test note; verify via tab switch)
    await switchDatabaseTab(page, CLASSES_TAB);
    await switchDatabaseTab(page, ACTORS_TAB);
    await expect(page.getByTestId("db-actor-exp-summary")).toContainText("기본=0");

    // parameter curve dialog clamp: 0 -> 1(min), huge -> 99999(max)
    // The dialog's 99-bar graph is fully rebuilt on every "적용" click (renderGraph()
    // replaces all children), which occasionally makes Playwright's stability wait hang on
    // the moving graph geometry — use force clicks since we independently assert dialog
    // visibility and the resulting field value.
    await page.getByTestId("db-actor-curve-edit-maxHp").scrollIntoViewIfNeeded();
    await page.getByTestId("db-actor-curve-edit-maxHp").click({ force: true });
    await expect(page.getByTestId("db-actor-parameter-dialog")).toBeVisible();
    await page.getByTestId("db-actor-parameter-level").fill("1");
    await page.getByTestId("db-actor-parameter-value").fill("0");
    await page.getByTestId("db-actor-parameter-apply").click({ force: true });
    await page.waitForTimeout(150);
    await expect(page.getByTestId("db-actor-parameter-dialog")).toBeVisible();
    await expect(page.getByTestId("db-actor-parameter-value")).toHaveValue("1");
    await page.getByTestId("db-actor-parameter-value").fill("9999999");
    await page.getByTestId("db-actor-parameter-apply").click({ force: true });
    await page.waitForTimeout(150);
    await expect(page.getByTestId("db-actor-parameter-dialog")).toBeVisible();
    await expect(page.getByTestId("db-actor-parameter-value")).toHaveValue("99999");
    await page.getByTestId("db-actor-parameter-close").click({ force: true });
  });

  test("undo: name field edit reverts with Ctrl+Z", async ({ page }) => {
    await page.locator(".db-list-row").first().click();
    const nameField = page.getByTestId("db-field-name");
    const original = await nameField.inputValue();
    await nameField.fill("Undo테스트이름");
    await switchDatabaseTab(page, CLASSES_TAB);
    await switchDatabaseTab(page, ACTORS_TAB);
    await expect(page.getByTestId("db-field-name")).toHaveValue("Undo테스트이름");

    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("db-field-name")).toHaveValue(original);
  });

  test("dead-control check: class panel '적용' button is permanently disabled", async ({ page }) => {
    await page.locator(".db-list-row").first().click();
    const applyButton = page.locator(".actor-class-row button", { hasText: "적용" });
    await expect(applyButton).toBeVisible();
    await expect(applyButton).toBeDisabled();
  });
});

async function openAndConfirmResourceDialog(page: Page, textInputTestId: string): Promise<void> {
  const setButton = page.locator(`[data-testid='${textInputTestId}']`).locator("xpath=following-sibling::button[1]");
  await setButton.click();
  const dialog = page.getByTestId("db-actor-resource-dialog");
  await expect(dialog).toBeVisible();
  const firstOption = dialog.locator("[data-testid^='db-actor-resource-dialog-option-']").first();
  if (await firstOption.count()) {
    await firstOption.click();
  }
  await page.getByTestId("db-actor-resource-dialog-ok").click();
  await expect(dialog).toBeHidden();
}
