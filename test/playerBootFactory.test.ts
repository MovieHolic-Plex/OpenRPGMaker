/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";

const fakePlayScene = vi.hoisted(() => class FakePlayScene {});

const fakeProjectStore = vi.hoisted(() => ({
  current: undefined as ReturnType<typeof createBlankProject> | undefined,
}));

const fakePhaser = vi.hoisted(() => {
  type BootConfig = {
    readonly type: number;
    readonly parent: HTMLElement;
    readonly backgroundColor: string;
    readonly roundPixels: boolean;
    readonly antialias: boolean;
    readonly pixelArt: boolean;
    readonly scale: {
      readonly mode: number;
      readonly width: number;
      readonly height: number;
      readonly parent: HTMLElement;
    };
    readonly scene: readonly unknown[];
    readonly callbacks?: {
      readonly preBoot?: (game: FakeGame) => void;
    };
  };

  const games: FakeGame[] = [];
  const constructorRegistrySnapshots: ReadonlyMap<string, unknown>[] = [];
  let observeRegistryDuringConstruction = false;

  class FakeGame {
    readonly registryValues = new Map<string, unknown>();
    readonly destroyCalls: boolean[] = [];
    readonly registry = {
      get: (key: string): unknown => this.registryValues.get(key),
      set: (key: string, value: unknown): void => {
        this.registryValues.set(key, value);
      },
    };

    constructor(readonly config: BootConfig) {
      games.push(this);
      config.callbacks?.preBoot?.(this);
      if (observeRegistryDuringConstruction) {
        constructorRegistrySnapshots.push(new Map(this.registryValues));
      }
    }

    destroy(removeCanvas: boolean): void {
      this.destroyCalls.push(removeCanvas);
    }
  }

  return {
    AUTO: 10,
    NONE: 20,
    FakeGame,
    constructorRegistrySnapshots,
    games,
    reset: (): void => {
      games.length = 0;
      constructorRegistrySnapshots.length = 0;
      observeRegistryDuringConstruction = false;
    },
    setObserveRegistryDuringConstruction: (value: boolean): void => {
      observeRegistryDuringConstruction = value;
    },
  };
});

vi.mock("@/app/phaserRuntime", () => ({
  ensurePhaser: vi.fn(async () => ({
    AUTO: fakePhaser.AUTO,
    Scale: { NONE: fakePhaser.NONE },
    Game: fakePhaser.FakeGame,
  })),
}));

vi.mock("@/player/PlayScene", () => ({ PlayScene: fakePlayScene }));
vi.mock("@/project/store", () => ({
  DbConnectionRequiredError: class DbConnectionRequiredError extends Error {},
  store: {
    getCurrent: vi.fn(() => fakeProjectStore.current ?? createBlankProject()),
    load: vi.fn(async () => undefined),
  },
}));
vi.mock("@/editor/editorState", () => ({
  editorState: { set: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("@/app/perfMetrics", () => ({
  markInitialEditRender: vi.fn(),
  markModeSwitch: vi.fn(),
  mountPerfMetrics: vi.fn(),
}));
vi.mock("@/editor/mapEditHistory", () => ({
  MAP_EDIT_HISTORY_EVENT: "test-map-edit-history",
}));
vi.mock("@/editor/editorUiMode", () => ({
  subscribeEditorUiMode: vi.fn(),
}));

type StartPlayGame = typeof import("@/app/mode").startPlayGame;

async function loadAdapters(): Promise<readonly StartPlayGame[]> {
  const editor = await import("@/app/mode");
  const exported = await import("@/player/exportAppModeShim");
  return [editor.startPlayGame, exported.startPlayGame];
}

// 이 묶음은 테스트마다 vi.resetModules() 로 모듈 그래프를 버리고 @/app/mode 를 다시
// import 했다. 그 재임포트가 CPU 경합 아래에서 **영구 교착**했다 — 실측(프로브): 테스트 본문
// 시작 직후 `await import("@/app/mode")` 에서 60.6초 동안 아무 단계도 진행되지 않았고
// (SUT 는 진입조차 못 했다) 타임아웃 뒤 남은 테스트는 정상 속도로 통과했다. 같은 실행의 다른
// 테스트가 한가할 때와 같은 시간(5.6s/1.0s/0.6s)이었으므로 느려짐이 아니라 교착이다.
// 5중 동시 실행에서 2/5 재현.
//
// 그래서 그래프를 한 번만 import 하고, 테스트 사이에는 **모듈이 들고 있는 상태만** 명시적으로
// 되돌린다(각 어댑터의 destroyGame() 이 자기 싱글턴을 null 로 만든다). 재임포트가 없으므로
// 교착 창이 사라지고, 반복 transform 비용도 없어진다.
//
// 상한을 따로 두는 이유: 첫 테스트가 그래프 초기 import 비용을 혼자 낸다(한가할 때 5.4s,
// 공용 머신 부하에서 17s). 전역 testTimeout(15s)으로는 그 한 번이 부하에서 넘치고, 넘긴
// 테스트의 남은 startPlayGame 이 뒤늦게 게임을 밀어 넣어 다음 테스트의 개수 단정까지 무너뜨렸다.
describe("player Phaser boot contract", { timeout: 60_000 }, () => {
  beforeEach(() => {
    fakePhaser.reset();
    fakeProjectStore.current = undefined;
  });

  afterEach(async () => {
    // 두 어댑터의 모듈 싱글턴을 비운다. destroyGame() 이 fake 게임에 destroy 기록을 남기지만
    // 다음 beforeEach 의 fakePhaser.reset() 이 배열을 비우므로 단정에 새지 않는다.
    const [editor, exported] = await Promise.all([
      import("@/app/mode"),
      import("@/player/exportAppModeShim"),
    ]);
    editor.destroyGame();
    exported.destroyGame();
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  it("keeps editor and export Phaser config and registry contracts identical", async () => {
    // Given
    const parent = document.createElement("div");
    const initialSession = startSession(createBlankProject());
    const onPlayLoadProgress = vi.fn();
    const onPlayLoadStage = vi.fn();
    const onPlaySceneReady = vi.fn();
    const adapters = await loadAdapters();

    // When
    for (const startPlayGame of adapters) {
      await startPlayGame(parent, initialSession, {
        initialEventTestId: "event_intro",
        onPlayLoadProgress,
        onPlayLoadStage,
        onPlaySceneReady,
      });
    }

    // Then
    expect(fakePhaser.games).toHaveLength(2);
    for (const game of fakePhaser.games) {
      expect(game.config).toMatchObject({
        type: fakePhaser.AUTO,
        parent,
        backgroundColor: "#000",
        roundPixels: true,
        antialias: false,
        pixelArt: true,
        scale: {
          mode: fakePhaser.NONE,
          width: 320,
          height: 240,
          parent,
        },
        scene: [fakePlayScene],
      });
      expect([...game.registryValues.entries()]).toEqual([
        ["initialSession", initialSession],
        ["initialEventTestId", "event_intro"],
        ["onPlayLoadProgress", onPlayLoadProgress],
        ["onPlayLoadStage", onPlayLoadStage],
        ["onPlaySceneReady", onPlaySceneReady],
      ]);
    }
  });

  it("boots Phaser with the current project's authored play resolution", async () => {
    // Break named: the shared player factory currently ignores project.system.playResolution.
    const project = createBlankProject();
    project.system.playResolution = { width: 640, height: 360 };
    fakeProjectStore.current = project;
    const parent = document.createElement("div");
    const adapters = await loadAdapters();

    for (const startPlayGame of adapters) await startPlayGame(parent);

    expect(fakePhaser.games).toHaveLength(2);
    for (const game of fakePhaser.games) {
      expect(game.config.scale).toMatchObject({ width: 640, height: 360 });
    }
  });

  it("installs every boot value before PlayScene preload and create can observe the registry", async () => {
    // Given
    const parent = document.createElement("div");
    const initialSession = startSession(createBlankProject());
    const onPlayLoadProgress = vi.fn();
    const onPlayLoadStage = vi.fn();
    const onPlaySceneReady = vi.fn();
    const adapters = await loadAdapters();
    fakePhaser.setObserveRegistryDuringConstruction(true);

    // When
    for (const startPlayGame of adapters) {
      await startPlayGame(parent, initialSession, {
        initialEventTestId: "event_intro",
        onPlayLoadProgress,
        onPlayLoadStage,
        onPlaySceneReady,
      });
    }

    // Then
    expect(fakePhaser.constructorRegistrySnapshots).toHaveLength(2);
    for (const registry of fakePhaser.constructorRegistrySnapshots) {
      expect([...registry.entries()]).toEqual([
        ["initialSession", initialSession],
        ["initialEventTestId", "event_intro"],
        ["onPlayLoadProgress", onPlayLoadProgress],
        ["onPlayLoadStage", onPlayLoadStage],
        ["onPlaySceneReady", onPlaySceneReady],
      ]);
    }
  });

  it("routes editor and export construction through the same player-owned factory", async () => {
    // Given
    const parent = document.createElement("div");
    const factory = await import("@/player/createPlayGame");
    const createPlayGame = vi.spyOn(factory, "createPlayGame");
    const adapters = await loadAdapters();

    // When
    for (const startPlayGame of adapters) {
      await startPlayGame(parent);
    }

    // Then
    expect(createPlayGame).toHaveBeenCalledTimes(2);
    // 모듈 그래프를 공유하므로 스파이를 여기서 되돌린다 — 안 되돌리면 다음 테스트가
    // 패치된 네임스페이스를 물려받는다(예전에는 resetModules 가 대신 버려 줬다).
    createPlayGame.mockRestore();
  });

  it("keeps an untracked modal game outside editor global destroy ownership", async () => {
    // Given
    const parent = document.createElement("div");
    const editor = await import("@/app/mode");
    const trackedGame = await editor.startPlayGame(parent);
    const untrackedGame = await editor.startPlayGame(parent, undefined, {
      trackGlobalGame: false,
    });

    // When
    untrackedGame.destroy(true);

    // Then
    expect(editor.getGame()).toBe(trackedGame);
    expect(fakePhaser.games[0]?.destroyCalls).toEqual([]);
    expect(fakePhaser.games[1]?.destroyCalls).toEqual([true]);
    expect(trackedGame).not.toBe(untrackedGame);
  });

  it("destroys the editor-owned game only once across repeated teardown", async () => {
    // Given
    const parent = document.createElement("div");
    const editor = await import("@/app/mode");
    await editor.startPlayGame(parent);

    // When
    editor.destroyGame();
    editor.destroyGame();

    // Then
    expect(editor.getGame()).toBeNull();
    expect(fakePhaser.games[0]?.destroyCalls).toEqual([true]);
  });

  it("tracks a fresh editor game after teardown and re-entry", async () => {
    // Given
    const parent = document.createElement("div");
    const editor = await import("@/app/mode");
    await editor.startPlayGame(parent);
    editor.destroyGame();

    // When
    const reenteredGame = await editor.startPlayGame(parent);

    // Then
    expect(editor.getGame()).toBe(reenteredGame);
    expect(fakePhaser.games[0]?.destroyCalls).toEqual([true]);
    expect(fakePhaser.games[1]?.destroyCalls).toEqual([]);
  });

  it("honors untracked export games without replacing the shim-owned game", async () => {
    // Given
    const parent = document.createElement("div");
    const exported = await import("@/player/exportAppModeShim");
    await exported.startPlayGame(parent);
    await exported.startPlayGame(parent, undefined, { trackGlobalGame: false });

    // When
    exported.destroyGame();
    exported.destroyGame();

    // Then
    expect(fakePhaser.games[0]?.destroyCalls).toEqual([true]);
    expect(fakePhaser.games[1]?.destroyCalls).toEqual([]);
  });
});
