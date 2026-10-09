/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mode = vi.hoisted(() => ({ startPlayGame: vi.fn(), destroyGame: vi.fn() }));
vi.mock("@/app/mode", () => mode);
vi.mock("@/project/store", () => import("@/player/exportProjectStoreShim"));
vi.mock("@/assets/bundledAssetWarmup", () => ({ warmBundledPlayAssets: vi.fn() }));
vi.mock("@/player/runtimeJuice", () => ({ emitRuntimeJuice: vi.fn(() => ({})) }));
vi.mock("@/player/audio", () => ({
  getAudioEngine: vi.fn(() => ({ setQaInstrumentation: vi.fn() })),
  playAudioCommand: vi.fn(), stopAudioCommand: vi.fn(),
}));
vi.mock("@/player/runtimeDebugPanel", () => ({ renderRuntimeDebugPanel: () => document.createElement("div") }));

import { setExportedProject, store } from "@/player/exportProjectStoreShim";
import { renderPlayer, teardownPlayer } from "@/player/player";
import * as saves from "@/player/saveSlots";
import * as loadPanel from "@/player/playerLoadPanel";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { isLifeRecoveryState, LifeReconciliationError } from "@/project/lifeRecovery";
import { startSession, type PlaySession } from "@/project/session";

let main: HTMLElement;
let session: PlaySession;
let registry: Map<string, () => unknown>;
const applySession = vi.fn();
const destroy = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  saves.setSaveSlotStorageNamespace(null);
  const project = createBlankProject();
  project.database.items.push(normalizeItemRecord({ id: "raw", name: "Raw", scope: "none", price: 10 }));
  project.system.shipping = { enabled: true };
  setExportedProject(project);
  registry = new Map();
  vi.clearAllMocks();
  mode.startPlayGame.mockImplementation(async (_host: HTMLElement, next: PlaySession) => {
    session = next;
    return {
      destroy,
      registry: { set: (key: string, value: () => unknown) => registry.set(key, value) },
      events: { once: () => undefined, off: () => undefined },
      scene: { getScene: () => ({
        getSession: () => session, applySession,
        refreshRuntimeSurfaces: () => undefined,
        sys: { settings: { status: 5 } },
      }) },
    };
  });
  main = document.createElement("div");
  document.body.append(main);
});

afterEach(() => {
  teardownPlayer();
  main.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

async function boot(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("Player boot signal missing")), 2000);
    renderPlayer(main, { autoStartRun: true, trackGlobalGame: false, onPlayBootSuccess: () => {
      clearTimeout(deadline);
      resolve();
    } });
  });
}

function fillRecovery(target: PlaySession): void {
  target.shippingQueue = { raw: 3 };
  target.lifeRecovery = { nextSequence: 4097, claims: Object.fromEntries(Array.from({ length: 4096 }, (_, i) => {
    const id = `recovery:${i + 1}`;
    return [id, { id, sourceKind: "shippingQueue", sourceId: "raw", reason: "removed", items: [{ itemId: "raw", count: 1 }] }];
  })) };
  expect(isLifeRecoveryState(target.lifeRecovery)).toBe(true);
}

function seedSlots(): void {
  const project = store.getCurrent();
  const stored = startSession(project, 39);
  const older = JSON.stringify({ ...saves.createSaveSnapshot(project, stored), schemaVersion: 4 });
  fillRecovery(stored);
  const snapshot = saves.createSaveSnapshot(project, stored);
  expect(saves.saveToSlot(window.localStorage, 1, snapshot)).toEqual({ ok: true });
  saves.writeAutosave(window.localStorage, snapshot);
  window.localStorage.setItem("oprn:save-slot:1", older);
  window.localStorage.setItem("oprn:save-slot:auto", older);
  project.system.shipping = { enabled: false };
  for (const result of [saves.readSaveSlot(window.localStorage, 1), saves.readAutosave(window.localStorage)]) {
    expect(result.kind).toBe("present");
    if (result.kind !== "present") throw new Error(result.kind);
    expect(saves.snapshotLoadBlocker(project, result.snapshot)).toBeNull();
    expect(() => saves.applySaveSnapshot(project, result.snapshot)).toThrow(LifeReconciliationError);
    try { saves.applySaveSnapshot(project, result.snapshot); } catch (error) {
      expect(error).toMatchObject({ sourceKind: "shippingQueue", sourceId: "raw", reason: "capacity" });
    }
  }
}

function disk(): Record<string, string | null> {
  return Object.fromEntries(Array.from({ length: window.localStorage.length }, (_, i) => {
    const key = window.localStorage.key(i)!;
    return [key, window.localStorage.getItem(key)];
  }));
}

function click(id: string): void {
  const button = main.querySelector<HTMLButtonElement>(`[data-testid='${id}']`);
  expect(button).not.toBeNull();
  button!.click();
}

// Subscribe to the exact failure DOM change before activation, not a settling delay.
async function observeMessage(selector: string, trigger: () => void, textOnly = true): Promise<void> {
  const previous = main.querySelector(selector)?.textContent;
  let cancel = () => {};
  const state = () => ({
    selectedTitle: main.querySelector(".rm-title-menu-button[aria-selected='true']")?.getAttribute("data-testid"),
    loadWindows: main.querySelectorAll("[data-testid='player-load-window']").length,
    message: main.querySelector(".oprn-load-message")?.textContent,
    startedSessions: mode.startPlayGame.mock.calls.length,
  });
  let atDeadline: ReturnType<typeof state> | undefined;
  const completion = new Promise<boolean>((resolve) => {
    const finish = (ok: boolean) => { observer.disconnect(); clearTimeout(deadline); resolve(ok); };
    const observer = new MutationObserver(() => {
      const node = main.querySelector(selector);
      if (node?.textContent && node.textContent !== previous) finish(true);
    });
    const deadline = setTimeout(() => { atDeadline = state(); finish(false); }, 1500);
    cancel = () => finish(false);
    observer.observe(main, { subtree: true, childList: true, characterData: true });
  });
  try {
    trigger();
    const afterTrigger = state();
    expect(await completion, JSON.stringify({ selector, atDeadline, afterTrigger, current: state() })).toBe(true);
    const nodes = main.querySelectorAll(selector);
    expect(nodes).toHaveLength(1);
    if (textOnly) expect(nodes[0].children).toHaveLength(0);
  } finally { cancel(); }
}

async function openTitleLoadPanel(): Promise<void> {
  // Navigation rerenders/read-checks the large slots synchronously. It prepares
  // the selected action; only Enter schedules the asynchronous panel transition.
  for (const key of ["ArrowDown", "ArrowDown"]) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  }
  expect(main.querySelector(".rm-title-menu-button[aria-selected='true']")?.getAttribute("data-testid")).toBe("title-load-game");
  await observeMessage("[data-testid='player-load-window']", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  }, false);
}

describe("player save/load reconciliation refusal boundaries", () => {
  it("rejects a confirmed overwrite once without changing old bytes or live state", async () => {
    await boot();
    fillRecovery(session);
    expect(saves.saveToSlot(window.localStorage, 1, saves.createSaveSnapshot(store.getCurrent(), session)).ok).toBe(true);
    store.getCurrent().system.shipping = { enabled: false };
    const before = structuredClone(session), bytes = disk();
    expect(bytes[saves.saveSlotKey(1)]).not.toBeNull();
    registry.get("openSaveMenu")!();
    click("save-slot-1"); // First selection only confirms the existing, non-null slot.
    expect(disk()).toEqual(bytes);
    vi.mocked(emitRuntimeJuice).mockClear();
    await observeMessage(".status-menu-message", () => click("save-slot-1"));
    expect(vi.mocked(emitRuntimeJuice).mock.calls.filter((call) => call[0].event === "menu-invalid")).toHaveLength(1);
    expect(vi.mocked(emitRuntimeJuice).mock.calls.filter((call) => call[0].event === "menu-confirm")).toHaveLength(0);
    expect(session).toEqual(before);
    expect(disk()).toEqual(bytes);
    expect(applySession).not.toHaveBeenCalled();
    expect(mode.startPlayGame).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
    expect(main.querySelector("[data-testid='main-menu']")).not.toBeNull();
  });

  it.each(["1", "auto"])("reports slot %s refusal once in the running shell without fallback or replacement", async (slot) => {
    await boot();
    seedSlots();
    const before = structuredClone(session), bytes = disk();
    registry.get("openLoadMenu")!();
    const render = vi.spyOn(loadPanel, "renderPlayerLoadPanel");
    const reads = vi.spyOn(window.localStorage, "getItem");
    await observeMessage(".oprn-load-message", () => click(`save-slot-${slot}`));
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0][0]).toMatchObject({ fromTitle: false, message: expect.any(String) });
    expect(reads.mock.calls.some(([key]) => key === "oprn:save-slot:1" || key === "oprn:save-slot:auto")).toBe(false);
    expect(session).toEqual(before);
    expect(disk()).toEqual(bytes);
    expect(applySession).not.toHaveBeenCalled();
    expect(mode.startPlayGame).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
  });

  it.each(["1", "auto"])("reports title slot %s refusal without starting a restored session", async (slot) => {
    seedSlots();
    const bytes = disk();
    renderPlayer(main, { trackGlobalGame: false });
    await openTitleLoadPanel();
    const render = vi.spyOn(loadPanel, "renderPlayerLoadPanel");
    await observeMessage(".oprn-load-message", () => click(`save-slot-${slot}`));
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0][0]).toMatchObject({ fromTitle: true, message: expect.any(String) });
    expect(disk()).toEqual(bytes);
    expect(mode.startPlayGame).not.toHaveBeenCalled();
    expect(applySession).not.toHaveBeenCalled();
  });

  it("does not spend the title readiness deadline on synchronous keyboard processing", async () => {
    seedSlots();
    const bytes = disk();
    renderPlayer(main, { trackGlobalGame: false });
    // Time is the helper contract under test: model a synchronous key handler
    // consuming the old deadline before it schedules the title's real callback.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const render = vi.spyOn(loadPanel, "renderPlayerLoadPanel");
    let navigationKeys = 0;
    const consumeNavigationTime = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" || ++navigationKeys !== 2) return;
      expect(main.querySelector(".rm-title-menu-button[aria-selected='true']")?.getAttribute("data-testid")).toBe("title-load-game");
      vi.advanceTimersByTime(1500);
      expect(render).not.toHaveBeenCalled();
      expect(main.querySelector("[data-testid='player-load-window']")).toBeNull();
    };
    document.addEventListener("keydown", consumeNavigationTime);
    let completion: Promise<void>;
    try { completion = openTitleLoadPanel(); }
    finally { document.removeEventListener("keydown", consumeNavigationTime); }
    expect(navigationKeys).toBe(2);
    // Attach rejection handling before allowing the actual title callback to run.
    const observed = completion.then(() => ({ ok: true }), (error: unknown) => ({ ok: false, error }));
    await vi.runOnlyPendingTimersAsync();
    const diagnostic = {
      observed: await observed, timers: vi.getTimerCount(), selected: main.querySelector(".rm-title-menu-button[aria-selected='true']")?.getAttribute("data-testid"),
      windows: main.querySelectorAll("[data-testid='player-load-window']").length, renderCalls: render.mock.calls.length,
    };
    expect(render, JSON.stringify(diagnostic, (_key, value) => value instanceof Error ? String(value) : value)).toHaveBeenCalledTimes(1);
    expect(main.querySelectorAll("[data-testid='player-load-window']")).toHaveLength(1);
    expect(await observed).toEqual({ ok: true });
    expect(disk()).toEqual(bytes);
    expect(mode.startPlayGame).not.toHaveBeenCalled();
    expect(applySession).not.toHaveBeenCalled();
  });

  it.each([
    ["save", "TypeError"], ["save", "DataCloneError"],
    ["1", "TypeError"], ["1", "DataCloneError"],
    ["auto", "TypeError"], ["auto", "DataCloneError"],
  ])("propagates unrelated %s %s without failure guidance", async (boundary, errorKind) => {
    await boot();
    seedSlots();
    registry.get(boundary === "save" ? "openSaveMenu" : "openLoadMenu")!();
    if (boundary === "save") click("save-slot-1");
    const bytes = disk(), before = structuredClone(session);
    const error = errorKind === "DataCloneError" ? new DOMException("cannot clone", "DataCloneError") : new TypeError("programming defect");
    const render = vi.spyOn(loadPanel, "renderPlayerLoadPanel");
    const previousMessage = main.querySelector(".status-menu-message")?.textContent;
    vi.mocked(emitRuntimeJuice).mockClear();
    vi.spyOn(saves, boundary === "save" ? "createSaveSnapshot" : "applySaveSnapshot").mockImplementation(() => { throw error; });
    expect(() => click(`save-slot-${boundary === "save" ? "1" : boundary}`)).toThrow(error);
    expect(render).not.toHaveBeenCalled();
    expect(main.querySelector(".status-menu-message")?.textContent).toBe(previousMessage);
    expect(emitRuntimeJuice).not.toHaveBeenCalled();
    expect(disk()).toEqual(bytes);
    expect(session).toEqual(before);
    expect(applySession).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
    expect(mode.startPlayGame).toHaveBeenCalledTimes(1);
  });
});
