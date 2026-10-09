// test/e2e/runtimeInput.ts
// Playwright 런타임 키 입력 헬퍼.
//
// headless Chromium에서 window keydown이 Phaser keyboard 매니저에 도달하지
// 않아 실제 키보드 입력(이동/조사)이 잡히지 않는다. PlayScene은 이를 위해
// window.__oprnInput 주입 훅을 노출한다. 이 헬퍼는 훅이 있으면 그것을 쓰고,
// 없으면(실제 브라우저 등) page.keyboard.press로 폴백한다.
//
// 실제 브라우저에서는 keydown 리스너가 정상 동작하므로 두 경로 모두 작동한다.

import { expect, type Page } from "@playwright/test";

const DIR_MAP: Record<string, "down" | "left" | "right" | "up"> = {
  ArrowDown: "down",
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowRight: "right",
  Down: "down",
  Up: "up",
  Left: "left",
  Right: "right",
};

export async function tapKey(page: Page, key: string, holdMs = 80): Promise<void> {
  const hasHook = await page.evaluate(
    () => typeof (window as unknown as { __oprnInput?: unknown }).__oprnInput === "object"
      && !!(window as unknown as { __oprnInput?: unknown }).__oprnInput
  );
  if (!hasHook) {
    await page.keyboard.press(key, { delay: holdMs });
    return;
  }
  const dir = DIR_MAP[key];
  if (dir) {
    await page.evaluate((d) => {
      const h = (window as unknown as { __oprnInput?: { dir: (d: string | null) => void } }).__oprnInput;
      h?.dir(d);
    }, dir);
    await page.waitForTimeout(holdMs);
    await page.evaluate(() => {
      const h = (window as unknown as { __oprnInput?: { dir: (d: string | null) => void } }).__oprnInput;
      h?.dir(null);
    });
    await page.waitForTimeout(60);
  } else {
    // action/confirm 키 (Space/Enter/E)
    await page.evaluate(() => {
      const h = (window as unknown as { __oprnInput?: { action: () => void } }).__oprnInput;
      h?.action();
    });
    await page.waitForTimeout(holdMs);
  }
}


/** Prefer keyboard Enter on title (default selection = 새 게임). Mouse click on title-new-game also works for real users. */
export async function startNewGameFromTitle(
  page: Page,
  options?: { readonly timeoutMs?: number; readonly waitForRuntimeState?: boolean }
): Promise<void> {
  const timeout = options?.timeoutMs ?? 15_000;
  // 자동 시작이 켜져 있으면 타이틀을 거치지 않고 이미 플레이 중이다. 그때 타이틀을
  // 기다리면 부팅은 성공했는데 스펙이 빨개진다. 이미 스테이지가 떠 있으면 걷지 않는다.
  const stage = page.getByTestId("play-stage");
  const title = page.getByTestId("title-screen");
  await expect(title.or(stage)).toBeVisible({ timeout });
  if ((await title.count()) === 0 && (await stage.count()) > 0) {
    if (options?.waitForRuntimeState === false) return;
    await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout });
    return;
  }
  await expect(title).toBeVisible({ timeout });
  await expect(page.getByTestId("title-new-game")).toBeVisible({ timeout });
  // Default selection is 새 게임 (index 0).
  await page.keyboard.press("Enter");
  // 상태 덤프를 실제로 읽는 스펙만 기다리면 된다. 덤프가 필요 없는 스펙까지 여기서
  // 막히면 부팅은 성공했는데 스펙 전체가 빨개진다.
  if (options?.waitForRuntimeState === false) return;
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout });
}
