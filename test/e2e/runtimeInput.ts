// test/e2e/runtimeInput.ts
// Playwright 런타임 키 입력 헬퍼.
//
// headless Chromium에서 window keydown이 Phaser keyboard 매니저에 도달하지
// 않아 실제 키보드 입력(이동/조사)이 잡히지 않는다. PlayScene은 이를 위해
// window.__rpgzzuInput 주입 훅을 노출한다. 이 헬퍼는 훅이 있으면 그것을 쓰고,
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
    () => typeof (window as unknown as { __rpgzzuInput?: unknown }).__rpgzzuInput === "object"
      && !!(window as unknown as { __rpgzzuInput?: unknown }).__rpgzzuInput
  );
  if (!hasHook) {
    await page.keyboard.press(key, { delay: holdMs });
    return;
  }
  const dir = DIR_MAP[key];
  if (dir) {
    await page.evaluate((d) => {
      const h = (window as unknown as { __rpgzzuInput?: { dir: (d: string | null) => void } }).__rpgzzuInput;
      h?.dir(d);
    }, dir);
    await page.waitForTimeout(holdMs);
    await page.evaluate(() => {
      const h = (window as unknown as { __rpgzzuInput?: { dir: (d: string | null) => void } }).__rpgzzuInput;
      h?.dir(null);
    });
    await page.waitForTimeout(60);
  } else {
    // action/confirm 키 (Space/Enter/E)
    await page.evaluate(() => {
      const h = (window as unknown as { __rpgzzuInput?: { action: () => void } }).__rpgzzuInput;
      h?.action();
    });
    await page.waitForTimeout(holdMs);
  }
}


/** Prefer keyboard Enter on title (default selection = 새 게임). Mouse click on title-new-game also works for real users. */
export async function startNewGameFromTitle(page: Page, options?: { readonly timeoutMs?: number }): Promise<void> {
  const timeout = options?.timeoutMs ?? 15_000;
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout });
  await expect(page.getByTestId("title-new-game")).toBeVisible({ timeout });
  // Default selection is 새 게임 (index 0).
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout });
}
