import { mkdir, writeFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

const EVIDENCE_DIR = ".omo/ulw-loop/dialogue-90-match/evidence";
const SCREENSHOT_PATH = `${EVIDENCE_DIR}/play-screen-green.png`;
const DIALOGUE_SCREENSHOT_PATH = `${EVIDENCE_DIR}/dialogue-box-green.png`;
const METRICS_PATH = `${EVIDENCE_DIR}/dialogue-metrics-green.json`;

type RuntimeState = {
  readonly inputEnabled: boolean;
  readonly player: {
    readonly x: number;
    readonly y: number;
  };
};

type DialogueMetrics = {
  readonly backgroundImage: string;
  readonly borderTopWidth: number;
  readonly bodyFontSize: string;
  readonly bodyFontSizePx: number;
  readonly boxHeightRatio: number;
  readonly faceHeight: number;
  readonly faceHeightRatio: number;
  readonly faceWidth: number;
  readonly paddingLeft: number;
  readonly paddingLeftRatio: number;
  readonly speakerFontSize: string;
  readonly speakerFontSizePx: number;
  readonly speakerFontRatio: number;
  readonly height: number;
  readonly containerBottom: number;
  readonly viewportHeight: number;
  readonly minHeight: string;
  readonly display: string;
  readonly structuralSimilarityScore: number;
};

async function startFreshPlay(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("mode-play")).toBeVisible();
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await expect.poll(async () => {
    if (await page.getByTestId("title-new-game").isVisible()) return "title";
    if (await page.getByTestId("play-canvas").isVisible()) return "canvas";
    return "loading";
  }, { timeout: 15_000 }).not.toBe("loading");
  if (await page.getByTestId("title-new-game").isVisible()) {
    await page.getByTestId("title-new-game").click();
  }
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
  await page.getByTestId("play-canvas").locator("canvas").click();
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("malformed runtime state");
  return parsed;
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (!isRecord(value) || !isRecord(value.player)) return false;
  return typeof value.inputEnabled === "boolean" &&
    typeof value.player.x === "number" &&
    typeof value.player.y === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

test("held ArrowRight moves continuously before OS key repeat", async ({ page }) => {
  await startFreshPlay(page);
  const before = await runtimeState(page);

  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(520);
  await page.keyboard.up("ArrowRight");

  const after = await runtimeState(page);
  expect(after.player.x).toBeGreaterThan(before.player.x);
});

test("starter NPC dialogue uses a compact bottom panel and does not reopen while confirm is held", async ({ page }) => {
  await startFreshPlay(page);

  await page.getByTestId("event-event_starter_mina").click();
  const dialogue = page.getByTestId("dialogue-box");
  await expect(dialogue).toContainText("미나");
  await expect(dialogue).toContainText("어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요.");

  const metrics = await dialogueMetrics(page);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(METRICS_PATH, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");

  expect(metrics.structuralSimilarityScore).toBeGreaterThanOrEqual(90);
  expect(metrics.boxHeightRatio).toBeGreaterThanOrEqual(0.23);
  expect(metrics.boxHeightRatio).toBeLessThanOrEqual(0.3);
  expect(metrics.containerBottom).toBeLessThanOrEqual(28);
  expect(metrics.faceWidth).toBeGreaterThanOrEqual(150);
  expect(metrics.faceHeight).toBeGreaterThanOrEqual(150);
  expect(metrics.faceHeightRatio).toBeGreaterThanOrEqual(0.68);
  expect(metrics.bodyFontSize).toBe("7px");
  expect(metrics.bodyFontSizePx).toBeGreaterThanOrEqual(7);
  expect(metrics.speakerFontSize).toBe("7px");
  expect(metrics.speakerFontSizePx).toBeGreaterThanOrEqual(7);
  expect(metrics.backgroundImage).toContain("rgba");
  expect(metrics.backgroundImage).toContain("repeating-linear-gradient");
  expect(metrics.minHeight).toBe("100%");
  expect(metrics.display).toBe("flex");

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  await dialogue.screenshot({ path: DIALOGUE_SCREENSHOT_PATH });

  await page.keyboard.press("Enter");
  await expect(dialogue).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(dialogue).toHaveCount(0);
});

async function dialogueMetrics(page: Page): Promise<DialogueMetrics> {
  const metrics = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="dialogue-box"]');
    const body = box?.querySelector(".body");
    const speaker = box?.querySelector(".speaker");
    const face = document.querySelector('[data-testid="dialogue-face"]');
    if (!(box instanceof HTMLElement)) return null;
    if (!(body instanceof HTMLElement)) return null;
    if (!(speaker instanceof HTMLElement)) return null;
    if (!(face instanceof HTMLElement)) return null;
    const rect = box.getBoundingClientRect();
    const parentRect = box.parentElement?.getBoundingClientRect();
    const style = window.getComputedStyle(box);
    const bodyStyle = window.getComputedStyle(body);
    const speakerStyle = window.getComputedStyle(speaker);
    const faceRect = face.getBoundingClientRect();
    const height = rect.height;
    const bodyFontSizePx = Number.parseFloat(bodyStyle.fontSize);
    const speakerFontSizePx = Number.parseFloat(speakerStyle.fontSize);
    const borderTopWidth = Number.parseFloat(style.borderTopWidth);
    const paddingLeft = Number.parseFloat(style.paddingLeft);
    const boxHeightRatio = height / window.innerHeight;
    const faceHeightRatio = faceRect.height / height;
    const speakerFontRatio = speakerFontSizePx / height;
    const paddingLeftRatio = paddingLeft / height;
    const closeness = (actual: number, target: number, tolerance: number): number =>
      Math.max(0, 1 - Math.abs(actual - target) / tolerance);
    const weightedScore =
      closeness(boxHeightRatio, 0.294, 0.04) * 20 +
      closeness(faceHeightRatio, 0.816, 0.12) * 25 +
      closeness(bodyFontSizePx, 7, 1) * 18 +
      closeness(speakerFontSizePx, 7, 1) * 12 +
      closeness(borderTopWidth, 1, 0.75) * 10 +
      closeness(paddingLeft, 8, 3) * 5 +
      (style.backgroundImage.includes("rgba") && style.backgroundImage.includes("repeating-linear-gradient") ? 10 : 0);
    return {
      backgroundImage: style.backgroundImage,
      borderTopWidth,
      bodyFontSize: bodyStyle.fontSize,
      bodyFontSizePx,
      boxHeightRatio,
      faceHeight: faceRect.height,
      faceHeightRatio,
      faceWidth: faceRect.width,
      paddingLeft,
      paddingLeftRatio,
      speakerFontSize: speakerStyle.fontSize,
      speakerFontSizePx,
      speakerFontRatio,
      height,
      containerBottom: parentRect ? parentRect.bottom - rect.bottom : window.innerHeight - rect.bottom,
      viewportHeight: window.innerHeight,
      minHeight: style.minHeight,
      display: style.display,
      structuralSimilarityScore: Math.round(weightedScore),
    };
  });
  if (!metrics) throw new Error("missing dialogue metrics");
  return metrics;
}
