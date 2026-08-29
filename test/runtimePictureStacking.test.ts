import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
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

type ComputedStack = Record<(typeof STACK_SELECTORS)[number], {
  readonly position: string;
  readonly zIndex: string;
}>;

describe("런타임 computed z-index 밴드", () => {
  let browser: Browser;
  let computed: ComputedStack;

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
      const css = await readFile(cssFile, "utf8");
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(`<style>${css}</style><div class="play-stage">${STACK_SELECTORS.map(
        (selector) => `<div class="${selector.slice(1)}"></div>`,
      ).join("")}</div>`);
      computed = await page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) throw new Error(`missing fixture element: ${selector}`);
        const style = getComputedStyle(element);
        return [selector, { position: style.position, zIndex: style.zIndex }];
      })) as ComputedStack, STACK_SELECTORS);
    } finally {
      await rm(outputDirectory, { force: true, recursive: true });
    }
  }, PLAYER_BUILD_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  it("picture layer keeps a positioned stacking context below dialogue", () => {
    expect(computed[".picture-layer"]).toEqual({ position: "absolute", zIndex: "26" });
    expect(Number(computed[".picture-layer"].zIndex)).toBeLessThan(Number(computed[".dialogue-overlay"].zIndex));
  });

  it("resolves the complete shipped band through the player.css import closure", () => {
    expect(Object.fromEntries(STACK_SELECTORS.map((selector) => [selector, computed[selector].zIndex]))).toEqual({
      ".picture-layer": "26",
      ".runtime-timer-hud": "29",
      ".runtime-time-hud": "29",
      ".minimap-root": "30",
      ".hand-slot": "30",
      ".zone-feedback": "30",
      ".dialogue-overlay": "39",
      ".action-hud": "40",
    });
  });
});

async function listFiles(root: string): Promise<readonly string[]> {
  const found: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else found.push(path);
    }
  }
  await walk(root);
  return found;
}
