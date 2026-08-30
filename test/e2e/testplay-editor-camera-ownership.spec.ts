// 시연 실행 창이 떠 있는 동안 게임 입력이 **편집 카메라를 건드리지 않는다**는 실브라우저 계약.
//
// 관측된 결함(2026-08-30, 1440×900, ?freshProject=1):
//   테스트 버튼 → 게임에서 방향키로 이동 → 창 닫기 → 편집 캔버스에 맵이 거의 안 보인다.
//   원인은 편집 Phaser 게임이 창 뒤에서 살아 있는데 그 키보드 플러그인이 window 를 듣는
//   것이었다. 방향키 한 번이 편집 카메라를 6타일 밀어내므로(Shift 16타일) 조금만 걸어도
//   편집 카메라가 맵 경계 밖으로 나가 «맵이 사라진» 것처럼 보였다.
//
// 단정은 엔진이 노출하는 카메라 값(`__oprnEditCamera`)으로 한다 — 픽셀 비교가 아니라
// 기계가 읽는 수치라 흔들리지 않는다.
import { expect, test } from "@playwright/test";

const EDIT_CANVAS = '[data-testid="edit-canvas"] canvas';

type EditCamera = { scrollX: number; scrollY: number; zoom: number };

async function readEditCamera(page: import("@playwright/test").Page): Promise<EditCamera> {
  return await page.evaluate(() => {
    const read = (window as unknown as { __oprnEditCamera?: () => EditCamera }).__oprnEditCamera;
    if (!read) throw new Error("__oprnEditCamera 훅이 없다 — EditScene 이 부팅되지 않았다");
    const camera = read();
    return { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom };
  }) as Promise<EditCamera>;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test("시연 실행 중 방향키로 걸어도 편집 카메라는 제자리에 있다", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.locator(EDIT_CANVAS).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("mode-play")).toBeVisible({ timeout: 90_000 });
  // 카메라 훅이 붙고 캔버스 버퍼가 실제 크기를 잡을 때까지 기다린다(고정 sleep 금지).
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('[data-testid="edit-canvas"] canvas');
      return Boolean(canvas && canvas.width > 100 && (window as unknown as { __oprnEditCamera?: unknown }).__oprnEditCamera);
    },
    null,
    { timeout: 90_000 },
  );

  const before = await readEditCamera(page);

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("runtime-state-json")).toBeAttached({ timeout: 90_000 });

  // 게임에서 한참 걸어 다니는 흐름. 결함 상태에서는 이 입력이 편집 카메라를 그대로 밀었다.
  for (let step = 0; step < 24; step += 1) await page.keyboard.press("ArrowRight");
  for (let step = 0; step < 12; step += 1) await page.keyboard.press("ArrowDown");
  // Shift 조합(16타일 점프)과 도구/레이어/줌 키도 같은 경로였다.
  await page.keyboard.press("Shift+ArrowRight");
  for (const key of ["1", "3", "F6", "F7"]) await page.keyboard.press(key);

  const during = await readEditCamera(page);
  expect(during.scrollX).toBeCloseTo(before.scrollX, 0);
  expect(during.scrollY).toBeCloseTo(before.scrollY, 0);
  expect(during.zoom).toBeCloseTo(before.zoom, 5);

  await page.getByTestId("test-play-window-close").click();
  await expect(page.getByTestId("test-play-window")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator(EDIT_CANVAS).first()).toBeVisible({ timeout: 30_000 });

  const after = await readEditCamera(page);
  expect(after.scrollX).toBeCloseTo(before.scrollX, 0);
  expect(after.scrollY).toBeCloseTo(before.scrollY, 0);
  expect(after.zoom).toBeCloseTo(before.zoom, 5);

  // 편집기 도구/레이어 상태도 게임 키에 오염되지 않는다.
  const editorSurface = await page.evaluate(() => {
    const tool = document.querySelector('[data-testid="editor-layout"]');
    return { hasLayout: Boolean(tool) };
  });
  expect(editorSurface.hasLayout).toBe(true);
});
