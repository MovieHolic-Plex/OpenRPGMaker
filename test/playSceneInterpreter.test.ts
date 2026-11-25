// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { runCommands } from "@/player/playSceneInterpreter";
import { applyNonBlockingStep, updateParallelEvents } from "@/player/playSceneSchedulers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { deserialize, serialize } from "@/project/io";
import { openEventMenu } from "@/player/playerEventMenus";
import { isolateTimers } from "./mergedTeardown";

describe("p0TransitionControlFlow", () => {
  isolateTimers();
  function commandScene(sleepUntilMorning: () => Promise<boolean>) {
    const project = createBlankProject();
    project.system.timeSystem = { enabled: true };
    const session = startSession(project, 501);
    const overlays: string[] = [];
    const dialogue = {
      showText: vi.fn(async () => undefined),
      showChoices: vi.fn(async () => 0),
      showNumberInput: vi.fn(async () => 0),
      hide: vi.fn(),
      close: vi.fn(),
    };
    const registry = new Map<string, unknown>([["dialogue", dialogue]]);
    const scene = {
      session,
      running: false,
      inputEnabled: true,
      lastActionTargetKey: "",
      tileY: 0,
      map: { height: 1 },
      game: { registry: { get: (key: string) => registry.get(key) } },
      sleepUntilMorning,
      setInputEnabled: vi.fn(),
      refreshRuntimeSurfaces: vi.fn(),
      syncRuntimeState: vi.fn(),
      showRuntimeOverlay: (_id: string, text: string) => overlays.push(text),
      clearRuntimeOverlay: vi.fn(),
    } as unknown as PlaySceneContext;
    return { project, session, scene, overlays };
  }
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (cause: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  }
  function parallelScene(commands: Command[], sleepUntilMorning: () => Promise<boolean>) {
    const fixture = commandScene(sleepUntilMorning);
    fixture.project.commonEvents = [{
      id: "common_parallel_time",
      name: "Parallel time",
      trigger: "parallel",
      commands,
    }];
    fixture.scene.parallelProcesses = new Map();
    fixture.scene.activeRuntimeEvents = vi.fn(() => []);
    return fixture;
  }
  describe("P0 transition control flow", () => {
    it("does not resume the next authored command when sleep reports false", async () => {
      const previous = store.getCurrent();
      try {
        const { project, session, scene } = commandScene(async () => false);
        store.replaceProject(project);
        const commands: Command[] = [
          { kind: "sleepUntilMorning" },
          { kind: "setSwitch", switchId: "after_failed_sleep", value: true },
        ];

        await runCommands(scene, commands);

        expect(session.switches.after_failed_sleep).not.toBe(true);
      } finally {
        store.replaceProject(previous);
      }
    });

    it("observes false and rejected fire-and-forget scheduler sleeps", async () => {
      const falseCase = commandScene(async () => false);
      expect(applyNonBlockingStep(falseCase.scene, { kind: "sleepUntilMorning" })).toBe(true);
      await vi.waitFor(() => expect(falseCase.overlays.at(-1)).toContain("scheduled-sleep"));

      const rejectedCase = commandScene(async () => {
        throw new Error("scheduler rejection");
      });
      expect(applyNonBlockingStep(rejectedCase.scene, { kind: "sleepUntilMorning" })).toBe(true);
      await vi.waitFor(() => expect(rejectedCase.overlays.at(-1)).toContain("scheduler rejection"));
    });

    it("observes a rejected fire-and-forget scheduler day advance", async () => {
      const previous = store.getCurrent();
      try {
        const scheduled = commandScene(async () => {
          throw new Error("advance rejection");
        });
        store.replaceProject(scheduled.project);

        expect(applyNonBlockingStep(scheduled.scene, { kind: "advanceTime", days: 1 })).toBe(true);
        await vi.waitFor(() => {
          expect(scheduled.overlays.at(-1)).toContain("scheduled-advance");
          expect(scheduled.overlays.at(-1)).toContain("advance rejection");
        });
      } finally {
        store.replaceProject(previous);
      }
    });

    it("keeps a parallel sleep pending and resumes the interpreter only after success", async () => {
      // Break caught: consumeParallelSteps resumes setSwitch immediately after starting an unresolved sleep.
      const previous = store.getCurrent();
      const sleep = deferred<boolean>();
      try {
        const scheduled = parallelScene([
          { kind: "sleepUntilMorning" },
          { kind: "setSwitch", switchId: "after_parallel_sleep", value: true },
        ], () => sleep.promise);
        store.replaceProject(scheduled.project);

        updateParallelEvents(scheduled.scene, 16);
        updateParallelEvents(scheduled.scene, 16);
        expect(scheduled.session.switches.after_parallel_sleep).not.toBe(true);
        expect(scheduled.scene.parallelProcesses.size).toBe(1);

        sleep.resolve(true);
        await vi.waitFor(() => expect(scheduled.session.switches.after_parallel_sleep).toBe(true));
        expect(scheduled.scene.parallelProcesses.size).toBe(0);
      } finally {
        store.replaceProject(previous);
      }
    });

    it.each([
      ["false", (pending: ReturnType<typeof deferred<boolean>>) => pending.resolve(false)],
      ["reject", (pending: ReturnType<typeof deferred<boolean>>) => pending.reject(new Error("parallel sleep rejection"))],
    ] as const)("stops a failed parallel sleep (%s) without running later commands", async (_kind, finish) => {
      // Break caught: failed parallel sleeps only paint an overlay after their interpreter already completed.
      const previous = store.getCurrent();
      const sleep = deferred<boolean>();
      try {
        const scheduled = parallelScene([
          { kind: "sleepUntilMorning" },
          { kind: "setSwitch", switchId: "after_failed_parallel_sleep", value: true },
        ], () => sleep.promise);
        store.replaceProject(scheduled.project);

        updateParallelEvents(scheduled.scene, 16);
        finish(sleep);
        await vi.waitFor(() => expect(scheduled.overlays.at(-1)).toContain("scheduled-sleep"));
        updateParallelEvents(scheduled.scene, 16);

        expect(scheduled.session.switches.after_failed_parallel_sleep).not.toBe(true);
        expect(scheduled.scene.parallelProcesses.size).toBe(1);
        expect(scheduled.overlays.at(-1)).toContain("scheduled-sleep");
      } finally {
        store.replaceProject(previous);
      }
    });

    it("waits for a parallel advance before running its following command", async () => {
      // Break caught: advanceTime is treated as synchronous inside parallel processes even when it sleeps.
      const previous = store.getCurrent();
      const sleep = deferred<boolean>();
      try {
        const scheduled = parallelScene([
          { kind: "advanceTime", days: 1 },
          { kind: "setSwitch", switchId: "after_parallel_advance", value: true },
        ], () => sleep.promise);
        store.replaceProject(scheduled.project);

        updateParallelEvents(scheduled.scene, 16);
        expect(scheduled.session.switches.after_parallel_advance).not.toBe(true);
        sleep.resolve(true);
        await vi.waitFor(() => expect(scheduled.session.switches.after_parallel_advance).toBe(true));
      } finally {
        store.replaceProject(previous);
      }
    });

    it.each([
      ["false", async () => false],
      ["reject", async () => { throw new Error("parallel advance rejection"); }],
    ] as const)("stops a failed parallel advance (%s) without running later commands", async (_kind, sleepUntilMorning) => {
      // Break caught: advanceTime failure is observed but its parallel interpreter still resumes setSwitch.
      const previous = store.getCurrent();
      try {
        const scheduled = parallelScene([
          { kind: "advanceTime", days: 1 },
          { kind: "setSwitch", switchId: "after_failed_parallel_advance", value: true },
        ], sleepUntilMorning);
        store.replaceProject(scheduled.project);

        updateParallelEvents(scheduled.scene, 16);
        await vi.waitFor(() => expect(scheduled.overlays.at(-1)).toContain("scheduled-advance"));
        updateParallelEvents(scheduled.scene, 16);

        expect(scheduled.session.switches.after_failed_parallel_advance).not.toBe(true);
        expect(scheduled.scene.parallelProcesses.size).toBe(1);
      } finally {
        store.replaceProject(previous);
      }
    });
  });
});

// presentItem 실플레이어 경로: 선물하기와 같은 목록 창을 띄우고, 고른 아이템으로 인터프리터를 재개한다.
describe("presentItemPlayerUi", () => {
  isolateTimers();
  function sceneFixture(inventory: Record<string, number>) {
    const blank = createBlankProject();
    const template = blank.database.items[0]!;
    blank.database.items.push({ ...template, id: "item_knife", name: "피 묻은 칼" }, { ...template, id: "item_letter", name: "찢긴 편지" });
    store.replace(deserialize(serialize(blank)));
    const project = store.getCurrent();
    const messages: string[] = [];
    const dialogue = { showText: async (message: { body: string }) => { messages.push(message.body); }, showChoices: async () => 0, showNumberInput: async () => 0, close() {}, hide() {} };
    const host = document.createElement("div");
    document.body.append(host);
    const scene = { session: startSession(project, 1), map: project.maps[project.startMapId], tileY: 0, running: false, inputEnabled: true, eventPositions: {}, eventSprites: new Map(), game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : key === "dialogueHost" ? host : undefined } }, setInputEnabled() {}, refreshRuntimeSurfaces() {}, syncRuntimeState() {}, showRuntimeOverlay() {}, clearRuntimeOverlay() {} } as unknown as PlaySceneContext;
    scene.session.inventory = { ...inventory };
    return { scene, messages, host };
  }
  const interrogate: Command[] = [{
    kind: "presentItem",
    prompt: "증거를 제시하라",
    itemIds: ["item_knife", "item_letter"],
    options: [{ itemId: "item_knife", branch: [{ kind: "text", body: "자백" }] }],
    otherwiseBranch: [{ kind: "text", body: "헛짚음" }],
    cancelBranch: [{ kind: "text", body: "안 냄" }],
  }];
  async function waitFor<T>(probe: () => T | null | undefined): Promise<T> {
    for (let i = 0; i < 50; i += 1) {
      const found = probe();
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error("timed out");
  }
  describe("presentItem 플레이어 UI", () => {
    beforeEach(() => { document.body.replaceChildren(); });

    it("소지한 후보만 목록에 띄우고 고른 아이템의 분기를 실행한다", async () => {
      const { scene, messages, host } = sceneFixture({ item_knife: 1, item_letter: 2, item_other: 1 });
      const run = runCommands(scene, interrogate);
      const button = await waitFor(() => host.querySelector<HTMLButtonElement>("[data-testid='present-item-item_knife']"));
      expect(host.querySelector("[data-testid='present-item-scene']")?.textContent).toContain("증거를 제시하라");
      expect([...host.querySelectorAll("[data-testid^='present-item-item_']")].map((el) => el.textContent)).toEqual(["피 묻은 칼1", "찢긴 편지2"]);
      button.click();
      await run;
      expect(messages).toEqual(["자백"]);
      expect(host.querySelector("[data-testid='present-item-scene']")).toBeNull();
    });

    it("그만두기 → cancelBranch", async () => {
      const { scene, messages, host } = sceneFixture({ item_knife: 1 });
      const run = runCommands(scene, interrogate);
      (await waitFor(() => host.querySelector<HTMLButtonElement>("[data-testid='present-item-cancel']"))).click();
      await run;
      expect(messages).toEqual(["안 냄"]);
    });

    it("보여줄 것이 없으면 prompt 만 보이고 cancelBranch", async () => {
      const { scene, messages, host } = sceneFixture({});
      await runCommands(scene, interrogate);
      expect(host.querySelector("[data-testid='present-item-scene']")).toBeNull();
      expect(messages).toEqual(["증거를 제시하라", "안 냄"]);
    });
  });
});

describe("runtimeEventMenus", () => {
  isolateTimers();
  describe("event menus block subsequent commands", () => {
    it.each([["m2-078-open-menu-screen", "openMenuScreen"], ["m2-093-open-load-menu", "openLoadMenu"]])("%s resumes only after closing its requested screen", async (id, callback) => {
      const project = createBlankProject(); store.replace(project);
      const session = startSession(project);
      const root = document.createElement("div"); document.body.append(root);
      const menu = document.createElement("div"); menu.dataset.testid = "main-menu";
      const show = vi.fn(() => openEventMenu(root, () => root.append(menu)));
      const save = vi.fn();
      const dialogue = { showText: vi.fn(), showChoices: vi.fn(), showNumberInput: vi.fn(), hide: vi.fn(), close: vi.fn() };
      const registry = new Map<string, unknown>([["dialogue", dialogue], [callback, show], ["openSaveMenu", save]]);
      const scene = {
        session, map: project.maps[project.startMapId], running: false, inputEnabled: true,
        game: { registry: { get: (key: string) => registry.get(key) } },
        setInputEnabled: vi.fn(), refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
        clearRuntimeOverlay: vi.fn(), showRuntimeOverlay: vi.fn(),
      } as unknown as PlaySceneContext;
      try {
        const pending = runCommands(scene, [
          { kind: "m2Command", commandId: id!, fields: {} },
          { kind: "setSwitch", switchId: "after", value: true },
        ]);
        expect(show).toHaveBeenCalledOnce();
        expect(save).not.toHaveBeenCalled();
        expect(session.switches.after).not.toBe(true);
        await Promise.resolve();
        expect(session.switches.after).not.toBe(true);
        menu.remove();
        await pending;
        expect(session.switches.after).toBe(true);
      } finally { root.remove(); }
    });

    it("resolves when the player is removed without leaking an observer", async () => {
      const root = document.createElement("div"); document.body.append(root);
      const pending = openEventMenu(root, () => { root.innerHTML = '<div data-testid="main-menu"></div>'; });
      root.remove();
      await pending;
    });

    it("loading abandons the old event without closing a new session's dialogue or unlocking it", async () => {
      const project = createBlankProject(); store.replace(project);
      const oldSession = startSession(project), newSession = startSession(project);
      const close = vi.fn(), input = vi.fn();
      const dialogue = { showText: vi.fn(), showChoices: vi.fn(), showNumberInput: vi.fn(), hide: vi.fn(), close };
      const scene = {
        session: oldSession, map: project.maps[project.startMapId], running: false, inputEnabled: true,
        game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : async () => {
          scene.session = newSession; scene.running = true;
        } } },
        setInputEnabled: input, refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
        clearRuntimeOverlay: vi.fn(), showRuntimeOverlay: vi.fn(),
      } as unknown as PlaySceneContext;
      await runCommands(scene, [
        { kind: "m2Command", commandId: "m2-093-open-load-menu", fields: {} },
        { kind: "setSwitch", switchId: "stale", value: true },
      ]);
      expect(oldSession.switches.stale).not.toBe(true);
      expect(newSession.switches.stale).not.toBe(true);
      expect(scene.running).toBe(true);
      expect(close).not.toHaveBeenCalled();
      expect(input).not.toHaveBeenCalledWith(true);
    });
  });
});
