/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StartPlayGameOptions } from "@/app/mode";

const modeMocks = vi.hoisted(() => ({
  startPlayGame: vi.fn(),
  destroyGame: vi.fn(),
}));

vi.mock("@/app/mode", () => modeMocks);
vi.mock("@/assets/bundledAssetWarmup", () => ({ warmBundledPlayAssets: vi.fn() }));
vi.mock("@/player/runtimeJuice", () => ({ emitRuntimeJuice: vi.fn(() => ({})) }));
vi.mock("@/player/audio", () => ({
  playAudioCommand: vi.fn(),
  stopAudioCommand: vi.fn(),
}));
vi.mock("@/player/runtimeDebugPanel", () => ({
  renderRuntimeDebugPanel: () => document.createElement("div"),
}));

import { AUTHORING_TEST_BOOT_SUCCESS_EVENT } from "@/editor/authoringJourney";
import { closeTestPlayModal, openTestPlayModal } from "@/editor/panels/testPlayModal";
import { clearRecentPlayBootDiagnosticsForTest } from "@/player/playBootDiagnostics";
import { setExportedProject, store as exportProjectStore } from "@/player/exportProjectStoreShim";
import { renderPlayer, teardownPlayer } from "@/player/player";
import { createBlankProject } from "@/project/defaults";
import type { PlaySession } from "@/project/session";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";

const AUTO_START_KEY = "oprn:test-play-auto-start";

// 가짜 타이머를 켠 테스트도 감시 시한은 **진짜 시계**로 재야 한다. 가짜 시계를 30초 밀면
// 가짜 setTimeout 으로 걸어 둔 감시 시한이 먼저 터져 자기가 기다리는 변화를 못 본다.
const realSetTimeout = globalThis.setTimeout.bind(globalThis);
const realClearTimeout = globalThis.clearTimeout.bind(globalThis);

type FakeScene = {
  applySession: () => void;
  getSession: () => undefined;
  refreshRuntimeSurfaces: () => void;
  sys: { settings: { status: number } };
};

type FakeGame = {
  destroy: ReturnType<typeof vi.fn>;
  registry: { set: ReturnType<typeof vi.fn> };
  events: { once: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> };
  scene: { getScene: () => FakeScene };
};

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

function fakeGame(status: number): FakeGame {
  const scene: FakeScene = {
    applySession: () => undefined,
    getSession: () => undefined,
    refreshRuntimeSurfaces: () => undefined,
    sys: { settings: { status } },
  };
  return {
    destroy: vi.fn(),
    registry: { set: vi.fn() },
    events: { once: vi.fn(), off: vi.fn() },
    scene: { getScene: () => scene },
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function nextBootSuccess(): Promise<void> {
  return new Promise((resolve) => {
    window.addEventListener(AUTHORING_TEST_BOOT_SUCCESS_EVENT, () => resolve(), { once: true });
  });
}

function nextRecoveryPanel(): Promise<HTMLElement> {
  const existing = document.querySelector<HTMLElement>("[data-testid='play-recovery-panel']");
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeout = realSetTimeout(() => {
      observer.disconnect();
      reject(new Error("복구 패널이 나타나지 않았습니다."));
    }, 5_000);
    const observer = new MutationObserver(() => {
      const panel = document.querySelector<HTMLElement>("[data-testid='play-recovery-panel']");
      if (!panel) return;
      realClearTimeout(timeout);
      observer.disconnect();
      resolve(panel);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function recoveryReason(): string {
  return document.querySelector<HTMLElement>("[data-testid='play-recovery-reason']")?.textContent ?? "";
}

// 자율 이동 + 자동 실행을 저작한 이벤트. 안전 모드가 실제로 무엇을 걷어내는지 보는 표본.
function autonomousAutoRunEvent(): GameEvent {
  const page: EventPage = {
    id: "page-auto",
    name: "자동 실행",
    conditions: [],
    graphic: {},
    trigger: { kind: "auto" },
    priority: "below",
    movement: { type: "random", speed: 3, frequency: 3 },
    commands: [],
  };
  return {
    id: "event-auto",
    x: 2,
    y: 2,
    trigger: { kind: "auto" },
    commands: [],
    pages: [page],
  };
}

beforeEach(() => {
  const storage = memoryStorage();
  storage.setItem(AUTO_START_KEY, "1");
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  store.replaceProject(createBlankProject());
  vi.spyOn(store, "flush").mockResolvedValue({ kind: "not-configured" });
  modeMocks.startPlayGame.mockReset();
  modeMocks.destroyGame.mockReset();
  clearRecentPlayBootDiagnosticsForTest();
});

afterEach(() => {
  vi.useRealTimers();
  closeTestPlayModal();
  vi.restoreAllMocks();
});

describe("test play boot recovery", () => {
  it("shows the thrown boot reason in the recovery panel", async () => {
    const recovery = nextRecoveryPanel();
    modeMocks.startPlayGame.mockRejectedValueOnce(new Error("WebGL 컨텍스트 생성 실패"));

    await openTestPlayModal();
    await recovery;

    expect(recoveryReason()).toContain("WebGL 컨텍스트 생성 실패");
  });

  it("shows a recovery panel when waiting for PlayScene times out", async () => {
    vi.useFakeTimers();
    modeMocks.startPlayGame.mockResolvedValueOnce(fakeGame(0));
    const recovery = nextRecoveryPanel();

    const opening = openTestPlayModal();
    await vi.advanceTimersByTimeAsync(100);
    await opening;
    await vi.advanceTimersByTimeAsync(30_000);
    await recovery;

    expect(recoveryReason()).toContain("timeout");
    expect(document.querySelector("[data-testid='play-recovery-retry']")).not.toBeNull();
  });

  it("starts a fresh boot attempt when retry is clicked", async () => {
    modeMocks.startPlayGame
      .mockRejectedValueOnce(new Error("첫 부팅 실패"))
      .mockResolvedValueOnce(fakeGame(5));
    const recovery = nextRecoveryPanel();

    await openTestPlayModal();
    await recovery;
    const booted = nextBootSuccess();
    document.querySelector<HTMLButtonElement>("[data-testid='play-recovery-retry']")?.click();
    await booted;

    expect(modeMocks.startPlayGame).toHaveBeenCalledTimes(2);
  });

  it("boots the repaired project and reports a dangling start-map repair", async () => {
    const project = createBlankProject();
    const expectedMapId = Object.keys(project.maps)[0]!;
    project.startMapId = "missing-start-map";
    store.replaceProject(project);
    let bootSession: PlaySession | undefined;
    let bootProjectStartMapId = "";
    modeMocks.startPlayGame.mockImplementation(async (_host: HTMLElement, session: PlaySession | undefined, _options: StartPlayGameOptions) => {
      bootSession = session;
      bootProjectStartMapId = store.getCurrent().startMapId;
      return fakeGame(5);
    });
    const booted = nextBootSuccess();

    await openTestPlayModal();
    await booted;

    expect(bootProjectStartMapId).toBe(expectedMapId);
    expect(bootSession?.currentMapId).toBe(expectedMapId);
    expect(document.querySelector("[data-testid='toast']")?.textContent).toContain("missing-start-map");
  });

  it("creates the session from the repaired project without snapshot support", async () => {
    const project = createBlankProject();
    const expectedMapId = Object.keys(project.maps)[0]!;
    project.startMapId = "missing-start-map";
    store.replaceProject(project);
    Object.defineProperty(store, "beginReadOnlyProjectSnapshot", {
      configurable: true,
      value: undefined,
    });
    let bootSession: PlaySession | undefined;
    modeMocks.startPlayGame.mockImplementation(async (_host: HTMLElement, session: PlaySession | undefined) => {
      bootSession = session;
      return fakeGame(5);
    });
    const host = document.createElement("div");
    document.body.append(host);

    try {
      await new Promise<void>((resolve) => {
        renderPlayer(host, { autoStartRun: true, onPlayBootSuccess: resolve });
      });

      expect(bootSession?.currentMapId).toBe(expectedMapId);
    } finally {
      teardownPlayer();
      delete (store as { beginReadOnlyProjectSnapshot?: unknown }).beginReadOnlyProjectSnapshot;
      host.remove();
    }
  });

  it("exposes an idempotent repaired-project snapshot in the export store", () => {
    const original = createBlankProject();
    const repaired = structuredClone(original);
    repaired.startMapId = "repaired-start-map";
    setExportedProject(original);

    const release = exportProjectStore.beginReadOnlyProjectSnapshot(repaired);

    expect(exportProjectStore.getCurrent()).not.toBe(repaired);
    expect(exportProjectStore.getCurrent().startMapId).toBe("repaired-start-map");
    release();
    expect(exportProjectStore.getCurrent()).toBe(original);
    release();
    expect(exportProjectStore.getCurrent()).toBe(original);
  });

  it("does not let a stale failed run paint a recovery panel over a newer run", async () => {
    const firstBoot = deferred<FakeGame>();
    modeMocks.startPlayGame
      .mockImplementationOnce(() => firstBoot.promise)
      .mockResolvedValueOnce(fakeGame(5));

    await openTestPlayModal();
    const booted = nextBootSuccess();
    document.querySelector<HTMLButtonElement>("[data-testid='test-play-restart']")?.click();
    await booted;
    firstBoot.reject(new Error("늦게 도착한 실패"));
    await Promise.resolve();
    await Promise.resolve();

    expect(modeMocks.startPlayGame).toHaveBeenCalledTimes(2);
    expect(document.querySelector("[data-testid='play-recovery-panel']")).toBeNull();
  });

  it("refuses to boot Phaser and names the blocker when the project has no maps", async () => {
    const project = createBlankProject();
    project.maps = {};
    project.startMapId = "";
    store.replaceProject(project);
    const recovery = nextRecoveryPanel();

    await openTestPlayModal();
    await recovery;

    // 사람이 읽는 문구 대신 예비검사의 기계 코드를 박아 둔다.
    expect(recoveryReason()).toContain("no-maps");
    expect(modeMocks.startPlayGame).not.toHaveBeenCalled();
    // 안전 모드로도 뒤집질 수 없는 상태니 그 버튼을 내밀지 않는다.
    expect(document.querySelector("[data-testid='play-recovery-safe-mode']")).toBeNull();
    expect(document.querySelector("[data-testid='play-recovery-retry']")).not.toBeNull();
  });

  it("suppresses autonomous movement and auto-run events when safe mode is chosen", async () => {
    const project = createBlankProject();
    project.maps[project.startMapId]!.events = [autonomousAutoRunEvent()];
    store.replaceProject(project);
    let bootedTriggerKinds: readonly string[] = [];
    let bootedMovementType = "";
    modeMocks.startPlayGame
      .mockRejectedValueOnce(new Error("자동 실행 이벤트가 부팅을 잡아먹었습니다"))
      .mockImplementationOnce(async () => {
        const runtime = store.getCurrent();
        const booted = runtime.maps[runtime.startMapId]!.events[0]!;
        bootedTriggerKinds = [booted.trigger.kind, booted.pages![0]!.trigger.kind];
        bootedMovementType = booted.pages![0]!.movement.type;
        return fakeGame(5);
      });
    const recovery = nextRecoveryPanel();

    await openTestPlayModal();
    await recovery;
    const booted = nextBootSuccess();
    document.querySelector<HTMLButtonElement>("[data-testid='play-recovery-safe-mode']")?.click();
    await booted;

    expect(bootedTriggerKinds).toEqual(["action", "action"]);
    expect(bootedMovementType).toBe("fixed");
  });
});
