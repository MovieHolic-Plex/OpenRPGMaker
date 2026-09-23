// 첫 화면 → 조수 핸드오프의 «보이는 문장» 과 «보낸 지시문» 분리 — 패널 하네스(모델 호출 없음).
//
// 2026-09-23 실측: 첫 화면에 「숲속 마을에서 잃어버린 고양이를 찾는 짧은 게임」 한 줄을 쳤더니 사용자
// 말풍선에 「사용자 의도: …」·「지금 열려 있는 프로젝트에 이어서 작업한다 …」·「한국어로 진행하고, 도구로
// 맵·이벤트·DB를 실제로 구성하세요.」 가 그대로 떴고, 실행이 끝난 뒤에도 입력창에 그 꼬리 줄이 남았다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearConversations } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { prefillAiAssistantInput, sendAiBootIntent } from "@/editor/aiBootIntent";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { runPiCommand } from "@/editor/panels/aiPiAgentCommand";
import { resetAiWorkStripForTest } from "@/editor/panels/aiWorkStrip";
import { buildWelcomeFreeTextPrompt, welcomeFreeTextDisplayText } from "@/editor/welcomeGenrePresets";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/editor/panels/aiPiAgentCommand", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiPiAgentCommand")>()),
  runPiCommand: vi.fn(async () => true),
}));
// 의도 분류는 모델을 부른다 — 판정만 고정하고, 분류가 **무엇을 읽었는지**는 기록한다.
const classified = vi.hoisted(() => ({ texts: [] as string[] }));
vi.mock("@/ai/intentDeclarationClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ai/intentDeclarationClient")>()),
  declareIntentCached: vi.fn(async (_declarer: unknown, facts: { userText: string }) => {
    classified.texts.push(facts.userText);
    return { intent: { mode: "other", source: "llm", needsPlan: false, clarify: null, tools: [] }, elapsedMs: 1 } as never;
  }),
}));

const INTENT = "숲속 마을에서 잃어버린 고양이를 찾는 짧은 게임";
const INTERNAL_LINES = ["사용자 의도:", "지금 열려 있는 프로젝트에 이어서", "한국어로 진행하고"];

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  vi.mocked(runPiCommand).mockClear();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  // 잠금 막(aiLockScrim)이 window 이벤트를 듣는다 — fakeDom 은 window 를 만들지 않는다.
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

const userBubbles = (panel: FakeElement): string[] =>
  panel.querySelectorAll("[data-testid='ai-command-row-user']").map((node) => node.textContent ?? "");
const composer = (panel: FakeElement) => findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
const sentTask = (): string => vi.mocked(runPiCommand).mock.calls.at(-1)?.[0].task ?? "";
async function waitForTurn(before: number): Promise<void> {
  await vi.waitFor(() => expect(vi.mocked(runPiCommand).mock.calls.length).toBeGreaterThan(before), { timeout: 5_000, interval: 5 });
}

describe("첫 화면 핸드오프 — 보이는 문장과 보낸 지시문", () => {
  it("자동 전송은 말풍선에 사용자 문장만 남기고, 모델에는 전체 지시문을 보내며, 입력창을 더럽히지 않는다", async () => {
    // Break: 보이는 문장을 따로 싣지 않으면 말풍선이 「사용자 의도: …」 로 시작하고 입력창에 꼬리 줄이 남는다.
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    const full = buildWelcomeFreeTextPrompt(INTENT);
    expect(sendAiBootIntent(full, welcomeFreeTextDisplayText(INTENT))).toBe(true);
    await waitForTurn(0);

    expect(userBubbles(panel)).toEqual([INTENT]);
    for (const line of INTERNAL_LINES) expect(userBubbles(panel).join("\n")).not.toContain(line);
    expect(sentTask()).toContain(`사용자 의도: ${INTENT}`);
    expect(sentTask()).toContain("한국어로 진행하고");
    // 의도 분류도 예전처럼 전체 지시문을 읽는다 — 보이는 문장 분리가 판정 재료를 줄이지 않는다.
    expect(classified.texts.at(-1)).toContain(`사용자 의도: ${INTENT}`);
    expect(composer(panel).value).toBe("");
  });

  it("AI 연결 전에 담아 둔 핸드오프는 입력창에 요약만 보이고, 보낼 때 전체 지시문이 간다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    const full = buildWelcomeFreeTextPrompt(INTENT);
    expect(prefillAiAssistantInput(full, { displayText: INTENT })).toBe(true);
    expect(composer(panel).value).toBe(INTENT);

    findByTestId(panel, "ai-send")?.click();
    await waitForTurn(0);
    expect(userBubbles(panel)).toEqual([INTENT]);
    expect(sentTask()).toContain(`사용자 의도: ${INTENT}`);
  });

  it("담아 둔 요약을 사용자가 고치면 고친 문장 그대로 보낸다 — 숨은 지시를 몰래 붙이지 않는다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    prefillAiAssistantInput(buildWelcomeFreeTextPrompt(INTENT), { displayText: INTENT });
    composer(panel).value = "고양이 대신 강아지를 찾는 게임";

    findByTestId(panel, "ai-send")?.click();
    await waitForTurn(0);
    expect(userBubbles(panel)).toEqual(["고양이 대신 강아지를 찾는 게임"]);
    expect(sentTask()).not.toContain("사용자 의도:");
  });
});
