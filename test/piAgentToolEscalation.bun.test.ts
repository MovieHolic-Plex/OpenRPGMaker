import { describe, expect, test } from "bun:test";

// Pi 툴 에스컬레이션 회귀 — 진짜 Agent 루프를 스크립트 모델로 돌린다.
// 계약: 초기 노출이 도메인으로 좁혀져도 find_tools 수확(선언 승격)과 resolveFallbackTool
// (미노출 호출 구제)이 실행 중에 툴을 얹는다. 단, readOnly·toolNames 경계는 에스컬레이션이
// 넘지 못한다 — 읽기 전용 실행에 쓰기 툴이 스는 순간 「편집하지 마」보장이 무너진다.
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { PiAgentEvent, PiAgentRequest } from "../src/ai/piAgent/protocol.ts";

interface ScriptedCall {
  readonly toolNames: readonly string[];
}

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

/** 순서대로 툴콜을 내고 마지막에 텍스트로 끝나는 스크립트 모델. 각 호출 시점의 선언 툴을 기록한다. */
function scriptedStream(calls: ScriptedCall[], toolCallsPerTurn: readonly { name: string; args: Record<string, unknown> }[]) {
  return (_model: unknown, context: { tools?: readonly { name: string }[] }) => {
    calls.push({ toolNames: (context.tools ?? []).map((tool) => tool.name) });
    const step = toolCallsPerTurn[calls.length - 1];
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      if (step) {
        const message = assistantMessage(
          [{ type: "toolCall", id: `c${calls.length}`, name: step.name, arguments: step.args }],
          "toolUse",
        );
        stream.push({ type: "start", partial: message } as never);
        stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: (message as never as { content: never[] }).content[0], partial: message } as never);
        stream.push({ type: "done", reason: "toolUse", message } as never);
      } else {
        const message = assistantMessage([{ type: "text", text: "끝" }], "stop");
        stream.push({ type: "start", partial: message } as never);
        stream.push({ type: "done", reason: "stop", message } as never);
      }
    });
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
    maxTurns: 6,
    ...overrides,
  };
}

describe("piAgent 툴 에스컬레이션", () => {
  test("find_tools 수확이 다음 턴 선언에 툴을 얹는다", async () => {
    const calls: ScriptedCall[] = [];
    const events: PiAgentEvent[] = [];
    const done = await runPiAgent(request(), {
      streamFn: scriptedStream(calls, [
        { name: "find_tools", args: { query: "set_project_settings" } },
        { name: "set_project_settings", args: { title: "승격된 제목" } },
      ]) as never,
      onEvent: (event) => events.push(event),
    });

    // 초기 노출은 core+범용뿐 — set_project_settings 는 없다.
    expect(calls[0]!.toolNames).toContain("find_tools");
    expect(calls[0]!.toolNames).not.toContain("set_project_settings");
    // find_tools 가 발견한 이름은 다음 턴 요청에 선언으로 실려 있다.
    expect(calls[1]!.toolNames).toContain("set_project_settings");
    // 그리고 실제로 실행됐다.
    const setEnd = events.find((event) => event.type === "tool_end" && event.name === "set_project_settings");
    expect(setEnd && setEnd.type === "tool_end" ? setEnd.ok : false).toBe(true);
    expect(done.project.meta.title).toBe("승격된 제목");
    expect(done.stats.toolErrors).toBe(0);
  });

  test("미노출 툴의 직접 호출도 폴백이 구제한다", async () => {
    const calls: ScriptedCall[] = [];
    const done = await runPiAgent(request(), {
      streamFn: scriptedStream(calls, [
        { name: "set_project_settings", args: { title: "직접 호출" } },
      ]) as never,
    });
    expect(calls[0]!.toolNames).not.toContain("set_project_settings");
    expect(done.project.meta.title).toBe("직접 호출");
    // 구제된 툴은 이후 요청에도 선언된다.
    expect(calls[1]!.toolNames).toContain("set_project_settings");
  });

  test("읽기 전용 실행은 폴백이 쓰기 툴을 못 만든다 — 승격이 경계를 넘지 않는다", async () => {
    const calls: ScriptedCall[] = [];
    const events: PiAgentEvent[] = [];
    const done = await runPiAgent(request({ readOnly: true }), {
      readOnlyTools: true,
      streamFn: scriptedStream(calls, [
        { name: "set_project_settings", args: { title: "못 바꿈" } },
      ]) as never,
      onEvent: (event) => events.push(event),
    });
    expect(done.project.meta.title).not.toBe("못 바꿈");
    expect(done.stats.toolErrors).toBeGreaterThan(0);
    const setEnd = events.find((event) => event.type === "tool_end" && event.name === "set_project_settings");
    expect(setEnd && setEnd.type === "tool_end" ? setEnd.ok : true).toBe(false);
  });

  test("find_tools 로 찾은 쓰기 툴도 읽기 전용에선 주입되지 않는다", async () => {
    const calls: ScriptedCall[] = [];
    const done = await runPiAgent(request({ readOnly: true }), {
      readOnlyTools: true,
      streamFn: scriptedStream(calls, [
        { name: "find_tools", args: { query: "set_project_settings" } },
        { name: "get_project_summary", args: {} },
      ]) as never,
    });
    // find_tools 는 읽기 툴만 주입할 수 있다 — 쓰기 툴 이름이 결과에 있어도 걸러진다.
    expect(calls[1]!.toolNames).not.toContain("set_project_settings");
    expect(done.stats.toolErrors).toBe(0);
  });
});
