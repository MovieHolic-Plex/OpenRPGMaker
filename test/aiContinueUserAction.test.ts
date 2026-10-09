// @vitest-environment happy-dom
// 읽기 전용 다이얼은 «계속» 한 마디로 풀리지 않는다 — 승격은 다이얼로만 한다.
//
// 계약 변경(2026-09-11, 조수 채팅 Pi 전용): 컴포저는 Pi 하나로 가므로 읽기 전용은 Pi 실행 계획의
// `readOnly` 로 실린다. 세션 경로(조수 QA 브리지)는 남아 있고 거기서는 같은 다이얼이 `composerMode:
// "ask"` 를 만든다 — 두 경로 모두 «계속» 으로 쓰기가 열리지 않는다.
import { afterEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { clearConversations } from "@/ai/conversationStore";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { runPiCommand } from "@/editor/panels/aiPiAgentCommand";
import { sendAiAssistantMessage } from "@/editor/aiAssistantBridge";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

vi.mock("@/editor/panels/aiPiAgentCommand", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiPiAgentCommand")>()),
  runPiCommand: vi.fn(async () => true),
}));
vi.mock("@/ai/activityLog", async original => ({
  ...await original<typeof import("@/ai/activityLog")>(), recordAiActivity: vi.fn(async () => ({})),
}));
vi.mock("@/editor/ui/aiGateModal", () => ({ showAiGateNotice: vi.fn() }));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));

function node<T extends HTMLElement>(testid: string): T {
  const result = document.querySelector<T>(`[data-testid='${testid}']`);
  if (!result) throw new Error(`Missing ${testid}`);
  return result;
}

async function bounded(promise: Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Missing panel publication")), 5000);
  })]); } finally { clearTimeout(timer); }
}

/** 컴포저로 한 줄 — Pi 호출이 «새로» 일어난 것을 기다린다. */
async function sendFromComposer(text: string): Promise<void> {
  const before = vi.mocked(runPiCommand).mock.calls.length;
  node<HTMLTextAreaElement>("ai-input").value = text;
  node("ai-send").click();
  await vi.waitFor(() => expect(vi.mocked(runPiCommand).mock.calls.length).toBeGreaterThan(before), { timeout: 5_000, interval: 5 });
}

const lastPlan = () => vi.mocked(runPiCommand).mock.calls.at(-1)?.[2];

afterEach(async () => {
  teardownAiChatPanel(); await bounded(whenAiChatPanelSettled()); await clearConversations();
  document.body.replaceChildren(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllEnvs();
});

it("no continuation path escalates a read-only composer out of the Ask rail", async () => {
  vi.stubEnv("VITE_LLM_API_URL", ""); vi.stubEnv("VITE_LLM_API_KEY", "");
  localStorage.clear(); await clearConversations();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  const sessionSend = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async (_text, onEvent) => {
    onEvent?.({ type: "status", text: "자율 실행 예산 소진" });
    return { assistantText: "", proposedCalls: [], stoppedReason: "max-tool-calls" };
  });
  document.body.append(renderAiChatPanel()); await bounded(whenAiChatPanelSettled());
  const dial = node<HTMLSelectElement>("ai-composer-autonomy");
  dial.value = "readonly"; dial.dispatchEvent(new Event("change"));

  await sendFromComposer("QUERY_FIXTURE");
  expect(lastPlan()).toMatchObject({ readOnly: true, planOnly: false });

  // 계속은 실행 허가가 아니다 — 같은 다이얼이 같은 계획을 낸다.
  // Break: 예전에 여기 있던 userResume 리셋이 다시 생기면 읽기 전용이 조용히 풀린다.
  await sendFromComposer("계속");
  expect(lastPlan()).toMatchObject({ readOnly: true, planOnly: false });

  // 조수 QA 브리지(세션 경로 — deprecated 재고)도 같은 다이얼을 읽는다: ask 레일이 유지된다.
  await bounded(sendAiAssistantMessage("계속"));
  expect(sessionSend.mock.lastCall?.[3]?.composerMode).toBe("ask");
  expect(dial.value).toBe("readonly");
});
