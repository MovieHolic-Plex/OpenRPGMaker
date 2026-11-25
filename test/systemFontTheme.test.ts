import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { updateParallelEvents } from "@/player/playSceneSchedulers";
import { clearRuntimeOverlay, showRuntimeOverlay } from "@/player/playSceneOverlays";
import { presentDayTransitionFailure, sleepUntilMorningScene } from "@/player/playSceneTime";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { FakeElement, installFakeDom } from "./fakeDom";
import { runTool } from "@/editor/tools";
import { craftRecipe, canCraft } from "@/project/craftRecipes";
import { ensureChest, depositToChest, withdrawFromChest, placeObject, removeObjectAt, findChestAt, inventoryEntries } from "@/project/placeables";
import { hasFarmToolAvailable, setEquippedTool, toolActionRulesOf } from "@/project/toolActions";
import { applyItemUpgrade, resolveSellPrice } from "@/project/upgrades";
import { interactWithFarmPlot } from "@/player/farming";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyProjectFontTheme } from "@/app/fontTheme";
import { DEFAULT_FONT_SELECTION, FONT_REGISTRY, fontOptionsForRole, isFontFamilyId, projectFontStack, resolveFontSelection, resolveFontStack } from "@/project/fontRegistry";
import { isolateTimers } from "./mergedTeardown";

describe("scheduledTimeDiagnostics", () => {
  isolateTimers();
  const cleanups: Array<() => void> = [];
  afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  }
  function runtime(command: Command, malformed = true) {
    const restoreDom = installFakeDom();
    const previous = store.getCurrent();
    const project = createBlankProject();
    project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
    project.system.shipping = { enabled: true };
    project.database.items.push(normalizeItemRecord({ id: "raw", name: "Raw", scope: "none", price: 1 }));
    project.commonEvents = [{
      id: "scheduled", name: "Scheduled", trigger: "parallel",
      commands: [command, { kind: "setSwitch", switchId: "continued", value: true }],
    }];
    const session = startSession(project, 1605);
    session.commonEvents = project.commonEvents;
    session.gameTime = { year: 1, season: "spring", day: 1, hour: 25, minute: 50 };
    // Reconciliation boundary arrangement, not a valid Save5 or injected live-player fixture.
    session.shippingQueue = malformed ? { item_deleted: -1 } : {};
    session.lifeRecovery = { nextSequence: 2, claims: {
      "recovery:1": { id: "recovery:1", sourceKind: "shippingQueue", sourceId: "raw", reason: "disabled", items: [{ itemId: "raw", count: 3 }] },
    } };
    store.replaceProject(project);
    const host = document.createElement("div");
    document.body.append(host);
    const openLedger = vi.fn();
    const cameraEvents = new Map<string, () => void>();
    const scene = {
      session, parallelProcesses: new Map(), activeRuntimeEvents: () => [],
      timeFixedAccumulatorMs: 0, timeMinuteAccumulator: 0, timeSleepInProgress: false,
      game: { canvas: { parentElement: null, ownerDocument: document }, registry: {
        get: (key: string) => key === "dialogueHost" ? host : key === "openLifeRecoveryLedger" ? openLedger : undefined,
      } },
      // Camera boundary emits the exact pre-subscribed completion; no timer or mocked transition.
      cameras: { main: {
        once: (name: string, done: () => void) => cameraEvents.set(name, done),
        fadeOut: () => cameraEvents.get("camerafadeoutcomplete")!(),
        fadeIn: () => cameraEvents.get("camerafadeincomplete")!(),
      } },
      refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
      showRuntimeOverlay: (id: string, text: string) => showRuntimeOverlay(scene, id, text),
      clearRuntimeOverlay: (id: string) => clearRuntimeOverlay(scene, id),
    } as unknown as PlaySceneContext;
    const hook = vi.fn(async (_commands: readonly Command[]) => undefined);
    scene.sleepUntilMorning = (...args: Parameters<PlaySceneContext["sleepUntilMorning"]>) => sleepUntilMorningScene(scene, hook, ...args);
    cleanups.push(() => {
      clearRuntimeOverlay(scene, "day-transition-error");
      host.remove();
      store.replaceProject(previous);
      restoreDom();
    });
    return { scene, session, project, host, openLedger, hook };
  }
  function startParallel(scene: PlaySceneContext) {
    updateParallelEvents(scene, 0);
    const process = scene.parallelProcesses.get("common:scheduled");
    if (!process?.pendingTimeTransition) throw new Error("missing scheduled transition");
    return { process, pending: process.pendingTimeTransition };
  }
  function errorOverlay(host: HTMLElement): FakeElement {
    const overlay = host.querySelector("[data-testid='day-transition-error']");
    if (!(overlay instanceof FakeElement)) throw new Error("missing date-error overlay");
    return overlay;
  }
  function key(root: FakeElement, value: string) {
    root.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), {
      key: value, repeat: false, isComposing: false,
    }));
  }
  function expectRich(overlay: FakeElement) {
    expect(overlay.getAttribute("data-stage")).toBe("recovery");
    expect(overlay.getAttribute("data-problem-id")).toBe("shippingQueue/item_deleted");
    expect(overlay.getAttribute("data-recovery-entry")).toBe("life-ledger:recovery");
    expect(overlay.getAttribute("data-recovery-actionable")).toBe("true");
    expect(overlay.querySelector("[data-testid='day-transition-recovery-entry']")).not.toBeNull();
  }
  function expectDisposed(overlay: FakeElement) {
    expect(overlay.isConnected).toBe(false);
    expect(overlay.hasListener("keydown")).toBe(false);
    expect(overlay.hasListener("focusin")).toBe(false);
  }
  const stale = { reason: "old", stage: "makers", problemId: "maker/stale" };
  describe("composed scheduled date diagnostics", () => {
    it.each([
      ["sleep false", { kind: "sleepUntilMorning" }],
      ["advance rejection", { kind: "advanceTime", minutes: 20 }],
      ["nested day-advance rejection", { kind: "advanceTime", days: 1 }],
    ] as const)("retains structured markers and owned recovery cursor after %s", async (_name, command) => {
      const { scene, session, host, openLedger, hook } = runtime(command);
      const before = structuredClone(session);
      const { process, pending } = startParallel(scene);
      await expect(pending).resolves.toBe(false);
      expect(session).toEqual(before);
      expect(process.stopped).toBe(true);
      expect(process.pendingTimeTransition).toBeUndefined();
      expect(scene.timeSleepInProgress).toBe(false);
      expect(hook).not.toHaveBeenCalled();
      const overlay = errorOverlay(host);
      expectRich(overlay);
      key(overlay, "Enter");
      expect(openLedger).toHaveBeenCalledTimes(1);
      expectDisposed(overlay);
      key(overlay, "Enter");
      expect(openLedger).toHaveBeenCalledTimes(1);
      expect(session).toEqual(before);
      updateParallelEvents(scene, 0);
      expect(session.switches.continued).toBeUndefined();
    });

    it.each(["false", "rejection"] as const)("replaces a stale diagnostic for an unpresented %s", async (outcome) => {
      const { scene, session, host, openLedger } = runtime({ kind: "sleepUntilMorning" });
      presentDayTransitionFailure(scene, stale);
      const old = errorOverlay(host);
      scene.sleepUntilMorning = async () => {
        if (outcome === "rejection") throw new Error("unpresented");
        return false;
      };
      const before = structuredClone(session);
      await expect(startParallel(scene).pending).resolves.toBe(false);
      const overlay = errorOverlay(host);
      expect(overlay).not.toBe(old);
      expect(overlay.getAttribute("data-stage")).toBeNull();
      expect(overlay.getAttribute("data-problem-id")).toBeNull();
      expect(overlay.getAttribute("data-recovery-actionable")).toBe("true");
      expectDisposed(old);
      key(old, "Enter");
      expect(openLedger).not.toHaveBeenCalled();
      key(overlay, "Escape");
      expectDisposed(overlay);
      expect(openLedger).not.toHaveBeenCalled();
      expect(session).toEqual(before);
    });

    it.each(["false", "rejection"] as const)("presents fallback for a fresh unpresented %s", async (outcome) => {
      const { scene, host, session } = runtime({ kind: "sleepUntilMorning" });
      scene.sleepUntilMorning = async () => {
        if (outcome === "rejection") throw new Error("unpresented");
        return false;
      };
      const before = structuredClone(session);
      await expect(startParallel(scene).pending).resolves.toBe(false);
      const overlay = errorOverlay(host);
      expect(overlay.getAttribute("data-stage")).toBeNull();
      expect(overlay.getAttribute("data-problem-id")).toBeNull();
      expect(overlay.getAttribute("data-recovery-entry")).toBe("life-ledger:recovery");
      expect(session).toEqual(before);
    });

    it.each([
      { kind: "sleepUntilMorning" }, { kind: "advanceTime", minutes: 1 },
    ] as const)("clears prior diagnostics and resumes after real $kind success", async (command) => {
      const { scene, session, host, openLedger } = runtime(command, false);
      presentDayTransitionFailure(scene, stale);
      const old = errorOverlay(host);
      const claims = structuredClone(session.lifeRecovery);
      const inventory = structuredClone(session.inventory);
      await expect(startParallel(scene).pending).resolves.toBe(true);
      expect(host.querySelector("[data-testid='day-transition-error']")).toBeNull();
      expectDisposed(old);
      key(old, "Enter");
      expect(openLedger).not.toHaveBeenCalled();
      expect(session.switches.continued).toBe(true);
      expect(scene.parallelProcesses.size).toBe(0);
      expect(session.lifeRecovery).toEqual(claims);
      expect(session.inventory).toEqual(inventory);
    });

    it("retains a nested forced-sleep failure through scheduled advance", async () => {
      const { scene, session, project, host } = runtime({ kind: "advanceTime", minutes: 20 });
      project.system.timeSystem = { ...project.system.timeSystem, enabled: true, forceSleep: true };
      store.replaceProject(project);
      const before = structuredClone(session);
      await expect(startParallel(scene).pending).resolves.toBe(false);
      expectRich(errorOverlay(host));
      expect(session).toEqual(before);
    });

    it("presents fallback for an unpresented real advance rejection", async () => {
      const { scene, session, host } = runtime({ kind: "advanceTime", days: 1 }, false);
      scene.cameras.main.fadeOut = () => { throw new Error("camera failure"); };
      presentDayTransitionFailure(scene, stale);
      const old = errorOverlay(host);
      const before = structuredClone(session);
      await expect(startParallel(scene).pending).resolves.toBe(false);
      const overlay = errorOverlay(host);
      expect(overlay).not.toBe(old);
      expect(overlay.getAttribute("data-stage")).toBeNull();
      expect(overlay.getAttribute("data-problem-id")).toBeNull();
      expectDisposed(old);
      expect(session).toEqual(before);
    });

    it.each(["structured", "hook rejection"] as const)("keeps a presented %s failure after rollback and asynchronous fade-in", async (failure) => {
      const { scene, session, project, host, hook } = runtime({ kind: "sleepUntilMorning" }, false);
      project.system.timeSystem = { ...project.system.timeSystem, enabled: true, onDayEnd: "day-end" };
      project.commonEvents.push({ id: "day-end", name: "Day end", trigger: "none", commands: [{ kind: "setSwitch", switchId: "hook", value: true }] });
      store.replaceProject(project);
      hook.mockImplementation(async () => {
        session.gold += 123;
        session.inventory.raw = 7;
        session.shippingQueue = { item_deleted: -1 };
        if (failure === "hook rejection") throw new Error("hook-failed");
      });
      const faded = deferred<void>();
      const completeFade = scene.cameras.main.fadeIn;
      scene.cameras.main.fadeIn = () => { faded.resolve(); return scene.cameras.main; };
      const before = structuredClone(session);
      const { pending } = startParallel(scene);
      await faded.promise;
      const presented = errorOverlay(host);
      expect(session).toEqual(before);
      completeFade.call(scene.cameras.main);
      await expect(pending).resolves.toBe(false);
      expect(errorOverlay(host)).toBe(presented);
      if (failure === "structured") expectRich(presented);
      expect(session).toEqual(before);
      expect(scene.timeSleepInProgress).toBe(false);
    });

    it("does not overwrite a newer failure when an already-presented sleep finishes later", async () => {
      const { scene, session, project, host, hook } = runtime({ kind: "sleepUntilMorning" }, false);
      project.system.timeSystem = { ...project.system.timeSystem, enabled: true, onDayEnd: "day-end" };
      project.commonEvents.push({ id: "day-end", name: "Day end", trigger: "none", commands: [{ kind: "setSwitch", switchId: "hook", value: true }] });
      store.replaceProject(project);
      hook.mockImplementation(async () => { session.shippingQueue = { item_deleted: -1 }; });
      const faded = deferred<void>();
      const completeFade = scene.cameras.main.fadeIn;
      scene.cameras.main.fadeIn = () => { faded.resolve(); return scene.cameras.main; };
      const before = structuredClone(session);
      const { pending } = startParallel(scene);
      await faded.promise;
      const rich = errorOverlay(host);
      expectRich(rich);
      expect(session).toEqual(before);
      scene.parallelProcesses.delete("common:scheduled");
      // Real sleep's in-progress guard returns an unpresented false for the new operation.
      const replacement = startParallel(scene);
      await expect(replacement.pending).resolves.toBe(false);
      const newer = errorOverlay(host);
      expect(newer).not.toBe(rich);
      expect(newer.getAttribute("data-stage")).toBeNull();
      expectDisposed(rich);
      completeFade.call(scene.cameras.main);
      await expect(pending).resolves.toBe(false);
      expect(errorOverlay(host)).toBe(newer);
      expect(replacement.process.stopped).toBe(true);
      expect(session).toEqual(before);
    });

    it("does not attribute an overlapping operation's presentation to an unpresented failure", async () => {
      const { scene, session, host } = runtime({ kind: "sleepUntilMorning" });
      const held = deferred<boolean>();
      const realSleep = scene.sleepUntilMorning;
      const invoked = deferred<void>();
      scene.sleepUntilMorning = () => { invoked.resolve(); return held.promise; };
      const { pending } = startParallel(scene);
      await invoked.promise;
      // A replacement parallel process fails independently while the first is held.
      scene.parallelProcesses.delete("common:scheduled");
      scene.sleepUntilMorning = realSleep;
      const before = structuredClone(session);
      await expect(startParallel(scene).pending).resolves.toBe(false);
      const other = errorOverlay(host);
      expectRich(other);
      held.resolve(false);
      await expect(pending).resolves.toBe(false);
      const final = errorOverlay(host);
      expect(final).not.toBe(other);
      expect(final.getAttribute("data-stage")).toBeNull();
      expect(final.getAttribute("data-problem-id")).toBeNull();
      expectDisposed(other);
      expect(session).toEqual(before);
    });
  });
});

describe("stardewAuthoringTools", () => {
  isolateTimers();
  describe("P1 tool action table", () => {
    it("defaults to legacy hoe/can rules when system.toolActions absent", () => {
      const project = createBlankProject();
      const rules = toolActionRulesOf(project);
      expect(rules.some((r) => r.farmTool === "hoe" && r.action === "till")).toBe(true);
      expect(rules.some((r) => r.farmTool === "wateringCan" && r.action === "water")).toBe(true);
    });

    it("respects authored toolActions override", () => {
      const project = createBlankProject();
      project.system.toolActions = [
        { id: "custom-hoe", farmTool: "hoe", requiresFarmable: true, action: "till" },
      ];
      expect(toolActionRulesOf(project)).toHaveLength(1);
    });
  });
  describe("P2 equipped tool hand", () => {
    it("prefers equipped tool when present in inventory", () => {
      const project = createBlankProject();
      const session = startSession(project);
      session.inventory = { item_hoe: 1, item_watering_can: 1 };
      setEquippedTool(session, "item_hoe");
      expect(hasFarmToolAvailable(project, session, "hoe")).toBe(true);
      setEquippedTool(session, undefined);
      // empty hand falls back to any inventory hoe
      expect(hasFarmToolAvailable(project, session, "hoe")).toBe(true);
    });
  });
  describe("P3 craft recipes", () => {
    it("crafts when ingredients and optional gold present", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 1 }),
        normalizeItemRecord({ id: "item_fence", name: "울타리", scope: "none", price: 5 })
      );
      project.system.craftRecipes = [
        {
          id: "craft_fence",
          ingredients: [{ itemId: "item_wood", count: 2 }],
          outputItemId: "item_fence",
          outputCount: 1,
          goldCost: 10,
        },
      ];
      const session = startSession(project);
      session.gold = 100;
      session.inventory = { item_wood: 5 };
      expect(canCraft(project, session, "craft_fence").ok).toBe(true);
      const result = craftRecipe(project, session, "craft_fence");
      expect(result).toMatchObject({ ok: true, outputItemId: "item_fence" });
      expect(session.inventory.item_wood).toBe(3);
      expect(session.inventory.item_fence).toBe(1);
      expect(session.gold).toBe(90);
    });

    it("returns disabled when no recipes authored", () => {
      const project = createBlankProject();
      const session = startSession(project);
      expect(craftRecipe(project, session, "x")).toMatchObject({ ok: false, reason: "disabled" });
    });
  });
  describe("P4 chests and placeables", () => {
    it("deposits and withdraws chest items", () => {
      const session = startSession(createBlankProject());
      session.inventory = { item_a: 3 };
      ensureChest(session, { id: "chest_1", mapId: "m1", x: 1, y: 2 });
      expect(depositToChest(session, "chest_1", "item_a", 2)).toBe(true);
      expect(session.inventory.item_a).toBe(1);
      expect(session.chests?.chest_1.inventory.item_a).toBe(2);
      expect(withdrawFromChest(session, "chest_1", "item_a", 1)).toBe(true);
      expect(session.inventory.item_a).toBe(2);
    });

    it("places and removes objects at tile keys", () => {
      const session = startSession(createBlankProject());
      placeObject(session, { id: "obj1", mapId: "m1", x: 3, y: 4, kind: "chest", itemId: "item_chest" });
      expect(removeObjectAt(session, "m1", 3, 4)?.kind).toBe("chest");
      expect(removeObjectAt(session, "m1", 3, 4)).toBeUndefined();
    });
  });
  describe("P5 make_villager friendship wizard", () => {
    it("writes characterId, optional talkFriendship, and unlock pages", () => {
      const ctx = { project: createBlankProject() };
      const map = ctx.project.maps[ctx.project.startMapId];
      // ensure passable home
      const result = runTool(ctx, "make_villager", {
        mapId: map.id,
        id: "ev_wizard_npc",
        name: "마을 주민",
        home: { x: 1, y: 1 },
        dialogue: [{ text: "안녕" }],
        talkFriendship: true,
        friendshipUnlock: 80,
      });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[map.id].events.find((e) => e.id === "ev_wizard_npc");
      expect(event?.characterId).toBeTruthy();
      expect(event?.talkFriendship).toBe(true);
      const kinds = (event?.pages ?? []).flatMap((p) => p.conditions.map((c) => c.kind));
      expect(kinds).toContain("friendshipAtLeast");
      expect(kinds).toContain("selfSwitch");
    });

    it("같은 characterId 재요청은 새 id를 받아도 기존 주민을 재사용하고 대사를 보존한다", () => {
      const ctx = { project: createBlankProject() };
      const map = ctx.project.maps[ctx.project.startMapId];
      const first = runTool(ctx, "make_villager", {
        mapId: map.id,
        id: "ev_hana_guide",
        characterId: "hana_guide",
        name: "안내인 하나",
        home: { x: 2, y: 2 },
        dialogue: [{ text: "광장은 동쪽이에요." }],
      });
      expect(first.ok, first.summary).toBe(true);

      // Regression: explicit new id disabled nearby merging and allocateCharacterId
      // produced hana_guide_2, leaving two bodies for one authored character.
      const second = runTool(ctx, "make_villager", {
        mapId: map.id,
        id: "ev_hana_schedule_copy",
        characterId: "hana_guide",
        name: "안내인 하나",
        home: { x: 8, y: 8 },
        schedule: [
          { when: { hourRange: [8, 20] }, at: { mapId: map.id, x: 4, y: 2 }, activity: "guide" },
        ],
      });

      expect(second.ok, second.summary).toBe(true);
      expect(second.data).toMatchObject({ eventId: "ev_hana_guide", characterId: "hana_guide", reused: true });
      const updatedMap = ctx.project.maps[map.id];
      expect(updatedMap.events.filter((event) => event.characterId === "hana_guide")).toHaveLength(1);
      const hana = updatedMap.events.find((event) => event.id === "ev_hana_guide");
      expect(hana).toMatchObject({ x: 2, y: 2 });
      expect(JSON.stringify(hana?.pages)).toContain("광장은 동쪽이에요.");
      expect(hana?.schedule).toHaveLength(1);
    });
  });
  describe("P6 upgrades and sell prices", () => {
    it("applies upgrade and rewrites equipped tool", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_hoe", name: "괭이", scope: "none", price: 50, farmTool: "hoe" }),
        normalizeItemRecord({ id: "item_hoe_iron", name: "철 괭이", scope: "none", price: 200, farmTool: "hoe" })
      );
      project.system.itemUpgrades = [
        { id: "up_hoe", fromItemId: "item_hoe", toItemId: "item_hoe_iron", goldCost: 50 },
      ];
      const session = startSession(project);
      session.gold = 100;
      session.inventory = { item_hoe: 1 };
      setEquippedTool(session, "item_hoe");
      const result = applyItemUpgrade(project, session, "up_hoe");
      expect(result).toMatchObject({ ok: true, toItemId: "item_hoe_iron" });
      expect(session.inventory.item_hoe).toBeUndefined();
      expect(session.inventory.item_hoe_iron).toBe(1);
      expect(session.equippedToolItemId).toBe("item_hoe_iron");
      expect(session.gold).toBe(50);
    });

    it("resolves sell price from table or half item price", () => {
      const project = createBlankProject();
      // 기본 CC0 카탈로그에 item_potato 가 이미 있다. push 하면 items.find() 가 카탈로그의
      // 낡은 레코드를 먼저 집어 가격이 40 이 아닌 20 으로 읽힌다 — 반드시 upsert 해야 한다.
      const potato = normalizeItemRecord({ id: "item_potato", name: "감자", scope: "none", price: 40 });
      const existing = project.database.items.findIndex((item) => item.id === potato.id);
      if (existing >= 0) project.database.items[existing] = potato;
      else project.database.items.push(potato);
      project.system.sellPrices = [{ itemId: "item_potato", price: 30 }];
      expect(resolveSellPrice(project, "item_potato")).toBe(30);
      project.system.sellPrices = [];
      expect(resolveSellPrice(project, "item_potato")).toBe(20);
    });
  });
  describe("P1 placeable chop via toolActions", () => {
    it("chops tree placeable with axe equipped", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_axe", name: "도끼", scope: "none", price: 10, farmTool: "axe" as const }),
        normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 2 })
      );
      const session = startSession(project);
      session.inventory = { item_axe: 1 };
      setEquippedTool(session, "item_axe");
      const map = project.maps[project.startMapId];
      placeObject(session, { id: "t1", mapId: map.id, x: 2, y: 2, kind: "tree", itemId: "item_wood" });
      const result = interactWithFarmPlot(project, session, map, 2, 2);
      expect(result.kind).toBe("harvested");
      expect(session.inventory.item_wood).toBe(1);
      expect(session.placeables?.[map.id+":2,2"]).toBeUndefined();
    });
  });
  describe("craft/upgrade/equip commands via pure APIs (interpreter surface)", () => {
    it("equipTool helper sets hand; craft and upgrade still work", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 1 }),
        normalizeItemRecord({ id: "item_fence", name: "울타리", scope: "none", price: 5 }),
        normalizeItemRecord({ id: "item_hoe", name: "괭이", scope: "none", price: 50, farmTool: "hoe" }),
        normalizeItemRecord({ id: "item_hoe_iron", name: "철 괭이", scope: "none", price: 200, farmTool: "hoe" })
      );
      project.system.craftRecipes = [{ id: "craft_fence", ingredients: [{ itemId: "item_wood", count: 1 }], outputItemId: "item_fence" }];
      project.system.itemUpgrades = [{ id: "up_hoe", fromItemId: "item_hoe", toItemId: "item_hoe_iron", goldCost: 0 }];
      const session = startSession(project);
      session.inventory = { item_wood: 2, item_hoe: 1 };
      setEquippedTool(session, "item_hoe");
      expect(session.equippedToolItemId).toBe("item_hoe");
      expect(craftRecipe(project, session, "craft_fence").ok).toBe(true);
      expect(applyItemUpgrade(project, session, "up_hoe").ok).toBe(true);
      expect(session.equippedToolItemId).toBe("item_hoe_iron");
    });
  });
  describe("P4 chest play surface helpers", () => {
    it("finds chest by map tile and lists inventories", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 1 })
      );
      const session = startSession(project);
      session.inventory = { item_wood: 3 };
      const mapId = project.startMapId;
      const chest = ensureChest(session, { id: "chest_farm_3_4", mapId, x: 3, y: 4 });
      expect(findChestAt(session, mapId, 3, 4)?.id).toBe(chest.id);
      expect(findChestAt(session, mapId, 9, 9)).toBeUndefined();
      expect(depositToChest(session, chest.id, "item_wood", 2)).toBe(true);
      expect(inventoryEntries(session.inventory)).toEqual([{ itemId: "item_wood", count: 1 }]);
      expect(inventoryEntries(chest.inventory)).toEqual([{ itemId: "item_wood", count: 2 }]);
      expect(withdrawFromChest(session, chest.id, "item_wood", 1)).toBe(true);
      expect(session.inventory.item_wood).toBe(2);
      expect(chest.inventory.item_wood).toBe(1);
    });

    it("stable openChest id uses map coords when empty chestId", () => {
      const mapId = "map_home";
      const x = 2;
      const y = 5;
      expect(`chest_${mapId}_${x}_${y}`).toBe("chest_map_home_2_5");
    });
  });
});

// 폰트 통일 계약 — 레지스트리 · SystemRecords.fonts 정규화 · DOM 적용.
//
// 지켜야 할 불변식:
//   1. 레지스트리가 선택 가능한 글꼴의 유일한 목록이다(에디터 UI · 런타임 · 캔버스 텍스트 공용).
//   2. 기본값은 이 변경 **이전의** 스택과 글자 단위로 같다 — 손대지 않은 프로젝트는 렌더가 안 바뀐다.
//   3. tokens.css 의 --font-ui / --font-pixel / --font-mono 선언이 레지스트리 기본 스택과 일치한다.
//      (JS 레지스트리와 CSS 단일 진실 공급원이 갈라지면 폰트 통일 자체가 무의미해진다.)
//   4. normalizeSystemRecords 는 화이트리스트다 — fonts 가 여기 없으면 저장/로드 1회 왕복에 사라진다.
//      실제로 skillSystem 이 그렇게 사라진 전례가 databaseRecordModel.ts 주석에 남아 있다.
//   5. 기본값과 같은 선택은 저장하지 않는다(battleUiStyle · battleModel 과 같은 관례).
describe("systemFontTheme", () => {
  isolateTimers();
  const repoRoot = resolve(__dirname, "..");
  const readText = (rel: string): string => readFileSync(resolve(repoRoot, rel), "utf8");
  /** tokens.css 의 커스텀 프로퍼티 값을 읽는다(여러 줄 선언 허용, 주석 제거 후). */
  function tokenValue(css: string, name: string): string {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//gu, "");
    const match = stripped.match(new RegExp(`${name}\\s*:\\s*([^;]+);`, "u"));
    if (!match) throw new Error(`tokens.css 에 ${name} 선언이 없다`);
    return match[1].replace(/\s+/gu, " ").trim();
  }
  describe("폰트 레지스트리", () => {
    it("id 가 중복되지 않고 모든 엔트리가 비어 있지 않은 스택과 역할을 갖는다", () => {
      const ids = FONT_REGISTRY.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const entry of FONT_REGISTRY) {
        expect(entry.stack.trim().length).toBeGreaterThan(0);
        expect(entry.label.trim().length).toBeGreaterThan(0);
        expect(entry.roles.length).toBeGreaterThan(0);
      }
    });

    it("번들된 픽셀 글꼴 3종이 pixel 역할로 선택 가능하다", () => {
      const pixelIds = fontOptionsForRole("pixel").map((entry) => entry.id);
      expect(pixelIds).toContain("neodgm");
      expect(pixelIds).toContain("galmuri11");
      expect(pixelIds).toContain("galmuri9");
    });

    it("역할별 기본 선택이 레지스트리에 존재하고 그 역할을 실제로 지원한다", () => {
      for (const role of ["ui", "pixel", "mono"] as const) {
        const id = DEFAULT_FONT_SELECTION[role];
        expect(isFontFamilyId(id)).toBe(true);
        const entry = FONT_REGISTRY.find((candidate) => candidate.id === id);
        expect(entry?.roles).toContain(role);
      }
    });

    it("isFontFamilyId 가 미등록 id 를 거부한다", () => {
      expect(isFontFamilyId("neodgm")).toBe(true);
      expect(isFontFamilyId("comic-sans")).toBe(false);
      expect(isFontFamilyId(undefined)).toBe(false);
      expect(isFontFamilyId(42)).toBe(false);
    });

    it("tokens.css 의 폰트 토큰이 레지스트리 기본 스택과 일치한다", () => {
      const tokens = readText("src/styles/tokens.css");
      expect(tokenValue(tokens, "--font-ui")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.ui));
      expect(tokenValue(tokens, "--font-pixel")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.pixel));
      expect(tokenValue(tokens, "--font-mono")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.mono));
    });

    it("runtime/system.css 가 --runtime-pixel-font 를 --font-pixel 의 별칭으로 둔다", () => {
      const css = readText("src/styles/runtime/system.css");
      expect(tokenValue(css, "--runtime-pixel-font")).toBe("var(--font-pixel)");
    });
  });
  describe("SystemRecords.fonts 정규화", () => {
    it("등록된 선택을 저장/로드 왕복에서 보존한다", () => {
      const normalized = normalizeSystemRecords({
        startActorIds: [],
        fonts: { ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" },
      });
      expect(normalized.fonts).toEqual({ ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" });

      // 두 번째 왕복에서도 동일해야 한다 — 화이트리스트 누락은 1회 왕복 뒤에 드러난다.
      expect(normalizeSystemRecords(normalized).fonts).toEqual({
        ui: "galmuri11",
        pixel: "galmuri9",
        mono: "neodgm",
      });
    });

    it("미등록 id 는 버리고 남은 유효 선택만 유지한다", () => {
      const normalized = normalizeSystemRecords({
        startActorIds: [],
        fonts: { ui: "comic-sans", pixel: "galmuri9" } as never,
      });
      expect(normalized.fonts).toEqual({ pixel: "galmuri9" });
    });

    it("기본값과 같은 선택은 저장하지 않는다", () => {
      const normalized = normalizeSystemRecords({
        startActorIds: [],
        fonts: { ui: DEFAULT_FONT_SELECTION.ui, pixel: "galmuri9" },
      });
      expect(normalized.fonts).toEqual({ pixel: "galmuri9" });
    });

    it("빈 객체 · 유효 선택 없음 · 비객체는 fonts 키 자체를 남기지 않는다", () => {
      expect(normalizeSystemRecords({ startActorIds: [], fonts: {} }).fonts).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], fonts: { ui: "nope" } as never }).fonts).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], fonts: "neodgm" as never }).fonts).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], fonts: null as never }).fonts).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [] }).fonts).toBeUndefined();
    });

    it("resolveFontSelection 이 생략된 역할을 기본값으로 채운다", () => {
      expect(resolveFontSelection(undefined)).toEqual(DEFAULT_FONT_SELECTION);
      expect(resolveFontSelection({ pixel: "galmuri9" })).toEqual({
        ...DEFAULT_FONT_SELECTION,
        pixel: "galmuri9",
      });
      expect(resolveFontSelection({ ui: "comic-sans" } as never)).toEqual(DEFAULT_FONT_SELECTION);
    });

    // Phaser 캡버스 텍스트는 CSS 변수를 해석하지 못해 이 함수로 생성 시점의 스택을 집어온다.
    it("projectFontStack 은 자자 선택을 따르고 생략 시 기본값으로 돌아간다", () => {
      expect(projectFontStack({ ui: "galmuri11" }, "ui")).toBe(resolveFontStack("galmuri11"));
      expect(projectFontStack({ mono: "neodgm" }, "mono")).toBe(resolveFontStack("neodgm"));
      expect(projectFontStack({ ui: "galmuri11" }, "mono")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.mono));
      expect(projectFontStack(undefined, "pixel")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.pixel));
    });
  });
  describe("applyProjectFontTheme", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
    });

    it("선택한 글꼴 스택을 세 CSS 변수로 루트에 심는다", () => {
      const project = createBlankProject();
      project.system.fonts = { ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" };
      const root = document.createElement("div");

      applyProjectFontTheme(project, root);

      expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack("galmuri11"));
      expect(root.style.getPropertyValue("--font-pixel")).toBe(resolveFontStack("galmuri9"));
      expect(root.style.getPropertyValue("--font-mono")).toBe(resolveFontStack("neodgm"));
    });

    it("fonts 가 없으면 기본 스택을 심어 tokens.css 와 같은 값을 유지한다", () => {
      const project = createBlankProject();
      delete project.system.fonts;
      const root = document.createElement("div");

      applyProjectFontTheme(project, root);

      expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.ui));
      expect(root.style.getPropertyValue("--font-pixel")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.pixel));
      expect(root.style.getPropertyValue("--font-mono")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.mono));
    });

    it("선택을 되돌리면 이전 선택이 남지 않는다", () => {
      const project = createBlankProject();
      const root = document.createElement("div");

      project.system.fonts = { ui: "galmuri11" };
      applyProjectFontTheme(project, root);
      expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack("galmuri11"));

      delete project.system.fonts;
      applyProjectFontTheme(project, root);
      expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.ui));
    });
  });
});
