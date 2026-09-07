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
import type { Project } from "@/project/types";
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

/**
 * 독립 검수를 통과한 후보를 모델링한다. fake 세션의 getProposedProject가 돌려주는
 * 초안이 곧 검수 승인본이므로, 실제 적용 경로의 승인 확인(isDraftReviewApproved)과
 * 불변 베이스라인(stale) 검사는 그대로 탄다 — 검수를 끄거나 베이스라인을
 * 다시 캡처하지 않는다. 승인은 캡처한 후보 스냅샷과 일치할 때만 성립한다.
 */
function reviewedTurn(proposedCalls: ProposedCall[], assistantText = "완료"): TurnResult {
  return {
    ...turn(proposedCalls, assistantText),
    review: { status: "approved", revision: 1, summary: "독립 검수 승인", findings: [] },
  };
}

function mockReviewedDraftApproval(approved: Project): void {
  const identity = JSON.stringify(approved);
  vi.spyOn(AssistantSession.prototype, "isDraftReviewApproved").mockImplementation(function (
    this: AssistantSession,
    candidate?: Project,
  ): boolean {
    const current = candidate ?? this.getProposedProject();
    return JSON.stringify(current) === identity;
  });
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

// 확인 팝업 없음(2026-09 정책): 파괴·대량 변경도 모달 없이 바로 적용하고 복구는 되돌리기다.
describe("과삽입 자동 적용", () => {
  it("파괴적 변경도 확인 모달 없이 적용하고 모달 잔재를 남기지 않는다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const drafted = structuredClone(baseline);
    drafted.meta.title = "applied:remove_event";
    const result: ToolResult = { ok: true, summary: "이벤트 삭제", diff: diff({ eventsRemoved: 1 }) };
    const destructive: ProposedCall[] = [{
      name: "remove_event",
      args: { mapId, eventId: "ev1" },
      summary: "이벤트 삭제",
      result,
      destructive: true,
    }];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(reviewedTurn(destructive));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(drafted));
    mockReviewedDraftApproval(drafted);

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "이벤트 지워줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    const root = document.body as unknown as Parameters<typeof findByTestId>[0];

    expect(findByTestId(root, "app-confirm-modal"), "확인 모달이 뜨면 안 된다").toBeNull();
    expect(store.getCurrent().meta.title).toBe("applied:remove_event");
    expect(getAgentGhostPreviewState().previews).toHaveLength(0);
    expect(findByTestId(panel, "ai-status")?.textContent).toBe("대기");
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("확인 없이 적용");
  });

  it("적용 뒤 다음 턴은 새 기준 위에서 시작한다", async () => {
    const drafted = structuredClone(store.getCurrent());
    drafted.meta.title = "applied:remove_event";
    const result: ToolResult = { ok: true, summary: "이벤트 삭제", diff: diff({ eventsRemoved: 1 }) };
    const destructive: ProposedCall[] = [{
      name: "remove_event",
      args: { mapId: store.getCurrent().startMapId, eventId: "ev1" },
      summary: "이벤트 삭제",
      result,
      destructive: true,
    }];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(reviewedTurn(destructive));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(drafted));
    mockReviewedDraftApproval(drafted);
    const rebaseSpy = vi.spyOn(AssistantSession.prototype, "rebaseProject");

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "이벤트 지워줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    const root = document.body as unknown as Parameters<typeof findByTestId>[0];

    expect(findByTestId(root, "app-confirm-modal"), "확인 모달이 뜨면 안 된다").toBeNull();
    expect(store.getCurrent().meta.title).toBe("applied:remove_event");
    expect(rebaseSpy).toHaveBeenCalled();
    expect(rebaseSpy.mock.calls.at(-1)?.[0]).toBe(store.getCurrent());
  });
});

