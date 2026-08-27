import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { openCommandPicker, openMapEventEditor } from "./eventStoryboardPicker";
import { screenshotEvidence, writeEvidenceJson } from "./eventEditorCertEvidence";

const EVIDENCE_DIR = "output/evidence/shop-command-fullscreen";

test.setTimeout(180_000);

/**
 * 상점은 진열·재고·옵션이 한 화면에 다 있어야 하는 특수 명령이라 편집 창을 전체화면으로 연다.
 * 일반 명령(문장 표시)은 기존 wide 창을 유지한다 — 이 계약을 제품 표면에서 확인한다.
 */
test("shop command edit dialog opens fullscreen while ordinary commands stay wide", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);

  await openMapEventEditor(page);

  const shopDialog = await pickBySearch(page, "상점");
  const shopWindow = shopDialog.locator(".event-subdialog-window");
  await expect(shopWindow).toHaveClass(/\bfull\b/);
  await expect(shopDialog.getByTestId("shop-command-body")).toBeVisible();
  await expect(shopDialog.getByTestId("shop-options-rail")).toBeVisible();

  const shopMetrics = await measure(page, shopWindow);
  expect(shopMetrics.widthRatio).toBeGreaterThanOrEqual(0.9);
  expect(shopMetrics.heightRatio).toBeGreaterThanOrEqual(0.9);

  const rail = shopDialog.getByTestId("shop-options-rail");
  for (const testId of [
    "shop-type-select",
    "shop-quantity-mode",
    "shop-message-type",
    "shop-merchant-gold",
    "shop-branch-on-transaction",
    "shop-serviceKind",
    "shop-investmentLevel",
    "shop-mileageRate",
  ]) {
    await expect(rail.getByTestId(testId)).toBeVisible();
  }
  await screenshotEvidence(page, EVIDENCE_DIR, "C001-shop-dialog-fullscreen.png");

  await shopDialog.getByTestId("event-command-edit-cancel").click();
  await expect(shopDialog).toHaveCount(0);

  const textDialog = await pickBySearch(page, "문장 표시");
  const textWindow = textDialog.locator(".event-subdialog-window");
  await expect(textWindow).toHaveClass(/\bwide\b/);
  const textMetrics = await measure(page, textWindow);
  expect(textMetrics.widthRatio).toBeLessThan(0.9);
  await screenshotEvidence(page, EVIDENCE_DIR, "C002-text-dialog-stays-wide.png");
  await textDialog.getByTestId("event-command-edit-cancel").click();

  await writeEvidenceJson(EVIDENCE_DIR, "C001-shop-dialog-fullscreen.json", {
    cleanup: "Playwright closes the browser context; the dev server is the shared worktree server.",
    shop: shopMetrics,
    text: textMetrics,
    proves: "Shop command opens a fullscreen subdialog with every option on one rail; ordinary commands keep the wide window.",
  });
});

async function dismissOverlays(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible({ timeout: 60_000 });
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function pickBySearch(page: Page, query: string): Promise<Locator> {
  const picker = await openCommandPicker(page);
  await picker.getByTestId("event-command-picker-search").fill(query);
  await picker
    .locator(".event-command-picker-search-results .event-command-picker-command")
    .first()
    .click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function measure(
  page: Page,
  window: Locator
): Promise<{ readonly widthRatio: number; readonly heightRatio: number; readonly width: number; readonly height: number }> {
  const box = await window.boundingBox();
  if (!box) throw new Error("missing subdialog window box");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("missing viewport size");
  return {
    width: Math.round(box.width),
    height: Math.round(box.height),
    widthRatio: Number((box.width / viewport.width).toFixed(3)),
    heightRatio: Number((box.height / viewport.height).toFixed(3)),
  };
}
