import { describe, expect, it, vi } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { collectLifeRecoveryClaim } from "@/project/lifeRecovery";
import { startSession, type LifeRecoveryClaim } from "@/project/session";
import { store } from "@/project/store";
import {
  hasLifeLedgerData,
  hasSessionLifeRecoveryClaims,
  resolveLifeLedgerTab,
} from "@/player/lifeLedger";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import {
  formatDayTransitionFailureMessage,
  presentDayTransitionFailure,
  type DayTransitionFailureView,
} from "@/player/playSceneTime";
import { createPlayerStatusMenuController } from "@/player/playerStatusMenuController";
import type { PlayScene } from "@/player/PlayScene";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const fade = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/player/playSceneMapCommands", () => ({
  fadeCamera: fade,
  TRANSFER_FADE_DURATION_MS: 120,
}));

import { sleepUntilMorningScene } from "@/player/playSceneTime";

function disableAllLifePackages(project: ReturnType<typeof createBlankProject>): void {
  delete project.system.shipping;
  delete project.system.bundles;
  delete project.system.skillSystem;
  delete project.system.makers;
  delete project.system.fishing;
  delete project.system.seasonalForage;
  delete project.system.collections;
  delete project.system.museum;
  delete project.system.energy;
  project.database.lifeSkills = [];
  project.database.farmAnimalSpecies = [];
  project.system.farmAnimalBuildings = [];
  project.database.farmBuildingTypes = [];
  project.database.homeDecorationTypes = [];
  project.session.farmAnimals = [];
  project.session.farmBuildingPlacements = [];
  project.session.homeDecorationPlacements = [];
}

function requireFakeElement(node: unknown, label: string): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error(`expected FakeElement for ${label}`);
}

function claim(partial: Partial<LifeRecoveryClaim> & Pick<LifeRecoveryClaim, "id">): LifeRecoveryClaim {
  return {
    sourceKind: partial.sourceKind ?? "shippingQueue",
    sourceId: partial.sourceId ?? "raw",
    reason: partial.reason ?? "disabled",
    items: partial.items ?? [{ itemId: "raw", count: 3 }],
    ...(partial.unresolved ? { unresolved: partial.unresolved } : {}),
    id: partial.id,
  };
}

function packagesOffWithClaims(options?: {
  readonly claims?: Record<string, LifeRecoveryClaim>;
  readonly inventory?: Record<string, number>;
  readonly knownItems?: boolean;
}) {
  const project = createBlankProject();
  disableAllLifePackages(project);
  if (options?.knownItems !== false) {
    project.database.items.push(normalizeItemRecord({ id: "raw", name: "원료", scope: "none", price: 1 }));
  }
  const session = startSession(project, 1601);
  session.inventory = { ...(options?.inventory ?? {}) };
  session.lifeRecovery = {
    nextSequence: 3,
    claims: options?.claims ?? {
      "recovery:1": claim({ id: "recovery:1", items: [{ itemId: "raw", count: 3 }] }),
    },
  };
  return { project, session };
}

function renderRecovery(project: ReturnType<typeof createBlankProject>, session: ReturnType<typeof startSession>) {
  const mutations: Array<{ ok: boolean; message: string }> = [];
  const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
    project,
    session,
    selectedCommand: "life-ledger",
    lifeLedgerTab: resolveLifeLedgerTab(project, session, "recovery"),
    slots: [],
    waitModeEnabled: true,
    onLifeLedgerMutation: (ok, message) => mutations.push({ ok, message }),
  })));
  return { panel, mutations };
}

describe("life recovery ledger UI", () => {
  it("exposes the recovery ledger when every life package is off but session claims remain", () => {
    const restoreDom = installFakeDom();
    try {
      const { project, session } = packagesOffWithClaims();
      expect(hasSessionLifeRecoveryClaims(session)).toBe(true);
      expect(hasLifeLedgerData(project)).toBe(false);
      expect(hasLifeLedgerData(project, session)).toBe(true);
      expect(listStatusMenuCommandIds(project, session)).toContain("life-ledger");

      const { panel } = renderRecovery(project, session);
      const tab = findByTestId(panel, "life-ledger-tab-recovery");
      expect(tab?.tagName).toBe("BUTTON");
      expect(tab?.getAttribute("role")).toBe("tab");
      expect(tab?.getAttribute("aria-selected")).toBe("true");

      const frozen = structuredClone(session);
      const row = findByTestId(panel, "life-ledger-recovery-collect-recovery:1");
      expect(row).toBeTruthy();
      expect(row?.getAttribute("data-claim-id")).toBe("recovery:1");
      expect(row?.getAttribute("data-claim-presentation")).toBe("open");
      expect(row?.getAttribute("data-claim-state")).toBeNull();
      expect(row?.getAttribute("data-claim-outcome")).toBeNull();
      expect(row?.getAttribute("data-item-amounts")).toBe(JSON.stringify([{ itemId: "raw", count: 3 }]));
      expect(row?.getAttribute("data-unresolved-reason") ?? "").toBe("");
      expect(row?.getAttribute("disabled")).toBeNull();
      expect(findByTestId(panel, "life-ledger-tab-shipping")).toBeNull();
      // Rendering must not clone-probe or mutate live session/claims.
      expect(session).toEqual(frozen);
    } finally {
      restoreDom();
    }
  });

  it("collects a known item claim exactly once and rejects a duplicate retry with zero inventory change", () => {
    const restoreDom = installFakeDom();
    try {
      const { project, session } = packagesOffWithClaims();
      const first = renderRecovery(project, session);
      findByTestId(first.panel, "life-ledger-recovery-collect-recovery:1")?.click();
      expect(first.mutations).toEqual([expect.objectContaining({ ok: true })]);
      expect(session.inventory.raw).toBe(3);
      expect(session.lifeRecovery?.claims["recovery:1"]).toBeUndefined();
      expect(session.lifeRecovery?.nextSequence).toBe(3);

      const second = renderRecovery(project, session);
      expect(findByTestId(second.panel, "life-ledger-recovery-collect-recovery:1")).toBeNull();
      expect(Object.keys(session.lifeRecovery?.claims ?? {})).toEqual([]);

      const before = structuredClone(session.inventory);
      expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "missing-claim" });
      expect(session.inventory).toEqual(before);
      expect(session.lifeRecovery?.nextSequence).toBe(3);
    } finally {
      restoreDom();
    }
  });

  it("keeps unknown-item and quantity-cap refusals as raw claims with actionable recovery controls", () => {
    const restoreDom = installFakeDom();
    try {
      const unknown = packagesOffWithClaims({
        knownItems: false,
        claims: {
          "recovery:1": claim({
            id: "recovery:1",
            items: [{ itemId: "ghost", count: 2 }],
            unresolved: { record: { ghost: 2 }, detail: "unknown-item" },
          }),
        },
      });
      const claimBeforeUnknown = structuredClone(unknown.session.lifeRecovery?.claims["recovery:1"]);
      const unknownRender = renderRecovery(unknown.project, unknown.session);
      // Render does not invent overflow/collectable; it only shows claim evidence.
      expect(unknown.session.lifeRecovery?.claims["recovery:1"]).toEqual(claimBeforeUnknown);
      const unknownRow = findByTestId(unknownRender.panel, "life-ledger-recovery-collect-recovery:1");
      expect(unknownRow?.getAttribute("data-claim-presentation")).toBe("open");
      expect(unknownRow?.getAttribute("data-claim-outcome")).toBeNull();
      expect(unknownRow?.getAttribute("data-item-amounts")).toBe(JSON.stringify([{ itemId: "ghost", count: 2 }]));
      expect(unknownRow?.getAttribute("data-unresolved-reason")).toBe("unknown-item");
      expect(unknownRow?.getAttribute("disabled")).toBeNull();
      unknownRow?.click();
      expect(unknownRender.mutations).toEqual([expect.objectContaining({ ok: false })]);
      expect(unknown.session.lifeRecovery?.claims["recovery:1"]).toEqual(claimBeforeUnknown);
      expect(unknown.session.inventory.ghost).toBeUndefined();
      const unknownAfter = renderRecovery(unknown.project, unknown.session);
      const unknownRetained = findByTestId(unknownAfter.panel, "life-ledger-recovery-collect-recovery:1");
      expect(unknownRetained?.getAttribute("data-claim-outcome")).toBe("unresolved");
      expect(unknownRetained?.getAttribute("disabled")).toBeNull();

      const capped = packagesOffWithClaims({
        inventory: { raw: ITEM_QUANTITY_MAX },
        claims: {
          "recovery:2": claim({ id: "recovery:2", items: [{ itemId: "raw", count: 1 }] }),
        },
      });
      const claimBeforeCap = structuredClone(capped.session.lifeRecovery?.claims["recovery:2"]);
      const capRender = renderRecovery(capped.project, capped.session);
      expect(capped.session.lifeRecovery?.claims["recovery:2"]).toEqual(claimBeforeCap);
      const capRow = findByTestId(capRender.panel, "life-ledger-recovery-collect-recovery:2");
      expect(capRow?.getAttribute("data-claim-presentation")).toBe("open");
      expect(capRow?.getAttribute("data-claim-outcome")).toBeNull();
      expect(capRow?.getAttribute("data-item-amounts")).toBe(JSON.stringify([{ itemId: "raw", count: 1 }]));
      capRow?.click();
      expect(capRender.mutations).toEqual([expect.objectContaining({ ok: false })]);
      expect(capped.session.lifeRecovery?.claims["recovery:2"]).toEqual(claimBeforeCap);
      expect(capped.session.inventory.raw).toBe(ITEM_QUANTITY_MAX);
      const afterCap = renderRecovery(capped.project, capped.session);
      const retained = findByTestId(afterCap.panel, "life-ledger-recovery-collect-recovery:2");
      expect(retained?.getAttribute("data-claim-outcome")).toBe("inventory-overflow");
      expect(retained?.getAttribute("disabled")).toBeNull();
      // No duplicate payout: second activation still refuses and preserves claim.
      retained?.click();
      expect(capped.session.lifeRecovery?.claims["recovery:2"]).toEqual(claimBeforeCap);
      expect(capped.session.inventory.raw).toBe(ITEM_QUANTITY_MAX);
    } finally {
      restoreDom();
    }
  });

  it("surfaces date-error stage, problem id, and recovery entry without mutating the session", async () => {
    const restoreDom = installFakeDom();
    const previous = store.getCurrent();
    fade.mockClear();
    try {
      const project = createBlankProject();
      project.system.timeSystem = {
        enabled: true,
        dayStartHour: 6,
        dayEndHour: 26,
        daysPerSeason: 28,
      };
      project.system.shipping = { enabled: true };
      const session = startSession(project, 1602);
      session.gameTime = { year: 1, season: "spring", day: 1, hour: 25, minute: 50 };
      session.shippingQueue = { item_deleted: -1 };
      store.replaceProject(project);

      const host = document.createElement("div");
      document.body.append(host);
      const overlayTexts: string[] = [];
      const scene = {
        session,
        timeFixedAccumulatorMs: 0,
        timeMinuteAccumulator: 0,
        timeSleepInProgress: false,
        game: {
          canvas: { parentElement: null, ownerDocument: document },
          registry: {
            get: (key: string) => (key === "dialogueHost" ? host : undefined),
          },
        },
        showRuntimeOverlay: (id: string, text: string) => {
          if (id === "day-transition-error") overlayTexts.push(text);
        },
        clearRuntimeOverlay: vi.fn(),
        refreshRuntimeSurfaces: vi.fn(),
        syncRuntimeState: vi.fn(),
      } as unknown as PlaySceneContext;

      const view: DayTransitionFailureView = {
        reason: "recovery",
        stage: "recovery",
        problemId: "shippingQueue/item_deleted",
        recoveryEntry: "life-ledger:recovery",
      };
      expect(formatDayTransitionFailureMessage(view)).toContain("stage:recovery");
      expect(formatDayTransitionFailureMessage(view)).toContain("problem:shippingQueue/item_deleted");
      expect(formatDayTransitionFailureMessage(view)).toContain("recovery:life-ledger:recovery");

      // No claims on session → informational markers only (no actionable recovery button).
      presentDayTransitionFailure(scene, view);
      const presented = host.querySelector("[data-testid='day-transition-error']");
      expect(presented?.getAttribute("data-stage")).toBe("recovery");
      expect(presented?.getAttribute("data-problem-id")).toBe("shippingQueue/item_deleted");
      expect(presented?.getAttribute("data-recovery-entry")).toBe("life-ledger:recovery");
      expect(presented?.getAttribute("data-recovery-actionable")).toBe("false");
      expect(host.querySelector("[data-testid='day-transition-recovery-entry']")).toBeNull();

      const frozen = structuredClone(session);
      await expect(sleepUntilMorningScene(scene, async () => undefined)).resolves.toBe(false);
      expect(session).toEqual(frozen);
      expect(fade).not.toHaveBeenCalled();
      const liveError = host.querySelector("[data-testid='day-transition-error']");
      expect(liveError?.getAttribute("data-stage")).toBe("recovery");
      expect(liveError?.getAttribute("data-problem-id")).toMatch(/shippingQueue\//);
      expect(liveError?.getAttribute("data-recovery-entry")).toBe("life-ledger:recovery");
      expect(liveError?.getAttribute("data-recovery-actionable")).toBe("false");
      expect(liveError?.textContent ?? "").toContain("recovery");
      expect(overlayTexts.length === 0 || overlayTexts.some((text) => text.includes("recovery"))).toBe(true);
      host.remove();
    } finally {
      store.replaceProject(previous);
      restoreDom();
    }
  });

  it("activates date-error recovery entry into the recovery ledger when claims remain", () => {
    const restoreDom = installFakeDom();
    const previous = store.getCurrent();
    const previousWindow = globalThis.window;
    const storage = new Map<string, string>();
    type Listener = EventListenerOrEventListenerObject;
    const windowListeners = new Map<string, Set<Listener>>();
    const windowStub = {
      localStorage: {
        get length() { return storage.size; },
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        key: (index: number) => Array.from(storage.keys())[index] ?? null,
        removeItem: (key: string) => void storage.delete(key),
        setItem: (key: string, value: string) => void storage.set(key, value),
      } as Storage,
      addEventListener: (type: string, listener: Listener, options?: boolean | AddEventListenerOptions) => {
        const signal = typeof options === "object" && options ? options.signal : undefined;
        if (signal?.aborted) return;
        const bucket = windowListeners.get(type) ?? new Set<Listener>();
        bucket.add(listener);
        windowListeners.set(type, bucket);
        signal?.addEventListener("abort", () => bucket.delete(listener), { once: true });
      },
      removeEventListener: (type: string, listener: Listener) => {
        windowListeners.get(type)?.delete(listener);
      },
      dispatchEvent: (event: Event) => {
        for (const listener of [...(windowListeners.get(event.type) ?? [])]) {
          if (typeof listener === "function") listener(event);
          else listener.handleEvent(event);
        }
        return !event.defaultPrevented;
      },
      matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
    };
    Object.defineProperty(globalThis, "window", { configurable: true, value: windowStub });
    try {
      const project = createBlankProject();
      project.database.items.push(normalizeItemRecord({ id: "raw", name: "원료", scope: "none", price: 1 }));
      disableAllLifePackages(project);
      const session = startSession(project, 1603);
      session.lifeRecovery = {
        nextSequence: 2,
        claims: {
          "recovery:1": claim({ id: "recovery:1", items: [{ itemId: "raw", count: 3 }] }),
        },
      };
      store.replaceProject(project);
      expect(hasSessionLifeRecoveryClaims(session)).toBe(true);

      const layout = document.createElement("div");
      document.body.append(layout);
      const host = document.createElement("div");
      document.body.append(host);

      const fakeScene = {
        session,
        getSession: () => session,
        facing: "down",
        refreshRuntimeSurfaces: () => undefined,
        syncRuntimeState: () => undefined,
      } as unknown as PlayScene;

      let openCalls = 0;
      const controller = createPlayerStatusMenuController({
        layout,
        getActiveScene: () => fakeScene,
        getPlayStage: () => layout,
        getPlayStartedAt: () => 0,
        closeMenu: () => undefined,
        closeMenuWithJuice: () => undefined,
        renderTitle: () => undefined,
        emitMenuJuice: (_event, _target) => undefined,
        menuCloseJuiceMs: 0,
        loadSlot: () => undefined,
      });

      const registry = new Map<string, unknown>([
        ["dialogueHost", host],
        ["openLifeRecoveryLedger", () => {
          openCalls += 1;
          controller.openLifeRecoveryLedger();
        }],
      ]);
      const scene = {
        session,
        game: {
          canvas: { parentElement: null, ownerDocument: document },
          registry: { get: (key: string) => registry.get(key) },
        },
        showRuntimeOverlay: vi.fn(),
      } as unknown as PlaySceneContext;

      const before = structuredClone(session);
      presentDayTransitionFailure(scene, {
        reason: "recovery",
        stage: "recovery",
        problemId: "shippingQueue/raw",
        recoveryEntry: "life-ledger:recovery",
      });
      expect(session).toEqual(before);

      const overlay = host.querySelector("[data-testid='day-transition-error']");
      expect(overlay?.getAttribute("data-recovery-actionable")).toBe("true");
      expect(host.querySelector("[data-testid='day-transition-recovery-entry']")).toBeTruthy();
      expect(host.querySelector("[data-testid='day-transition-error-dismiss']")).toBeTruthy();

      const pressKeyOn = (target: EventTarget, key: string): void => {
        const event = new Event("keydown", { bubbles: true }) as KeyboardEvent;
        Object.defineProperty(event, "key", { configurable: true, value: key });
        Object.defineProperty(event, "repeat", { configurable: true, value: false });
        Object.defineProperty(event, "isComposing", { configurable: true, value: false });
        (target as { dispatchEvent: (event: Event) => boolean }).dispatchEvent(event);
      };

      const errorOverlay = host.querySelector("[data-testid='day-transition-error']");
      expect(errorOverlay).toBeTruthy();
      // Root keydown is the primary attachCursorMenu path; window fallback is browser-only.
      pressKeyOn(errorOverlay as EventTarget, "Enter");
      expect(openCalls).toBe(1);
      expect(host.querySelector("[data-testid='day-transition-error']")).toBeNull();

      const menu = requireFakeElement(layout.querySelector("[data-testid='main-menu']"), "main-menu");
      expect(findByTestId(menu, "life-ledger-tab-recovery")?.getAttribute("aria-selected")).toBe("true");
      expect(findByTestId(menu, "life-ledger-recovery-collect-recovery:1")).toBeTruthy();

      // Further Enter on the host must not reopen via leaked date-error cursor ownership.
      pressKeyOn(host as EventTarget, "Enter");
      windowStub.dispatchEvent(Object.assign(new Event("keydown"), { key: "Enter", repeat: false, isComposing: false }) as Event);
      expect(openCalls).toBe(1);
      expect(layout.querySelectorAll("[data-testid='main-menu']").length).toBe(1);
      expect(session).toEqual(before);

      // Replace/clear path: present again then dismiss via cancel without opening.
      presentDayTransitionFailure(scene, {
        reason: "recovery",
        stage: "recovery",
        problemId: "shippingQueue/raw",
        recoveryEntry: "life-ledger:recovery",
      });
      const again = host.querySelector("[data-testid='day-transition-error']");
      expect(again).toBeTruthy();
      pressKeyOn(again as EventTarget, "Escape");
      expect(openCalls).toBe(1);
      expect(host.querySelector("[data-testid='day-transition-error']")).toBeNull();

      host.remove();
      layout.remove();
    } finally {
      store.replaceProject(previous);
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
      restoreDom();
    }
  });

  it("does not offer an actionable recovery entry when the session has no claims", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const session = startSession(project, 1604);
      const host = document.createElement("div");
      document.body.append(host);
      let openCalls = 0;
      const scene = {
        session,
        game: {
          canvas: { parentElement: null, ownerDocument: document },
          registry: {
            get: (key: string) => {
              if (key === "dialogueHost") return host;
              if (key === "openLifeRecoveryLedger") return () => { openCalls += 1; };
              return undefined;
            },
          },
        },
        showRuntimeOverlay: vi.fn(),
      } as unknown as PlaySceneContext;

      presentDayTransitionFailure(scene, {
        reason: "shipping",
        stage: "shipping",
        recoveryEntry: "life-ledger:recovery",
      });
      const overlay = host.querySelector("[data-testid='day-transition-error']");
      expect(overlay?.getAttribute("data-recovery-actionable")).toBe("false");
      expect(host.querySelector("[data-testid='day-transition-recovery-entry']")).toBeNull();
      expect(openCalls).toBe(0);
      host.remove();
    } finally {
      restoreDom();
    }
  });
});
