import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test.use({ video: "on" });
test.setTimeout(120_000);

const desktopViewports = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

for (const viewport of desktopViewports) {
  test(`title controls stay keyboard-only at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const fixtureStubs = optionalFixtureDescriptions();
    await page.addInitScript(() => {
      (globalThis as { __oprnForcePointerBlock?: boolean }).__oprnForcePointerBlock = true;
      localStorage.setItem("oprn:editor-ui-mode", "expert");
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      Object.defineProperty(window, "Audio", {
        configurable: true,
        value: function titlePlayFixtureAudio(): HTMLAudioElement {
          return document.createElement("audio");
        },
      });
      Object.defineProperty(HTMLMediaElement.prototype, "play", {
        configurable: true,
        value: (): Promise<void> => Promise.resolve(),
      });
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === "string" || input instanceof URL
          ? new URL(input, window.location.href).href
          : input.url;
        if (url === "http://127.0.0.1:17831/v1/browser/hello" || url.startsWith("http://127.0.0.1:17831/v1/browser/next")) {
          return Promise.resolve(new Response("{}", { headers: { "Content-Type": "application/json" }, status: 200 }));
        }
        if (url === `${window.location.origin}/__oprn/ai-activity`) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (url.startsWith("http://dbserver:8100/rest/v1/ai_activity_logs") || url.startsWith("http://dbserver:8100/rest/v1/ai_analysis_runs")) {
          return Promise.resolve(new Response("[]", { headers: { "Content-Type": "application/json" }, status: 201 }));
        }
        return realFetch(input, init);
      };
    });
    await page.setViewportSize(viewport);
    const browserIssues: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserIssues.push(`console:${message.text()}`);
    });
    page.on("pageerror", (error) => browserIssues.push(`pageerror:${error.message}`));
    page.on("requestfailed", (request) => browserIssues.push(`request:${request.url()}:${request.failure()?.errorText ?? "unknown"}`));
    await gotoShowcaseEditor(page);

    const focusTrace: string[] = [];
    await openTestPlay(page);
    await expectFocused(page, "title-option-new-game", focusTrace);
    await expectTitlebarContained(page);
    await page.keyboard.press("ArrowDown");
    await expectFocused(page, "title-option-load-game", focusTrace);
    await page.keyboard.press("Space");
    await expect(page.getByTestId("player-load-window")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("title-new-game")).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("player-load-window")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("load-keyboard.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("title-screen")).toBeVisible();

    await page.keyboard.press("ArrowUp");
    await expectFocused(page, "title-option-new-game", focusTrace);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("play-canvas").locator("canvas")).toBeVisible({ timeout: 15_000 });
    expect(await dispatchedFieldClickIsBlocked(page)).toBe(true);
    await expectRuntimeStageContained(page, viewport, testInfo);
    await page.screenshot({ path: testInfo.outputPath("new-keyboard-field-blocked.png"), fullPage: true });
    await closeTestPlay(page);

    await openTestPlay(page);
    await dispatchTrustedClick(page, "title-new-game");
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("play-canvas").locator("canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("touch-pad")).toHaveCount(0);
    await closeTestPlay(page);

    await openTestPlay(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expectFocused(page, "title-option-quit-game", focusTrace);
    await page.keyboard.press("Space");
    await expect(page.getByTestId("test-play-window")).toHaveCount(0);

    await openTestPlay(page);
    await dispatchTrustedClick(page, "title-quit-game");
    await expect(page.getByTestId("test-play-window")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("test-play-window")).toHaveCount(0);

    await page.waitForLoadState("networkidle");
    const strictPolicyIssues = browserIssues.filter((issue) => !isAllowedBridgeRefusal(issue));
    await writeFile(testInfo.outputPath("focus-trace.json"), `${JSON.stringify({ viewport, focusTrace }, null, 2)}\n`);
    await writeFile(testInfo.outputPath("optional-dependency-fixtures.json"), `${JSON.stringify(fixtureStubs, null, 2)}\n`);
    await writeFile(testInfo.outputPath("browser-policy.json"), `${JSON.stringify({ allowed: "exact 127.0.0.1:17831 browser hello refusal only", browserIssues, strictPolicyIssues }, null, 2)}\n`);
    expect(strictPolicyIssues).toEqual([]);
  });
}

async function dispatchTrustedClick(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).evaluate((node) => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
  });
}

async function gotoShowcaseEditor(page: Page): Promise<void> {
  await page.goto(`/?devProject=1&logCabinShowcase=1&titleControls=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
}

async function openTestPlay(page: Page): Promise<void> {
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toBeVisible();
}

async function closeTestPlay(page: Page): Promise<void> {
  await page.getByTestId("test-play-window-close").click();
  await expect(page.getByTestId("test-play-window")).toHaveCount(0);
}

async function expectFocused(page: Page, id: string, trace: string[]): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? "")).toBe(id);
  trace.push(await page.evaluate(() => document.activeElement?.id ?? ""));
}

async function expectTitlebarContained(page: Page): Promise<void> {
  const contained = await page.evaluate(() => {
    const windowNode = document.querySelector("[data-testid='test-play-window']");
    const titlebar = document.querySelector(".test-play-titlebar");
    if (!(windowNode instanceof HTMLElement) || !(titlebar instanceof HTMLElement)) return false;
    const outer = windowNode.getBoundingClientRect();
    const inner = titlebar.getBoundingClientRect();
    return inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
  });
  expect(contained).toBe(true);
}

async function dispatchedFieldClickIsBlocked(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const canvas = document.querySelector("[data-testid='play-canvas'] canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
    return canvas.dispatchEvent(event) === false;
  });
}

function optionalFixtureDescriptions(): readonly string[] {
  return [
    "Audio constructor: silent HTMLAudioElement without a source",
    "HTMLMediaElement.play: resolved promise",
    "fetch http://127.0.0.1:17831/v1/browser/{hello,next}: 200 {}",
    "fetch /__oprn/ai-activity: 204",
    "fetch dbserver ai_activity_logs: 201 []",
    "fetch dbserver ai_analysis_runs: 201 []",
  ] as const;
}

function isAllowedBridgeRefusal(issue: string): boolean {
  return issue === "request:http://127.0.0.1:17831/v1/browser/hello:net::ERR_CONNECTION_REFUSED";
}

async function expectRuntimeStageContained(
  page: Page,
  viewport: { readonly width: number; readonly height: number },
  testInfo: Parameters<typeof test>[1],
): Promise<void> {
  const metrics = await page.evaluate(() => {
    const runtimeViewport = document.querySelector("[data-testid='play-viewport']");
    const stage = document.querySelector("[data-testid='play-stage']");
    const canvas = document.querySelector("[data-testid='play-canvas'] canvas");
    if (!(runtimeViewport instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error("missing runtime stage metrics surface");
    }
    const viewportRect = runtimeViewport.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      canvasHeight: canvas.height,
      canvasWidth: canvas.width,
      scale: Number(runtimeViewport.dataset.scale),
      stageBottom: stageRect.bottom,
      stageHeight: stageRect.height,
      stageLeft: stageRect.left,
      stageRight: stageRect.right,
      stageTop: stageRect.top,
      stageWidth: stageRect.width,
      viewportBottom: viewportRect.bottom,
      viewportLeft: viewportRect.left,
      viewportRight: viewportRect.right,
      viewportTop: viewportRect.top,
    };
  });
  expect(metrics.canvasWidth).toBe(320);
  expect(metrics.canvasHeight).toBe(240);
  expect(Number.isInteger(metrics.scale)).toBe(true);
  expect(Math.round(metrics.stageWidth)).toBe(320 * metrics.scale);
  expect(Math.round(metrics.stageHeight)).toBe(240 * metrics.scale);
  expect(metrics.stageWidth / metrics.stageHeight).toBeCloseTo(4 / 3, 2);
  expect(metrics.stageLeft).toBeGreaterThanOrEqual(metrics.viewportLeft);
  expect(metrics.stageRight).toBeLessThanOrEqual(metrics.viewportRight);
  expect(metrics.stageTop).toBeGreaterThanOrEqual(metrics.viewportTop);
  expect(metrics.stageBottom).toBeLessThanOrEqual(metrics.viewportBottom);
  await writeFile(testInfo.outputPath("stage-metrics.json"), `${JSON.stringify({ viewport, metrics }, null, 2)}\n`);
}
