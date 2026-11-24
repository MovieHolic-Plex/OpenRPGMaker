import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { findNpcGraphicMatches, queryNpcGraphics } from "@/assets/charsetQuery";
import { friendshipShortName } from "@/project/friendship";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { ROMANCE_TITLE_SUBTITLE } from "@/project/romancePreset";
import type { RuntimeEventView } from "@/project/runtimeEventState";
import { footprintBounds, UNIT_FOOTPRINT } from "@/project/footprint";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { darkenChannel, effectiveDarkness, normalizeLightingState, setSessionLighting } from "@/project/lightingRules";
import { lightingGradientParams, lightingMaskSignature } from "@/player/lighting";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession, type PlaySession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, Project, LifeSkillRecord } from "@/project/types";
import { updateParallelEvents } from "@/player/playSceneSchedulers";
import { clearRuntimeOverlay, showRuntimeOverlay } from "@/player/playSceneOverlays";
import { presentDayTransitionFailure, sleepUntilMorningScene } from "@/player/playSceneTime";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { placeableDropItemId, placeObject } from "@/project/placeables";
import { BuildingBudget, DEFAULT_FILLER, fillerOf, placeableRoles, programArg, type SettlementDecl } from "@/project/settlementProgram";
import { ensureSharedCharacters, installSharedCharacters, sharedCharacterSemantics } from "@/project/sharedCharacters";
import { listCharacterSprites, exportCharacterGraphics } from "@/project/characterGraphics";
import { sharedCharacterGraphicsProject, validateSharedCharacterGraphics } from "@/project/sharedCharacterGraphics";
import type { SharedContentLibrary, SharedContentSnapshot } from "@/project/sharedContentSchema";
import { dedupeSharedContent, inflateSharedContentResponse } from "../src/project/sharedContentDedup";
import { mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodedSharedContent, publishSharedContent, readSharedContent, readSharedContentForEditor, readSharedContentPreview, readSharedReferenceImage, sharedContentEtag, encodedSharedContentWithRevision } from "../scripts/lib/sharedContentSqlite";
import { isSharedReferenceImage } from "@/project/bundledReferenceImagePath";
import { validateTilesetReferences } from "@/project/tilesetReferences";
import { resolveReferenceImageDataUrl, setSharedReferenceImageReader } from "@/project/bundledReferenceImages";
import { proposeHaggle, resolveHaggleReserve } from "@/project/haggle";
import { clampShopReputation, generateShopkeeperCustomers, reputationAfterVerdict } from "@/project/shopkeeper";
import { resolvePricedShopStock, resolveShopBuyUnitPrice, resolveShopSellUnitPrice } from "@/project/shopPrice";
import { shouldRestock } from "@/project/shopStock";
import { deserialize, serialize } from "@/project/io";
import { normalizeLifeSkillRecord, levelForXp, MAX_LIFE_SKILL_LEVEL } from "@/project/skillModel";
import { createInterpreter } from "@/player/interpreter";
import { isolateTimers } from "./mergedTeardown";

// 연애 시뮬레이션 두 번째 측정 수리(2026-10-16) — 미실행(이 세션은 테스트·게이트 금지). 기대값은 qa-runs 실측과 같은 방향이다.
describe("romanceFix3", () => {
  isolateTimers();
  describe("romance fix 3", () => {
    it("일반 질의(villager)도 Modern 연애 칩을 사람으로 센다", () => {
      // 이 경우는 「Modern 칩이 사람 후보에 든다」를 본다 — 순위가 아니다. scarloxy 사람 시트가 늘어(#2335 뒤 OPRN 사람 칩 추가)
      // 사람 칩이 100 장을 넘어(queryNpcGraphics 는 최대 100 으로 자른다) 후보 전체(findNpcGraphicMatches)에서 찾는다.
      const keys = findNpcGraphicMatches("villager").map((match) => match.entry.textureKey);
      expect(keys.some((key) => key.startsWith("tex_oprn_charset_modern"))).toBe(true);
    });

    it("HUD 이름은 호칭 꼬리를 뗀다", () => {
      expect(friendshipShortName("한서연 선배")).toBe("한서연");
      expect(friendshipShortName("선생님")).toBe("선생님");
      expect(friendshipShortName("차도현")).toBe("차도현");
    });

    it("관계 중심 게임만 호감 메뉴를 쓴다", () => {
      expect(usesRelationshipMenu({ system: { genreLock: { preset: "romance" } } } as never)).toBe(true);
      expect(usesRelationshipMenu({ system: {} } as never)).toBe(false);
    });

    it("연애 기본 타이틀 부제는 모험 문구가 아니다", () => {
      expect(ROMANCE_TITLE_SUBTITLE).not.toMatch(/ADVENTURE|모험/u);
    });
  });
});

describe("runtimeDomMarkers", () => {
  isolateTimers();
  class TestHost extends FakeElement {
    constructor() {
      super("div");
    }
  }
  let restore: (() => void) | null = null;
  beforeEach(() => {
    restore = installFakeDom();
  });
  afterEach(() => {
    restore?.();
    restore = null;
  });
  function hostElement(host: TestHost): HTMLElement {
    return host as unknown as HTMLElement;
  }
  function view(index: number, sprite: boolean): RuntimeEventView {
    const id = `event_${index}`;
    return {
      event: {
        id,
        x: index,
        y: index,
        trigger: { kind: "action" },
        commands: [],
        ...(sprite ? { sprite: { type: "bundled", id: "npc" } as const } : {}),
      },
      page: undefined,
      pageId: undefined,
      x: index,
      y: index,
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      // 마커는 크기가 아니라 **계산된 사각**을 쓴다. 1x1 모든 사겁은 발밑 앵커에서 한 칸이다.
      footprint: UNIT_FOOTPRINT,
      passRows: UNIT_FOOTPRINT.height,
      bodyRect: footprintBounds(index, index, UNIT_FOOTPRINT),
      passRect: footprintBounds(index, index, UNIT_FOOTPRINT),
      scale: 1,
      transparent: false,
      animationType: "normal",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      sprite: sprite ? { type: "bundled", id: "npc" } : undefined,
      direction: undefined,
      runtimeDirection: undefined,
    };
  }
  describe("RuntimeDomOverlay debug markers", () => {
    it("normal mode creates and updates no markers or stage bounds", () => {
      const host = new TestHost();
      let sizeReads = 0;
      let markerWrites = 0;
      const overlay = new RuntimeDomOverlay(() => hostElement(host), {
        playResolution: { width: 320, height: 240 },
        stageSizeProvider: (resolution) => {
          sizeReads += 1;
          return resolution;
        },
        onMarkerWrite: () => {
          markerWrites += 1;
        },
      });

      for (let index = 0; index < 8; index += 1) overlay.upsertEventMarker(view(index, true));
      for (let update = 0; update < 120; update += 1) overlay.syncCameraOffset(update + 1, update + 1);
      overlay.signalResize();

      expect(host.querySelectorAll(".runtime-debug-marker")).toHaveLength(0);
      expect(sizeReads).toBe(0);
      expect(markerWrites).toBe(0);
    });

    it("QA mode caches one stage read per explicit resize and batches marker writes without reads", () => {
      const host = new TestHost();
      let sizeReads = 0;
      let markerWrites = 0;
      let firstWriteReadCount = -1;
      const overlay = new RuntimeDomOverlay(() => hostElement(host), {
        qaInstrumentation: true,
        playResolution: { width: 320, height: 240 },
        stageSizeProvider: (resolution) => {
          sizeReads += 1;
          return resolution;
        },
        onMarkerWrite: () => {
          markerWrites += 1;
          if (firstWriteReadCount < 0) firstWriteReadCount = sizeReads;
          expect(sizeReads).toBe(firstWriteReadCount);
        },
      });

      for (let index = 0; index < 8; index += 1) overlay.upsertEventMarker(view(index, true));
      expect(host.querySelectorAll(".runtime-debug-marker")).toHaveLength(16);
      expect(sizeReads).toBe(1);

      for (let update = 0; update < 120; update += 1) overlay.syncCameraOffset(update + 1, update + 1);
      expect(sizeReads).toBe(1);
      expect(markerWrites).toBe(16 + 120 * 16);

      firstWriteReadCount = -1;
      overlay.signalResize();
      expect(sizeReads).toBe(2);
      expect(markerWrites).toBe(16 + 121 * 16);

      const marker = findByTestId(host, "event-event_7");
      expect(marker?.style.left).toBe("-8px");
      expect(marker?.style.top).toBe("-8px");
      expect(marker?.style.visibility).toBe("");
      expect(marker?.style.pointerEvents).toBe("");
    });
  });
});

describe("runtimeLightingBlend", () => {
  isolateTimers();
  const context = {
    viewportWidth: 320, viewportHeight: 180, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0,
    resolveAnchor: () => undefined,
  };
  describe("lighting blend · vignette", () => {
    it("곱하기 막은 밝은 색도 색조로 묶지 않고 화면 색에 곱한다", () => {
      expect(effectiveDarkness("#8090ff", 0.9, "multiply")).toEqual({ color: "#8090ff", ambient: 0.9 });
      expect(effectiveDarkness("#8090ff", 0.9).ambient).toBeLessThan(0.9);
      // 흰 눈(255)은 막 색 그대로, 검은 바닥(0)은 검게 남는다 — 덮기 막처럼 회색 판으로 뭉개지지 않는다.
      expect(darkenChannel(255, 64, 1, "multiply")).toBeCloseTo(64);
      expect(darkenChannel(0, 64, 1, "multiply")).toBe(0);
      expect(darkenChannel(0, 64, 1, "over")).toBe(64);
    });

    it("마스크 인자·서명에 섞기와 비네트가 실린다(생략은 예전과 같다)", () => {
      const plain = lightingGradientParams({ ambient: 0.8, color: "#000000", sources: [] }, context);
      expect(plain.blend).toBe("over");
      expect(plain.vignette).toBe(0);
      const night = lightingGradientParams({ ambient: 0.8, color: "#203060", sources: [], blend: "multiply", vignette: 0.6 }, context);
      expect(night.blend).toBe("multiply");
      expect(night.vignette).toBeCloseTo(0.6);
      expect(lightingMaskSignature(night)).not.toBe(lightingMaskSignature(plain));
    });

    it("setLighting(진하기·색만)은 맵 기본 조명의 섞기·비네트를 지우지 않는다", () => {
      const session = { lighting: normalizeLightingState({ ambient: 0.5, sources: [], blend: "multiply", vignette: 0.4 }) } as PlaySessionLike;
      const next = setSessionLighting(session, { ambient: 0.9, color: "#101830" });
      expect(next.blend).toBe("multiply");
      expect(next.vignette).toBeCloseTo(0.4);
    });

    it("set_lighting_volume 가 blend·vignette 를 기본 조명에 저장하고 모르는 섞기는 거절한다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const ok = runTool(ctx, "set_lighting_volume", { mapId, ambient: 0.9, color: "#263a70", blend: "multiply", vignette: 0.5, sources: [] });
      expect(ok.ok, ok.summary).toBe(true);
      expect(ctx.project.maps[mapId]!.defaultLighting).toMatchObject({ blend: "multiply", vignette: 0.5 });
      const bad = runTool(ctx, "set_lighting_volume", { mapId, ambient: 0.9, blend: "screen", sources: [] });
      expect(bad.ok).toBe(false);
    });
  });
});

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

describe("seasonalForage", () => {
  isolateTimers();
  const SEASONAL = {
    spring: "item_cherry",
    summer: "item_grape",
    fall: "item_mushroom",
    winter: "item_winter_root",
  };
  describe("계절별 채집물", () => {
    it("현재 계절의 산출물이 기본 itemId 보다 우선한다", () => {
      const object = { itemId: "item_wood", seasonalDrops: SEASONAL };
      expect(placeableDropItemId(object, "spring")).toBe("item_cherry");
      expect(placeableDropItemId(object, "fall")).toBe("item_mushroom");
    });

    it("해당 계절 지정이 없으면 기본 itemId 로 폴백한다", () => {
      expect(placeableDropItemId({ itemId: "item_wood", seasonalDrops: { spring: "item_cherry" } }, "winter")).toBe("item_wood");
      expect(placeableDropItemId({ itemId: "item_wood" }, "spring")).toBe("item_wood");
      expect(placeableDropItemId({ itemId: "item_wood", seasonalDrops: { spring: "   " } }, "spring")).toBe("item_wood");
    });

    it("계절 정보가 없으면 기본 itemId 를 쓴다", () => {
      expect(placeableDropItemId({ itemId: "item_wood", seasonalDrops: SEASONAL }, undefined)).toBe("item_wood");
    });

    // 회귀: seasonalDrops 는 스키마에만 있고 수확 경로가 읽지 않아 저작해도 효과가 없었다.
    it("도구 수확이 현재 계절의 산출물을 인벤토리에 넣는다", async () => {
      const { interactWithFarmPlot } = await import("@/player/farming");
      const project = createBlankProject();
      const session = startSession(project, 1);
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing start map");
      session.gameTime = { ...session.gameTime!, season: "fall" };
      session.inventory.item_axe = 1;
      placeObject(session, {
        id: "pl_tree_1", mapId: map.id, x: 5, y: 5,
        kind: "tree", itemId: "item_wood", seasonalDrops: SEASONAL,
      });
      const result = interactWithFarmPlot(project, session, map, 5, 5);
      if (result.kind !== "harvested") {
        // 이 프로젝트의 기본 도구 규칙에 도끼가 없으면 수확 자체가 성립하지 않는다 —
        // 그 경우 순수 리졸버 검증(위 3개)만으로 계약을 보장한다.
        expect(result.kind).toBe("ignored");
        return;
      }
      expect(result.itemId).toBe("item_mushroom");
      expect(session.inventory.item_mushroom).toBe(1);
      expect(session.inventory.item_wood ?? 0).toBe(0);
    });
  });
});

// 정착지 목적표 계약(settlementProgram.ts) — 구성기가 묻는 건물 예산: 역할이 먼저, 채움 집은 선언한 수만큼, 그 뒤에는 아무것도 주지 않는다.
describe("settlementProgram", () => {
  isolateTimers();
  const DECL: SettlementDecl = {
    roles: {
      home: { ko: "집", kits: ["house-a", "house-b"], anyKit: true },
      shop: { ko: "가게", kits: ["shop-front", "shop-small"], room: "shop" },
      keep: { ko: "성", kits: ["keep"], room: "hall" },
    },
    kinds: {
      town: { roles: ["shop", "home"] },
      capital: { roles: ["keep", "shop", "home"], filler: 5, landmark: "keep" },
    },
  };
  const any = () => true;
  const first = (kits: readonly string[]) => kits[0]!;
  describe("정착지 목적표 — 건물 예산", () => {
    it("역할을 차례대로 먼저 주고, 채움 집은 선언한 수(없으면 기본 2)만큼만 준다", () => {
      const budget = new BuildingBudget(DECL, "town", { roles: [{ id: "s", role: "shop" }, { id: "h", role: "home", label: "나지라의 집" }] });
      expect(budget.total).toBe(2 + DEFAULT_FILLER);
      expect(budget.next(any, ["plain"], first)).toEqual({ kit: "shop-front", need: { id: "s", role: "shop" } });
      expect(budget.next(any, ["plain"], first)?.need?.id).toBe("h");
      expect(budget.next(any, ["plain"], first)).toEqual({ kit: "plain" });
      expect(budget.next(any, ["plain"], first)).toEqual({ kit: "plain" });
      expect(budget.open).toBe(false);
      expect(budget.next(any, ["plain"], first)).toBeUndefined();
    });

    it("역할의 얼굴 키트가 그 자리에 안 맞으면 대안 키트, 그것도 안 맞으면 그 자리는 채움 집이 받고 역할은 다음 자리를 기다린다", () => {
      const budget = new BuildingBudget(DECL, "town", { roles: [{ id: "s", role: "shop" }], filler: 1 });
      expect(budget.next((kit) => kit !== "shop-front", ["plain"], first)?.kit).toBe("shop-small");
      const tight = new BuildingBudget(DECL, "town", { roles: [{ id: "s", role: "shop" }], filler: 1 });
      expect(tight.next((kit) => kit === "plain", ["plain"], first)).toEqual({ kit: "plain" });
      expect(tight.wants("shop")).toBe(true);
      expect(tight.next((kit) => kit === "plain", ["plain"], first)).toBeUndefined();
      expect(tight.unplaced().map((need) => need.id)).toEqual(["s"]);
    });

    it("그 종류가 선언하지 않은 역할은 처음부터 빠지고, 종류가 선언한 채움 수를 쓴다", () => {
      const program = { roles: [{ id: "k", role: "keep" }, { id: "s", role: "shop" }] };
      expect(placeableRoles(DECL, "town", program).map((need) => need.id)).toEqual(["s"]);
      expect(fillerOf(DECL, "capital", program)).toBe(5);
      expect(fillerOf(DECL, "capital", { ...program, filler: 0 })).toBe(0);
    });

    it("구성기가 스스로 정한 자리는 claim·fill 로 예산에서 뗀다", () => {
      const budget = new BuildingBudget(DECL, "capital", { roles: [{ id: "landmark", role: "keep" }, { id: "s", role: "shop" }], filler: 1 });
      expect(budget.claim(["keep"])?.id).toBe("landmark");
      expect(budget.claim(["keep"])).toBeUndefined();
      expect(budget.claim()?.id).toBe("s");
      expect(budget.fill()).toBe(true);
      expect(budget.fill()).toBe(false);
      expect(budget.open).toBe(false);
    });

    it("도구 인자: 모르는 역할·겹친 id 는 던지고, 없으면 undefined", () => {
      expect(programArg(undefined, DECL)).toBeUndefined();
      expect(programArg({ roles: [{ id: "a", role: "home", label: " 미라의 집 " }], filler: 3 }, DECL)).toEqual({ roles: [{ id: "a", role: "home", label: "미라의 집" }], filler: 3 });
      expect(() => programArg({ roles: [{ id: "a", role: "castle" }] }, DECL)).toThrow(/role must be one of/u);
      expect(() => programArg({ roles: [{ id: "a", role: "home" }, { id: "a", role: "shop" }] }, DECL)).toThrow(/repeated/u);
    });
  });
});

describe("sharedCharacters", () => {
  isolateTimers();
  const id = 'shared_charset_actor_0123456789abcdef01234567';
  function library(): SharedContentLibrary {
    return { version:1, projectDefaults:true, roots:[], places:{}, tilesets:{}, maps:{}, previews:{}, sourceProjectId:'fixture',
      assets:{[id]:{id, kind:'charset', name:'청록 배달원', dataUrl:'data:image/png;base64,iVBORw0KGgo=', meta:{width:288,height:256,frameWidth:24,frameHeight:32,frames:96}}},
      characters:{[id]:{assetId:id,characterIndex:0, description:{label:'청록 배달원',role:'배달원',appearance:'청록 바람막이를 입은 사람',attributes:{clothing:'청록 바람막이'},tags:['배달']},
        source:{candidateId:'fixture/person',base:'Actor1:0',inspected:{},acceptance:{decision:'accept'}}}} };
  }
  function install(value = library()) { installSharedCharacters({revision:'fixture',libraries:{kept:value}}); }
  function project(): Project { return {assets:{uploaded:{}}, resourceProfiles:[],charsetLabels:[]} as unknown as Project; }
  afterEach(() => installSharedCharacters({revision:'empty',libraries:{}}));
  describe('Human-kept shared character catalog', () => {
    it('adds the same single usable character to new and existing projects without guessing age', () => {
      install();
      const fresh=project(), existing=project();
      existing.assets.uploaded.other={id:'other',name:'저자 그림',kind:'picture',dataUrl:'data:image/png;base64,AA==',meta:{}};
      for (const value of [fresh,existing]) {
        expect(ensureSharedCharacters(value)).toBe(true);
        expect(listCharacterSprites(value).filter(sprite=>sprite.textureKey===id)).toHaveLength(1);
        expect(value.resourceProfiles[0]?.characterSlots?.[0]?.graphicAttributes?.age).toBeUndefined();
        expect(ensureSharedCharacters(value)).toBe(false);
      }
      expect(existing.assets.uploaded.other?.name).toBe('저자 그림');
    });
    it('preserves author labels, face choices and existing pixels on reload', () => {
      install(); const value=project(); ensureSharedCharacters(value);
      const asset=value.assets.uploaded[id]!;
      value.charsetLabels![0]={...value.charsetLabels![0]!,label:'우리 프로젝트의 이름',origin:'user'};
      const slot=value.resourceProfiles[0]!.characterSlots![0]!;
      slot.status='mapped'; slot.faceResourceId='easyrpg-faceset-actor1-00'; slot.graphicAttributes={age:'노년'};
      expect(ensureSharedCharacters(value)).toBe(false);
      expect(value.assets.uploaded[id]).toBe(asset);
      expect(value.charsetLabels![0]?.label).toBe('우리 프로젝트의 이름');
      expect(slot.faceResourceId).toBe('easyrpg-faceset-actor1-00');
      expect(slot.graphicAttributes.age).toBe('노년');
    });
    it('exposes name, clothing and role to NPC discovery as uploaded graphics', () => {
      install();
      for (const query of ['청록 배달원','청록 바람막이','배달원']) {
        const result=queryNpcGraphics(query,50).find(match=>match.entry.textureKey===id);
        expect(result?.entry.spriteType).toBe('uploaded');
      }
      const value=library(); value.characters![id]!.description.attributes!.age='청년'; install(value);
      expect(sharedCharacterSemantics()[0]?.age).toBe('youth');
    });
    it('withdraws discovery while retaining project pixels and keeping the remaining face catalog readable', () => {
      install(); const value=project(); ensureSharedCharacters(value);
      const document=exportCharacterGraphics(sharedCharacterGraphicsProject());
      const pixels=value.assets.uploaded[id];
      installSharedCharacters({revision:'withdrawn',libraries:{}});
      expect(queryNpcGraphics('청록 배달원',50).some(match=>match.entry.textureKey===id)).toBe(false);
      expect(ensureSharedCharacters(value)).toBe(false);
      expect(value.assets.uploaded[id]).toBe(pixels);
      expect(validateSharedCharacterGraphics(document).mappings.some(row=>row.textureKey===id)).toBe(false);
    });
    it.each([
      ['고양이형 갑각 짐승', '바위 지대의 필드 몬스터'],
      ['붉은 갑피를 가진 소 계열 사족 마수', '근거리 돌진'],
      ['닭 계열의 언데드 조류 몬스터', '묘지 길목'],
    ])('classifies the authored species rather than requiring an exact tag: %s', (kind, role) => {
      const value = library(), description = value.characters![id]!.description;
      description.attributes = {kind}; description.role = role; install(value);
      expect(sharedCharacterSemantics()[0]?.tags).toContain('몬스터');
      expect(queryNpcGraphics('monster', 100).some(match => match.entry.textureKey === id)).toBe(true);
      expect(queryNpcGraphics('people', 100).some(match => match.entry.textureKey === id)).toBe(false);
      const p = project(); ensureSharedCharacters(p);
      expect(p.charsetLabels![0]?.tags).toContain('몬스터');
    });
    it('does not classify a human hunter by a monster word in their role or clothes', () => {
      const value = library(), description = value.characters![id]!.description;
      description.attributes = {kind:'사람',clothing:'몬스터 문양 재킷'};
      description.role = '몬스터 사냥꾼'; install(value);
      expect(sharedCharacterSemantics()[0]?.tags).not.toContain('몬스터');
      expect(queryNpcGraphics('monster', 100).some(match => match.entry.textureKey === id)).toBe(false);
    });
    it('does not index absent traits or a removed feather as visible features', () => {
      const value = library(), description = value.characters![id]!.description;
      description.attributes = {kind:'몬스터',hair:'청록 비늘; 긴 털과 갈기 없음',clothing:'옷 없음; 별도 갑피 없이 이마의 작은 황금빛 표식'};
      description.appearance = '청록 몸과 황금빛 표식. 원본의 깃털과 큰 무기는 제거했다.';
      install(value);
      for (const query of ['깃털','갈기','갑피','옷']) {
        expect(queryNpcGraphics(query,100).some(match => match.entry.textureKey === id)).toBe(false);
      }
      expect(queryNpcGraphics('황금빛 표식',100).some(match => match.entry.textureKey === id)).toBe(true);
      expect(description.appearance).toContain('깃털');
    });
  });
});

describe("sharedContentDedup", () => {
  isolateTimers();
  const long = (seed: string) => `${seed}:`.repeat(600);
  function snapshotWith(...strings: string[]): SharedContentSnapshot {
    return {
      revision: "r1",
      libraries: { a: { version: 1, roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, sourceProjectId: "p", previews: Object.fromEntries(strings.map((s, i) => [`k${i}`, s])) } },
    } as unknown as SharedContentSnapshot;
  }
  describe("shared content transport dedup", () => {
    it("puts a repeated long string on the wire once and restores identical values", () => {
      const original = snapshotWith(long("x"), long("x"), long("y"), "short", "short");
      const deduped = dedupeSharedContent(original)!;
      expect(deduped.strings).toEqual([long("x")]);
      const wire = JSON.stringify(deduped);
      expect(wire.split(long("x")).length - 1).toBe(1);
      expect(inflateSharedContentResponse(JSON.parse(wire))).toEqual(original);
    });

    it("keeps key order and leaves a snapshot without repeats alone", () => {
      expect(dedupeSharedContent(snapshotWith(long("x"), long("y")))).toBeNull();
      const original = snapshotWith(long("x"), long("x"));
      const restored = inflateSharedContentResponse(JSON.parse(JSON.stringify(dedupeSharedContent(original))));
      expect(Object.keys(restored.libraries.a!.previews)).toEqual(["k0", "k1"]);
    });

    it("refuses to dedup when a real string could be mistaken for a marker", () => {
      expect(dedupeSharedContent(snapshotWith(long("x"), long("x"), "\u0000S0"))).toBeNull();
    });

    it("passes an old-format response through untouched", () => {
      const old = snapshotWith(long("x"), long("x"));
      expect(inflateSharedContentResponse(JSON.parse(JSON.stringify(old)))).toEqual(old);
    });
  });
});

describe("sharedContentSqlite", () => {
  isolateTimers();
  const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const hashLibrary = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  function library(projectDefaults: boolean): SharedContentLibrary {
    const reference = [{ id: "study", name: "study", description: "", documents: [], images: [{ id: "a", name: "a", caption: "", dataUrl: PIXEL }] }];
    const tileset = { id: "shared_room", referenceDocuments: reference, structureKits: [{ id: "kit", referenceDocuments: structuredClone(reference) }] };
    return { version: 1, ...(projectDefaults ? { projectDefaults: true } : {}), roots: [], places: {}, tilesets: { shared_room: tileset } as unknown as SharedContentLibrary["tilesets"], assets: {}, maps: {}, sourceProjectId: "test", previews: { shared_room: PIXEL } };
  }
  let directory: string;
  let file: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "oprn-shared-content-"));
    file = join(directory, "shared-content.sqlite");
    publishSharedContent("catalog", library(false), null, file);
    publishSharedContent("defaults", library(true), null, file);
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  describe("editor shared-content snapshot", () => {
    it("serves only projectDefaults libraries for the boot scope, with the full-catalog revision", () => {
      const boot = readSharedContentForEditor("defaults", file);
      expect(Object.keys(boot.libraries)).toEqual(["defaults"]);
      expect(boot.revision).toBe(readSharedContentForEditor("all", file).revision);
      expect(boot.revision).toBe(readSharedContent(file).revision);
    });

    it("replaces inline previews with an address that returns the same bytes", () => {
      const url = readSharedContentForEditor("all", file).libraries.catalog!.previews.shared_room!;
      expect(url.startsWith("data:")).toBe(false);
      const params = new URL(url, "http://host").searchParams;
      const found = readSharedContentPreview(params.get("library")!, params.get("kind")!, params.get("id")!, file);
      expect(found?.mime).toBe("image/png");
      expect(found?.bytes.equals(Buffer.from(PIXEL.slice(PIXEL.indexOf(",") + 1), "base64"))).toBe(true);
    });

    it("keeps the publishing reader byte-exact and rejects unknown preview requests", () => {
      expect(readSharedContent(file).libraries.catalog!.previews.shared_room).toBe(PIXEL);
      expect(readSharedContent(file).libraries.defaults!.tilesets.shared_room!.referenceDocuments![0]!.images[0]!.dataUrl).toBe(PIXEL);
      expect(readSharedContentPreview("catalog", "place", "missing", file)).toBeNull();
      expect(readSharedContentPreview("catalog", "tileset", "shared_room", file)).toBeNull();
    });

    it("carries the byte SHA-256 of every default image so HTTP editors need not hash them", () => {
      publishSharedContent("defaults", { ...library(true), assets: { shared_room_image: { id: "shared_room_image", name: "room", kind: "tileset", dataUrl: PIXEL, meta: {} } } as unknown as SharedContentLibrary["assets"] }, hashLibrary(readSharedContent(file).libraries.defaults), file);
      const boot = readSharedContentForEditor("defaults", file);
      expect(boot.assetBytesSha256).toEqual({ shared_room_image: createHash("sha256").update(Buffer.from(PIXEL.slice(PIXEL.indexOf(",") + 1), "base64")).digest("hex") });
    });
  });
  describe("shared tileset reference images", () => {
    it("replaces inline tileset and kit reference images with one address that serves the same bytes", () => {
      const tileset = readSharedContentForEditor("defaults", file).libraries.defaults!.tilesets.shared_room!;
      const address = tileset.referenceDocuments![0]!.images[0]!.dataUrl;
      expect(isSharedReferenceImage(address)).toBe(true);
      expect(tileset.structureKits![0]!.referenceDocuments![0]!.images[0]!.dataUrl).toBe(address);
      expect(() => validateTilesetReferences(tileset.referenceDocuments)).not.toThrow();
      const found = readSharedReferenceImage(address, file);
      expect(found?.mime).toBe("image/png");
      expect(found?.bytes.equals(Buffer.from(PIXEL.slice(PIXEL.indexOf(",") + 1), "base64"))).toBe(true);
    });

    it("serves an address from a library outside the requested scope and rejects unknown or malformed ones", () => {
      const address = readSharedContentForEditor("all", file).libraries.catalog!.tilesets.shared_room!.referenceDocuments![0]!.images[0]!.dataUrl;
      expect(readSharedReferenceImage(address, file)).not.toBeNull();
      expect(readSharedReferenceImage(address.replace(/-\d+\.png$/, "-1.png"), file)).toBeNull();
      expect(readSharedReferenceImage("/__oprn/shared-content/image/../x.png", file)).toBeNull();
    });
  });
  describe("encoded editor response", () => {
    it("decodes to the editor snapshot and is rebuilt after a library is republished", () => {
      const first = encodedSharedContent("defaults", file);
      expect(JSON.parse(gunzipSync(first).toString())).toEqual(readSharedContentForEditor("defaults", file));
      expect(encodedSharedContent("defaults", file)).toBe(first);
      const old = readSharedContent(file).libraries.defaults!;
      publishSharedContent("defaults", { ...library(true), roots: [], sourceProjectId: "changed" }, hashLibrary(old), file);
      const second = encodedSharedContent("defaults", file);
      expect(second).not.toBe(first);
      expect(JSON.parse(gunzipSync(second).toString()).libraries.defaults.sourceProjectId).toBe("changed");
    });

    it("splits the catalog so defaults + rest is the whole, all sharing one revision", () => {
      const defaults = readSharedContentForEditor("defaults", file);
      const rest = readSharedContentForEditor("rest", file);
      const all = readSharedContentForEditor("all", file);
      expect(Object.keys(defaults.libraries)).toEqual(["defaults"]);
      expect(Object.keys(rest.libraries)).toEqual(["catalog"]);
      expect({ ...defaults.libraries, ...rest.libraries }).toEqual(all.libraries);
      expect(new Set([defaults.revision, rest.revision, all.revision]).size).toBe(1);
    });

    it("changes the scope ETag exactly when a library is republished", () => {
      const before = sharedContentEtag("all", encodedSharedContentWithRevision("all", file).revision);
      expect(sharedContentEtag("all", encodedSharedContentWithRevision("all", file).revision)).toBe(before);
      expect(sharedContentEtag("rest", encodedSharedContentWithRevision("rest", file).revision)).not.toBe(before);
      const old = readSharedContent(file).libraries.catalog!;
      publishSharedContent("catalog", { ...library(false), sourceProjectId: "moved" }, hashLibrary(old), file);
      expect(sharedContentEtag("all", encodedSharedContentWithRevision("all", file).revision)).not.toBe(before);
    });
  });
});

describe("sharedReferenceImageReader", () => {
  isolateTimers();
  // 조수 워커(Bun)는 상대 주소 fetch 를 못 한다 — 공용 참고 이미지는 등록한 읽기 함수로 바로 푼다(2026-10-08).
  describe("shared reference image reader", () => {
    afterEach(() => setSharedReferenceImageReader(null));
    it("resolves a shared-content image address without fetch", async () => {
      setSharedReferenceImageReader(src => src.endsWith(".png") ? { mime: "image/png", bytes: new Uint8Array([1, 2, 3]) } : null);
      await expect(resolveReferenceImageDataUrl("/__oprn/shared-content/image/s1-2-3.png")).resolves.toBe("data:image/png;base64,AQID");
    });
  });
});

describe("shopkeeper", () => {
  isolateTimers();
  describe("shopkeeper inverted haggle", () => {
    it("Given / When / Then the same day key yields the same customer queue", () => {
      const input = { shopKey: "shop_a", dayKey: "1:spring:2", itemIds: ["item_potion", "item_sword"] };
      expect(generateShopkeeperCustomers(input)).toEqual(generateShopkeeperCustomers(input));
      expect(generateShopkeeperCustomers({ ...input, itemIds: [] })).toEqual([]);
    });

    it("Given / When / Then a customer buy uses playerSells and never pays at or above list", () => {
      const reserve = resolveHaggleReserve({
        role: "playerSells",
        reference: 100,
        buyPrice: 200,
        maxDiscount: 0.25,
        itemId: "item_potion",
        merchantKey: "shop_a",
        dayKey: "1:spring:2",
        attemptIndex: 0,
      });
      expect(reserve).toBeGreaterThanOrEqual(100);
      expect(reserve).toBeLessThan(200);
      const accepted = proposeHaggle(
        {
          role: "playerSells",
          reference: 100,
          reserve,
          patience: 3,
          insultRatio: 0.6,
          buyPrice: 200,
        },
        Math.min(reserve, 199),
      );
      expect(accepted.kind).toBe("accept");
      if (accepted.kind !== "accept") return;
      expect(accepted.price).toBeLessThan(200);
    });

    it("Given / When / Then walkout lowers reputation and a sale raises it", () => {
      expect(clampShopReputation(200)).toBe(100);
      expect(reputationAfterVerdict(10, "accept")).toBe(12);
      expect(reputationAfterVerdict(10, "broken")).toBe(5);
    });
  });
});

describe("shopPrice", () => {
  isolateTimers();
  function shop(overrides: Partial<Extract<Command, { kind: "shop" }>> = {}): Extract<Command, { kind: "shop" }> {
    return {
      kind: "shop",
      itemIds: ["item_potion"],
      ...overrides,
    };
  }
  describe("shop price unification", () => {
    it("uses the equipment database price when stock has no override", () => {
      const project = createBlankProject();
      const equipment = { ...project.database.equipment[0], id: "equipment_price_test", price: 40 };
      project.database.equipment = [equipment];
      expect(resolvePricedShopStock(project, {}, shop({ itemIds: [equipment.id] }))).toEqual([
        { itemId: equipment.id, price: 40 },
      ]);
    });

    it("keeps equipment discount floors and explicit seasonal price priority", () => {
      const project = createBlankProject();
      project.database.equipment = [{ ...project.database.equipment[0], id: "equipment_price_test", price: 40 }];
      const id = "equipment_price_test";
      const session = { gameTime: { minute: 0, hour: 21, day: 1, season: "spring" as const, year: 1 }, shopLoyaltySpend: { global: 60000 } };
      expect(resolveShopBuyUnitPrice(project, session, shop({ economy: { closingSaleEnabled: true } }), id, 10)).toBe(20);
      project.system.timeSystem = { ...project.system.timeSystem, enabled: true };
      expect(resolvePricedShopStock(project, {}, shop({ stock: [{ itemId: id, priceOverride: 60 }] }))[0]?.price).toBe(60);
      expect(resolvePricedShopStock(project, { gameTime: session.gameTime }, shop({ stock: [{ itemId: id, priceOverride: 60, priceBySeason: { spring: 80 } }] }))[0]?.price).toBe(80);
      expect(resolveShopBuyUnitPrice(project, session, shop({ economy: { closingSaleEnabled: true } }), id, 40)).toBe(30);
    });

    it("preserves zero prices and item-first lookup for duplicate ids", () => {
      const project = createBlankProject();
      project.database.equipment = [{ ...project.database.equipment[0], id: "equipment_price_test", price: 0 }];
      expect(resolvePricedShopStock(project, {}, shop({ itemIds: ["equipment_price_test"] }))[0]?.price).toBe(0);
      project.database.items = [{ ...project.database.items[0], id: "equipment_price_test", price: 0 }];
      project.database.equipment[0].price = 40;
      expect(resolvePricedShopStock(project, {}, shop({ stock: [{ itemId: "equipment_price_test", priceOverride: 0 }] }))[0]?.price).toBe(0);
    });

    it("applies the social discount to equipment without an override", () => {
      const project = createBlankProject();
      project.database.equipment = [{ ...project.database.equipment[0], id: "equipment_price_test", price: 40 }];
      expect(resolvePricedShopStock(project, { friendship: { merchant: 100 } }, shop({ itemIds: ["equipment_price_test"] }), {
        id: "merchant", characterId: "merchant", socialShop: { minFriendship: 10, priceMultiplier: 0.75 },
      })).toEqual([{ itemId: "equipment_price_test", price: 30 }]);
    });

    it("Given / When / Then loyalty and closing sale never break sell < buy", () => {
      const project = createBlankProject();
      project.database.items = [{
        ...(project.database.items[0] ?? {
          id: "item_potion",
          name: "회복약",
          description: "",
          type: "medicine",
          scope: "ally",
          occasion: "always",
          consumable: true,
          stateEffects: [],
          consumptionLimit: "noLimit",
          usableActorIds: [],
          usableClassIds: [],
          healStateIds: [],
          hpRecovery: { flat: 0, percentMax: 0 },
          mpRecovery: { flat: 0, percentMax: 0 },
          onlyUsableInMenu: false,
          onlyEffectiveOnDeadActors: false,
          usageMessage: "normal",
          occasionField: true,
          occasionBattle: true,
          seedParameterBonuses: { maxHp: 0, maxMp: 0, attack: 0, defense: 0, spirit: 0, agility: 0 },
          equipmentProfile: { equipable: false },
        }),
        id: "item_potion",
        price: 200,
      }];
      const buy = resolveShopBuyUnitPrice(
        project,
        {
          shopLoyaltySpend: { global: 60000 },
          gameTime: { minute: 0, hour: 21, day: 1, season: "spring", year: 1 },
        },
        shop({ economy: { closingSaleEnabled: true } }),
        "item_potion",
        200,
      );
      const sell = resolveShopSellUnitPrice(project, "item_potion", 200);
      expect(buy).toBeGreaterThanOrEqual(100);
      expect(sell).toBeLessThan(buy);
    });

    it("Given / When / Then weekly restock ignores same-week day changes", () => {
      expect(shouldRestock("daily", "1:spring:1", "1:spring:2")).toBe(true);
      expect(shouldRestock("weekly", "1:spring:1", "1:spring:6")).toBe(false);
      expect(shouldRestock("weekly", "1:spring:1", "1:spring:8")).toBe(true);
      expect(shouldRestock("onDemand", undefined, "1:spring:1")).toBe(false);
    });
  });
});

describe("skillSystem", () => {
  isolateTimers();
  function roundTrip(project: Project): Project {
    return deserialize(serialize(project));
  }
  function projectWithFarmingSkill(): Project {
    const project = createBlankProject();
    project.database.lifeSkills = [
      { id: "skill_farming", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 2, switchId: "sw_farming_lv2" }] },
    ];
    project.switches.push({ id: "sw_farming_lv2", name: "농사 레벨 2" });
    return project;
  }
  function runLifeSkillExp(project: Project, session: PlaySession, amount: number): void {
    const interpreter = createInterpreter(
      [{ kind: "changeLifeSkillExp", skillId: "skill_farming", op: "+=", amount }],
      session,
      project
    );
    interpreter.start();
  }
  describe("생활 스킬 시스템", () => {
    // 회귀: normalizeSystemRecords 가 화이트리스트 방식이라 skillSystem 이 목록에 없으면
    // 사용자가 켠 플래그가 저장/로드 1회 왕복에 조용히 사라졌다.
    it("skillSystem 플래그가 저장/로드 왕복에서 보존된다", () => {
      const project = createBlankProject();
      project.system.skillSystem = { enabled: true };
      expect(roundTrip(project).system.skillSystem?.enabled).toBe(true);
    });

    it("skillSystem 미설정이면 JSON 에 생략된다(기본 계약)", () => {
      expect(roundTrip(createBlankProject()).system.skillSystem).toBeUndefined();
    });

    it("lifeSkills 레코드가 저장/로드 왕복에서 정규화되어 보존된다", () => {
      const project = createBlankProject();
      project.database.lifeSkills = [
        { id: "skill_farming", name: "  농사  ", skillType: "farming", maxLevel: 10, levelUpRewards: [{ level: 2, switchId: "sw_lv2" }] },
      ];
      project.switches.push({ id: "sw_lv2", name: "농사 레벨 2" });
      expect(roundTrip(project).database.lifeSkills?.[0]).toMatchObject({
        id: "skill_farming",
        name: "농사",
        skillType: "farming",
        maxLevel: 10,
      });
    });

    it("잘못된 skillType 과 빈 이름은 정규화된다", () => {
      const record = normalizeLifeSkillRecord({ id: "s1", name: "   ", skillType: "alchemy" as never, maxLevel: 0 });
      expect(record.skillType).toBe("farming");
      expect(record.name).toBe("스킬");
    });

    // 회귀: maxLevel 은 1..100 으로 정규화됐지만 XP 테이블은 10단계뿐이라
    // maxLevel 50 레코드가 영원히 레벨 10 에 머물렀다(스키마/런타임 불일치).
    it("maxLevel 은 XP 곡선이 지원하는 상한을 넘지 않는다", () => {
      const record = normalizeLifeSkillRecord({ id: "s1", name: "농사", maxLevel: 50 });
      expect(record.maxLevel).toBe(MAX_LIFE_SKILL_LEVEL);
      expect(levelForXp(999_999, record.maxLevel)).toBe(record.maxLevel);
    });

    it("도달 불가능한 레벨의 보상은 maxLevel 로 클램프된다", () => {
      const input = { id: "s1", name: "농사", maxLevel: 5, levelUpRewards: [{ level: 99, switchId: "sw_x" }] };
      const record = normalizeLifeSkillRecord(input as Partial<LifeSkillRecord> & Pick<LifeSkillRecord, "id" | "name">);
      expect(record.levelUpRewards[0]?.level).toBe(5);
    });

    it("switchId·recipeId 가 모두 없는 보상은 버려진다", () => {
      const record = normalizeLifeSkillRecord({ id: "s1", name: "농사", levelUpRewards: [{ level: 2 }] });
      expect(record.levelUpRewards).toHaveLength(0);
    });

    it("changeLifeSkillExp 명령으로 XP를 증가시키고 레벨업 시 스위치가 켜진다", () => {
      const project = projectWithFarmingSkill();
      project.system.skillSystem = { enabled: true };
      const session = startSession(project, 1);
      runLifeSkillExp(project, session, 100);
      expect(session.lifeSkills!.skill_farming.xp).toBe(100);
      expect(session.lifeSkills!.skill_farming.level).toBe(2);
      expect(session.switches.sw_farming_lv2).toBe(true);
    });

    // 회귀: "opt-in" 이라 문서화됐지만 게이트를 읽는 코드가 없어 플래그와 무관하게 동작했다.
    it("skillSystem 이 꺼져 있으면 changeLifeSkillExp 는 아무 일도 하지 않는다", () => {
      const project = projectWithFarmingSkill();
      const session = startSession(project, 1);
      runLifeSkillExp(project, session, 100);
      expect(session.lifeSkills?.skill_farming).toBeUndefined();
      // 세션 시작 시 선언된 스위치는 false 로 초기화된다 — 켜지지 않았음을 확인.
      expect(session.switches.sw_farming_lv2).toBe(false);
    });
  });
});
