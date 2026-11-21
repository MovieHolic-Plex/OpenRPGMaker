import { expect, test, type Page } from "@playwright/test";

// 이벤트 에디터 도움말(eventEditorHelp.ts)에 배치할 섹션별 스크린샷를 찍는다.
// 실행: npx playwright test capture-event-editor-help-images.spec.ts
// 결과물: public/assets/help/event-editor/*.png
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test.setTimeout(150_000);

async function settle(page: Page, ms = 700): Promise<void> {
  await page.waitForTimeout(ms);
}

async function waitForCanvasReady(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  // 빈 프로젝트 부팅 스플래시가 캔버스보다 오래 남는다. 5초는 그 화면에서 끊긴다.
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const c = document.querySelector("[data-testid='edit-canvas'] canvas") as HTMLCanvasElement | null;
    return !!c && c.width > 0 && c.height > 0;
  });
  await settle(page, 1200);
}

async function openRail(page: Page, slug: string): Promise<void> {
  const group = page.getByTestId(`evt-rail-group-${slug}`);
  const open = await group.evaluate((node) => node.classList.contains("is-open"));
  if (!open) {
    await group.locator(".event-editor-settings-accordion-header").evaluate((node: HTMLElement) => {
      node.scrollIntoView({ block: "center", inline: "nearest" });
      node.click();
    });
  }
  await expect(group).toHaveClass(/is-open/);
}

// 이벤트 레이어에서 빈 칸을 더블클릭해야 편집기가 열린다. 바닥 레이어의 더블클릭은 타일을 칠 뿐이다.
async function openEventEditor(page: Page): Promise<void> {
  await page.getByTestId("layer-event").click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas").last();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing edit canvas");
  const candidates = [
    { x: 0.5, y: 0.5 },
    { x: 0.2, y: 0.45 },
    { x: 0.25, y: 0.75 },
    { x: 0.35, y: 0.72 },
    { x: 0.18, y: 0.62 },
  ];
  for (const c of candidates) {
    await canvas.dblclick({ position: { x: Math.floor(box.width * c.x), y: Math.floor(box.height * c.y) } });
    try {
      await page.getByTestId("event-editor-modal").waitFor({ state: "visible", timeout: 4_000 });
      return;
    } catch {
      /* try next */
    }
  }
  throw new Error("event editor did not open");
}

test("capture event editor help images", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  await waitForCanvasReady(page);

  await openEventEditor(page);
  await settle(page, 600);
  const modal = page.getByTestId("event-editor-modal");

  // 1) 페이지 탭 + 페이지 속성 전체
  await expect(modal.getByTestId("evt-page-segment-1")).toBeVisible();
  await page.screenshot({ path: "public/assets/help/event-editor/pages.png" });

  // 2) 실행 조건 — 「언제 보이나요」는 레일 본문이 아니라 조건 창이다.
  await openRail(page, "when");
  const conditions = page.getByTestId("event-condition-modal");
  await expect(conditions).toBeVisible();
  await settle(page, 400);
  await page.screenshot({ path: "public/assets/help/event-editor/conditions.png" });
  await page.getByTestId("event-condition-modal-done").click();
  await expect(conditions).toBeHidden();

  // 3) 명령 피커 — 빈 줄 클릭 한 번. 두 번째는 방금 열린 피커를 닫는다.
  const emptyLine = modal.getByTestId("event-command-empty-line");
  await expect(emptyLine).toBeVisible();
  await emptyLine.click();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await settle(page, 400);
  await page.screenshot({ path: "public/assets/help/event-editor/commands.png" });
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();

  // 4) 그래픽 선택기
  await openRail(page, "look-talk");
  await modal.getByTestId("event-page-graphic-set").click();
  const graphic = page.getByTestId("event-graphic-dialog");
  await expect(graphic).toBeVisible();
  await settle(page, 400);
  await page.screenshot({ path: "public/assets/help/event-editor/graphics.png" });
  await page.keyboard.press("Escape");
  await expect(graphic).toBeHidden();

  // 5) 이동 경로 편집기
  await openRail(page, "move");
  await modal.getByTestId("event-page-movement-type").selectOption("custom");
  await modal.getByTestId("event-page-custom-route").click();
  const route = page.getByTestId("event-page-move-route-dialog");
  await expect(route).toBeVisible();
  await settle(page, 400);
  await page.screenshot({ path: "public/assets/help/event-editor/move-route.png" });
});
