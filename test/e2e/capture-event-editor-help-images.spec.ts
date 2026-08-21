import { expect, test, type Page } from "@playwright/test";

// 이벤트 에디터 도움말(eventEditorHelp.ts)에 배치할 섹션별 스크린샷를 찍는다.
// 실행: npx playwright test capture-event-editor-help-images.spec.ts
// 결과물: public/assets/help/event-editor/*.png
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test.setTimeout(90_000);

async function settle(page: Page, ms = 700): Promise<void> {
  await page.waitForTimeout(ms);
}

async function waitForCanvasReady(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  await page.waitForFunction(() => {
    const c = document.querySelector("[data-testid='edit-canvas'] canvas") as HTMLCanvasElement | null;
    return !!c && c.width > 0 && c.height > 0;
  });
  await settle(page, 1200);
}

async function expandDetails(page: Page, testid: string): Promise<void> {
  await page.evaluate((id) => {
    const node = document.querySelector(`[data-testid='${id}']`);
    if (node instanceof HTMLDetailsElement) node.open = true;
  }, testid);
}

// 캔버스 더블클릭으로 이벤트 에디터를 연다. 빈 칸일 수 있으므로 여러 후보 좌표를 시도.
async function openEventEditor(page: Page): Promise<boolean> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) return false;
  const candidates = [
    { x: 0.2, y: 0.45 },
    { x: 0.25, y: 0.75 },
    { x: 0.35, y: 0.72 },
    { x: 0.18, y: 0.62 },
    { x: 0.5, y: 0.5 },
  ];
  for (const c of candidates) {
    await canvas.dblclick({ position: { x: Math.floor(box.width * c.x), y: Math.floor(box.height * c.y) } });
    try {
      await page.getByTestId("event-page-tabs").waitFor({ state: "visible", timeout: 1200 });
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

test("capture event editor help images", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  await waitForCanvasReady(page);

  const opened = await openEventEditor(page);
  if (!opened) {
    // 이벤트 에디터를 열지 못하면 스킵 — 캡처는 최선의 노력이다.
    test.skip();
    return;
  }
  await settle(page, 600);

  // 1) 페이지 탭 + 페이지 속성 전체
  await page.screenshot({ path: "public/assets/help/event-editor/pages.png" });

  // 2) 실행 조건 영역 — details 펼치기 후 스크롤
  await expandDetails(page, "event-classic-conditions");
  const pageProps = page.getByTestId("event-page-props");
  if (await pageProps.isVisible().catch(() => false)) {
    await pageProps.scrollIntoViewIfNeeded().catch(() => {});
    await settle(page, 500);
  }
  await page.screenshot({ path: "public/assets/help/event-editor/conditions.png" });

  // 3) 명령 피커 — 빈 명령 줄 더블클릭으로 열기
  const emptyLine = page.getByTestId("event-command-empty-line");
  if (await emptyLine.isVisible().catch(() => false)) {
    await emptyLine.dblclick().catch(() => {});
    try {
      await page.getByTestId("event-command-picker").waitFor({ state: "visible", timeout: 1500 });
      await settle(page, 500);
      await page.screenshot({ path: "public/assets/help/event-editor/commands.png" });
    } catch {
      /* picker did not open */
    }
    await page.keyboard.press("Escape");
    await settle(page, 300);
  }

  // 4) 그래픽 선택기 — 페이지 속성의 그래픽 설정 버튼
  const graphicSet = page.getByTestId("event-page-graphic-set");
  if (await graphicSet.isVisible().catch(() => false)) {
    await graphicSet.scrollIntoViewIfNeeded().catch(() => {});
    await graphicSet.click().catch(() => {});
    await settle(page, 600);
    await page.screenshot({ path: "public/assets/help/event-editor/graphics.png" });
    await page.keyboard.press("Escape");
    await settle(page, 300);
  }

  // 5) 이동 경로 — details 펼치기 후 스크롤
  await expandDetails(page, "event-classic-movement-section");
  const movement = page.getByTestId("event-page-movement");
  if (await movement.isVisible().catch(() => false)) {
    await movement.scrollIntoViewIfNeeded().catch(() => {});
    await settle(page, 500);
    await page.screenshot({ path: "public/assets/help/event-editor/move-route.png" });
  }
});
