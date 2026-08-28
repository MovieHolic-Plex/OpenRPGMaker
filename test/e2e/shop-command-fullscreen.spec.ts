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
  for (const testId of ["shop-type-select", "shop-quantity-mode", "shop-message-type", "shop-merchant-gold", "shop-branch-on-transaction"]) {
    await expect(rail.getByTestId(testId)).toBeVisible();
  }
  // 드물게 쓰는 셋은 «고급» 밑에 접혀 있다 — 펼쳐야 보인다.
  const advancedBody = rail.getByTestId("shop-advanced-body");
  await expect(advancedBody).toBeHidden();
  await rail.getByTestId("shop-advanced-toggle").click();
  for (const testId of ["shop-serviceKind", "shop-investmentLevel", "shop-mileageRate"]) {
    await expect(rail.getByTestId(testId)).toBeVisible();
  }
  await screenshotEvidence(page, EVIDENCE_DIR, "C001-shop-dialog-fullscreen.png");

  // 「한 화면에 다 보인다」는 창 크기 비율이 아니라 **도달 가능성**으로 확인한다. 예전 이
  // 스펙은 비율과 레일 testid 가시성만 봤고, 그 사이 담기 버튼이 aria-hidden 트레이로
  // 옮겨가고 자료집 179행이 전부 잘려도 계속 통과했다.
  const reach = await measureReachability(page, shopDialog);
  await writeEvidenceJson(EVIDENCE_DIR, "C003-shop-goods-reachability.json", reach);
  // 1600×1000 에서 DB 전체가 목록 스크롤로 닿아야 한다. 예전 `<details>` 자료집은
  // UA `::details-content` 때문에 scrollTop 이 0 에 못 박혀 6번째 이후가 영구히 잠겼다.
  expect(reach.scrollHeight).toBeGreaterThan(reach.clientHeight);
  expect(reach.scrollTopAfterWheel).toBeGreaterThan(0);
  expect(reach.lastRowReachable).toBe(true);
  // 본문 열의 스크롤러는 상품 목록 하나뿐이다 — 중첩 스크롤러가 있으면 휠이 엉킨다.
  // (오른쪽 옵션 레일은 설계상 자기 스크롤러를 갖는다.)
  expect(reach.mainColumnScrollers).toEqual(["shop-item-catalog"]);
  // aria-hidden 안에 포커스 가능한 노드가 없다 (WCAG 4.1.2 / axe aria-hidden-focus).
  expect(reach.ariaHiddenFocusables).toBe(0);
  // 「스크롤은 되는데 두 줄만 보인다」로 퇴화하지 않도록 쓸 만한 높이도 못 박는다. #183 이
  // 듀얼 리스트 시절 진열 목록에 걸어 둔 6행 바닥인데, 단일 목록으로 합치면서 사라졌다.
  expect(reach.clientHeight, "상품 목록이 최소 6행(약 160px)은 보여야 한다").toBeGreaterThanOrEqual(160);

  // 가장 좁은 지원 해상도에서도 판매 중 행이 최소 하나는 온전히 보인다.
  await page.setViewportSize({ width: 1280, height: 720 });
  await shopDialog.getByTestId("shop-item-check-item_potion").check();
  const narrow = await measureSaleList(shopDialog);
  expect(narrow.rowVisibleHeight).toBeGreaterThanOrEqual(narrow.rowHeight);
  // 거래 후 분기를 켜도 목록이 굶지 않는다 — 예전에는 판매 목록이 0px 로 눌렸다.
  await shopDialog.getByTestId("shop-branch-on-transaction").check();
  const withBranch = await measureSaleList(shopDialog);
  expect(withBranch.rowVisibleHeight).toBeGreaterThanOrEqual(withBranch.rowHeight);
  await screenshotEvidence(page, EVIDENCE_DIR, "C003-shop-goods-narrow-with-branch.png");
  await writeEvidenceJson(EVIDENCE_DIR, "C003-shop-sale-list-narrow.json", { narrow, withBranch });
  await page.setViewportSize({ width: 1600, height: 1000 });

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
      "Shop command opens a fullscreen subdialog with every option on one rail and one checkbox list that reaches the whole item DB (wheel scrolls, last row reachable, single scroller in the main column, no focusable node inside aria-hidden, list at least 6 rows tall); ordinary commands keep the wide window.",
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

type Reachability = {
  readonly rowCount: number;
  readonly saleRowCount: number;
  readonly clientHeight: number;
  readonly scrollHeight: number;
  readonly scrollTopAfterWheel: number;
  readonly lastRowReachable: boolean;
  /** 실제로 스크롤되는 노드들의 testid(없으면 class). 본문 열에는 상품 목록 하나만 있어야 한다. */
  readonly scrollers: readonly string[];
  readonly mainColumnScrollers: readonly string[];
  readonly ariaHiddenFocusables: number;
};

/**
 * 목록 도달 가능성을 제품 표면에서 잰다. 「스크롤바가 있다」로는 부족하다 — 예전 자료집은
 * overflow:auto 였는데도 UA `::details-content` 때문에 실제로는 한 픽셀도 움직이지 않았다.
 */
async function measureReachability(page: Page, dialog: Locator): Promise<Reachability> {
  const goods = dialog.getByTestId("shop-item-catalog");
  await expect(goods).toBeVisible();
  const rows = goods.locator('[data-testid^="shop-item-row-"]');
  // 필터가 없으면 DB 전체가 두 그룹에 나뉘어 전부 렌더된다 — 행 수가 곧 DB 수다.
  const rowCount = await rows.count();
  const saleRowCount = await dialog.locator('[data-testid="shop-sale-list"] [data-testid^="shop-item-row-"]').count();
  const before = await goods.evaluate((node) => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }));

  await goods.hover();
  for (let i = 0; i < 12; i += 1) await page.mouse.wheel(0, 400);
  const scrollTopAfterWheel = await goods.evaluate((node) => Math.round(node.scrollTop));

  const last = rows.last();
  await last.scrollIntoViewIfNeeded();
  const lastRowReachable = await last.evaluate((node) => {
    const scroller = node.closest<HTMLElement>('[data-testid="shop-item-catalog"]');
    if (!scroller) return false;
    const row = node.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    // 그룹 머리글이 sticky 라 위쪽은 살짝 겹칠 수 있다. 행 절반 이상이 보이면 도달로 본다.
    const overlap = Math.min(row.bottom, box.bottom) - Math.max(row.top, box.top);
    return overlap >= row.height / 2;
  });

  const audit = await dialog.evaluate((root) => {
    const scrolling = [...root.querySelectorAll<HTMLElement>("*")].filter((node) => {
      const style = getComputedStyle(node);
      return /auto|scroll/.test(`${style.overflowY}`) && node.scrollHeight > node.clientHeight + 1;
    });
    const name = (node: HTMLElement) => node.dataset.testid ?? `.${node.className.split(/\s+/)[0]}`;
    const focusableInHidden = [...root.querySelectorAll('[aria-hidden="true"]')]
      .flatMap((node) => [...node.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")])
      .filter((node) => node.tabIndex >= 0);
    return {
      scrollers: scrolling.map(name),
      mainColumnScrollers: scrolling.filter((node) => node.closest(".shop-processing-main")).map(name),
      ariaHiddenFocusables: focusableInHidden.length,
    };
  });

  return {
    rowCount,
    saleRowCount,
    clientHeight: Math.round(before.clientHeight),
    scrollHeight: Math.round(before.scrollHeight),
    scrollTopAfterWheel,
    lastRowReachable,
    ...audit,
  };
}

/** 판매 중 그룹의 첫 행이 스크롤러 안에서 실제로 몇 픽셀 보이는지. */
async function measureSaleList(
  dialog: Locator
): Promise<{ readonly rowHeight: number; readonly rowVisibleHeight: number; readonly listClientHeight: number }> {
  const row = dialog.locator('[data-testid="shop-sale-list"] [data-testid^="shop-item-row-"]').first();
  await expect(row).toBeVisible();
  await dialog.getByTestId("shop-item-catalog").evaluate((node) => {
    node.scrollTop = 0;
  });
  return await row.evaluate((node) => {
    const scroller = node.closest<HTMLElement>('[data-testid="shop-item-catalog"]');
    if (!scroller) throw new Error("missing shop goods scroller");
    const box = node.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    return {
      rowHeight: Math.round(box.height),
      rowVisibleHeight: Math.round(Math.max(0, Math.min(box.bottom, view.bottom) - Math.max(box.top, view.top))),
      listClientHeight: Math.round(scroller.clientHeight),
    };
  });
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
