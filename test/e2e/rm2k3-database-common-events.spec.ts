import { expect, test, type Page } from "@playwright/test";
import type { Command } from "@/project/types";
import { applyDatabaseChanges, openDatabase, switchDatabaseTab } from "./rm2k3-database-helpers";

test.setTimeout(60_000);

const COMMON_EVENTS_TAB = { label: "Common Events", slug: "common-events", testId: "db-tab-common-events" } as const;

type ExportedCommonEvent = {
  readonly name: string;
  readonly commands: readonly Command[];
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("rpg-zzu-editor-session-id", "e2e-db-common-events");
  });
});

test("database common events use the full command picker and preserve cancel/save behavior", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?freshProject=1");
  await openCommonEvents(page);

  await openCommonEventCommandPicker(page);
  await page.getByTestId("command-picker-add-setSwitch").click();
  let commandDialog = page.getByTestId("event-command-edit-dialog");
  await expect(commandDialog).toBeVisible();
  await commandDialog.locator("select").last().selectOption("false");
  await commandDialog.getByTestId("event-command-edit-cancel").click();
  await expect(commandDialog).toBeHidden();
  await page.getByTestId("event-command-picker-cancel").click();
  await expect(page.getByTestId("event-command-picker")).toBeHidden();
  await expect(page.getByTestId("event-command-setSwitch")).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath("db-common-event-cancel-without-mutation.png"), fullPage: true });

  await openCommonEventCommandPicker(page);
  await page.getByTestId("command-picker-add-setSwitch").click();
  commandDialog = page.getByTestId("event-command-edit-dialog");
  await commandDialog.getByTestId("event-command-edit-ok").click();
  const switchCommand = page.getByTestId("event-command-setSwitch").first();
  await expect(switchCommand).toBeVisible();

  await switchCommand.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-edit").click();
  commandDialog = page.getByTestId("event-command-edit-dialog");
  await commandDialog.locator("select").last().selectOption("false");
  await commandDialog.getByTestId("event-command-edit-cancel").click();
  await expectCommonEventHasSwitchValue(page, true);

  await switchCommand.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-edit").click();
  commandDialog = page.getByTestId("event-command-edit-dialog");
  await commandDialog.locator("select").last().selectOption("false");
  await commandDialog.getByTestId("event-command-edit-ok").click();
  await expectCommonEventHasSwitchValue(page, false);

  await openCommonEventCommandPicker(page);
  await page.getByTestId("command-picker-add-fork").click();
  commandDialog = page.getByTestId("event-command-edit-dialog");
  await commandDialog.getByTestId("event-command-edit-ok").click();
  const nestedText = page.getByTestId("event-command-text").last();
  await nestedText.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-insert").click();
  await page.getByTestId("command-picker-add-setSwitch").click();
  commandDialog = page.getByTestId("event-command-edit-dialog");
  await commandDialog.getByTestId("event-command-edit-ok").click();

  await applyDatabaseChanges(page);
  await page.getByTestId("database-footer-ok").click();
  await expect(page.getByTestId("database-modal")).toBeHidden();
  await openCommonEvents(page);
  await expect(page.getByTestId("event-command-setSwitch")).toHaveCount(2);
  await expectNestedCommonEventSwitch(page);

  await page.screenshot({ path: testInfo.outputPath("db-common-event-non-text-save.png"), fullPage: true });
});

async function openCommonEvents(page: Page): Promise<void> {
  await openDatabase(page);
  await switchDatabaseTab(page, COMMON_EVENTS_TAB);
  if (await page.getByTestId("db-common-event-command-list").count() === 0) {
    await page.getByRole("button", { name: /이벤트 추가/u }).click();
  }
  await expect(page.getByTestId("db-common-event-command-list")).toBeVisible();
}

async function openCommonEventCommandPicker(page: Page): Promise<void> {
  await page.getByTestId("event-command-empty-line").dblclick();
  await expect(page.getByTestId("event-command-picker")).toBeVisible();
}

async function exportedCommonEvents(page: Page): Promise<readonly ExportedCommonEvent[]> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export json");
  return (JSON.parse(text) as { readonly project: { readonly commonEvents: readonly ExportedCommonEvent[] } }).project.commonEvents;
}

async function expectCommonEventHasSwitchValue(page: Page, value: boolean): Promise<void> {
  const events = await exportedCommonEvents(page);
  expect(events[0]?.commands.some((command) => command.kind === "setSwitch" && command.value === value)).toBe(true);
}

async function expectNestedCommonEventSwitch(page: Page): Promise<void> {
  const events = await exportedCommonEvents(page);
  const fork = events[0]?.commands.find((command): command is Extract<Command, { kind: "fork" }> => command.kind === "fork");
  expect(fork?.then.some((command) => command.kind === "setSwitch")).toBe(true);
}
