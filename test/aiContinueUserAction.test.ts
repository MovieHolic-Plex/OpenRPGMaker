// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { buildAiActivityLogRecord, recordAiActivity } from "@/ai/activityLog";
import { clearConversations } from "@/ai/conversationStore";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import * as turnRunner from "@/editor/panels/aiTurnRunner";
import { sendAiAssistantMessage } from "@/editor/aiAssistantBridge";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

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
function terminalSignal() {
  let done = () => {};
  const promise = new Promise<void>(resolve => { done = resolve; });
  vi.mocked(recordAiActivity).mockImplementation(async record => {
    if (record.result?.stoppedReason && !record.result.pending) done();
    return buildAiActivityLogRecord(record);
  });
  return promise;
}
afterEach(async () => {
  teardownAiChatPanel(); await bounded(whenAiChatPanelSettled()); await clearConversations();
  document.body.replaceChildren(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllEnvs();
});
// 계약 변경(자율성 다이얼 단일화): 예전에는 「계속」 컨트롤이 "명시적 사용자 승인"이라는 이유로
// composerMode 를 do 로 되돌렸다. 모드가 턴 단위 칩일 때는 무해했지만, 이제 정본은 **지속 설정**인
// 자율성 다이얼이다 — 「계속」이 사용자의 읽기 전용을 풀면 그 뒤 모든 턴에 쓰기 툴이 붙는다.
// 읽기 전용에서 「계속」은 읽기를 계속하라는 뜻이며, 승격은 다이얼로만 한다.
it("no continuation path escalates a read-only composer out of the Ask rail", async () => {
  vi.stubEnv("VITE_LLM_API_URL", ""); vi.stubEnv("VITE_LLM_API_KEY", "");
  localStorage.clear(); await clearConversations();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  const send = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async (_text, onEvent) => {
    onEvent?.({ type: "status", text: "자율 실행 예산 소진" });
    return { assistantText: "", proposedCalls: [], stoppedReason: "max-tool-calls" };
  });
  const factory = vi.spyOn(turnRunner, "createAiTurnRunner");
  document.body.append(renderAiChatPanel()); await bounded(whenAiChatPanelSettled());
  const dial = node<HTMLSelectElement>("ai-composer-autonomy");
  dial.value = "readonly"; dial.dispatchEvent(new Event("change"));
  node<HTMLTextAreaElement>("ai-input").value = "QUERY_FIXTURE";
  const asked = terminalSignal(); node("ai-send").click(); await bounded(asked);
  expect(send.mock.calls[0]?.[3]?.composerMode).toBe("ask");
  // A continuation string is not permission to leave the Ask rail.
  node<HTMLTextAreaElement>("ai-input").value = "계속";
  const typed = terminalSignal(); node("ai-send").click(); await bounded(typed);
  expect(send.mock.lastCall?.[3]?.composerMode).toBe("ask");
  await bounded(sendAiAssistantMessage("계속"));
  expect(send.mock.lastCall?.[3]?.composerMode).toBe("ask");
  const surface = factory.mock.calls[0]?.[0].surface;
  if (!surface) throw new Error("Missing actual Panel run surface");
  await bounded(surface.sendText("계속"));
  expect(send.mock.lastCall?.[3]?.composerMode).toBe("ask");
  // Break: the old userResume reset lived here — the Continue button must not grant write tools.
  const resumed = terminalSignal(); node("ai-continue-run").click(); await bounded(resumed);
  expect(send.mock.lastCall?.[3]?.composerMode).toBe("ask");
  expect(dial.value).toBe("readonly");
});
