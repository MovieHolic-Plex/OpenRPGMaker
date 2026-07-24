/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";

const fakePlayScene = vi.hoisted(() => class FakePlayScene {});

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
    getCurrent: vi.fn(() => createBlankProject()),
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

describe("player Phaser boot contract", () => {
  beforeEach(() => {
    fakePhaser.reset();
  });

  afterEach(() => {
    vi.resetModules();
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
