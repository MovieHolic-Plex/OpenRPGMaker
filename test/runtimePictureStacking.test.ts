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

type DialogueState = { readonly text: string; readonly positionClass: string };

const DIALOGUE_CLOSED: DialogueState = { text: "", positionClass: "" };
const DIALOGUE_OPEN: DialogueState = {
  text: "촌장: 자네가 이 마을에 온 이유를 알고 있네.",
  positionClass: "position-bottom",
};

/* 중첩·속성·형제 순서가 프로덕션과 어긋나면 배포된 상태 스코프 규칙이 픽스처에서 발화하지
   않아 오버라이드를 조용히 통과시킨다. `player.ts:135-137` 은 루트에 data-play-input-owner 를
   항상 달고, `player.ts:295` 은 대사창을 스테이지에 먼저 붙이며 픽처·하이드는 나중에 지연
   생성한다 — 즉 `~` 형제 규칙(`runtime/timer.css:37`)이 걸리는 순서는 dialogue → picture 다.
   열린 대사창은 항상 `position-*` 을 갖는다(`dialogue.ts:667`). */
const fixtureMarkup = (css: string, dialogue: DialogueState): string => `<style>${css}</style>
  <div class="player-layout system-shell" data-play-input-owner="keyboard-only">
    <div class="play-viewport">
      <div class="play-stage" data-testid="play-stage">
        <div class="phaser-container"></div>
        <div class="dialogue-overlay ${dialogue.positionClass}">${dialogue.text}</div>
        <div class="picture-layer" data-testid="picture-layer">
          <div class="picture-layer-item" style="z-index: 45"></div>
        </div>
        <div class="runtime-timer-hud" data-testid="runtime-timer-hud"></div>
        <div class="runtime-time-hud" data-testid="runtime-time-hud"></div>
        <div class="minimap-root"></div>
        <div class="hand-slot"></div>
        <div class="zone-feedback"></div>
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

  const measure = async (dialogue: DialogueState): Promise<ComputedStack> => {
    await page.setContent(fixtureMarkup(css, dialogue));
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
      closed = await measure(DIALOGUE_CLOSED);
      open = await measure(DIALOGUE_OPEN);
      await page.emulateMedia({ reducedMotion: "reduce" });
      reducedMotion = await measure(DIALOGUE_OPEN);
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

  it("픽처 레이어는 어느 상태에서도 숨겨지지 않는다", () => {
    for (const state of [closed, open, reducedMotion]) {
      expect(state[".picture-layer"].display).not.toBe("none");
      expect(state[".picture-layer"].visibility).toBe("visible");
    }
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
