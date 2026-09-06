import { describe, expect, it, vi } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";

const fade = vi.hoisted(() => vi.fn<typeof import("@/player/playSceneMapCommands")["fadeCamera"]>(async () => undefined));
vi.mock("@/player/playSceneMapCommands", () => ({
  fadeCamera: fade,
  TRANSFER_FADE_DURATION_MS: 120,
}));

import { sleepUntilMorningScene, updateGameTime } from "@/player/playSceneTime";

function failingRuntime() {
  const project = createFarmingDemoProject();
  project.system.timeSystem = {
    enabled: true,
    dayStartHour: 6,
    dayEndHour: 26,
    daysPerSeason: 28,
    minutesPerRealSecond: 10,
  };
  project.system.shipping = { enabled: true };
  const session = startSession(project, 401);
  session.gameTime = { year: 1, season: "spring", day: 1, hour: 25, minute: 50 };
  // Unknown items now recover successfully; malformed ownership must still block the scene.
  session.shippingQueue = { item_deleted: -1 };
  return { project, session };
}

function sceneStub(session: ReturnType<typeof startSession>) {
  const overlays: string[] = [];
  const refreshRuntimeSurfaces = vi.fn();
  const syncRuntimeState = vi.fn();
  const scene = {
    session,
    timeFixedAccumulatorMs: 0,
    timeMinuteAccumulator: 0,
    timeSleepInProgress: false,
    game: {
      canvas: {
        parentElement: null,
        ownerDocument: { querySelector: () => null },
      },
    },
    showRuntimeOverlay: (_id: string, text: string) => overlays.push(text),
    clearRuntimeOverlay: vi.fn(),
    refreshRuntimeSurfaces,
    syncRuntimeState,
  } as unknown as PlaySceneContext;
  return { scene, overlays, refreshRuntimeSurfaces, syncRuntimeState };
}

describe("P0 day-transition scene failure handling", () => {
  it("keeps natural clock state unchanged and exposes a visible error", () => {
    const previous = store.getCurrent();
    try {
      const { project, session } = failingRuntime();
      store.replaceProject(project);
      const { scene, overlays } = sceneStub(session);
      const frozen = structuredClone(session);

      updateGameTime(scene, 1_000);

      expect(session).toEqual(frozen);
      expect(overlays.at(-1)).toContain("transition-failed");
      expect(scene.timeFixedAccumulatorMs).toBe(0);
      expect(scene.timeMinuteAccumulator).toBe(0);
    } finally {
      store.replaceProject(previous);
    }
  });

  it("preflights sleep before fade/hooks and does not refresh as though sleep succeeded", async () => {
    const previous = store.getCurrent();
    fade.mockClear();
    try {
      const { project, session } = failingRuntime();
      store.replaceProject(project);
      const { scene, overlays, refreshRuntimeSurfaces, syncRuntimeState } = sceneStub(session);
      const hook = vi.fn(async () => undefined);
      const frozen = structuredClone(session);

      await expect(sleepUntilMorningScene(scene, hook)).resolves.toBe(false);

      expect(session).toEqual(frozen);
      expect(fade).not.toHaveBeenCalled();
      expect(hook).not.toHaveBeenCalled();
      expect(refreshRuntimeSurfaces).not.toHaveBeenCalled();
      expect(syncRuntimeState).not.toHaveBeenCalled();
      expect(overlays.at(-1)).toContain("recovery");
      expect(scene.timeSleepInProgress).toBe(false);
    } finally {
      store.replaceProject(previous);
    }
  });

  it("rolls back a partially mutating day-end hook, fades in, and refreshes error surfaces", async () => {
    const previous = store.getCurrent();
    fade.mockClear();
    try {
      const project = createFarmingDemoProject();
      project.system.timeSystem = {
        enabled: true,
        dayStartHour: 6,
        dayEndHour: 26,
        daysPerSeason: 28,
        onDayEnd: "common_day_end",
      };
      project.commonEvents.push({ id: "common_day_end", name: "Day end", trigger: "none", commands: [{ kind: "wait", ms: 1 }] });
      const session = startSession(project, 402);
      session.gameTime = { year: 1, season: "spring", day: 4, hour: 25, minute: 50 };
      session.gold = 25;
      store.replaceProject(project);
      const { scene, overlays, refreshRuntimeSurfaces, syncRuntimeState } = sceneStub(session);
      const beforeHook = structuredClone(session);
      const hook = vi.fn(async () => {
        session.gold = 9_999;
        session.switches.partial_hook = true;
        throw new Error("malicious hook failure");
      });

      await expect(sleepUntilMorningScene(scene, hook)).resolves.toBe(false);

      expect(session).toEqual(beforeHook);
      expect(fade.mock.calls.map((call) => call[1])).toEqual(["out", "in"]);
      expect(overlays.at(-1)).toContain("day-end-hook");
      expect(refreshRuntimeSurfaces).toHaveBeenCalled();
      expect(syncRuntimeState).toHaveBeenCalled();
      expect(scene.timeSleepInProgress).toBe(false);
    } finally {
      store.replaceProject(previous);
    }
  });

  it("surfaces a forced-sleep false result instead of dropping the scheduler failure", async () => {
    const previous = store.getCurrent();
    try {
      const project = createFarmingDemoProject();
      project.system.timeSystem = {
        enabled: true,
        dayStartHour: 6,
        dayEndHour: 26,
        minutesPerRealSecond: 10,
        forceSleep: true,
      };
      const session = startSession(project, 403);
      session.gameTime = { year: 1, season: "spring", day: 2, hour: 25, minute: 50 };
      store.replaceProject(project);
      const { scene, overlays } = sceneStub(session);
      scene.sleepUntilMorning = vi.fn(async () => false);

      let timeout: ReturnType<typeof setTimeout> | undefined;
      const failed = new Promise<void>((resolve, reject) => {
        const show = scene.showRuntimeOverlay;
        scene.showRuntimeOverlay = (id, text) => {
          show.call(scene, id, text);
          if (text.includes("forced-sleep")) resolve();
        };
        timeout = setTimeout(() => reject(new Error("missing forced-sleep result")), 1_000);
      });
      try {
        updateGameTime(scene, 1_000);
        await failed;
        expect(overlays.at(-1)).toContain("forced-sleep");
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      store.replaceProject(previous);
    }
  });
});
