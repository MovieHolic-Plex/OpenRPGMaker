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
  // 「한 화면에 다 보인다」는 크기 비율이 아니라 **도달 가능성**으로 확인한다.
  // 예전 이 스펙은 창 비율과 레일 testid 가시성만 봤고, 그 사이 담기/빼기 버튼이
  // aria-hidden 트레이로 옮겨가고 자료집 179행이 전부 잘려도 계속 통과했다.
  const reach = await assertShopReachable(shopDialog);
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
    reach,
    proves:
      "Shop command opens a fullscreen subdialog with every option on one rail, both item lists reachable (add/remove clickable, catalog scrollable, no focusable node inside aria-hidden); ordinary commands keep the wide window.",
  });
});

type ShopReach = {
  readonly saleListClientH: number;
  readonly clientH: number;
  readonly scrollH: number;
  readonly catalogScrolled: number;
  readonly ariaHiddenFocusable: number;
};

/**
 * 상점 편집창에서 사용자가 실제로 할 수 있어야 하는 것들:
 * 담기·빼기를 누를 수 있고, 두 목록이 쓸 만한 높이를 갖고, 자료집이 스크롤되고,
 * aria-hidden 안에 포커스 가능한 컨트롤이 없다.
 */
async function assertShopReachable(dialog: Locator): Promise<ShopReach> {
  for (const testId of ["shop-add-item", "shop-remove-item", "shop-move-item-up", "shop-move-item-down"]) {
    const button = dialog.getByTestId(testId);
    await expect(button, `${testId} 는 화면에 보여야 한다`).toBeVisible();
    expect(
      await button.evaluate((node) => Boolean(node.closest('[aria-hidden="true"]'))),
      `${testId} 가 aria-hidden 조상 안에 있다`
    ).toBe(false);
  }

  const saleScroller = dialog.locator('[data-testid="shop-sale-list"] .shop-processing-item-list');
  const saleListClientH = await saleScroller.evaluate((node) => node.clientHeight);
  expect(saleListClientH, "진열 목록이 최소 6행(약 160px)은 보여야 한다").toBeGreaterThanOrEqual(160);

  const catalog = dialog.getByTestId("shop-item-catalog");
  await expect(catalog).toBeVisible();
  const catalogBox = await catalog.evaluate((node) => ({
    clientH: node.clientHeight,
    scrollH: node.scrollHeight,
  }));
  expect(catalogBox.clientH, "자료집이 최소 4행은 보여야 한다").toBeGreaterThanOrEqual(120);
  expect(catalogBox.scrollH, "DB 전체가 자료집 안에 있어야 한다").toBeGreaterThan(catalogBox.clientH);

  // 스크롤이 실제로 먹는가 — ::details-content 회귀를 여기서 잡는다.
  const catalogScrolled = await catalog.evaluate((node) => {
    node.scrollTop = 400;
    return node.scrollTop;
  });
  expect(catalogScrolled, "자료집이 스크롤되지 않으면 6번째 이후 아이템에 닿을 수 없다").toBeGreaterThan(0);

  const ariaHiddenFocusable = await dialog.evaluate((root) => {
    const sel =
      "a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex],[contenteditable]";
    return Array.from(root.querySelectorAll('[aria-hidden="true"]')).reduce(
      (total, host) =>
        total + Array.from(host.querySelectorAll<HTMLElement>(sel)).filter((node) => node.tabIndex >= 0).length,
      0
    );
  });
  expect(ariaHiddenFocusable, "aria-hidden 안에 탭으로 닿는 컨트롤이 있으면 WCAG 4.1.2 위반").toBe(0);

  return { saleListClientH, ...catalogBox, catalogScrolled, ariaHiddenFocusable } as ShopReach;
}

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
