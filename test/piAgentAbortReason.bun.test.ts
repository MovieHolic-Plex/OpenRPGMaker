// Pi 에이전트 중단 사유가 사용자에게 그대로 닿는지 — 2026-09-17 「Request was aborted」 회귀 게이트.
//
// 런타임은 턴 상한·시간 상한·클라이언트 끊김 세 경우에 agent.abort() 를 부른다. 사유 없이 부르면
// pi-agent-core 가 `errorMessage: "Request was aborted"` 인 assistant 메시지를 합성하고, message_end
// 핸들러가 그 문구로 `fatal` 을 덮어써 에디터 조수에는 영문 일반 문구만 보였다(「마을 만들어달라」가
// 균형 레벨 16턴을 넘길 때마다). 여기서는 네트워크 없이 진짜 Agent 루프를 돌려 각 사유가 이벤트에
// 실리는지 확인한다.
import { describe, expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { PiAgentEvent, PiAgentRequest } from "../src/ai/piAgent/protocol.ts";

function assistantMessage(content: unknown[], stopReason: string) {
  return {
    role: "assistant",
    content,
    api: "gemini",
    provider: "google-antigravity",
    model: "scripted",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
    stopReason,
    timestamp: Date.now(),
  } as never;
}

/** 매 턴 같은 읽기 툴을 부르는 모델 — 스스로는 절대 멈추지 않는다. */
function endlessToolStream(delayMs = 0) {
  let n = 0;
  return () => {
    n += 1;
    const stream = createAssistantMessageEventStream();
    const push = () => {
      const message = assistantMessage([{ type: "toolCall", id: `c${n}`, name: "get_project_summary", arguments: {} }], "toolUse");
      stream.push({ type: "start", partial: message } as never);
      stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: (message as never as { content: never[] }).content[0], partial: message } as never);
      stream.push({ type: "done", reason: "toolUse", message } as never);
    };
    if (delayMs > 0) setTimeout(push, delayMs);
    else queueMicrotask(push);
    return stream;
  };
}

function request(overrides: Partial<PiAgentRequest> = {}): PiAgentRequest {
  return {
    provider: "google-antigravity",
    task: "테스트 실행",
    mapIds: [],
    project: createBlankProject(),
    toolDomains: ["core"],
    maxTurns: 2,
    ...overrides,
  };
}

function errorMessages(events: readonly PiAgentEvent[]): string[] {
  return events.flatMap((event) => (event.type === "error" ? [event.message] : []));
}

describe("Pi 에이전트 중단 사유", () => {
  test("턴 상한을 넘으면 「Request was aborted」가 아니라 상한 문구가 이벤트에 실린다", async () => {
    const events: PiAgentEvent[] = [];
    const done = await runPiAgent(request({ maxTurns: 2 }), {
      streamFn: endlessToolStream() as never,
      onEvent: (event) => events.push(event),
    });
    expect(done.stats.turns).toBeGreaterThan(2);
    const errors = errorMessages(events);
    expect(errors).toContain("턴 상한(2)을 넘어 중단했습니다.");
    expect(errors.join("\n")).not.toContain("Request was aborted");
  });

  test("클라이언트가 끊으면 끊김 문구가 실린다", async () => {
    const events: PiAgentEvent[] = [];
    const controller = new AbortController();
    const done = await runPiAgent(request({ maxTurns: 10 }), {
      streamFn: endlessToolStream() as never,
      signal: controller.signal,
      onEvent: (event) => {
        events.push(event);
        if (event.type === "tool_start") controller.abort();
      },
    });
    expect(done.stats.turns).toBeLessThan(10);
    const errors = errorMessages(events);
    expect(errors.join("\n")).not.toContain("Request was aborted");
    if (errors.length) expect(errors).toContain("클라이언트가 중단했습니다.");
  });

  test("시간 상한에 걸리고 툴 호출이 없으면 상한 문구로 502 를 던진다", async () => {
    const events: PiAgentEvent[] = [];
    let thrown: unknown;
    try {
      await runPiAgent(request({ maxTurns: 10 }), {
        streamFn: endlessToolStream(200) as never,
        timeoutMs: 20,
        onEvent: (event) => events.push(event),
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("시간 상한을 넘어 중단했습니다.");
    expect((thrown as { status?: number }).status).toBe(502);
    expect(errorMessages(events).join("\n")).not.toContain("Request was aborted");
  });
});
