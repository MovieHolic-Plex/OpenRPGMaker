import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { build } from "vite";

const PLAYER_BUILD_TIMEOUT_MS = 120_000;
const STACK_SELECTORS = [
  ".picture-layer",
  ".runtime-timer-hud",
  ".runtime-time-hud",
  ".minimap-root",
  ".hand-slot",
  ".zone-feedback",
  ".dialogue-overlay",
  ".action-hud",
] as const;

const EXPECTED_BAND = {
  ".picture-layer": "26",
  ".runtime-timer-hud": "29",
  ".runtime-time-hud": "29",
  ".minimap-root": "30",
  ".hand-slot": "30",
  ".zone-feedback": "30",
  ".dialogue-overlay": "39",
  ".action-hud": "40",
} as const;

type StackSelector = (typeof STACK_SELECTORS)[number];
type ComputedStack = Record<StackSelector, {
  readonly position: string;
  readonly zIndex: string;
  readonly display: string;
  readonly visibility: string;
}>;

/* 중첩이 프로덕션(`playSurface.ts:24-33` · `player.ts:295-297`)과 어긋나면 배포된 규칙 넷
   `.play-stage:has(> .dialogue-overlay:not(:empty)) > …` 이 픽스처에서 발화하지 않아
   조상·상태 스코프 오버라이드를 조용히 통과시킨다. */
const fixtureMarkup = (css: string, dialogueText: string): string => `<style>${css}</style>
  <div class="player-layout system-shell">
    <div class="play-viewport">
      <div class="play-stage" data-testid="play-stage">
        <div class="phaser-container"></div>
        <div class="picture-layer" data-testid="picture-layer">
          <div class="picture-layer-item" style="z-index: 45"></div>
        </div>
        <div class="runtime-timer-hud" data-testid="runtime-timer-hud"></div>
        <div class="runtime-time-hud" data-testid="runtime-time-hud"></div>
        <div class="minimap-root"></div>
        <div class="hand-slot"></div>
        <div class="zone-feedback"></div>
        <div class="dialogue-overlay">${dialogueText}</div>
        <div class="action-hud"></div>
        <div class="touch-pad"></div>
      </div>
    </div>
  </div>`;

describe("런타임 computed z-index 밴드", () => {
  let browser: Browser;
  let page: Page;
  let css: string;
  let closed: ComputedStack;
  let open: ComputedStack;
  let reducedMotion: ComputedStack;

  const measure = async (dialogueText: string): Promise<ComputedStack> => {
    await page.setContent(fixtureMarkup(css, dialogueText));
    return page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`missing fixture element: ${selector}`);
      const style = getComputedStyle(element);
      return [selector, {
        position: style.position,
        zIndex: style.zIndex,
        display: style.display,
        visibility: style.visibility,
      }];
    })) as ComputedStack, STACK_SELECTORS);
  };

  beforeAll(async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "rpgzzu-picture-stacking-"));
    try {
      await build({
        configFile: false,
        publicDir: false,
        root: resolve("."),
        logLevel: "silent",
        build: {
          emptyOutDir: true,
          outDir: outputDirectory,
          rollupOptions: { input: resolve("src/player/player.css") },
        },
      });
      const cssFile = (await listFiles(outputDirectory)).find((file) => file.endsWith(".css"));
      if (!cssFile) throw new Error("player.css build did not emit CSS");
      css = await readFile(cssFile, "utf8");
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
      closed = await measure("");
      open = await measure("촌장: 자네가 이 마을에 온 이유를 알고 있네.");
      await page.emulateMedia({ reducedMotion: "reduce" });
      reducedMotion = await measure("촌장: 자네가 이 마을에 온 이유를 알고 있네.");
      await page.emulateMedia({ reducedMotion: "no-preference" });
    } finally {
      await rm(outputDirectory, { force: true, recursive: true });
    }
  }, PLAYER_BUILD_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("picture layer keeps a positioned stacking context below dialogue", () => {
    expect(closed[".picture-layer"].position).toBe("absolute");
    expect(closed[".picture-layer"].zIndex).toBe("26");
    expect(Number(closed[".picture-layer"].zIndex)).toBeLessThan(Number(closed[".dialogue-overlay"].zIndex));
  });

  it("resolves the complete shipped band through the player.css import closure", () => {
    expect(Object.fromEntries(STACK_SELECTORS.map((selector) => [selector, closed[selector].zIndex])))
      .toEqual(EXPECTED_BAND);
  });

  it("대사창이 열린 상태에서도 밴드가 같다", () => {
    expect(Object.fromEntries(STACK_SELECTORS.map((selector) => [selector, open[selector].zIndex])))
      .toEqual(EXPECTED_BAND);
    expect(open[".picture-layer"].position).toBe("absolute");
  });

  it("prefers-reduced-motion 에서도 밴드가 같다", () => {
    expect(Object.fromEntries(STACK_SELECTORS.map((selector) => [selector, reducedMotion[selector].zIndex])))
      .toEqual(EXPECTED_BAND);
    expect(reducedMotion[".picture-layer"].position).toBe("absolute");
  });

  it("대사창이 차면 배포된 :has() 규칙이 겹치는 조작면을 걷는다", () => {
    expect(closed[".action-hud"].display).not.toBe("none");
    expect(closed[".hand-slot"].display).not.toBe("none");
    expect(open[".action-hud"].display).toBe("none");
    expect(open[".hand-slot"].display).toBe("none");
  });
});

const listFiles = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
};
