import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openCommandPicker, openMapEventEditor } from "./eventStoryboardPicker";

/**
 * 진단 전용(`_` 접두사라 기본 실행에서 제외된다). 상점 편집창 단일 목록 재설계의
 * **after** 실측을 4해상도로 남긴다. before 는 `verify-shots/shop-event-recon/before/`.
 *
 * 편집창은 한 번만 열고 뷰포트만 바꾼다 — 좁은 뷰포트에서 맵 더블클릭으로 이벤트를 만드는
 * 경로가 불안정한데(상점과 무관), 우리가 재려는 건 열린 창의 반응형 거동이다.
 */
const OUT_DIR = "verify-shots/shop-event-recon/after";
const SIZES = [
  { w: 1600, h: 1000 },
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1280, h: 720 },
] as const;

test.describe.configure({ timeout: 300_000 });

test("shop single-list after shots at four viewports", async ({ page }) => {
  await mkdir(OUT_DIR, { recursive: true });
  const metrics: Record<string, unknown> = {};

  await page.setViewportSize({ width: SIZES[0].w, height: SIZES[0].h });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible({ timeout: 60_000 });
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await openMapEventEditor(page);
  const dialog = await pickShop(page);
  const goods = dialog.getByTestId("shop-item-catalog");

  for (const size of SIZES) {
    await page.setViewportSize({ width: size.w, height: size.h });
    const tag = `${size.w}x${size.h}`;

    await goods.evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.screenshot({ path: path.join(OUT_DIR, `A-${tag}-default.png`) });
    metrics[`${tag}-default`] = await snapshot(dialog);

    // 스크롤이 실제로 먹는지: 목록 맨 아래(마지막 DB 아이템)까지 내려 찍는다.
    await goods.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await page.screenshot({ path: path.join(OUT_DIR, `B-${tag}-scrolled-bottom.png`) });
    metrics[`${tag}-scrolled`] = await snapshot(dialog);
  }

  // 상세 + 거래 분기 + 고급을 모두 켠 최악의 세로 압박 상태를 가장 좁은 뷰포트에서.
  await page.setViewportSize({ width: 1280, height: 720 });
  await goods.evaluate((node) => {
    node.scrollTop = 0;
  });
  await dialog.locator('[data-testid="shop-sale-list"] .shop-goods-pick').first().click();
  await dialog.getByTestId("shop-branch-on-transaction").check();
  await dialog.getByTestId("shop-advanced-toggle").click();
  await page.screenshot({ path: path.join(OUT_DIR, "C-1280x720-detail-branch-advanced.png") });
  metrics["1280x720-worstcase"] = await snapshot(dialog);

  await writeFile(path.join(OUT_DIR, "after.json"), `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
});

async function pickShop(page: Page): Promise<Locator> {
  const picker = await openCommandPicker(page);
  await picker.getByTestId("event-command-picker-search").fill("상점");
  await picker.locator(".event-command-picker-search-results .event-command-picker-command").first().click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("shop-item-catalog")).toBeVisible();
  return dialog;
}

/** 도달 가능성과 굶주림을 숫자로 남긴다 — 스크린샷만으로는 회귀를 못 잡는다. */
async function snapshot(dialog: Locator): Promise<unknown> {
  return await dialog.evaluate((root) => {
    const pick = (testid: string) => root.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
    const box = (node: HTMLElement | null) =>
      node
        ? {
            clientH: node.clientHeight,
            scrollH: node.scrollHeight,
            scrollTop: Math.round(node.scrollTop),
            rows: node.querySelectorAll('[data-testid^="shop-item-row-"]').length,
          }
        : null;
    const scrolling = [...root.querySelectorAll<HTMLElement>("*")]
      .filter((node) => /auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1)
      .map((node) => node.dataset.testid ?? `.${node.className.split(/\s+/)[0]}`);
    const hiddenFocusables = [...root.querySelectorAll('[aria-hidden="true"]')]
      .flatMap((node) => [...node.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")])
      .filter((node) => node.tabIndex >= 0).length;
    return {
      goods: box(pick("shop-item-catalog")),
      saleList: box(pick("shop-sale-list")),
      stockPool: box(pick("shop-stock-pool")),
      detail: box(pick("shop-item-detail")),
      rail: box(pick("shop-options-rail")),
      scrollers: scrolling,
      ariaHiddenFocusables: hiddenFocusables,
    };
  });
}
