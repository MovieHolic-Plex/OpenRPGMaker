import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEvent, TurnResult } from "@/ai/assistantSession";
import type { RenderedToolImage } from "@/ai/toolImageRenderer";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import type { ChangeSummary } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { installFakeDom } from "./fakeDom";

type MockSession = {
  readonly sendUserMessage: ReturnType<typeof vi.fn<(text: string, onEvent: (event: SessionEvent) => void) => Promise<TurnResult>>>;
  readonly getProposedProject: ReturnType<typeof vi.fn<() => Project>>;
  readonly rebaseProject: ReturnType<typeof vi.fn<(project: Project) => void>>;
};

type TurnScript = (onEvent: (event: SessionEvent) => void) => TurnResult | Promise<TurnResult>;

const emptyTurn: TurnResult = { assistantText: "", proposedCalls: [], stoppedReason: "final" };

const mocks = vi.hoisted<{
  instances: MockSession[];
  proposedProject: Project | null;
  recordProjectSnapshot: ReturnType<typeof vi.fn>;
  renderToolImages: ReturnType<typeof vi.fn<(project: Project, toolName: string, data: unknown) => Promise<RenderedToolImage[]>>>;
  turns: TurnScript[];
}>(() => ({
  instances: [],
  proposedProject: null,
  recordProjectSnapshot: vi.fn(),
  renderToolImages: vi.fn(),
  turns: [],
}));

vi.mock("@/ai/assistantSession", () => ({
  AssistantSession: vi.fn().mockImplementation(function MockAssistantSession() {
    const session: MockSession = {
      sendUserMessage: vi.fn(async (_text: string, onEvent: (event: SessionEvent) => void) => {
        const nextTurn = mocks.turns.shift();
        return nextTurn ? nextTurn(onEvent) : emptyTurn;
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

vi.mock("@/ai/toolImageRenderer", () => ({
  renderToolImages: mocks.renderToolImages,
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
let replaceSpy: ReturnType<typeof vi.spyOn> | null = null;
let storage: MemoryStorage;

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
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  mocks.instances.length = 0;
  mocks.turns.length = 0;
  mocks.proposedProject = null;
  mocks.recordProjectSnapshot.mockReset();
  mocks.renderToolImages.mockReset();
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

describe("cluster AI range-classify modal", () => {
  it("opens range classify mode and sends the range-classify kickoff", async () => {
    openClusterAiModal({
      kind: "range-classify",
      rect: { x: 2, y: 3, w: 4, h: 2 },
      tileIds: [10, 11, 12, 13, 14, 15, 16, 17],
      tilesetId: DEFAULT_TILESET_ID,
    });
    await flushAsync();

    const modal = requireTestId(document, "cluster-ai-modal");
    const input = requireTestId(modal, "cluster-ai-input");
    expect(modal.textContent).toContain("범위 분류 — 8개 타일");
    expect(input.getAttribute("rows")).toBe("3");
    expect(mocks.instances).toHaveLength(1);
    expect(mocks.instances[0]?.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("suggest_group_from_range"),
      expect.any(Function)
    );
    const kickoff = mocks.instances[0]?.sendUserMessage.mock.calls[0]?.[0] ?? "";
    expect(kickoff).toContain("render_group_sample");
    expect(kickoff).toContain("upsert_tile_group");
    expect(kickoff).toContain("이 분류로 저장");
    expect(kickoff).toContain("\"w\": 4");
  });

  it("enters suggest/image/one-tap flow and accepts the upsert proposal", async () => {
    const previewData = { tilesetId: DEFAULT_TILESET_ID, tileIds: [20, 21, 22, 23] };
    const proposed = createBlankProject();
    proposed.meta.title = "Range Classified";
    mocks.proposedProject = proposed;
    mocks.renderToolImages.mockResolvedValue([{ dataUrl: "data:image/png;base64,range", label: "범위 미리보기" }]);
    mocks.turns.push((onEvent: (event: SessionEvent) => void) => {
      onEvent({
        args: { rect: { x: 5, y: 6, w: 2, h: 2 }, tilesetId: DEFAULT_TILESET_ID },
        name: "suggest_group_from_range",
        result: { ok: true, summary: "성벽 분류 초안", data: { name: "성벽", role: "wall" } },
        type: "tool_call",
      });
      onEvent({
        args: {},
        name: "render_group_sample",
        result: { ok: true, summary: "조립 이미지", data: previewData },
        type: "tool_call",
      });
      onEvent({ content: "성벽 묶음으로 보입니다. [선택지] 이 분류로 저장 | 이름 바꿔 | 역할 바꿔 | 다시", type: "assistant_message" });
      return { ...emptyTurn, assistantText: "성벽 묶음으로 보입니다. [선택지] 이 분류로 저장 | 이름 바꿔 | 역할 바꿔 | 다시" };
    });
    mocks.turns.push(() => ({
      assistantText: "저장 제안입니다.",
      proposedCalls: [{
        args: {
          name: "성벽",
          role: "wall",
          sourceRect: { height: 2, width: 2, x: 5, y: 6 },
          tileIds: [20, 21, 22, 23],
          tilesetId: DEFAULT_TILESET_ID,
        },
        destructive: false,
        name: "upsert_tile_group",
        result: { diff: changeSummary(), ok: true, summary: "성벽 그룹 생성" },
        summary: "성벽 그룹 생성",
      }],
      stoppedReason: "final",
    }));
    replaceSpy = vi.spyOn(store, "replace");

    openClusterAiModal({
      kind: "range-classify",
      rect: { x: 5, y: 6, w: 2, h: 2 },
      tileIds: [20, 21, 22, 23],
      tilesetId: DEFAULT_TILESET_ID,
    });
    await flushAsync();

    const stage = requireTestId(document, "cluster-ai-stage");
    expect(stage.querySelectorAll("img")).toHaveLength(1);
    expect(mocks.renderToolImages).toHaveBeenCalledWith(store.getCurrent(), "render_group_sample", previewData);
    const choices = testIdElements(document, "cluster-ai-choice");
    expect(choices.map((choice) => choice.textContent)).toEqual(["이 분류로 저장", "이름 바꿔", "역할 바꿔", "다시"]);

    choices[0]?.click();
    await flushAsync();
    expect(mocks.instances[0]?.sendUserMessage).toHaveBeenLastCalledWith("이 분류로 저장", expect.any(Function));
    requireTestId(document, "cluster-ai-accept").click();

    expect(recordProjectSnapshot).toHaveBeenCalledWith("클러스터 수정: 범위 분류 — 4개 타일", store.getCurrent().startMapId);
    expect(replaceSpy).toHaveBeenCalledWith(proposed);
    expect(mocks.instances[0]?.rebaseProject).toHaveBeenCalledWith(store.getCurrent());
  });

  it("keeps the textarea sized for multi-line input", async () => {
    openClusterAiModal({
      kind: "range-classify",
      rect: { x: 1, y: 1, w: 1, h: 1 },
      tileIds: [1],
      tilesetId: DEFAULT_TILESET_ID,
    });
    await flushAsync();

    const input = requireTestId(document, "cluster-ai-input");
    expect(input.getAttribute("rows")).toBe("3");
    expect(input.className).toContain("cluster-ai-input");
  });
});

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    warnings: [],
  };
}

function requireTestId(root: ParentNode, testId: string): HTMLElement {
  const element = root.querySelector(`[data-testid="${testId}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${testId}`);
  return element;
}

function testIdElements(root: ParentNode, testId: string): HTMLElement[] {
  return Array.from(root.querySelectorAll(`[data-testid="${testId}"]`))
    .filter((node): node is HTMLElement => node instanceof HTMLElement);
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
