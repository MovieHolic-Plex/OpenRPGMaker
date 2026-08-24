import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createFarmingDemoProject } from "@/project/defaults";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = ".superpowers/sdd/qa-shots/stardew-p0";

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

async function expectNotClipped(locator: Locator, label: string): Promise<void> {
  const metrics = await locator.evaluate((node) => {
    if (!(node instanceof HTMLElement)) throw new Error("expected an HTMLElement");
    return {
      clientHeight: node.clientHeight,
      clientWidth: node.clientWidth,
      scrollHeight: node.scrollHeight,
      scrollWidth: node.scrollWidth,
    };
  });
  expect(metrics.scrollWidth, `${label} horizontal clipping`).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight, `${label} vertical clipping`).toBeLessThanOrEqual(metrics.clientHeight + 1);
}

async function seedFarmingDemo(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await seedProjectFromSupabaseCanonical(page, createFarmingDemoProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  const coachSkip = page.getByRole("button", { name: "건너뛰기", exact: true }).first();
  if (await coachSkip.isVisible().catch(() => false)) await coachSkip.click();
}

async function openDatabaseAtAnyWidth(page: Page): Promise<void> {
  const toolbar = page.getByTestId("toolbar-database");
  if (await toolbar.isVisible().catch(() => false)) {
    await toolbar.click();
  } else {
    await page.getByTestId("authoring-task-data").click();
  }
  await expect(page.getByTestId("database-modal")).toBeVisible();
}

test("P0 생활 시스템을 좁은 에디터에서도 완전하게 저작하고 읽는다", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  await seedFarmingDemo(page);
  await openDatabaseAtAnyWidth(page);
  await page.getByTestId("db-tab-life-crafting").click({ force: true });

  await expect(page.getByTestId("db-life-crafting-header")).toContainText("생활 기술·제작");
  for (const section of ["skills", "energy", "shipping", "bundles", "makers"] as const) {
    const button = page.getByTestId(`db-life-section-${section}`);
    await expect(button).toBeVisible();
    await expectNotClipped(button, `database section ${section}`);
  }

  await page.getByTestId("db-life-section-energy").click();
  await expect(page.getByTestId("db-life-energy-max")).toHaveValue("100");
  await expect(page.getByTestId("db-life-energy-initial")).toHaveValue("100");
  await expect(page.getByTestId("db-life-energy-restore")).toHaveValue("100");

  await page.getByTestId("db-life-section-bundles").click();
  await expect(page.getByTestId("db-life-bundle-id")).toBeVisible();
  await expect(page.getByText("필요 아이템", { exact: true })).toBeVisible();

  await page.getByTestId("db-life-section-makers").click();
  await expect(page.getByTestId("db-life-maker-id")).toBeVisible();
  await expect(page.getByText("가공 시간(분)", { exact: true })).toBeVisible();

  const modalBox = await page.getByTestId("database-modal").boundingBox();
  expect(modalBox).not.toBeNull();
  expect(modalBox!.x).toBeGreaterThanOrEqual(0);
  expect(modalBox!.y).toBeGreaterThanOrEqual(0);
  expect(modalBox!.x + modalBox!.width).toBeLessThanOrEqual(1025);
  expect(modalBox!.y + modalBox!.height).toBeLessThanOrEqual(769);
  await page.screenshot({ path: `${EVIDENCE_DIR}/editor-life-crafting-1024.png`, fullPage: true });
});

test("생활 장부 5개 탭과 실제 출하 동작을 터치 화면에서도 검증한다", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  await seedFarmingDemo(page);
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page, { timeoutMs: 30_000 });
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });

  await page.evaluate(() => {
    const runtime = window as typeof window & { __oprnDebug?: { giveItem?: (itemId: string, count: number) => void } };
    runtime.__oprnDebug?.giveItem?.("item_potato", 2);
  });
  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.getByTestId("status-menu-command-record-menu").click();
  await page.getByTestId("status-menu-group-command-life-ledger").click();
  await expect(page.getByTestId("status-menu-detail-title")).toHaveText("생활 장부");

  const touchPad = page.locator(".play-stage > .touch-pad");
  if (await touchPad.count()) await expect(touchPad).toHaveCSS("visibility", "hidden");
  await expect(page.getByTestId("main-menu")).toHaveCSS("color", "rgb(255, 255, 255)");

  for (const tab of ["shipping", "bundles", "skills", "makers", "animals"] as const) {
    const button = page.getByTestId(`life-ledger-tab-${tab}`);
    await expect(button).toBeVisible();
    await expectNotClipped(button, `life ledger tab ${tab}`);
    await button.click();
    await expect(button).toHaveAttribute("aria-selected", "true");
    const artwork = page.getByTestId("life-ledger-artwork");
    await expect(artwork).toBeVisible();
    await expect(artwork).toHaveAttribute("src", /\/assets\/farming\/life-ui\/.+\.png/);
    await page.getByTestId("main-menu").screenshot({ path: `${EVIDENCE_DIR}/runtime-life-ledger-${tab}.png` });
  }

  await page.getByTestId("life-ledger-tab-shipping").click();
  const deposit = page.getByTestId("life-ledger-shipping-deposit-item_potato");
  await expect(deposit).toBeEnabled();
  await deposit.click();
  await expect(page.getByTestId("main-menu")).toContainText("출하");
  await page.getByTestId("main-menu").screenshot({ path: `${EVIDENCE_DIR}/runtime-life-ledger-shipping-action.png` });
});
