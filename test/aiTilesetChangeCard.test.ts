// 칩셋 계열 변경 질문 카드(aiTilesetChangeCard) — 패널 하네스(모델 호출 없음).
// 조수가 ask_tileset_change 로 물으면 Pi 턴 끝에 카드가 뜨고, 승인은 대화 승인 목록 + 후속 요청, 거절은 후속 요청만 만든다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearConversations } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { runPiCommand, type PiCommandSurface } from "@/editor/panels/aiPiAgentCommand";
import { tilesetChangeFollowUp, tilesetQuestionFromEvent } from "@/editor/panels/aiTilesetChangeCard";
import { resetAiWorkStripForTest } from "@/editor/panels/aiWorkStrip";
import type { TilesetChangeQuestion } from "@/editor/tools/tilesetChangeTools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/editor/panels/aiPiAgentCommand", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiPiAgentCommand")>()),
  runPiCommand: vi.fn(async () => true),
}));
vi.mock("@/ai/intentDeclarationClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ai/intentDeclarationClient")>()),
  declareIntentCached: vi.fn(async () =>
    ({ intent: { mode: "other", source: "llm", needsPlan: false, clarify: null, tools: [] }, elapsedMs: 1 }) as never),
}));

const QUESTION: TilesetChangeQuestion = {
  kind: "tileset-change-question", mapId: "map_blank_start",
  fromTilesetId: "forest_harmony", toTilesetId: "opengameart_castle",
  fromFamily: "easyrpg", toFamily: "castle", fromLabel: "EasyRPG", toLabel: "성채",
  reason: "성 안을 만들려면 성채 타일이 필요해요.", purpose: null,
};

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  vi.mocked(runPiCommand).mockReset();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: "map_blank_start", selection: null });
  restoreDom = installFakeDom();
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
  vi.stubGlobal("window", { addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true });
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, String(value)),
    removeItem: (key: string) => void storage.delete(key),
    clear: () => storage.clear(),
  });
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(defaultAiConfig()));
});

afterEach(async () => {
  teardownAiChatPanel();
  resetAiWorkStripForTest();
  await clearConversations();
  restoreDom?.();
  restoreDom = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const composer = (panel: FakeElement) => findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
const surfaceOf = (call: number): PiCommandSurface => vi.mocked(runPiCommand).mock.calls[call]![1];
async function waitForCalls(count: number): Promise<void> {
  await vi.waitFor(() => expect(vi.mocked(runPiCommand).mock.calls.length).toBeGreaterThanOrEqual(count), { timeout: 5_000, interval: 5 });
}

/** 첫 턴: 조수가 ask_tileset_change 로 물었다. 이후 턴은 아무 일도 없이 끝난다. */
async function askedPanel(): Promise<FakeElement> {
  vi.mocked(runPiCommand).mockImplementationOnce(async (_command, surface) => {
    surface.onTilesetChangeQuestion?.(QUESTION);
    return true;
  });
  const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
  composer(panel).value = "성 안을 만들어 줘";
  findByTestId(panel, "ai-send")?.click();
  await waitForCalls(1);
  await vi.waitFor(() => expect(findByTestId(panel, "ai-tileset-change-card")).toBeTruthy(), { timeout: 5_000, interval: 5 });
  return panel;
}

describe("질문 이벤트 꺼내기", () => {
  it("성공한 ask_tileset_change tool_end 의 data 를 꺼내고, 팀 포장도 푼다", () => {
    const end = { type: "tool_end", id: "t1", name: "ask_tileset_change", ok: true, summary: "물었다", result: { ok: true, summary: "물었다", data: QUESTION } } as const;
    expect(tilesetQuestionFromEvent(end)).toEqual(QUESTION);
    expect(tilesetQuestionFromEvent({ type: "agent_event", agentId: "a", event: end } as never)).toEqual(QUESTION);
    expect(tilesetQuestionFromEvent({ ...end, ok: false })).toBeNull();
    expect(tilesetQuestionFromEvent({ ...end, name: "paint_tiles" })).toBeNull();
  });

  it("후속 요청 문장", () => {
    expect(tilesetChangeFollowUp(QUESTION, true)).toBe("[사용자 승인] 칩셋 계열 변경 허용: EasyRPG → 성채. 원래 요청을 이어서 하라.");
    expect(tilesetChangeFollowUp(QUESTION, false)).toBe("[사용자 거절] EasyRPG 계열 안에서만 만들어라. 이 계열로 못 만드는 부분은 무엇이 부족한지 말하라.");
  });
});

describe("질문 카드", () => {
  it("턴 결과에 질문이 있으면 카드가 뜨고, 첫 턴은 승인 목록이 비어 있다", async () => {
    const panel = await askedPanel();
    const card = findByTestId(panel, "ai-tileset-change-card")!;
    expect(card.textContent).toContain("타일 느낌이 바뀌어요");
    expect(card.textContent).toContain(QUESTION.reason);
    expect(findByTestId(panel, "ai-tileset-change-before")).toBeTruthy();
    expect(findByTestId(panel, "ai-tileset-change-after")).toBeTruthy();
    expect(surfaceOf(0).getApprovedTilesetFamilies?.()).toEqual([]);
  });

  it("질문이 없으면 카드가 뜨지 않는다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    composer(panel).value = "성 안을 만들어 줘";
    findByTestId(panel, "ai-send")?.click();
    await waitForCalls(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(findByTestId(panel, "ai-tileset-change-card")).toBeFalsy();
  });

  it("승인: 대화 승인 목록에 대상 계열을 넣고 승인 후속 요청을 보낸다", async () => {
    const panel = await askedPanel();
    findByTestId(panel, "ai-tileset-change-approve")!.click();
    await waitForCalls(2);
    const [command, surface] = vi.mocked(runPiCommand).mock.calls[1]!;
    expect(command.task).toBe(tilesetChangeFollowUp(QUESTION, true));
    expect(surface.getApprovedTilesetFamilies?.()).toEqual(["castle"]);
    // 두 번 눌러도 한 번만 보낸다.
    findByTestId(panel, "ai-tileset-change-approve")!.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vi.mocked(runPiCommand).mock.calls.length).toBe(2);
  });

  it("거절: 승인 목록은 비운 채 거절 후속 요청을 보낸다", async () => {
    const panel = await askedPanel();
    findByTestId(panel, "ai-tileset-change-reject")!.click();
    await waitForCalls(2);
    const [command, surface] = vi.mocked(runPiCommand).mock.calls[1]!;
    expect(command.task).toBe(tilesetChangeFollowUp(QUESTION, false));
    expect(surface.getApprovedTilesetFamilies?.()).toEqual([]);
  });
});
