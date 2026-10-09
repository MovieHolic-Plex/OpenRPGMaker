import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionEvent, TurnResult } from "@/ai/assistantSession";
import type { RenderedToolImage } from "@/ai/toolImageRenderer";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { Project, TileGroupMetadata } from "@/project/types";
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
  renderToolImages: ReturnType<typeof vi.fn<(project: Project, toolName: string, data: unknown) => Promise<RenderedToolImage[]>>>;
  turns: TurnScript[];
}>(() => ({
  instances: [],
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
      getProposedProject: vi.fn(() => store.getCurrent()),
      rebaseProject: vi.fn(),
    };
    mocks.instances.push(session);
    return session;
  }),
  AGENT_RUN_MAX_TOTAL_STEPS: 48,
  METADATA_ONLY_TOOLS: new Set<string>(),
  proposalApprovalWarnings: (calls: readonly { readonly approvalWarning?: string }[]) => [
    ...new Set(calls.map((call) => call.approvalWarning).filter((warning): warning is string => typeof warning === "string" && warning.length > 0)),
  ],
  ruleToolRejectionText: () => null,
}));

vi.mock("@/ai/toolImageRenderer", () => ({
  renderToolImages: mocks.renderToolImages,
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

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  previousLocalStorage = globalThis.localStorage;
  storage = new MemoryStorage();
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    authMode: "apiKey",
    apiKey: "test-key",
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
  const project = createBlankProject();
  const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
  tileset.tileGroups = [makeFenceGroup()];
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId, selection: null });
  mocks.instances.length = 0;
  mocks.turns.length = 0;
  mocks.renderToolImages.mockReset();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  restoreWindow(previousWindow);
  restoreStorage(previousLocalStorage);
});

describe("cluster AI image-first modal", () => {
  it("renders two render_group_sample images as before-after stage cards", async () => {
    const data = {
      tilesetId: COMBINED_TOWN_TILESET_ID,
      samples: [
        { label: "수정 전", w: 1, h: 1, lower: [1], upper: [-1] },
        { label: "수정 후", w: 1, h: 1, lower: [2], upper: [-1] },
      ],
    };
    mocks.renderToolImages.mockResolvedValue([
      { dataUrl: "data:image/png;base64,before", label: "수정 전" },
      { dataUrl: "data:image/png;base64,after", label: "수정 후" },
    ]);
    mocks.turns.push((onEvent: (event: SessionEvent) => void) => {
      onEvent({ type: "tool_call", name: "render_group_sample", args: {}, result: { ok: true, summary: "비교 미리보기", data } });
      return emptyTurn;
    });

    openClusterAiModal({ kind: "cluster-edit", tilesetId: COMBINED_TOWN_TILESET_ID, groupId: "fence-main" });
    await flushAsync();

    const stage = requireTestId(document, "cluster-ai-stage");
    const beforeAfter = requireTestId(stage, "cluster-ai-beforeafter");
    expect(beforeAfter.querySelectorAll("img")).toHaveLength(2);
    expect(beforeAfter.textContent).toContain("수정 전");
    expect(beforeAfter.textContent).toContain("수정 후");
    const log = requireTestId(document, "cluster-ai-log");
    expect(log.textContent).toContain("완료 · 조립 미리보기 — 비교 미리보기");
    expect(log.textContent).not.toContain("render_group_sample");
    expect(mocks.renderToolImages).toHaveBeenCalledWith(store.getCurrent(), "render_group_sample", data);
  });

  it("maps internal tool image labels to user-facing captions", async () => {
    mocks.renderToolImages.mockResolvedValue([{ dataUrl: "data:image/png;base64,sample", label: "render_group_sample" }]);
    mocks.turns.push((onEvent: (event: SessionEvent) => void) => {
      onEvent({ type: "tool_call", name: "render_group_sample", args: {}, result: { ok: true, summary: "샘플 렌더" } });
      return emptyTurn;
    });

    openClusterAiModal({ kind: "cluster-edit", tilesetId: COMBINED_TOWN_TILESET_ID, groupId: "fence-main" });
    await flushAsync();

    const stage = requireTestId(document, "cluster-ai-stage");
    expect(stage.textContent).toContain("현재 모습");
    expect(stage.textContent).not.toContain("render_group_sample");
  });

  it("renders one tool image as a single large stage image", async () => {
    mocks.renderToolImages.mockResolvedValue([{ dataUrl: "data:image/png;base64,one", label: "타일 보기" }]);
    mocks.turns.push((onEvent: (event: SessionEvent) => void) => {
      onEvent({ type: "tool_call", name: "show_tiles", args: { tilesetId: COMBINED_TOWN_TILESET_ID, tiles: [1] }, result: { ok: true, summary: "타일 보기" } });
      return emptyTurn;
    });

    openClusterAiModal({ kind: "cluster-edit", tilesetId: COMBINED_TOWN_TILESET_ID, groupId: "fence-main" });
    await flushAsync();

    const stage = requireTestId(document, "cluster-ai-stage");
    expect(stage.querySelectorAll("img")).toHaveLength(1);
    expect(stage.querySelector("[data-testid='cluster-ai-beforeafter']")).toBeNull();
    expect(stage.textContent).toContain("타일 보기");
  });

  it("renders assistant choices and sends a clicked one as the next message", async () => {
    mocks.turns.push((onEvent: (event: SessionEvent) => void) => {
      onEvent({ type: "assistant_message", content: "어떻게 할까요? [선택지] 적용 | 다시 보기" });
      return { ...emptyTurn, assistantText: "어떻게 할까요? [선택지] 적용 | 다시 보기" };
    });
    mocks.turns.push(() => ({ ...emptyTurn, assistantText: "완료" }));

    openClusterAiModal({ kind: "cluster-edit", tilesetId: COMBINED_TOWN_TILESET_ID, groupId: "fence-main" });
    await flushAsync();
    const choices = testIdElements(document, "cluster-ai-choice");
    expect(choices).toHaveLength(2);
    choices[0]?.click();
    await flushAsync();

    expect(mocks.instances[0].sendUserMessage).toHaveBeenLastCalledWith("적용", expect.any(Function), expect.any(AbortSignal));
  });

  it("keeps long assistant prose as a single caption line", async () => {
    const longText = `첫 줄입니다.\n${"아주 긴 설명 ".repeat(40)}끝`;
    mocks.turns.push((onEvent: (event: SessionEvent) => void) => {
      onEvent({ type: "assistant_message", content: longText });
      return { ...emptyTurn, assistantText: longText };
    });

    openClusterAiModal({ kind: "cluster-edit", tilesetId: COMBINED_TOWN_TILESET_ID, groupId: "fence-main" });
    await flushAsync();

    const assistantBubble = assistantBubbles()[0];
    expect(assistantBubble?.textContent).not.toContain("\n");
    expect((assistantBubble?.textContent ?? "").length).toBeLessThan(longText.length);
    expect(assistantBubble?.textContent).toContain("...");
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

async function flushAsync(): Promise<void> {
  const turn = mocks.instances[0]?.sendUserMessage.mock.results.at(-1);
  if (!turn || turn.type !== "return") throw new Error("Missing cluster turn promise");
  const images = mocks.renderToolImages.mock.results.map(result => {
    if (result.type !== "return") throw new Error("Image producer did not return its completion");
    return result.value;
  });
  await Promise.all([turn.value, ...images]);
}

function assistantBubbles(): HTMLElement[] {
  return Array.from(document.querySelectorAll(".cluster-ai-bubble"))
    .filter((node): node is HTMLElement => node instanceof HTMLElement && node.className.includes("assistant"));
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

function restoreWindow(previous: (Window & typeof globalThis) | undefined): void {
  if (previous) {
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previous });
    return;
  }
  Reflect.deleteProperty(globalThis, "window");
}

function restoreStorage(previous: Storage | undefined): void {
  if (previous) {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: previous });
    return;
  }
  Reflect.deleteProperty(globalThis, "localStorage");
}
