import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { build, type Plugin } from "vite";

const PLAYER_BUILD_TIMEOUT_MS = 180_000;
const VIRTUAL_RUNTIME_BAND_ENTRY = "virtual:runtime-band-surface";
const RESOLVED_RUNTIME_BAND_ENTRY = `\0${VIRTUAL_RUNTIME_BAND_ENTRY}`;
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

const RUNTIME_BAND_ENTRY_SOURCE = `
import { createPlaySurface } from "/src/player/playSurface.ts";
import { createDialogueUI } from "/src/player/dialogue.ts";
import { RuntimeDomOverlay } from "/src/player/runtimeDom.ts";
import { HandSlotChip } from "/src/player/handSlotChip.ts";
import { ActionHud } from "/src/player/actionHud.ts";
import { syncMinimapVisibility } from "/src/player/minimap.ts";
import { createZoneFeedbackDom, feedbackSuppressedByOverlay } from "/src/player/playSceneZoneFeedback.ts";

function createMinimapMarkup(host, corner) {
  // Exact transcription of src/player/minimap.ts:160-186. createMinimap itself is async and
  // requires a store-backed map, tileset and image; production visibility still owns state below.
  const root = document.createElement("div");
  root.className = \`minimap-root is-\${corner}\`;
  root.dataset.testid = "minimap-root";
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", "스태킹 가드 미니맵");
  const frame = document.createElement("div");
  frame.className = "minimap-frame";
  const canvas = document.createElement("canvas");
  canvas.className = "minimap-canvas";
  canvas.dataset.testid = "minimap-canvas";
  const dot = document.createElement("div");
  dot.className = "minimap-dot";
  dot.dataset.testid = "minimap-dot";
  frame.append(canvas, dot);
  root.append(frame);
  const label = document.createElement("div");
  label.className = "minimap-label";
  label.textContent = "스태킹 가드";
  root.append(label);
  host.append(root);
  return { root, canvas, dot };
}

function openDialogue(dialogue, variant) {
  const settings = {
    format: "normal",
    position: variant === "top" ? "top" : variant === "center" ? "center" : "bottom",
    preventObscuringPlayer: false,
    allowEventMovementDuringWait: false,
  };
  const common = { settings, playerTileY: 7, mapHeight: 15 };
  if (variant === "choices") {
    void dialogue.showChoices({ ...common, options: [{ text: "예" }, { text: "아니오" }, { text: "잠시" }, { text: "떠난다" }] });
    return "choices";
  }
  if (variant === "bust") {
    void dialogue.showText({
      ...common,
      body: "촌장: 자네가 이 마을에 온 이유를 알고 있네.",
      face: { resourceId: "generated-face-actor1-bust", position: "left", flipHorizontally: false },
    });
    return "text";
  }
  if (variant !== "closed") {
    void dialogue.showText({ ...common, body: "촌장: 자네가 이 마을에 온 이유를 알고 있네." });
    return "text";
  }
  return "closed";
}

export function createRuntimeBandSurface(options) {
  const layout = document.createElement("div");
  layout.className = "player-layout system-shell";
  layout.dataset.playInputOwner = "keyboard-only";
  const surface = createPlaySurface();
  layout.append(surface.viewport);
  document.body.append(layout);
  surface.sync();

  let actionHud;
  const mountActionHud = () => { actionHud = new ActionHud(surface.stage); };
  if (options.actionHudFirst) mountActionHud();

  const dialogue = createDialogueUI(surface.stage);
  const dialogueKind = openDialogue(dialogue, options.dialogue);

  const runtimeDom = new RuntimeDomOverlay(() => surface.stage);
  runtimeDom.syncPictureLayer({
    pic25: { pictureId: "pic25", resourceId: "hero", x: 0, y: 0 },
    label: { pictureId: "label", resourceId: "no-such-runtime-band-resource", x: 0, y: 0 },
  });
  runtimeDom.syncVisibleHud({
    timers: { guard: 90 },
    timerActive: { guard: true },
    gameTime: { minute: 30, hour: 9, day: 1, season: "spring", year: 1 },
    timePhase: "morning",
  });

  const minimap = createMinimapMarkup(surface.stage, options.minimapCorner);
  const handSlot = new HandSlotChip(surface.stage);
  if (options.handSlot === "occupied") {
    handSlot.update(
      { database: { items: [{ id: "item_guard", name: "가드 도구", farmTool: "hoe" }] } },
      { inventory: { item_guard: 1 }, equippedToolItemId: "item_guard" },
    );
  }

  const zoneFeedback = createZoneFeedbackDom(surface.stage);
  zoneFeedback.render({
    banner: null,
    toast: null,
    objective: "스태킹 밴드 확인",
    prompt: null,
    suppressed: feedbackSuppressedByOverlay(surface.stage),
  }, []);
  if (!options.actionHudFirst) mountActionHud();

  const touchPad = document.createElement("div");
  touchPad.className = "touch-pad";
  surface.stage.append(touchPad);
  syncMinimapVisibility({
    mapId: "map_guard",
    setting: { enabled: true },
    scale: 1,
    canvas: minimap.canvas,
    dot: minimap.dot,
    root: minimap.root,
    hidden: false,
  }, surface.stage, false);

  return {
    cleanup() {
      if (dialogueKind === "choices") {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      } else if (dialogueKind === "text") {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      }
      dialogue.hide();
      zoneFeedback.destroy();
      handSlot.destroy();
      actionHud?.destroy();
      surface.cleanup();
      layout.remove();
    },
  };
}
`;

type StackSelector = (typeof STACK_SELECTORS)[number];
type ComputedEntry = {
  readonly position: string;
  readonly zIndex: string;
  readonly display: string;
  readonly visibility: string;
};
type ComputedStack = Record<StackSelector, ComputedEntry | null>;
type DialogueVariant = "closed" | "bottom" | "top" | "center" | "choices" | "bust";
type StateLabel =
  | "closed"
  | "bottom"
  | "reduced-motion"
  | "action-hud-first"
  | "top"
  | "center"
  | "choices"
  | "bust"
  | "bottom-left-occupied";
type FixtureOptions = {
  readonly dialogue: DialogueVariant;
  readonly actionHudFirst: boolean;
  readonly minimapCorner: "top-right" | "bottom-left";
  readonly handSlot: "empty" | "occupied";
};
type MeasuredState = { readonly label: StateLabel; readonly stack: ComputedStack };

const runtimeBandEntryPlugin = (): Plugin => ({
  name: "runtime-band-entry",
  resolveId(id) {
    return id === VIRTUAL_RUNTIME_BAND_ENTRY ? RESOLVED_RUNTIME_BAND_ENTRY : null;
  },
  load(id) {
    return id === RESOLVED_RUNTIME_BAND_ENTRY ? RUNTIME_BAND_ENTRY_SOURCE : null;
  },
});

const buildLibrary = async (input: string, format: "css" | "iife"): Promise<string> => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "rpgzzu-picture-stacking-"));
  try {
    const entry = input === VIRTUAL_RUNTIME_BAND_ENTRY ? input : resolve(input);
    await build({
      configFile: false,
      publicDir: false,
      root: resolve("."),
      logLevel: "silent",
      plugins: input === VIRTUAL_RUNTIME_BAND_ENTRY ? [runtimeBandEntryPlugin()] : [],
      resolve: { alias: { "@": resolve("src") } },
      build: {
        emptyOutDir: true,
        outDir: outputDirectory,
        ...(format === "css"
          ? { rollupOptions: { input: entry } }
          : {
              rollupOptions: {
                input: entry,
                preserveEntrySignatures: "strict",
                output: {
                  entryFileNames: "runtimeBand.js",
                  format: "iife" as const,
                  name: "RuntimeBandLib",
                },
                ...(input === VIRTUAL_RUNTIME_BAND_ENTRY ? { plugins: [runtimeBandEntryPlugin()] } : {}),
              },
            }),
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

const requireEntry = (stack: ComputedStack, selector: StackSelector): ComputedEntry => {
  const entry = stack[selector];
  if (!entry) throw new Error(`missing measured element: ${selector}`);
  return entry;
};

describe("런타임 computed z-index 밴드", () => {
  let browser: Browser;
  let page: Page;
  let states: readonly MeasuredState[];

  const measure = async (options: FixtureOptions): Promise<ComputedStack> => page.evaluate(
    ({ selectors, fixture }) => {
      document.body.replaceChildren();
      const runtime = (window as unknown as { RuntimeBandLib: RuntimeBandLib }).RuntimeBandLib.createRuntimeBandSurface(fixture);
      const measured = Object.fromEntries(selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return [selector, null];
        const style = getComputedStyle(element);
        return [selector, {
          position: style.position,
          zIndex: style.zIndex,
          display: style.display,
          visibility: style.visibility,
        }];
      })) as ComputedStack;
      runtime.cleanup();
      return measured;
    },
    { selectors: STACK_SELECTORS, fixture: options },
  );

  beforeAll(async () => {
    const [css, surfaceScript] = await Promise.all([
      buildLibrary("src/player/player.css", "css"),
      buildLibrary(VIRTUAL_RUNTIME_BAND_ENTRY, "iife"),
    ]);
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.setContent(`<style>${css}</style>`);
    if (!surfaceScript.includes("RuntimeBandLib")) throw new Error(`missing IIFE name: ${surfaceScript.slice(0, 500)}`);
    await page.addScriptTag({ content: surfaceScript });
    await page.evaluate("window.RuntimeBandLib = RuntimeBandLib");

    const defaults: FixtureOptions = {
      dialogue: "closed",
      actionHudFirst: false,
      minimapCorner: "top-right",
      handSlot: "empty",
    };
    const measured: MeasuredState[] = [
      { label: "closed", stack: await measure(defaults) },
      { label: "bottom", stack: await measure({ ...defaults, dialogue: "bottom" }) },
      { label: "action-hud-first", stack: await measure({ ...defaults, dialogue: "bottom", actionHudFirst: true }) },
      { label: "top", stack: await measure({ ...defaults, dialogue: "top" }) },
      { label: "center", stack: await measure({ ...defaults, dialogue: "center" }) },
      { label: "choices", stack: await measure({ ...defaults, dialogue: "choices" }) },
      { label: "bust", stack: await measure({ ...defaults, dialogue: "bust" }) },
      {
        label: "bottom-left-occupied",
        stack: await measure({ ...defaults, minimapCorner: "bottom-left", handSlot: "occupied" }),
      },
    ];
    await page.emulateMedia({ reducedMotion: "reduce" });
    measured.push({ label: "reduced-motion", stack: await measure({ ...defaults, dialogue: "bottom" }) });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    states = measured;
  }, PLAYER_BUILD_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
  });

  const state = (label: StateLabel): ComputedStack => {
    const measured = states.find((candidate) => candidate.label === label);
    if (!measured) throw new Error(`missing measured state: ${label}`);
    return measured.stack;
  };

  const bandOf = (stack: ComputedStack): Record<string, string | null> =>
    Object.fromEntries(STACK_SELECTORS.map((selector) => [selector, stack[selector]?.zIndex ?? null]));

  it("picture layer keeps a positioned stacking context below dialogue", () => {
    const closed = state("closed");
    expect(requireEntry(closed, ".picture-layer").position).toBe("absolute");
    expect(requireEntry(closed, ".picture-layer").zIndex).toBe("26");
    expect(Number(requireEntry(closed, ".picture-layer").zIndex)).toBeLessThan(
      Number(requireEntry(closed, ".dialogue-overlay").zIndex),
    );
  });

  it("resolves the complete shipped band through the player.css import closure", () => {
    expect(bandOf(state("closed"))).toEqual(EXPECTED_BAND);
  });

  it("실제 dialogue-box 를 가진 모든 대사 변형에서도 존재하는 밴드가 같다", () => {
    for (const label of ["bottom", "top", "center", "choices", "bust"] as const) {
      const stack = state(label);
      expect(bandOf(stack)).toEqual({ ...EXPECTED_BAND, ".zone-feedback": null });
      expect(requireEntry(stack, ".picture-layer").position).toBe("absolute");
    }
  });

  it("prefers-reduced-motion 과 반대 형제 순서에서도 존재하는 밴드가 같다", () => {
    for (const label of ["reduced-motion", "action-hud-first"] as const) {
      const stack = state(label);
      expect(bandOf(stack)).toEqual({ ...EXPECTED_BAND, ".zone-feedback": null });
      expect(requireEntry(stack, ".picture-layer").position).toBe("absolute");
    }
  });

  it("프로덕션 픽처 DOM 이 이미지와 라벨 슬롯을 모두 만든다", async () => {
    const inspected = await page.evaluate(() => {
      const runtime = (window as unknown as { RuntimeBandLib: RuntimeBandLib }).RuntimeBandLib.createRuntimeBandSurface({
        dialogue: "closed",
        actionHudFirst: false,
        minimapCorner: "top-right",
        handSlot: "empty",
      });
      const result = {
        image: Boolean(document.querySelector('.picture-layer-item[data-render="image"] > .picture-layer-image')),
        label: Boolean(document.querySelector('.picture-layer-item[data-render="label"] > .picture-layer-label')),
      };
      runtime.cleanup();
      return result;
    });
    expect(inspected).toEqual({ image: true, label: true });
  });

  it("닫힌 상태의 구성원은 표시되고 열린 상태의 구성원은 프로덕션 억제 계약을 따른다", () => {
    for (const label of ["closed", "bottom-left-occupied"] as const) {
      const stack = state(label);
      for (const selector of STACK_SELECTORS) {
        const entry = requireEntry(stack, selector);
        expect(entry.visibility, `${label} ${selector} visibility`).toBe("visible");
        expect(entry.display, `${label} ${selector} display`).not.toBe("none");
      }
    }

    const hiddenWhenDialogueOpen: readonly StackSelector[] = [".minimap-root", ".hand-slot", ".action-hud"];
    for (const { label, stack } of states.filter((candidate) => candidate.label !== "closed" && candidate.label !== "bottom-left-occupied")) {
      expect(stack[".zone-feedback"], `${label} zone-feedback presence`).toBeNull();
      for (const selector of STACK_SELECTORS.filter((candidate) => candidate !== ".zone-feedback")) {
        const entry = requireEntry(stack, selector);
        expect(entry.visibility, `${label} ${selector} visibility`).toBe("visible");
        if (hiddenWhenDialogueOpen.includes(selector)) {
          expect(entry.display, `${label} ${selector} display`).toBe("none");
        } else {
          expect(entry.display, `${label} ${selector} display`).not.toBe("none");
        }
      }
    }
  });

  it("픽처 슬롯은 프로덕션 산식의 z-index 를 레이어 스태킹 컨텍스트 안에서 유지한다", () => {
    for (const { stack } of states) {
      expect(requireEntry(stack, ".picture-layer-item").position).toBe("absolute");
      expect(requireEntry(stack, ".picture-layer-item").zIndex).toBe("45");
    }
  });

  it("추가 코너와 비어 있지 않은 손 슬롯도 실제 상태 속성으로 측정한다", async () => {
    const variant = state("bottom-left-occupied");
    expect(requireEntry(variant, ".minimap-root").display).not.toBe("none");
    expect(requireEntry(variant, ".hand-slot").display).not.toBe("none");
    const attributes = await page.evaluate(() => {
      const runtime = (window as unknown as { RuntimeBandLib: RuntimeBandLib }).RuntimeBandLib.createRuntimeBandSurface({
        dialogue: "closed",
        actionHudFirst: false,
        minimapCorner: "bottom-left",
        handSlot: "occupied",
      });
      const minimap = document.querySelector(".minimap-root");
      const handSlot = document.querySelector(".hand-slot");
      const result = {
        bottomLeft: minimap?.classList.contains("is-bottom-left") ?? false,
        slot: handSlot instanceof HTMLElement ? handSlot.dataset.slot : undefined,
        empty: handSlot?.classList.contains("is-empty") ?? true,
      };
      runtime.cleanup();
      return result;
    });
    expect(attributes).toEqual({ bottomLeft: true, slot: "1", empty: false });
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

type RuntimeBandLib = {
  readonly createRuntimeBandSurface: (options: FixtureOptions) => { readonly cleanup: () => void };
};
