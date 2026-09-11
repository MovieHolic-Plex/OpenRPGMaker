// 패널 배선: 자율성 다이얼 하나가 Pi 실행 옵션(쓰기 금지·계획만·턴 상한·추론)을 유도한다.
// 예전의 모드 3칩(지시/질문/계획)은 없다 — 「질문」은 다이얼 readonly, 「계획」은 confirm(planOnly).
// 여기서는 `runPiCommand` 를 가로채 **패널이 넘기는 값**만 본다(명령 내부는 piAgentCommandLoop 테스트가 본다).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearConversations } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { runPiCommand } from "@/editor/panels/aiPiAgentCommand";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/editor/panels/aiPiAgentCommand", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiPiAgentCommand")>()),
  runPiCommand: vi.fn(async () => true),
}));

let restoreDom: (() => void) | null = null;

function installFakeLocalStorage(): void {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

/** 다이얼을 고른다 — 패널이 저장까지 하는 실제 경로를 그대로 탄다. */
function selectAutonomy(panel: FakeElement, level: string): void {
  const dial = findByTestId(panel, "ai-composer-autonomy");
  if (!dial) throw new Error("ai-composer-autonomy missing");
  dial.value = level;
  dial.dispatchEvent(new Event("change"));
}

async function send(panel: FakeElement, text: string): Promise<void> {
  const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
  input.value = text;
  findByTestId(panel, "ai-send")?.click();
  await vi.waitFor(() => expect(runPiCommand).toHaveBeenCalled(), { timeout: 2_000, interval: 5 });
}

const lastCommand = () => vi.mocked(runPiCommand).mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  vi.mocked(runPiCommand).mockClear();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(defaultAiConfig()));
});

afterEach(async () => {
  teardownAiChatPanel();
  await clearConversations();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("자율성 다이얼 → Pi 실행 계획", () => {
  it("모드 3칩은 더 이상 존재하지 않는다", () => {
    // Break: 칩이 남아 있으면 같은 노브를 두 컨트롤이 만지고, 둘이 어긋날 때 어느 쪽이
    // 이기는지 사용자가 알 수 없다.
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-mode")).toBeNull();
    for (const key of ["do", "ask", "plan"]) {
      expect(findByTestId(panel, `ai-composer-mode-${key}`)).toBeNull();
    }
  });

  it("추론 강도 셀렉트도 없다 — 자율성 레벨이 추론을 정한다", () => {
    // Break: 수동 추론 override 가 남아 있으면 다이얼이 저장한 프리셋 값과 갈라진다.
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-reasoning")).toBeNull();
  });


  it("중단처럼 자격과 무관한 실패에는 설정 열기를 붙이지 않는다", async () => {
    vi.mocked(runPiCommand).mockImplementationOnce(async (_command, surface) => {
      surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
      return false;
    });
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "집 한 채 지어줘");

    expect(findByTestId(panel, "ai-error-open-settings")).toBeNull();
  });
});
