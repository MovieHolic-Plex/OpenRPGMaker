import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEvent, TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import type { ChangeSummary } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { Project, TileGroupMetadata } from "@/project/types";
import { installFakeDom } from "./fakeDom";

type MockSession = {
  readonly sendUserMessage: ReturnType<typeof vi.fn<(text: string, onEvent: (event: SessionEvent) => void) => Promise<TurnResult>>>;
  readonly getProposedProject: ReturnType<typeof vi.fn<() => Project>>;
  readonly rebaseProject: ReturnType<typeof vi.fn<(project: Project) => void>>;
};

const mocks = vi.hoisted<{
  constructorOptions: unknown[];
  instances: MockSession[];
  nextResult: TurnResult | null;
  proposedProject: Project | null;
  recordProjectSnapshot: ReturnType<typeof vi.fn>;
}>(() => ({
  constructorOptions: [],
  instances: [],
  nextResult: null,
  proposedProject: null,
  recordProjectSnapshot: vi.fn(),
}));

vi.mock("@/ai/assistantSession", () => ({
  AssistantSession: vi.fn().mockImplementation(function MockAssistantSession(_project: unknown, options: unknown) {
    mocks.constructorOptions.push(options);
    const session: MockSession = {
      sendUserMessage: vi.fn(async (_text: string, onEvent: (event: SessionEvent) => void) => {
        onEvent({ type: "assistant_token", delta: "확인했습니다. " });
        return mocks.nextResult ?? { assistantText: "완료", proposedCalls: [], stoppedReason: "final" };
      }),
      getProposedProject: vi.fn(() => mocks.proposedProject ?? store.getCurrent()),
      rebaseProject: vi.fn(),
    };
    mocks.instances.push(session);
    return session;
  }),
  METADATA_ONLY_TOOLS: new Set<string>(),
  proposalApprovalWarnings: (calls: readonly { readonly approvalWarning?: string }[]) => [
    ...new Set(calls.map((call) => call.approvalWarning).filter((warning): warning is string => typeof warning === "string" && warning.length > 0)),
  ],
  ruleToolRejectionText: () => null,
}));

vi.mock("@/editor/mapEditHistory", () => ({
  recordProjectSnapshot: mocks.recordProjectSnapshot,
}));

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

let restoreDom: (() => void) | null = null;
let previousWindow: (Window & typeof globalThis) | undefined;
let previousLocalStorage: Storage | undefined;
let storage: MemoryStorage;
let replaceSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  installDocumentEvents();
  previousWindow = globalThis.window;
  previousLocalStorage = globalThis.localStorage;
  storage = new MemoryStorage();
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    apiKey: "test-key",
    autoApprove: false,
    baseUrl: "https://example.test",
    maxTokens: 1024,
    model: "test-model",
    liteModel: "test-lite-model",
    reasoningEffort: "medium",
  }));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      confirm: () => true,
      localStorage: storage,
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  const project = createBlankProject();
  const tileset = project.tilesets[DEFAULT_TILESET_ID];
  tileset.tileGroups = [makeFenceGroup()];
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId, selection: null });
  mocks.instances.length = 0;
  mocks.constructorOptions.length = 0;
  mocks.nextResult = null;
  mocks.proposedProject = null;
  mocks.recordProjectSnapshot.mockReset();
  replaceSpy = null;
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  restoreWindow(previousWindow);
  restoreStorage(previousLocalStorage);
  replaceSpy?.mockRestore();
  replaceSpy = null;
});

describe("cluster AI modal", () => {
  it("opens a focused cluster dialog and sends the cluster-edit kickoff", async () => {
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await Promise.resolve();

    const modal = requireTestId(document, "cluster-ai-modal");
    expect(requireTestId(modal, "cluster-ai-dialog").getAttribute("role")).toBe("dialog");
    expect(modal.textContent).toContain("울타리");
    expect(modal.textContent).toContain("타일 3개");
    expect(requireTestId(modal, "cluster-ai-tile-1")).toBeTruthy();
    expect(mocks.instances).toHaveLength(1);
    expect(mocks.instances[0].sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("클러스터 수정"),
      expect.any(Function)
    );
    expect((mocks.constructorOptions[0] as { config?: { model?: string } }).config?.model).toBe("test-lite-model");
  });

  it("accepts proposed changes into the store and rebases the session", async () => {
    const proposed = createBlankProject();
    proposed.meta.title = "AI Proposed";
    mocks.proposedProject = proposed;
    mocks.nextResult = {
      assistantText: "변경안을 만들었습니다. [선택지] 적용 | 더 다듬기",
      proposedCalls: [{
        args: { groupId: "fence-main" },
        destructive: false,
        name: "upsert_tile_group",
        result: { ok: true, summary: "울타리 묶음 수정", diff: changeSummary() },
        summary: "울타리 묶음 수정",
      }],
      stoppedReason: "final",
    };
    replaceSpy = vi.spyOn(store, "replace");

    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await Promise.resolve();
    requireTestId(document, "cluster-ai-accept").click();

    expect(recordProjectSnapshot).toHaveBeenCalledWith("클러스터 수정: 울타리", store.getCurrent().startMapId);
    expect(replaceSpy).toHaveBeenCalledWith(proposed);
    expect(mocks.instances[0].rebaseProject).toHaveBeenCalledWith(store.getCurrent());
  });

  it("closes from Escape, backdrop, and close button", async () => {
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    dispatchDocumentKey("Escape");
    expect(document.querySelector("[data-testid='cluster-ai-modal']")).toBeNull();

    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    requireTestId(document, "cluster-ai-modal").click();
    expect(document.querySelector("[data-testid='cluster-ai-modal']")).toBeNull();

    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    requireTestId(document, "cluster-ai-modal-close").click();
    expect(document.querySelector("[data-testid='cluster-ai-modal']")).toBeNull();
  });

  it("opens unclassified analysis mode and sends that kickoff", async () => {
    openClusterAiModal({ kind: "unclassified-analysis", tilesetId: DEFAULT_TILESET_ID, sampleTiles: [4, 5, 6], total: 14 });
    await Promise.resolve();

    const modal = requireTestId(document, "cluster-ai-modal");
    expect(modal.textContent).toContain("미분류 타일 분석");
    expect(modal.textContent).toContain("14개");
    expect(requireTestId(modal, "cluster-ai-tile-4")).toBeTruthy();
    expect(mocks.instances[0].sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("미분류 분석"),
      expect.any(Function)
    );
  });
});

function makeFenceGroup(): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "나무 울타리",
    id: "fence-main",
    name: "울타리",
    placementRules: "경계선에 배치",
    role: "fence",
    tileIds: [1, 2, 3],
  };
}

function changeSummary(): ChangeSummary {
  return {
    dbRecordsChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    sessionChanged: false,
    switchesAdded: 0,
    systemChanged: false,
    tilesChanged: 0,
    tilesetsChanged: 1,
    variablesAdded: 0,
    warnings: [],
  };
}

function requireTestId(root: ParentNode, testId: string): HTMLElement {
  const element = root.querySelector(`[data-testid="${testId}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${testId}`);
  return element;
}

function installDocumentEvents(): void {
  const listeners = new Map<string, EventListener[]>();
  Object.assign(document, {
    addEventListener: (type: string, listener: EventListener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener));
    },
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return !event.defaultPrevented;
    },
  });
}

function dispatchDocumentKey(key: string): void {
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: key });
  document.dispatchEvent(event);
}

function restoreWindow(windowValue: (Window & typeof globalThis) | undefined): void {
  if (windowValue === undefined) {
    Reflect.deleteProperty(globalThis, "window");
    return;
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: windowValue,
  });
}

function restoreStorage(storageValue: Storage | undefined): void {
  if (storageValue === undefined) {
    Reflect.deleteProperty(globalThis, "localStorage");
    return;
  }
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: storageValue,
  });
}
