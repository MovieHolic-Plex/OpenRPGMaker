// 시연 실행 창이 떠 있는 동안 게임 입력이 **편집 카메라를 건드리지 않는다**는 실브라우저 계약.
//
// 관측된 결함(2026-08-30, 1440×900, ?freshProject=1):
//   테스트 버튼 → 게임에서 방향키로 이동 → 창 닫기 → 편집 캔버스에 맵이 거의 안 보인다.
//   원인은 편집 Phaser 게임이 창 뒤에서 살아 있는데(테스트 플레이는 trackGlobalGame:false 로
//   플레이 게임을 별도 소유한다) 그 키보드 플러그인이 window 를 듣는 것이었다. 방향키 한 번이
//   편집 카메라를 6타일 밀어내므로(Shift 16타일) 조금만 걸어도 편집 카메라가 맵 경계 밖으로
//   나가 «맵이 사라진» 것처럼 보였다. 수정 전 이 스펙은 scrollX 기대 323 / 실측 1123 으로 실패한다.
//
// 단정은 엔진이 노출하는 카메라 값(`__oprnEditCamera`)으로 한다 — 픽셀 비교가 아니라
// 기계가 읽는 수치라 흔들리지 않는다. 기준값을 읽기 전에는 카메라가 **정착할 때까지** 기다린다
// (부팅 직후에는 fitCanvas / applyEditorUiModeLayout 이 rAF 로 카메라를 몇 프레임 더 옮긴다).
import { expect, test, type Page } from "@playwright/test";
import { gotoWithRetry } from "../../scripts/lib/goto-retry.mjs";

const EDIT_CANVAS = '[data-testid="edit-canvas"] canvas';

type EditCamera = { scrollX: number; scrollY: number; zoom: number };

/**
 * 편집 카메라가 연속 프레임에서 움직이지 않을 때까지 기다린다. 고정 sleep 이 아니라
 * rAF 표본이 같아지는 **상태**를 기다리므로 부하에 따라 흔들리지 않는다. 편집기 자신이
 * `applyEditorUiModeLayout` 에서 쓰는 «5프레임 안정» 규칙과 같은 판정이다.
 */
async function waitForEditCameraSettled(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.evaluate(async (budget) => {
    const read = (window as unknown as { __oprnEditCamera?: () => EditCamera & { width: number; height: number } }).__oprnEditCamera;
    if (!read) throw new Error("__oprnEditCamera 훅이 없다 — EditScene 이 부팅되지 않았다");
    await new Promise<void>((resolve, reject) => {
      const deadline = performance.now() + budget;
      let last = read();
      let stable = 0;
      const tick = (): void => {
        const now = read();
        const same =
          Math.abs(now.scrollX - last.scrollX) < 0.5
          && Math.abs(now.scrollY - last.scrollY) < 0.5
          && now.width === last.width
          && now.height === last.height;
        stable = same ? stable + 1 : 0;
        last = now;
        if (stable >= 10) {
          resolve();
          return;
        }
        if (performance.now() > deadline) {
          reject(new Error("편집 카메라가 정착하지 않았다"));
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, timeoutMs);
}

async function readEditCamera(page: Page): Promise<EditCamera> {
  return (await page.evaluate(() => {
    const read = (window as unknown as { __oprnEditCamera?: () => EditCamera }).__oprnEditCamera;
    if (!read) throw new Error("__oprnEditCamera 훅이 없다 — EditScene 이 부팅되지 않았다");
    const camera = read();
    return { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom };
  })) as EditCamera;
}

/**
 * 편집기 부팅. 워크트리 dev 서버는 `curl` 이 200 을 주는데도 첫 네비게이션이 백지로 끝나는
 * 일이 있다(`openwiki/testing.md` «워크트리 e2e 는 dev 서버가 조용히 안 뜬다» — 다른
 * 에이전트가 `src/` 를 만지면 HMR 이 끼어들고, 도커 브리지가 오르내리면 모듈 요청이 통째로
 * 취소된다). `gotoWithRetry` 는 전송 계층 **예외**만 다시 시도하므로 이 경우를 못 잡는다.
 * 그래서 셸이 안 뜨면 한 번만 다시 싣는다 — 단정은 그대로 두고 부팅만 다시 한다.
 */
async function bootEditor(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (attempt === 1) await gotoWithRetry(page, "/?freshProject=1", { waitUntil: "domcontentloaded" });
    else await page.reload({ waitUntil: "domcontentloaded" });
    try {
      await page.locator(EDIT_CANVAS).first().waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForFunction(
        () => {
          const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="edit-canvas"] canvas');
          const hook = (window as unknown as { __oprnEditCamera?: unknown }).__oprnEditCamera;
          return Boolean(canvas && canvas.width > 100 && hook);
        },
        null,
        { timeout: 60_000 },
      );
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test("시연 실행 중 방향키로 걸어도 편집 카메라는 제자리에 있다", async ({ page }) => {
  test.setTimeout(300_000);

  await bootEditor(page);
  await expect(page.getByTestId("mode-play")).toBeVisible({ timeout: 60_000 });
  await waitForEditCameraSettled(page);
  const before = await readEditCamera(page);

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("runtime-state-json")).toBeAttached({ timeout: 120_000 });

  // 게임에서 한참 걸어 다니는 흐름. 결함 상태에서는 이 입력이 편집 카메라를 그대로 밀었다.
  for (let step = 0; step < 24; step += 1) await page.keyboard.press("ArrowRight");
  for (let step = 0; step < 12; step += 1) await page.keyboard.press("ArrowDown");
  // Shift 조합(16타일 점프)과 도구/레이어 키도 같은 경로였다.
  await page.keyboard.press("Shift+ArrowRight");
  for (const key of ["1", "3", "F6", "F7"]) await page.keyboard.press(key);

  const during = await readEditCamera(page);
  expect(during.scrollX).toBeCloseTo(before.scrollX, 0);
  expect(during.scrollY).toBeCloseTo(before.scrollY, 0);
  expect(during.zoom).toBeCloseTo(before.zoom, 5);

  await page.getByTestId("test-play-window-close").click();
  await expect(page.getByTestId("test-play-window")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator(EDIT_CANVAS).first()).toBeVisible({ timeout: 60_000 });
  await waitForEditCameraSettled(page);

  const after = await readEditCamera(page);
  expect(after.scrollX).toBeCloseTo(before.scrollX, 0);
  expect(after.scrollY).toBeCloseTo(before.scrollY, 0);
  expect(after.zoom).toBeCloseTo(before.zoom, 5);

  // 편집기 셸이 살아서 돌아왔다는 것도 함께 본다.
  await expect(page.getByTestId("editor-layout")).toBeVisible();
});
