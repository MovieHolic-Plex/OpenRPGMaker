import { expect, test, type Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createShopShowcaseProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";
import { debugState } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = ".omo/evidence/task-10-event-playwright";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("rpg-zzu-editor-session-id", "task-10-event");
  });
});

test("event delete confirmation supports dismiss and accept without manual browser input", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 840 });
  await seedProjectFromSupabaseCanonical(page, createShopShowcaseProject());
  await openSeededEventEditor(page, "ev_shopkeeper");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("이 이벤트를 삭제할까요?");
    await dialog.dismiss();
  });
  await page.getByTestId("event-delete").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(page.getByTestId("event-list-row-ev_shopkeeper")).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("이 이벤트를 삭제할까요?");
    await dialog.accept();
  });
  await page.getByTestId("event-delete").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  await expect(page.getByTestId("event-list-row-ev_shopkeeper")).toHaveCount(0);
  const state = await debugState(page);
  expect(Object.values(state.project.maps).flatMap((map) => map.events).some((event) => event.id === "ev_shopkeeper")).toBe(false);
  await page.screenshot({ path: `${EVIDENCE_DIR}/event-delete-confirmed.png`, fullPage: true });
  await writeFile(`${EVIDENCE_DIR}/event-delete-confirmation.json`, `${JSON.stringify({ dismissedFirst: true, acceptedSecond: true }, null, 2)}\n`, "utf8");
});

test("shop transaction branch survives apply, OK, and editor reopen", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 840 });
  await seedProjectFromSupabaseCanonical(page, shopBranchProject());
  await openSeededEventEditor(page, "ev_shopkeeper");

  const shop = page.getByTestId("event-command-shop").first();
  await openInlineCommand(shop);
  await shop.getByTestId("shop-add-transaction-branch-command").click();
  await page.getByTestId("event-editor-apply").click();
  await expect(page.getByTestId("event-editor-diff")).toContainText("변경 없음");
  expect(shopCommand(await debugState(page))?.transactionBranch?.some((command) => command.kind === "text")).toBe(true);

  await page.getByTestId("event-editor-ok").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  await openSeededEventEditor(page, "ev_shopkeeper");
  await expect(page.getByTestId("event-command-shop").first()).toBeVisible();
  expect(shopCommand(await debugState(page))?.transactionBranch?.some((command) => command.kind === "text")).toBe(true);
  await page.screenshot({ path: `${EVIDENCE_DIR}/event-shop-branch-reopened.png`, fullPage: true });
});

async function openInlineCommand(command: Locator): Promise<void> {
  await expect(command).toBeVisible();
  await command.locator(".cmd-head").dblclick();
  await expect(command).toHaveClass(/editing/);
}

async function openSeededEventEditor(page: Page, eventId: string): Promise<void> {
  await page.getByTestId("layer-event").click();
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if (await visibleEventTool.count() > 0) await visibleEventTool.click();
  await page.getByTestId(`event-list-row-${eventId}`).click();
  await page.getByTestId("event-editor-open").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
}

function shopCommand(state: { readonly project: Project }): Extract<Command, { kind: "shop" }> | undefined {
  return Object.values(state.project.maps)
    .flatMap((map) => map.events)
    .flatMap((event) => event.pages?.flatMap((page) => page.commands) ?? [])
    .find((command): command is Extract<Command, { kind: "shop" }> => command.kind === "shop");
}

function shopBranchProject(): Project {
  const project = createShopShowcaseProject();
  const event = Object.values(project.maps).flatMap((map) => map.events).find((candidate) => candidate.id === "ev_shopkeeper");
  const page = event?.pages?.[0];
  if (!event || !page) throw new Error("missing starter event page");
  const itemId = project.database.items[0]?.id ?? "";
  const commands: Command[] = [{ kind: "shop", itemIds: itemId ? [itemId] : [], shopType: "normal", messageType: "welcome", branchOnTransaction: true }];
  event.commands = commands;
  page.commands = commands;
  return project;
}
