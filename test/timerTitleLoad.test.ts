/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayScene } from "@/player/PlayScene";
import { updateRuntimeTimers } from "@/player/playSceneTimers";
import type { PlaySceneContext, RuntimeTimer } from "@/player/playSceneTypes";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
import { store } from "@/project/store";

vi.mock("@/app/phaserRuntime", () => ({ getLoadedPhaser: () => ({ Scene: class {} }) }));

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

class HaltCreate extends Error {
  constructor() {
    super("timer-installed");
    this.name = "HaltCreate";
  }
}

class HaltOnSet extends Map<string, RuntimeTimer> {
  override set(key: string, value: RuntimeTimer): this {
    super.set(key, value);
    throw new HaltCreate();
  }
}

const previousProject = store.getCurrent();
afterEach(() => {
  store.replaceProject(previousProject);
  vi.restoreAllMocks();
});

function loadFromSlot(session: PlaySession): PlaySession {
  const project = store.getCurrent();
  const storage = new MemoryStorage();
  expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
  const saved = readSaveSlot(storage, 1);
  if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
  return applySaveSnapshot(project, saved.snapshot);
}

/** 타이틀 불러오기는 새 PlayScene 을 연다. 카운트다운을 심는 순간 create 를 멈춘다. */
function bootTitleLoad(restored: PlaySession): PlayScene {
  const scene = new PlayScene();
  scene.runtimeTimers = new HaltOnSet();
  const registry = new Map<string, unknown>([
    ["initialSession", restored],
    ["qaInstrumentation", false],
  ]);
  const listeners = new Map<string, Array<() => void>>();
  Object.assign(scene, {
    textures: { exists: () => false } as unknown as PlayScene["textures"],
    cameras: { main: { setBackgroundColor: () => undefined } } as unknown as PlayScene["cameras"],
    add: { container: () => ({ setDepth: () => undefined }) } as unknown as PlayScene["add"],
    input: { keyboard: null } as unknown as PlayScene["input"],
    events: {
      once(name: string, fn: () => void) {
        const list = listeners.get(name) ?? [];
        list.push(fn);
        listeners.set(name, list);
      },
      emit(name: string) {
        for (const fn of listeners.get(name) ?? []) fn();
        listeners.delete(name);
      },
    } as unknown as PlayScene["events"],
    game: {
      registry: { get: (key: string) => registry.get(key) },
      events: { emit: () => undefined },
    } as unknown as PlayScene["game"],
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    scene.create();
    throw new Error("create finished without restoring timers");
  } catch (error) {
    if (!(error instanceof HaltCreate)) throw error;
  } finally {
    scene.events.emit("shutdown");
    scene.events.emit("destroy");
  }
  return scene;
}

describe("타이틀에서 불러온 카운트다운", () => {
  it("흐르던 타이머는 새 장면에서도 남은 초를 깎는다", () => {
    const project = createBlankProject();
    store.replaceProject(project);
    const session = startSession(project);
    session.timers = { timer1: 10 };
    session.timerActive = { timer1: true };

    const restored = loadFromSlot(session);
    expect(restored.timerActive?.timer1).toBe(true);
    const scene = bootTitleLoad(restored);
    expect(scene.runtimeTimers.get("timer1")).toEqual({ remaining: 10, active: true });

    updateRuntimeTimers(scene as unknown as PlaySceneContext, 1500);
    expect(scene.session.timers.timer1).toBe(9);
    expect(scene.runtimeTimers.get("timer1")?.active).toBe(true);
  });

  it("멈춰 둔 타이머는 남은 초를 유지하고 흐르지 않는다", () => {
    const project = createBlankProject();
    store.replaceProject(project);
    const session = startSession(project);
    session.timers = { timer1: 10 };

    const restored = loadFromSlot(session);
    expect(restored.timerActive).toBeUndefined();
    const scene = bootTitleLoad(restored);
    expect(scene.runtimeTimers.get("timer1")).toEqual({ remaining: 10, active: false });

    updateRuntimeTimers(scene as unknown as PlaySceneContext, 5000);
    expect(scene.session.timers.timer1).toBe(10);
    expect(scene.runtimeTimers.get("timer1")?.active).toBe(false);
  });
});
