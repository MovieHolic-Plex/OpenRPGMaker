// AI busy 중 입력 큐(도그푸딩 결함 ⑨) 회귀 테스트.
// 처리 중 들어온 메시지는 동시 세션 실행(레이스) 대신 큐에 쌓여 "대기 중 N건"으로 표시되고,
// 현재 턴이 끝나면 순서대로 전송된다. 가짜 API 키와 지연 fetch로 실제 busy 상태를 만든다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  restoreDom = installFakeDom();
  storage = new Map();
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
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test" }));
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
});

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

describe("AI busy 입력 큐", () => {
  it("empty pending queue is hidden when pendingSends is empty", () => {
    // Given: a freshly rendered panel (refreshQueueIndicator is the only hidden writer)
    // When: no sends have been queued
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const queue = findByTestId(panel, "ai-pending-queue") as unknown as FakeElement & { hidden: boolean };

    // Then: empty queue is hidden; deleting this pin would miss a writer that leaves it visible
    expect(queue).toBeTruthy();
    expect(queue.hidden).toBe(true);
  });

  it("empty pending queue used display is none even when author CSS sets display", () => {
    // Break this names: delete .ai-pending-queue[hidden] { display: none !important; }
    // and .ai-pending-queue { display: inline-flex } wins, so used display stays inline-flex.
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const queue = findByTestId(panel, "ai-pending-queue") as unknown as FakeElement & { hidden: boolean };
    expect(queue.hidden).toBe(true);

    const css = readFileSync(resolve("src/styles/database/assistant-rising-overlay.css"), "utf8");
    const window = new Window();
    try {
      const style = window.document.createElement("style");
      style.textContent = css;
      window.document.head.appendChild(style);
      const liveQueue = window.document.createElement("div");
      liveQueue.className = "ai-pending-queue";
      liveQueue.hidden = queue.hidden;
      window.document.body.appendChild(liveQueue);

      expect(window.getComputedStyle(liveQueue).display).toBe("none");
    } finally {
      window.close();
    }
  });

  it("처리 중 두 번째 메시지는 큐에 쌓여 '대기 중 1건'으로 표시되고, 턴 종료 후 순서대로 전송된다", async () => {
    const pendingResponses: Array<() => void> = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      pendingResponses.push(() => resolve(new Response('data: {"choices":[{"delta":{"content":"완료"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })));
    })));
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send") as unknown as HTMLElement;
    const queue = findByTestId(panel, "ai-pending-queue") as unknown as FakeElement & { hidden: boolean };

    expect(queue).toBeTruthy();
    expect(queue.hidden).toBe(true);

    input.value = "첫 번째 요청";
    send.click(); // 턴 시작(비异步) — API 키가 없어 곧 오류로 끝난다.
    input.value = "두 번째 요청";
    send.click(); // busy 중 → 큐로.

    // 두 번째는 아직 버블로 붙지 않고 큐 표시가 뜬다.
    expect(queue.hidden).toBe(false);
    expect(queue.textContent).toContain("기다리는 메시지 1개");

    // 기본 agentMode=auto 이므로 턴마다 의도 선언(응답 1, 여기서는 JSON 이 아니라 폴백) → 플래너(응답 2) →
    // 본문(응답 3) 라운드를 갖는다. 두 번째 턴도 같다. 큐가 빌 때까지 순서대로 방출한다.
    for (let round = 0; round < 12 && (pendingResponses.length > 0 || !queue.hidden); round += 1) {
      pendingResponses.shift()?.();
      await flushAsync();
    }

    // 첫 턴 종료 후 큐가 비고, 두 번째 메시지가 사용자 버블로 전송됐다.
    expect(queue.hidden).toBe(true);
    const log = findByTestId(panel, "ai-chat-log") as unknown as FakeElement;
    const text = log.textContent ?? "";
    expect(text).toContain("첫 번째 요청");
    expect(text).toContain("두 번째 요청");
  });

  it("busy 중 입력칸 Enter 는 pendingSends 에 쌓이고 동시 턴을 시작하지 않는다", async () => {
    const pendingResponses: Array<() => void> = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      pendingResponses.push(() => resolve(new Response('data: {"choices":[{"delta":{"content":"완료"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })));
    })));
    const panel = renderAiChatPanel({}) as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send") as unknown as HTMLButtonElement;
    const queue = findByTestId(panel, "ai-pending-queue") as unknown as FakeElement & { hidden: boolean };
    const log = findByTestId(panel, "ai-chat-log") as unknown as FakeElement;

    input.value = "첫 번째 요청";
    send.click();
    const afterFirst = log.textContent ?? "";
    expect(afterFirst).toContain("첫 번째 요청");
    expect(afterFirst).not.toContain("continue");

    input.value = "continue";
    const enter = new Event("keydown") as Event & { key: string; shiftKey: boolean; isComposing: boolean };
    enter.key = "Enter";
    enter.shiftKey = false;
    enter.isComposing = false;
    input.dispatchEvent(enter);

    expect(queue.hidden).toBe(false);
    expect(queue.textContent).toContain("기다리는 메시지 1개");
    expect(log.textContent ?? "").not.toContain("continue");
  });
});
