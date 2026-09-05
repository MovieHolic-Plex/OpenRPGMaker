import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    animationModalRefresh: Promise<void>;
    animationModalLoops: Set<number>;
  }
}

// Cold editor boot plus two modal mounts exceeded 120s on the shared QA host.
// All behavior still uses exact DOM signals and a controlled virtual clock.
test.setTimeout(240_000);
test.use({ viewport: { width: 1440, height: 900 } });

async function openAnimations(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname.endsWith("supabase.co") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      throw new Error(`Unexpected remote write: ${request.method()} ${request.url()}`);
    }
    if (url.port === (process.env.DEV_SERVER_PORT ?? "9173") && request.method() === "GET") {
      await route.fulfill({ response: await route.fetch({ maxRetries: 2 }) });
    } else {
      await route.continue();
    }
  });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 60_000 });
  const welcome = page.getByTestId("standard-welcome-start");
  if (await welcome.isVisible()) await welcome.click();
  await page.clock.install({ time: new Date("2026-09-05T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-05T13:00:00Z"));
  await page.evaluate(() => {
    const setInterval = window.setInterval.bind(window);
    const clearInterval = window.clearInterval.bind(window);
    window.animationModalLoops = new Set();
    window.setInterval = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
      const id = setInterval(handler, timeout, ...args);
      if (timeout === 67) window.animationModalLoops.add(id);
      return id;
    };
    window.clearInterval = (id?: number): void => {
      if (id !== undefined) window.animationModalLoops.delete(id);
      clearInterval(id);
    };
  });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-search").fill("애니메이션");
  await page.getByTestId("db-tab-animations").click();
  await expect(page.getByTestId("db-animation-play")).toHaveAttribute("aria-pressed", "true");
}

async function position(page: Page): Promise<string> {
  return page.getByTestId("db-animation-stage-target").evaluate((cell) => getComputedStyle(cell).backgroundPosition);
}

for (const stop of ["frame selection", "explicit stop"]) {
  test(`${stop} survives the delayed modal/store refresh`, async ({ page }, testInfo) => {
    await openAnimations(page);
    const play = page.getByTestId("db-animation-play");
    await page.getByTestId("db-animation-frame-1").click();
    await expect(page.getByTestId("db-animation-preview-status")).toHaveAttribute("data-state", "ready");
    if (stop === "explicit stop") {
      await play.click();
      await play.click();
    }
    const selectedPosition = await position(page);
    await page.getByTestId("db-shared-workspace").evaluate((workspace) => {
      const form = workspace.querySelector("[data-testid='db-detail-form']");
      if (!form) throw new Error("Missing animation form");
      window.animationModalRefresh = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => { observer.disconnect(); reject(new Error("No parent modal refresh")); }, 1000);
        const observer = new MutationObserver(() => {
          const replacement = workspace.querySelector("[data-testid='db-detail-form']");
          if (!replacement || replacement === form) return;
          observer.disconnect();
          window.clearTimeout(timeout);
          resolve();
        });
        observer.observe(workspace, { childList: true });
      });
    });
    await page.getByTestId("db-animation-timing-add").click();
    await expect(play).toHaveAttribute("aria-pressed", "false");
    // Deliver the modal's 450ms grace flush and the ensuing animation-frame
    // callback, not just six preview ticks (402ms, before the parent refresh).
    await page.clock.runFor(450 + 16);
    await page.evaluate(() => window.animationModalRefresh);
    await expect(page.getByTestId("db-animation-preview-status")).toHaveAttribute("data-state", "ready");
    await expect(play).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("db-animation-frame-1")).toHaveClass(/active/);
    expect(await page.evaluate(() => window.animationModalLoops.size)).toBe(0);
    await page.clock.runFor(67 * 4);
    expect(await position(page)).toBe(selectedPosition);
    await page.screenshot({ path: testInfo.outputPath("stopped-after-modal-refresh.png") });

    await page.getByTestId("db-record-row-anim_sword").click();
    await expect(play).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => window.animationModalLoops.size)).toBe(1);
    await play.click();
    await page.getByTestId("database-modal-close").click();
    await page.getByTestId("database-dirty-discard").click();
    await expect(page.getByTestId("database-modal")).toHaveCount(0);
    expect(await page.evaluate(() => window.animationModalLoops.size)).toBe(0);
    await page.getByTestId("toolbar-database").click();
    await expect(play).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => window.animationModalLoops.size)).toBe(1);
    await page.getByTestId("database-modal-close").click();
    await expect(page.getByTestId("database-modal")).toHaveCount(0);
    expect(await page.evaluate(() => window.animationModalLoops.size)).toBe(0);
  });
}
