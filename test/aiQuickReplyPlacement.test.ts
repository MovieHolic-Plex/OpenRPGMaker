// 복원된 [선택지] 답변이 칩으로 승격되지 않는 계약. CSS 그리드 원문 잠금은 2026-11 시험 감량에서 걷었다
// (E2E test/e2e/ai-panel-reachability.spec.ts 의 "본문 눌림" 판정이 레이아웃 계약을 지킨다).
import { afterEach, describe, expect, it, vi } from "vitest";
import { conversationScopeKey, saveConversation } from "@/ai/conversationStore";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

afterEach(() => {
  teardownAiChatPanel();
  restoreDom?.();
  restoreDom = null;
  vi.unstubAllGlobals();
});

describe("커맨드 줄 안에 꽂히는 상자는 그리드 배치를 명시한다", () => {
  it("복원된 선택지는 답변에 남고 칩으로 승격되지 않는다", async () => {
    // Break: restoring choices strips transcript content or inserts quick-reply buttons.
    store.replace(createBlankProject());
    restoreDom = installFakeDom({ window: true });
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    });
    const answer = "[선택지] 지붕 | 돌담 | 화단";
    await saveConversation({
      id: "conv_choices_placement",
      title: "choices",
      model: "m",
      savedAt: 100,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
      entries: [{ kind: "assistant", text: answer }],
    });

    const panel = renderWithFakeDom(() => renderAiChatPanel());
    await whenAiChatPanelSettled();

    const log = findByTestId(panel, "ai-chat-log");
    if (!log) throw new Error("log missing");
    const reply = findByTestId(log, "ai-command-row-assistant");
    expect(reply?.textContent).toBe(answer);
    expect(reply?.querySelectorAll("button")).toHaveLength(0);
    expect(findByTestId(panel, "ai-quick-replies")).toBeNull();
    expect(findByTestId(panel, "ai-input")).toBeTruthy();
    expect(findByTestId(panel, "ai-send")).toBeTruthy();
  });
});
