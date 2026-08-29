import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { build } from "vite";

const PLAYER_BUILD_TIMEOUT_MS = 180_000;
const STACK_SELECTORS = [
  ".picture-layer",
  ".runtime-timer-hud",
  ".runtime-time-hud",
  ".minimap-root",
  ".hand-slot",
  ".zone-feedback",
  ".dialogue-overlay",
  ".action-hud",
  ".picture-layer-item",
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
  ".picture-layer-item": "45",
} as const;

type StackSelector = (typeof STACK_SELECTORS)[number];
type ComputedEntry = {
  readonly position: string;
  readonly zIndex: string;
  readonly display: string;
  readonly visibility: string;
};
type ComputedStack = Record<StackSelector, ComputedEntry>;
type FixtureOptions = { readonly dialogueOpen: boolean; readonly actionHudFirst: boolean };

const buildLibrary = async (input: string, format: "css" | "iife"): Promise<string> => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "rpgzzu-picture-stacking-"));
  try {
    await build({
      configFile: false,
      publicDir: false,
      root: resolve("."),
      logLevel: "silent",
      resolve: { alias: { "@": resolve("src") } },
      build: {
        emptyOutDir: true,
        outDir: outputDirectory,
        ...(format === "css"
          ? { rollupOptions: { input: resolve(input) } }
          : { lib: { entry: resolve(input), formats: ["iife" as const], name: "PlaySurfaceLib", fileName: () => "playSurface.js" } }),
      },
    });
    const extension = format === "css" ? ".css" : ".js";
    const file = (await listFiles(outputDirectory)).find((candidate) => candidate.endsWith(extension));
    if (!file) throw new Error(`${input} build did not emit ${extension}`);
    return await readFile(file, "utf8");
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
};

describe("런타임 computed z-index 밴드", () => {
  let browser: Browser;
  let page: Page;
  let closed: ComputedStack;
  let open: ComputedStack;
  let reducedMotion: ComputedStack;
  let actionHudFirst: ComputedStack;

  const measure = async (options: FixtureOptions): Promise<ComputedStack> => page.evaluate(
    ({ selectors, fixture }) => {
      document.body.replaceChildren();
      const layout = document.createElement("div");
      layout.className = "player-layout system-shell";
      layout.dataset.playInputOwner = "keyboard-only";
      const surface = (window as unknown as { PlaySurfaceLib: PlaySurfaceLib }).PlaySurfaceLib.createPlaySurface();
      layout.append(surface.viewport);
      document.body.append(layout);
      surface.sync();

      const add = (className: string, testid?: string): HTMLElement => {
        const node = document.createElement("div");
        node.className = className;
        if (testid) node.dataset.testid = testid;
        surface.stage.append(node);
        return node;
      };
      const addDialogue = (): void => {
        const overlay = add(fixture.dialogueOpen ? "dialogue-overlay position-bottom" : "dialogue-overlay");
        if (fixture.dialogueOpen) overlay.textContent = "촌장: 자네가 이 마을에 온 이유를 알고 있네.";
      };
      const addActionHud = (): void => { add("action-hud", "action-hud"); };

      if (fixture.actionHudFirst) addActionHud();
      addDialogue();
      const pictureLayer = add("picture-layer", "picture-layer");
      const pictureItem = document.createElement("div");
      pictureItem.className = "picture-layer-item";
      pictureItem.dataset.pictureId = "pic25";
      pictureItem.dataset.testid = "picture-pic25";
      pictureItem.style.zIndex = "45";
      pictureLayer.append(pictureItem);
      add("runtime-timer-hud", "runtime-timer-hud");
      add("runtime-time-hud", "runtime-time-hud");
      add("minimap-root is-top-right", "minimap-root");
      const handSlot = add("hand-slot is-empty", "hand-slot");
      handSlot.dataset.slot = "0";
      add("zone-feedback", "zone-feedback");
      if (!fixture.actionHudFirst) addActionHud();
      add("touch-pad");

      return Object.fromEntries(selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) throw new Error(`missing fixture element: ${selector}`);
        const style = getComputedStyle(element);
        return [selector, {
          position: style.position,
          zIndex: style.zIndex,
          display: style.display,
          visibility: style.visibility,
        }];
      })) as ComputedStack;
    },
    { selectors: STACK_SELECTORS, fixture: options },
  );

  beforeAll(async () => {
    const [css, surfaceScript] = await Promise.all([
      buildLibrary("src/player/player.css", "css"),
      buildLibrary("src/player/playSurface.ts", "iife"),
    ]);
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.setContent(`<style>${css}</style><script>${surfaceScript}</script>`);
    closed = await measure({ dialogueOpen: false, actionHudFirst: false });
    open = await measure({ dialogueOpen: true, actionHudFirst: false });
    actionHudFirst = await measure({ dialogueOpen: true, actionHudFirst: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    reducedMotion = await measure({ dialogueOpen: true, actionHudFirst: false });
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }, PLAYER_BUILD_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  const bandOf = (stack: ComputedStack): Record<string, string> =>
    Object.fromEntries(STACK_SELECTORS.map((selector) => [selector, stack[selector].zIndex]));

  it("picture layer keeps a positioned stacking context below dialogue", () => {
    expect(closed[".picture-layer"].position).toBe("absolute");
    expect(closed[".picture-layer"].zIndex).toBe("26");
    expect(Number(closed[".picture-layer"].zIndex)).toBeLessThan(Number(closed[".dialogue-overlay"].zIndex));
  });

  it("resolves the complete shipped band through the player.css import closure", () => {
    expect(bandOf(closed)).toEqual(EXPECTED_BAND);
  });

  it("대사창이 열린 상태에서도 밴드가 같다", () => {
    expect(bandOf(open)).toEqual(EXPECTED_BAND);
    expect(open[".picture-layer"].position).toBe("absolute");
  });

  it("prefers-reduced-motion 에서도 밴드가 같다", () => {
    expect(bandOf(reducedMotion)).toEqual(EXPECTED_BAND);
    expect(reducedMotion[".picture-layer"].position).toBe("absolute");
  });

  it("액션 HUD 가 대사창보다 먼저 붙는 순서에서도 밴드가 같다", () => {
    expect(bandOf(actionHudFirst)).toEqual(EXPECTED_BAND);
    expect(actionHudFirst[".picture-layer"].position).toBe("absolute");
  });

  it("밴드 구성원은 어느 상태에서도 숨겨지지 않는다", () => {
    const hiddenWhenDialogueOpen: readonly StackSelector[] = [".hand-slot", ".action-hud"];
    for (const stack of [closed, open, reducedMotion, actionHudFirst]) {
      for (const selector of STACK_SELECTORS) {
        expect(stack[selector].visibility).toBe("visible");
        if (stack === closed || !hiddenWhenDialogueOpen.includes(selector)) {
          expect(stack[selector].display).not.toBe("none");
        }
      }
    }
  });

  it("픽처 슬롯은 레이어 스태킹 컨텍스트 안에서 자기 z-index 를 유지한다", () => {
    for (const stack of [closed, open, reducedMotion, actionHudFirst]) {
      expect(stack[".picture-layer-item"].position).toBe("absolute");
      expect(stack[".picture-layer-item"].zIndex).toBe("45");
    }
  });

  it("대사창이 차면 배포된 :has() 규칙이 겹치는 조작면을 걷는다", () => {
    expect(closed[".action-hud"].display).not.toBe("none");
    expect(closed[".hand-slot"].display).not.toBe("none");
    expect(open[".action-hud"].display).toBe("none");
    expect(open[".hand-slot"].display).toBe("none");
    expect(actionHudFirst[".action-hud"].display).toBe("none");
    expect(actionHudFirst[".hand-slot"].display).toBe("none");
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

type PlaySurfaceLib = {
  readonly createPlaySurface: () => {
    readonly viewport: HTMLElement;
    readonly stage: HTMLElement;
    readonly sync: () => void;
  };
};
