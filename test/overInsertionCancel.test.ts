import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall, type TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearAgentGhostPreview, getAgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import type { ToolResult } from "@/editor/tools";
import type { ChangeSummary } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

let restoreDom: (() => void) | null = null;
let storage: MemoryStorage;

function diff(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
    ...overrides,
  };
}

function installBrowserGlobals(): void {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      location: { search: "?aiBridge=0", href: "http://localhost/?aiBridge=0" },
      dispatchEvent: vi.fn(),
      setTimeout: (handler: TimerHandler) => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      innerWidth: 1280,
      innerHeight: 800,
    },
  });
  Object.defineProperty(document, "addEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "removeEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
}

function renderPanel(): FakeElement {
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(),
    apiKey: "sk-test",
    authMode: "apiKey",
    baseUrl: "x",
    model: "m",
  }));
  return renderAiChatPanel({ clock: () => 1_000 }) as unknown as FakeElement;
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 25; i += 1) await Promise.resolve();
}

function turn(proposedCalls: ProposedCall[], assistantText = "완료"): TurnResult {
  return { assistantText, proposedCalls, stoppedReason: "final" };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  installBrowserGlobals();
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  resetMapEditHistory();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  clearAgentGhostPreview();
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("중간 검토 취소", () => {
  it("저장소를 그대로 두고 고스트를 치우며 적용 실패로 표기하지 않는다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const drafted = structuredClone(baseline);
    const result: ToolResult = { ok: true, summary: "이벤트 삭제", diff: diff({ eventsRemoved: 1 }) };
    const destructive: ProposedCall[] = [{
      name: "remove_event",
      args: { mapId, eventId: "ev1" },
      summary: "이벤트 삭제",
      result,
      destructive: true,
    }];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn(destructive));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(drafted));

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "이벤트 지워줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    const root = document.body as unknown as Parameters<typeof findByTestId>[0];
    const cancelButton = findByTestId(root, "app-modal-cancel");
    expect(cancelButton, "중간 확인 모달이 떠야 한다").not.toBeNull();
    cancelButton?.dispatchEvent(new Event("click"));
    await flushAsync();

    expect(store.getCurrent().meta.title).toBe(baseline.meta.title);
    expect(getAgentGhostPreviewState().previews).toHaveLength(0);
    expect(findByTestId(panel, "ai-status")?.textContent).toBe("대기");
    expect(findByTestId(panel, "ai-chat-log")?.textContent).not.toContain("적용 실패");
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("중간 검토에서 취소");
    expect(findByTestId(root, "app-confirm-modal")).toBeNull();
  });

  it("취소 뒤 다음 턴은 취소된 초안 위에 쌓지 않는다", async () => {
    const baseline = store.getCurrent();
    const drafted = structuredClone(baseline);
    drafted.meta.title = "cancelled-draft";
    const result: ToolResult = { ok: true, summary: "이벤트 삭제", diff: diff({ eventsRemoved: 1 }) };
    const destructive: ProposedCall[] = [{
      name: "remove_event",
      args: { mapId: baseline.startMapId, eventId: "ev1" },
      summary: "이벤트 삭제",
      result,
      destructive: true,
    }];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn(destructive));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(drafted));
    const rebaseSpy = vi.spyOn(AssistantSession.prototype, "rebaseProject");

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "이벤트 지워줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    const root = document.body as unknown as Parameters<typeof findByTestId>[0];
    const modalAtReview = findByTestId(root, "app-confirm-modal");
    expect(modalAtReview, "중간 확인 모달이 떠야 한다").not.toBeNull();
    const rebasesBeforeCancel = rebaseSpy.mock.calls.length;
    const cancelButton = findByTestId(root, "app-modal-cancel");
    if (!cancelButton) throw new Error("중간 확인 취소 버튼이 없다");
    cancelButton.dispatchEvent(new Event("click"));
    await flushAsync();

    expect(store.getCurrent().meta.title).toBe(baseline.meta.title);
    const cancelRebases = rebaseSpy.mock.calls.slice(rebasesBeforeCancel);
    expect(cancelRebases.length).toBe(1);
    expect(cancelRebases[0]?.[0]).toBe(store.getCurrent());
  });
});

