/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const modeMocks = vi.hoisted(() => ({ startPlayGame: vi.fn(), destroyGame: vi.fn() }));
vi.mock("@/app/mode", () => modeMocks);
// Match player.html's store alias: this regression must not depend on the editor or DB.
vi.mock("@/project/store", () => import("@/player/exportProjectStoreShim"));
vi.mock("@/assets/bundledAssetWarmup", () => ({ warmBundledPlayAssets: vi.fn() }));
vi.mock("@/player/runtimeJuice", () => ({ emitRuntimeJuice: vi.fn(() => ({})) }));
vi.mock("@/player/audio", () => ({
  getAudioEngine: vi.fn(() => ({ setQaInstrumentation: vi.fn() })),
  playAudioCommand: vi.fn(), stopAudioCommand: vi.fn(),
}));
vi.mock("@/player/runtimeDebugPanel", () => ({
  renderRuntimeDebugPanel: () => document.createElement("div"),
}));

import { setExportedProject, store } from "@/player/exportProjectStoreShim";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { renderPlayer, teardownPlayer } from "@/player/player";
import { readSaveSlot, setSaveSlotStorageNamespace } from "@/player/saveSlots";
import { createBlankProject } from "@/project/defaults";
import type { PlaySession } from "@/project/session";
import { armSaveWriteSignal } from "./e2e/saveWriteSignal";

// On happy-dom 21 (#3310) the quota-failure spy on window.localStorage.setItem below survives
// vi.restoreAllMocks, so every later save in this file failed with "저장 공간이 부족합니다" (CI run
// 40463902992 traced the throw to that spy). Each test gets its own plain in-memory Storage instead.
// The shipped pixel-skin save path writes in a real browser (runtime QA, 2026-10-27).
class MemoryStorage implements Storage {
  #items = new Map<string, string>();
  get length(): number { return this.#items.size; }
  clear(): void { this.#items.clear(); }
  getItem(key: string): string | null { return this.#items.get(String(key)) ?? null; }
  key(index: number): string | null { return Array.from(this.#items.keys())[index] ?? null; }
  removeItem(key: string): void { this.#items.delete(String(key)); }
  setItem(key: string, value: string): void { this.#items.set(String(key), String(value)); }
}

let main: HTMLElement;
let session: PlaySession;
let registry: Map<string, unknown>;

beforeEach(async () => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  if (window.localStorage !== globalThis.localStorage) {
    Object.defineProperty(window, "localStorage", { configurable: true, value: globalThis.localStorage });
  }
  window.localStorage.clear();
  window.sessionStorage.clear();
  setSaveSlotStorageNamespace(null);
  setExportedProject(createBlankProject());
  registry = new Map();
  modeMocks.startPlayGame.mockReset();
  modeMocks.startPlayGame.mockImplementation(async (_container: HTMLElement, nextSession: PlaySession) => {
    session = nextSession;
    const scene = {
      session,
      applySession: () => undefined,
      getSession: () => session,
      refreshRuntimeSurfaces: () => undefined,
      sys: { settings: { status: 5 } },
    };
    return {
      destroy: vi.fn(),
      // player.ts onKeyDown reads registry.get('initialPresentationPending') before routing any key; without
      // get() the handler threw, so Enter on a save slot never reached the menu.
      registry: { set: (key: string, value: unknown) => registry.set(key, value), get: (key: string) => registry.get(key) },
      events: { once: () => undefined, off: () => undefined },
      scene: { getScene: () => scene },
    };
  });
  main = document.createElement("div");
  document.body.append(main);
  await new Promise<void>((resolve) => {
    // A blank project has a New Game opening, and the player now boots the engine behind it, so boot success
    // arrives while the opening still owns the keyboard (player.ts bootRun / onKeyDown). This suite is about
    // the save menu, so the host skips the opening, as the editor test-play window can.
    renderPlayer(main, { autoStartRun: true, trackGlobalGame: false, shouldPlayOpening: () => false, onPlayBootSuccess: resolve });
  });
});

afterEach(() => {
  window.__saveWriteSignal?.dispose();
  vi.useRealTimers();
  teardownPlayer();
  main.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openSaveMenu(): void {
  // The event interpreter invokes this registry callback after the savepoint dialogue.
  const callback = registry.get("openSaveMenu");
  expect(callback).toBeTypeOf("function");
  if (typeof callback === "function") callback();
}

function keyDown(key: string): void {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
}

function menu(): HTMLElement {
  return main.querySelector<HTMLElement>("[data-testid='main-menu']")!;
}

function expectSaveScreen(): void {
  expect(menu().dataset.statusMenuScreen).toBe("function");
  expect(menu().classList.contains("status-menu-detail-focus")).toBe(true);
  const detail = menu().querySelector<HTMLElement>("[data-status-menu-command='save']")!;
  expect(detail.hasAttribute("aria-hidden")).toBe(false);
  expect(detail.hasAttribute("inert")).toBe(false);
  expect(detail.querySelectorAll("[data-testid^='save-slot-']")).toHaveLength(3);
  expect(detail.contains(document.activeElement)).toBe(true);
}

describe("event-opened save menu in the shipping player shell", () => {
  it("signals the exact Save5 write from the real save entry point without a delay", async () => {
    openSaveMenu();
    session.switches.sw_quest_key = true;
    const original = window.localStorage.setItem;
    armSaveWriteSignal("oprn:save-slot:v5:1");
    const signal = window.__saveWriteSignal;
    if (!signal) throw new Error("Save signal was not armed");

    keyDown("Enter");

    expect(await signal.completion).toBe("written");
    expect(window.localStorage.setItem).toBe(original);
    expect(readSaveSlot(window.localStorage, 1)).toMatchObject({
      kind: "present", snapshot: { schemaVersion: 5, session: { switches: { sw_quest_key: true } } },
    });
  });

  it("ignores other keys and sessionStorage, then times out and restores instrumentation", async () => {
    vi.useFakeTimers();
    const original = window.localStorage.setItem;
    armSaveWriteSignal("oprn:save-slot:v5:1");
    const signal = window.__saveWriteSignal;
    if (!signal) throw new Error("Save signal was not armed");
    window.localStorage.setItem("oprn:save-slot:1", "legacy");
    window.sessionStorage.setItem("oprn:save-slot:v5:1", "other storage");

    await vi.advanceTimersByTimeAsync(5_000);

    expect(await signal.completion).toBe("timeout");
    expect(window.localStorage.setItem).toBe(original);
  });

  it("does not report a failed write as complete and disposes a cancelled observation", async () => {
    openSaveMenu();
    const write = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    armSaveWriteSignal("oprn:save-slot:v5:1");
    const signal = window.__saveWriteSignal;
    if (!signal) throw new Error("Save signal was not armed");

    keyDown("Enter");
    signal.dispose();

    expect(await signal.completion).toBe("cancelled");
    expect(window.localStorage.setItem).toBe(write);
    expect(window.__saveWriteSignal).toBeUndefined();
    expect(readSaveSlot(window.localStorage, 1).kind).toBe("empty");
  });

  it("shows slots immediately and saves, navigates and backs out through the keyboard", async () => {
    openSaveMenu();
    expectSaveScreen();
    expect(menu().querySelector("[data-testid='save-slot-1']")?.getAttribute("aria-current")).toBe("true");

    session.gold = 123;
    keyDown("Enter");
    expect(readSaveSlot(window.localStorage, 1)).toMatchObject({ kind: "present", snapshot: { session: { gold: 123 } } });
    keyDown("ArrowDown");
    keyDown("z");
    expect(readSaveSlot(window.localStorage, 2)).toMatchObject({ kind: "present", snapshot: { session: { gold: 123 } } });

    keyDown("Escape");
    expect(menu().dataset.statusMenuScreen).toBe("main");
    const closingMenu = menu();
    keyDown("Escape");
    expect(closingMenu.dataset.statusMenuClosing).toBe("1");
    // happy-dom 21 (#3310) implements Element.animate, so the shipping close helper removes the panel when
    // its 120ms exit animation finishes instead of immediately (playerStatusMenuMotion.closeStatusMenu).
    await vi.waitFor(() => expect(closingMenu.isConnected).toBe(false));
  });

  it("keeps overwrite confirmation cancellable and resets it on direct re-entry", () => {
    openSaveMenu();
    session.gold = 10;
    keyDown("Enter");
    session.gold = 20;
    keyDown("Enter");
    expect(menu().textContent).toContain("덮어쓰려면 다시 선택하세요");
    expect(readSaveSlot(window.localStorage, 1)).toMatchObject({ snapshot: { session: { gold: 10 } } });

    keyDown("Escape");
    expectSaveScreen();
    expect(menu().textContent).not.toContain("덮어쓰려면 다시 선택하세요");
    keyDown("Enter");
    openSaveMenu();
    expectSaveScreen();
    keyDown("Enter");
    expect(readSaveSlot(window.localStorage, 1)).toMatchObject({ snapshot: { session: { gold: 10 } } });
    keyDown("Enter");
    expect(readSaveSlot(window.localStorage, 1)).toMatchObject({ snapshot: { session: { gold: 20 } } });
  });

  it.each(["map", "session"] as const)("preserves the %s save restriction on direct entry", (restriction) => {
    if (restriction === "map") store.getCurrent().maps[session.currentMapId].disableSave = true;
    else ensureM2Runtime(session).access.save = false;

    openSaveMenu();
    expectSaveScreen();
    const slots = menu().querySelectorAll<HTMLElement>("[data-testid^='save-slot-']");
    expect(Array.from(slots).every((slot) => slot.classList.contains("disabled"))).toBe(true);
    expect(menu().querySelector(".status-menu-detail-action")).toBeNull();
    keyDown("Enter");
    expect(readSaveSlot(window.localStorage, 1).kind).toBe("empty");
  });
});
