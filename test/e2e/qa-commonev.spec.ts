import { expect, test, type Page } from "@playwright/test";
import { exportedProject, openDatabase, switchDatabaseTab } from "./rm2k3-database-helpers";

const COMMON_EVENTS_TAB = { label: "Common Events", slug: "common-events", testId: "db-tab-common-events" } as const;
const ACTORS_TAB = { label: "Actors", slug: "actors", testId: "db-tab-actors" } as const;

const LONG_NAME = "QA공통이벤트경계값이름아주길게길게길게삼십자이상테스트";

async function gotoExpert(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?freshProject=1");
}

async function openCommonEventsTab(page: Page): Promise<void> {
  await openDatabase(page);
  await switchDatabaseTab(page, COMMON_EVENTS_TAB);
}

async function addCommonEvent(page: Page): Promise<void> {
  await page.getByRole("button", { name: "+ 공통 이벤트 추가" }).click();
  await expect(page.getByTestId("db-common-event-command-list")).toBeVisible();
}

test.describe("QA sweep: common events tab", () => {
  test("CRUD round trip: add, fill fields, tab away/back, export, delete", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoExpert(page);
    await openCommonEventsTab(page);

    // fresh project starts with zero real records (no more decorative placeholder rows —
    // wave2 fix removed the 0001~0010 decoration; only "+ 추가" is shown when empty)
    await expect(page.locator("button.db-list-row")).toHaveCount(0);

    await addCommonEvent(page);
    await expect(page.locator("button.db-list-row")).toHaveCount(1);

    // fill: long name (30+ chars), trigger, condition switch
    const nameInput = page.locator(".db-common-event-editor .db-row input");
    await nameInput.fill(LONG_NAME);
    await page.locator(".db-common-event-editor .db-field select").first().selectOption("parallel");
    const checkbox = page.locator(".db-common-event-editor input[type=checkbox]");
    await checkbox.check();
    const switchSelect = page.locator(".db-checkbox-field select");
    const firstSwitch = await switchSelect.locator("option").nth(1).getAttribute("value");
    if (firstSwitch) await switchSelect.selectOption(firstSwitch);

    // tab away and back — values must persist
    await switchDatabaseTab(page, ACTORS_TAB);
    await switchDatabaseTab(page, COMMON_EVENTS_TAB);
    await expect(page.locator(".db-common-event-editor .db-row input")).toHaveValue(LONG_NAME);
    await expect(page.locator(".db-common-event-editor .db-field select").first()).toHaveValue("parallel");
    await expect(page.locator(".db-common-event-editor input[type=checkbox]")).toBeChecked();
    if (firstSwitch) await expect(page.locator(".db-checkbox-field select")).toHaveValue(firstSwitch);

    // exported project reflects the record
    const project = await exportedProject(page);
    const created = project.commonEvents.find((event) => event.name === LONG_NAME);
    expect(created, "created common event should exist in exported project").toBeTruthy();
    expect(created?.trigger).toBe("parallel");
    if (firstSwitch) expect(created?.conditionSwitchId).toBe(firstSwitch);

    // empty name renders the "(이름 없음)" fallback label in the list
    await page.locator(".db-common-event-editor .db-row input").fill("");
    await switchDatabaseTab(page, ACTORS_TAB);
    await switchDatabaseTab(page, COMMON_EVENTS_TAB);
    await expect(page.locator("button.db-list-row .db-list-name").first()).toHaveText("(이름 없음)");

    // delete: two-step confirm (wave2 fix closed the 1-click gap from qa-commonev-report)
    const deleteButton = page.locator(".db-common-event-editor .db-row button", { hasText: "삭제" });
    await deleteButton.click();
    await expect(deleteButton).toHaveText("정말 삭제?");
    await expect(page.locator("button.db-list-row")).toHaveCount(1);
    await deleteButton.click();
    await expect(page.locator("button.db-list-row")).toHaveCount(0);
    const afterDelete = await exportedProject(page);
    expect(afterDelete.commonEvents).toHaveLength(0);
  });

  test("command list: picker add, context menu insert/copy/paste/delete, nested fork, undo", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoExpert(page);
    await openCommonEventsTab(page);
    await addCommonEvent(page);

    // double-click empty line opens the full command picker; add setSwitch
    await page.getByTestId("event-command-empty-line").dblclick();
    await expect(page.getByTestId("event-command-picker")).toBeVisible();
    await page.getByTestId("command-picker-add-setSwitch").click();
    await page.getByTestId("event-command-edit-dialog").getByTestId("event-command-edit-ok").click();
    await expect(page.getByTestId("event-command-picker")).toBeHidden();
    await expect(page.getByTestId("event-command-setSwitch").first()).toBeVisible();

    // right-click context menu exposes insert/edit/copy/paste/delete
    await page.getByTestId("event-command-setSwitch").first().locator(".cmd-head").click({ button: "right" });
    for (const item of ["insert", "edit", "copy", "paste", "delete"]) {
      await expect(page.getByTestId(`event-command-menu-${item}`)).toBeVisible();
    }

    // insert a fork (nested container) via the context menu
    await page.getByTestId("event-command-menu-insert").click();
    await expect(page.getByTestId("event-command-picker")).toBeVisible();
    await page.getByTestId("command-picker-add-fork").click();
    await page.getByTestId("event-command-edit-dialog").getByTestId("event-command-edit-ok").click();
    await expect(page.getByTestId("event-command-fork")).toHaveCount(1);

    // copy + paste duplicates the command
    await page.getByTestId("event-command-setSwitch").first().locator(".cmd-head").click({ button: "right" });
    await page.getByTestId("event-command-menu-copy").click();
    await page.getByTestId("event-command-setSwitch").first().locator(".cmd-head").click({ button: "right" });
    await page.getByTestId("event-command-menu-paste").click();
    await expect(page.getByTestId("event-command-setSwitch")).toHaveCount(2);

    // delete removes one; Ctrl+Z (command-list edits are snapshot-wired) restores it
    await page.getByTestId("event-command-setSwitch").first().locator(".cmd-head").click({ button: "right" });
    await page.getByTestId("event-command-menu-delete").click();
    await expect(page.getByTestId("event-command-setSwitch")).toHaveCount(1);
    await page.locator("h3", { hasText: "공통 이벤트" }).click();
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("event-command-setSwitch")).toHaveCount(2);

    // exported commands include the fork container and both setSwitch commands
    const project = await exportedProject(page);
    const commands = project.commonEvents[0]?.commands ?? [];
    expect(commands.filter((command) => command.kind === "setSwitch")).toHaveLength(2);
    expect(commands.some((command) => command.kind === "fork")).toBe(true);
  });
});
