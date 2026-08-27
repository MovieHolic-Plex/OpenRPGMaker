import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall, type TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import type { ChatDock } from "@/editor/chatDock";
import { createProposalPin } from "@/editor/panels/aiProposalPin";
import { proposalAcceptButtonLabel } from "@/editor/panels/aiProposalFusion";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { ChangeSummary } from "@/editor/tools/types";
import type { ToolResult } from "@/editor/tools";
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

function changeSummary(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
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

function proposed(
  name: string,
  args: Record<string, unknown>,
  diff: Partial<ChangeSummary>,
  summary = `${name} summary`,
): ProposedCall {
  const result: ToolResult = { ok: true, summary, diff: changeSummary(diff) };
  return { name, args, summary, result, destructive: false };
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
      setTimeout: (handler: TimerHandler) => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  Object.defineProperty(document, "addEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "removeEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
}

function renderPanel(dock: ChatDock = "side"): FakeElement {
  // 이 파일은 대기 제안 카드/핀을 검증하므로 자동 적용을 명시적으로 끈다
  // (기본값은 승인 없이 즉시 적용 — approvalPolicy.resolveProposalApplyMode).
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test", baseUrl: "x", model: "m", agentMode: "chat", autoApprove: false }));
  return renderAiChatPanel({ clock: () => 1_000, getChatDock: () => dock }) as unknown as FakeElement;
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 25; i += 1) await Promise.resolve();
}

function turn(result: Partial<TurnResult>): TurnResult {
  return {
    assistantText: result.assistantText ?? "",
    proposedCalls: result.proposedCalls ?? [],
    stoppedReason: result.stoppedReason ?? "final",
    ...(result.error ? { error: result.error } : {}),
  };
}

async function renderPendingProposal(dock: ChatDock = "side"): Promise<FakeElement> {
  const mapId = store.getCurrent().startMapId;
  const calls = [proposed("paint_tiles", { mapId }, { tilesChanged: 1 }, "타일 1칸")];
  vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "초안입니다.", proposedCalls: calls }));
  vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
  const panel = renderPanel(dock);
  const input = findByTestId(panel, "ai-input") as FakeElement;
  input.value = "초안";
  findByTestId(panel, "ai-send")?.click();
  await flushAsync();
  return panel;
}

beforeEach(() => {
  restoreDom = installFakeDom();
  installBrowserGlobals();
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  resetMapEditHistory();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("proposalAcceptButtonLabel", () => {
  it("uses 이 맵에 넣기 when every item is selected", () => {
    // Break: default string is still 맵만 적용.
    expect(proposalAcceptButtonLabel(1, 1)).toBe("이 맵에 넣기");
  });

  it("uses 선택 N건 이 맵에 넣기 when the selection is partial", () => {
    // Break: partial string still ends with 맵만 적용.
    expect(proposalAcceptButtonLabel(1, 3)).toBe("선택 1개 이 맵에 넣기");
  });
});

describe("createProposalPin", () => {
  it("renders one command-row with summary, accept, and 취소", () => {
    // Break: pin module missing or omits the command-row accept/cancel pair.
    const accepted: number[] = [];
    const rejected: number[] = [];
    const pin = createProposalPin(
      { summary: "타일 1칸", selectedCount: 1, total: 1 },
      { onAccept: () => { accepted.push(1); }, onReject: () => { rejected.push(1); } },
    );

    expect(pin.dataset.testid).toBe("ai-proposal-pin");
    expect(pin.className.split(/\s+/)).toContain("ai-command-row");
    expect(pin.querySelector(".ai-command-prefix")?.textContent).toBe("@>");
    expect(pin.textContent).toContain("타일 1칸");
    expect(pin.textContent).toContain("이 맵에 넣기");
    expect(findByTestId(pin, "ai-proposal-reject")?.textContent).toBe("취소");
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it("click 취소 calls the reject path", () => {
    // Break: 취소 is missing or does not invoke onReject.
    const rejected: number[] = [];
    const pin = createProposalPin(
      { summary: "타일 1칸", selectedCount: 1, total: 1 },
      { onAccept: () => undefined, onReject: () => { rejected.push(1); } },
    );

    findByTestId(pin, "ai-proposal-reject")?.click();

    expect(rejected).toEqual([1]);
  });
});

describe("proposal pin on the work log", () => {
  it("side dock shows the decision card in the pin host instead of a compact pin", async () => {
    const panel = await renderPendingProposal("side");
    const card = findByTestId(panel, "ai-proposal-card");
    expect(findByTestId(panel, "ai-proposal-modal")?.hidden).toBe(true);
    expect(findByTestId(panel, "ai-proposal-pin")).toBeNull();
    expect(findByTestId(panel, "ai-proposal-pin-host")?.contains(card)).toBe(true);
  });

  it("click 취소 on the inline card discards the pending proposal", async () => {
    const panel = await renderPendingProposal("side");

    findByTestId(panel, "ai-proposal-reject")?.click();

    expect(findByTestId(panel, "ai-msg-badge-discarded")?.textContent).toBe("폐기됨");
    expect(findByTestId(panel, "ai-proposal-card")).toBeNull();
    expect(findByTestId(panel, "ai-proposal-pin")).toBeNull();
  });
});
