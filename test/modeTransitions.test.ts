import { afterEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

class TestElement {
  className = "";
  readonly children: TestElement[] = [];

  constructor(readonly tagName: string) {}

  get firstChild(): TestElement | null {
    return this.children[0] ?? null;
  }

  append(...nodes: TestElement[]): void {
    this.children.push(...nodes);
  }

  removeChild(node: TestElement): void {
    const index = this.children.indexOf(node);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
  }
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  if (!resolvePromise) {
    throw new Error("deferred resolver was not initialized");
  }
  return { promise, resolve: resolvePromise };
}

function installDocument(): void {
  vi.stubGlobal("document", {
    createElement: (tagName: string) => new TestElement(tagName),
  });
}

describe("mode transitions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("mounts play when a newer same-mode request overlaps an in-flight switch", async () => {
    installDocument();
    const playerModuleGate = deferred<{
      readonly renderPlayer: (parent: HTMLElement) => void;
      readonly teardownPlayer: () => void;
    }>();
    const renderEditor = vi.fn();
    const teardownEditor = vi.fn();
    const renderPlayer = vi.fn((parent: HTMLElement) => {
      const surface = document.createElement("div");
      surface.className = "play-surface";
      parent.append(surface);
    });
    const teardownPlayer = vi.fn();

    vi.doMock("@/project/store", () => ({
      store: {
        load: vi.fn(async () => {}),
        getCurrent: vi.fn(() => ({ startMapId: "map_town" })),
      },
    }));
    vi.doMock("@/editor/editorState", () => ({
      editorState: {
        set: vi.fn(),
      },
    }));
    vi.doMock("@/editor/panels/menu", () => ({
      renderTopbar: vi.fn(),
    }));
    vi.doMock("@/app/perfMetrics", () => ({
      markInitialEditRender: vi.fn(),
      markModeSwitch: vi.fn(),
      mountPerfMetrics: vi.fn(),
    }));
    vi.doMock("@/editor/panels/editor", () => ({
      renderEditor,
      teardownEditor,
    }));
    vi.doMock("@/player/player", async () => {
      await playerModuleGate.promise;
      return {
        renderPlayer,
        teardownPlayer,
      };
    });

    const { bootApp, enterMode } = await import("@/app/mode");
    const root = document.createElement("div");
    await bootApp(root);

    const firstSwitch = enterMode("play");
    await vi.waitFor(() => {
      expect(teardownEditor).toHaveBeenCalledTimes(1);
    });

    const secondSwitch = enterMode("play");
    playerModuleGate.resolve({ renderPlayer, teardownPlayer });
    await Promise.all([firstSwitch, secondSwitch]);

    expect(renderPlayer).toHaveBeenCalledTimes(1);
    const playParent = renderPlayer.mock.calls[0]?.[0];
    expect(playParent?.children.length).toBe(1);
    expect(playParent?.children[0]?.className).toBe("play-surface");
  });
});
