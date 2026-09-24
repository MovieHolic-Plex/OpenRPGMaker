// 제공자 스트림이 도중에 끊겨도 Pi 실행이 끝나지 않고 이어 가는지 — 2026-09-24 꿈 세계 도그푸딩 dream-1 회귀.
// 시공 턴이 맵 5개를 만든 뒤 「Cloud Code Assist stream ended without a finish reason」 한 번으로 실행 전체가 끝나
// 빈 껍데기 맵과 엔딩 없는 게임이 남았다.
import { describe, expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import { isTransientProviderStreamError } from "../src/ai/piAgent/providerRetry.ts";
import type { PiAgentEvent, PiAgentRequest } from "../src/ai/piAgent/protocol.ts";

const DROP = "Cloud Code Assist stream ended without a finish reason (connection dropped or response truncated)";

function assistantMessage(content: unknown[], stopReason: string, errorMessage?: string) {
  return {
    role: "assistant", content, api: "gemini", provider: "google-antigravity", model: "scripted",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
    stopReason, ...(errorMessage ? { errorMessage } : {}), timestamp: Date.now(),
  } as never;
}

/** 각 요청마다 스크립트의 다음 동작: "drop"(도구 호출 도중 끊김), "tool"(읽기 도구), "stop"(끝). */
function scripted(steps: readonly ("drop" | "tool" | "stop")[], seen: string[][]) {
  let n = 0;
  return (_model: unknown, context: { messages: { role: string; content: unknown }[] }) => {
    const step = steps[Math.min(n, steps.length - 1)]!;
    n += 1;
    seen.push(context.messages.filter((m) => m.role === "user").map((m) => JSON.stringify(m.content)));
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      if (step === "stop") {
        const message = assistantMessage([{ type: "text", text: "끝" }], "stop");
        stream.push({ type: "start", partial: message } as never);
        stream.push({ type: "done", reason: "stop", message } as never);
        return;
      }
      const call = { type: "toolCall", id: `c${n}`, name: "get_project_summary", arguments: {} };
      if (step === "tool") {
        const message = assistantMessage([call], "toolUse");
        stream.push({ type: "start", partial: message } as never);
        stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: call, partial: message } as never);
        stream.push({ type: "done", reason: "toolUse", message } as never);
        return;
      }
      const message = assistantMessage([call], "error", DROP);
      stream.push({ type: "start", partial: message } as never);
      stream.push({ type: "error", reason: "error", error: message } as never);
    });
    return stream;
  };
}

function request(): PiAgentRequest {
  return { provider: "google-antigravity", task: "테스트 실행", mapIds: [], project: createBlankProject(), toolDomains: ["core"], maxTurns: 20 };
}

describe("제공자 스트림 끊김", () => {
  test("끊김 문구를 일시 오류로 알아보고, 인자 오류는 아니다", () => {
    expect(isTransientProviderStreamError(DROP)).toBe(true);
    expect(isTransientProviderStreamError("Google API stream ended without a finish reason")).toBe(true);
    expect(isTransientProviderStreamError("Invalid argument: tools[3].parameters")).toBe(false);
    expect(isTransientProviderStreamError(undefined)).toBe(false);
  });

  test("한 번 끊겨도 실행이 이어지고 오류 이벤트 없이 끝난다", async () => {
    const events: PiAgentEvent[] = [];
    const seen: string[][] = [];
    const done = await runPiAgent(request(), { streamFn: scripted(["drop", "tool", "stop"], seen) as never, onEvent: (e) => events.push(e) });
    expect(events.filter((e) => e.type === "error")).toEqual([]);
    expect(events.some((e) => e.type === "execution_status" && e.name === "provider_retry")).toBe(true);
    expect(seen.length).toBe(3);
    expect(seen[1]!.join("\n")).toContain("연결 끊김 1/2");
    expect(done.stats.toolCalls).toBeGreaterThanOrEqual(1);
  }, 20_000);

  test("한도를 넘게 끊기면 끊김 문구로 끝난다", async () => {
    const events: PiAgentEvent[] = [];
    const seen: string[][] = [];
    await runPiAgent(request(), { streamFn: scripted(["drop", "drop", "drop", "stop"], seen) as never, onEvent: (e) => events.push(e) }).catch(() => undefined);
    expect(seen.length).toBe(3);
    expect(events.filter((e) => e.type === "error").map((e) => (e as { message: string }).message)).toContain(DROP);
  }, 20_000);
});
