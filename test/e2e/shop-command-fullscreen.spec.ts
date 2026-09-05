import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { openCommandPicker, openMapEventEditor, showCommandList } from "./eventStoryboardPicker";
import { screenshotEvidence, writeEvidenceJson } from "./eventEditorCertEvidence";

const EVIDENCE_DIR = "output/evidence/shop-ux";
test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible({ timeout: 60_000 });
  for (const id of ["standard-welcome-start", "coach-mark-skip"]) {
    const button = page.getByTestId(id);
    if (await button.isVisible()) await button.click();
  }
});

test("shop authoring separates the catalog, preserves staged edits and fits desktop sizes", async ({ page }) => {
  const editor = await openMapEventEditor(page);
  const shop = await pickBySearch(page, "상점");
  await expect(shop.locator(".event-subdialog-window")).toHaveClass(/\bfull\b/);
  await expect(shop.getByTestId("shop-item-row-item_potion")).toBeVisible();
  await expect(shop.getByTestId("shop-item-check-item_potion")).toHaveCount(0);
  await expect(shop.getByTestId("shop-type-select")).toHaveCount(0);

  await shop.getByTestId("shop-add-goods").click();
  const catalog = page.getByTestId("shop-catalog-dialog");
  const list = catalog.getByTestId("shop-catalog-list");
  await expect(catalog.getByTestId("shop-item-check-item_potion")).toBeDisabled();
  const checks = list.locator('input[type="checkbox"]');
  expect(await checks.count()).toBeGreaterThan(20);
  await list.hover(); await page.mouse.wheel(0, 1600);
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await checks.last().scrollIntoViewIfNeeded();
  expect(await checks.last().evaluate(el => {
    const r = el.getBoundingClientRect(); const p = el.closest('.shop-catalog-list')!.getBoundingClientRect();
    return r.top >= p.top && r.bottom <= p.bottom;
  })).toBe(true);
  await screenshotEvidence(page, EVIDENCE_DIR, "02-catalog.png");
  await catalog.getByTestId("shop-item-search").fill("포획 구슬");
  await catalog.getByTestId("shop-item-check-item_capture_orb").check();
  // Pending selection does not alter the parent's goods before Apply.
  await expect(shop.getByTestId("shop-item-row-item_capture_orb")).toHaveCount(0);
  await catalog.getByTestId("shop-catalog-cancel").click();
  await expect(shop.getByTestId("shop-item-row-item_capture_orb")).toHaveCount(0);
  await shop.getByTestId("shop-add-goods").click();
  await catalog.getByTestId("shop-preset-friendly").click();
  await catalog.getByTestId("shop-catalog-add").click();
  await expect(shop.getByTestId("shop-item-row-item_capture_orb")).toBeVisible();
  await expect(shop.getByTestId("shop-add-goods")).toBeFocused();

  await shop.getByTestId("shop-item-row-item_potion").click();
  await shop.getByTestId("shop-stock-price-custom").check();
  const price = shop.getByTestId("shop-stock-price-override");
  await price.fill("75"); await price.press("Tab");
  await shop.getByTestId("shop-stock-season-spring").click();
  await shop.getByTestId("shop-item-row-item_ether").click();
  await shop.getByTestId("shop-stock-season-summer").click();
  await shop.getByTestId("shop-item-row-item_potion").click();
  await expect(price).toHaveValue("75");
  await expect(shop.getByTestId("shop-stock-season-spring")).toHaveAttribute("aria-pressed", "true");
  await expect(shop.getByTestId("shop-item-row-item_potion")).toContainText("75 G");
  await shop.getByTestId("shop-preview-toggle").click();
  await expect(shop.getByTestId("event-command-preview")).toBeVisible();
  await expect(shop.getByTestId("ecp-shop-window")).toContainText("75 G");
  await expect(shop.getByTestId("shop-stock-price-override")).toBeHidden();
  await shop.getByTestId("shop-preview-toggle").click();

  const sizes = [];
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    const geometry = await shop.evaluate(root => {
      const window = root.querySelector('.event-subdialog-window')!;
      const list = root.querySelector('[data-testid="shop-item-catalog"]')!;
      const item = root.querySelector('[data-testid="shop-item-row-item_potion"]')!;
      const apply = root.querySelector('[data-testid="event-command-edit-ok"]')!;
      const r = item.getBoundingClientRect(), l = list.getBoundingClientRect(), a = apply.getBoundingClientRect();
      return { width: window.clientWidth, scrollWidth: window.scrollWidth, listHeight: list.clientHeight,
        rowVisible: r.top >= l.top && r.bottom <= l.bottom, applyVisible: a.bottom <= innerHeight && a.right <= innerWidth };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
    expect(geometry.listHeight).toBeGreaterThanOrEqual(200);
    expect(geometry.rowVisible).toBe(true); expect(geometry.applyVisible).toBe(true);
    sizes.push({ viewport: { width, height }, ...geometry });
    await screenshotEvidence(page, EVIDENCE_DIR, `01-goods-${width}.png`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await shop.getByTestId("shop-tab-rules").click();
  await expect(shop.getByTestId("shop-haggle-patience")).toHaveCount(0);
  await shop.getByTestId("shop-economy-haggle").check();
  await shop.getByTestId("shop-haggle-discount").fill("35");
  await shop.getByTestId("shop-haggle-discount").press("Tab");
  await shop.getByTestId("shop-economy-haggle").uncheck();
  await expect(shop.getByTestId("shop-haggle-patience")).toHaveCount(0);
  await shop.getByTestId("shop-merchant-gold").fill("777");
  await shop.getByTestId("shop-merchant-gold").press("Tab");
  // Native selects are enhanced by the shared popup; use the visible product controls.
  await shop.locator('[data-custom-select-for="shop-type-select"]').click();
  await page.getByRole("option", { name: "구매만 가능", exact: true }).click();
  await expect(shop.getByTestId("shop-merchant-budget")).toBeHidden();
  await shop.locator('[data-custom-select-for="shop-type-select"]').click();
  await page.getByRole("option", { name: "구매·판매 가능", exact: true }).click();
  await expect(shop.getByTestId("shop-merchant-gold")).toHaveValue("777");
  await screenshotEvidence(page, EVIDENCE_DIR, "03-rules.png");
  await shop.getByTestId("shop-tab-messages").click();
  await shop.locator('[data-custom-select-for="shop-message-type"]').click();
  await page.getByRole("option", { name: "VIP", exact: true }).click();
  await expect(shop.getByTestId("shop-message-example-0")).toContainText("VIP 고객님");
  await shop.getByTestId("shop-tab-branches").click();
  await shop.getByTestId("shop-branch-on-failed-transaction").check();
  await expect(shop.getByTestId("shop-failed-branch-row")).toBeVisible();
  await shop.getByTestId("shop-add-failed-branch-command").click();
  await expect(shop.getByTestId("shop-tab-branches")).toHaveAttribute("aria-selected", "true");
  await shop.getByTestId("event-command-edit-ok").click();
  await expect(shop).toHaveCount(0);

  await showCommandList(editor);
  const row = editor.getByTestId("event-command-shop").first().locator(".cmd-head");
  await row.click(); await row.dblclick();
  await expect(shop).toBeVisible();
  await expect(shop.getByTestId("shop-stock-price-override")).toHaveValue("75");
  await shop.getByTestId("shop-tab-rules").click();
  await expect(shop.getByTestId("shop-merchant-gold")).toHaveValue("777");
  await expect(shop.getByTestId("shop-economy-haggle")).not.toBeChecked();
  await shop.getByTestId("shop-economy-haggle").check();
  await expect(shop.getByTestId("shop-haggle-discount")).toHaveValue("35");
  await shop.getByTestId("event-command-edit-cancel").click();
  await writeEvidenceJson(EVIDENCE_DIR, "geometry.json", sizes);
});

test("catalog Escape and tab navigation preserve the parent, and ordinary commands stay wide", async ({ page }) => {
  await openMapEventEditor(page);
  const shop = await pickBySearch(page, "상점");
  await shop.getByTestId("shop-add-goods").click();
  await expect(page.getByTestId("shop-catalog-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("shop-catalog-dialog")).toHaveCount(0);
  await expect(shop).toBeVisible(); await expect(shop.getByTestId("shop-add-goods")).toBeFocused();
  await shop.getByTestId("shop-tab-goods").focus();
  await page.keyboard.press("ArrowRight");
  await expect(shop.getByTestId("shop-tab-rules")).toBeFocused();
  await expect(shop.getByTestId("shop-type-select")).toHaveCount(1);
  await shop.getByTestId("event-command-edit-cancel").focus();
  await page.keyboard.press("Tab");
  await expect(shop.getByRole("button", { name: "닫기", exact: true })).toBeFocused();
  await shop.getByTestId("event-command-edit-cancel").click();
  const ordinary = await pickBySearch(page, "문장 표시");
  await expect(ordinary.locator(".event-subdialog-window")).toHaveClass(/\bwide\b/);
  await ordinary.getByTestId("event-command-edit-cancel").click();
});

async function pickBySearch(page: Page, query: string): Promise<Locator> {
  const picker = await openCommandPicker(page);
  await picker.getByTestId("event-command-picker-search").fill(query);
  await picker.locator(".event-command-picker-search-results .event-command-picker-command").first().click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible(); return dialog;
}
