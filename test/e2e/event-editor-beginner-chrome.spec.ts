import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * 초보 화면은 사람이 연 창의 기본이다. Playwright 는 webdriver 라 저장값이 없으면 고급으로
 * 열리므로, 이 스펙만 `oprn.event-editor.advanced=0` 을 박고 그 기본 화면을 본다.
 */
test.setTimeout(120_000);

const TRIGGER_DESCRIPTIONS = [
  "눈앞의 사람에게 말을 걸면 실행해요",
  "플레이어가 이 칸에 부딪히면 실행해요",
  "이 이벤트가 움직이다가 플레이어에게 닿으면 실행해요",
  "이 페이지가 켜지는 순간 한 번 실행해요",
  "이 페이지가 켜진 동안 뒤에서 계속 반복해요",
  "지정한 구역에 들어가거나 나올 때 실행해요",
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("oprn.event-editor.advanced", "0");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  });
});

test("beginner event editor hides advanced chrome and remembers when it is opened", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const modal = await openEventEditor(page);

  await expect(modal.getByTestId("event-editor-beginner-who")).toBeVisible();
  await expect(modal.getByTestId("event-editor-beginner-who")).toHaveText("누구(모습)");
  await expect(modal.getByTestId("event-editor-beginner-when")).toBeVisible();
  await expect(modal.getByTestId("event-editor-beginner-when")).toHaveText("언제(시작 방식)");
  await expect(modal.getByTestId("event-editor-beginner-commands")).toBeVisible();
  await expect(modal.getByTestId("event-editor-beginner-commands")).toHaveText("무엇을(명령 목록)");
  await expect(modal.getByTestId("evt-rail-group-when")).toBeHidden();
  await expect(modal.getByTestId("event-classic-pixel-fx")).toBeHidden();
  await expect(modal.getByTestId("event-view-toggle-storyboard")).toBeHidden();
  await expect(modal.getByTestId("event-view-toggle-flow")).toBeHidden();
  await expect(modal.getByTestId("event-command-edit-menu")).toBeHidden();
  await expect(modal.getByTestId("event-editor-aux-tools")).toBeHidden();

  const trigger = modal.locator("[data-testid='event-classic-trigger'] .event-custom-select-trigger");
  await expect(trigger).toHaveText("말을 걸면");
  await trigger.focus();
  await trigger.press("ArrowDown");
  for (const description of TRIGGER_DESCRIPTIONS) {
    await expect(page.locator(".event-custom-select-option-desc").filter({ hasText: description })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  await expect(trigger).toHaveText("말을 걸면");

  await expect(modal.locator(".evt-page-segment")).toHaveCount(1);
  await expect(modal.locator(".evt-page-segment")).toBeHidden();
  await expect(modal.locator(".evt-page-add-label")).toBeVisible();
  await expect(modal.locator(".evt-page-add-label")).toHaveText("페이지 추가");

  const footerButtons = modal.locator(".event-editor-footer-actions button");
  await expect(footerButtons).toHaveCount(2);
  await expect(footerButtons.nth(0)).toHaveText("취소");
  await expect(footerButtons.nth(1)).toHaveText("저장하고 닫기");

  const save = modal.getByTestId("event-editor-save");
  const status = modal.getByTestId("event-editor-draft-status");
  const name = modal.getByTestId("event-editor-name");
  await name.focus();
  await page.keyboard.press("Control+s");
  await expect(modal).toBeVisible();
  await expect(save).not.toHaveClass(/is-dirty/);
  await expect(status).toHaveAttribute("data-state", "applied");

  await name.fill("촌장");
  await name.press("Tab");
  await expect(save).toHaveClass(/is-dirty/);
  await page.keyboard.press("Control+s");
  await expect(modal).toBeVisible();
  await expect(save).not.toHaveClass(/is-dirty/);
  await expect(status).toHaveAttribute("data-state", "applied");
  await expect(name).toHaveValue("촌장");

  await modal.getByTestId("evt-page-add").click();
  await expect(modal.locator(".evt-page-segment")).toHaveCount(2);
  await expect(modal.locator(".evt-page-segment").nth(0)).toBeVisible();
  await expect(modal.locator(".evt-page-segment").nth(1)).toBeVisible();
  await expect(modal.locator(".evt-page-add-label")).toBeHidden();

  await modal.getByTestId("event-editor-advanced-toggle").click();
  await expect(modal.getByTestId("event-editor-advanced-toggle")).toHaveText("고급 설정 접기");
  await expect(modal.getByTestId("evt-rail-group-when")).toBeVisible();
  await expect(modal.getByTestId("event-classic-pixel-fx")).toBeVisible();
  await expect(modal.getByTestId("event-view-toggle-storyboard")).toBeVisible();
  await expect(modal.getByTestId("event-view-toggle-flow")).toBeVisible();
  await expect(modal.getByTestId("event-command-edit-menu")).toBeVisible();
  await expect(modal.getByTestId("event-editor-aux-tools")).toBeVisible();

  const none = modal.getByTestId("event-page-pixel-fx-current");
  const pick = modal.getByTestId("event-page-pixel-fx-pick");
  await none.scrollIntoViewIfNeeded();
  await expect(none).toHaveText("없음");
  await expect(pick).toHaveText("효과 고르기…");
  const noneBox = await none.boundingBox();
  const pickBox = await pick.boundingBox();
  if (!noneBox || !pickBox) throw new Error("persistent-effect boxes missing");
  expect(noneBox.width).toBeGreaterThan(0);
  expect(noneBox.height).toBeGreaterThan(0);
  expect(pickBox.width).toBeGreaterThan(0);
  expect(pickBox.height).toBeGreaterThan(0);
  expect(intersectionArea(noneBox, pickBox)).toBe(0);

  await page.keyboard.press("Control+s");
  await expect(modal).toBeVisible();
  await expect(save).not.toHaveClass(/is-dirty/);

  const ids = await modal.evaluate((element) => {
    if (!(element instanceof HTMLElement) || !element.dataset.eventId) throw new Error("missing event id");
    return element.dataset.eventId;
  });
  await modal.getByTestId("event-editor-modal-close").click();
  const confirm = page.getByTestId("app-confirm-modal");
  await Promise.race([
    modal.waitFor({ state: "detached" }),
    confirm.waitFor({ state: "visible" }).then(() => confirm.getByTestId("app-modal-confirm").click()),
  ]);
  await expect(modal).toHaveCount(0);

  const row = page.getByTestId(`event-list-row-${ids}`);
  await expect(row).toBeVisible();
  await row.click();
  await row.dblclick();
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("event-editor-advanced-toggle")).toHaveText("고급 설정 접기");
  await expect(modal.getByTestId("event-classic-pixel-fx")).toBeVisible();
  await expect(modal.getByTestId("event-view-toggle-storyboard")).toBeVisible();
  await expect(modal.getByTestId("evt-rail-group-when")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("oprn.event-editor.advanced"))).toBe("1");
});

async function openEventEditor(page: Page): Promise<Locator> {
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  await page.getByTestId("layer-event").click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas").last();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing event canvas");
  await canvas.dblclick({ position: { x: box.width / 2, y: box.height / 2 } });
  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  return modal;
}

function intersectionArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}
