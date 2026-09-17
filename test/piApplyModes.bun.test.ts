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

describe("Pi application checkpoints", () => {
  test.each(["yolo", "auto", "default"] as const)("%s publishes writes before the next model turn", async applyMode => {
    const calls: ScriptedCall[] = [];
    const seen: string[] = [];
    await runPiAgent(request({ applyMode }), {
      streamFn: scriptedStream(calls, [
        { name: "set_project_settings", args: { title: "first" } },
        { name: "set_project_settings", args: { title: "second" } },
      ]) as never,
      onCheckpoint: async checkpoint => {
        seen.push(checkpoint.project.meta.title);
        expect(calls.length).toBe(seen.length);
      },
    });
    expect(seen).toEqual(["first", "second"]);
  });
  test("review keeps all writes detached", async () => {
    let checkpoints = 0;
    await runPiAgent(request({ applyMode: "review" }), {
      streamFn: scriptedStream([], [{ name: "set_project_settings", args: { title: "draft" } }]) as never,
      onCheckpoint: async () => { checkpoints++; },
    });
    expect(checkpoints).toBe(0);
  });
  test("step waits at an authored stage, not each tool, and resumes only after approval", async () => {
    const calls: ScriptedCall[] = [];
    let approve!: () => void;
    let ready!: () => void;
    const waiting = new Promise<void>(resolve => { ready = resolve; });
    const seen: string[] = [];
    const result = runPiAgent(request({ applyMode: "step" }), {
      streamFn: scriptedStream(calls, [
        { name: "set_project_settings", args: { title: "draft 1" } },
        { name: "set_project_settings", args: { title: "stage 1" } },
        { name: "finish_stage", args: { title: "지형" } },
        { name: "set_project_settings", args: { title: "stage 2" } },
      ]) as never,
      onCheckpoint: async checkpoint => {
        seen.push(checkpoint.project.meta.title);
        if (seen.length === 1) await new Promise<void>(resolve => { approve = resolve; ready(); });
      },
    });
    await waiting;
    expect(calls.length).toBe(3);
    expect(seen).toEqual(["stage 1"]);
    approve();
    await result;
    expect(seen).toEqual(["stage 1", "stage 2"]);
  });
  test("declining publication stops subsequent writes", async () => {
    const calls: ScriptedCall[] = [];
    await expect(runPiAgent(request({ applyMode: "default" }), {
      streamFn: scriptedStream(calls, [
        { name: "set_project_settings", args: { title: "first" } },
        { name: "set_project_settings", args: { title: "must not run" } },
      ]) as never,
      onCheckpoint: async () => { throw new Error("declined"); },
    })).rejects.toThrow("declined");
    expect(calls.length).toBeLessThanOrEqual(2);
  });
  test("read-only blocks fallback writes and publication in YOLO", async () => {
    let checkpoints = 0;
    const done = await runPiAgent(request({ applyMode: "yolo", readOnly: true }), {
      streamFn: scriptedStream([], [{ name: "set_project_settings", args: { title: "forbidden" } }]) as never,
      onCheckpoint: async () => { checkpoints++; },
    });
    expect(checkpoints).toBe(0);
    expect(done.project.meta.title).not.toBe("forbidden");
  });
});

test("checkpoint wait is retired when the core aborts the active tool", async () => {
  const controller = new AbortController();
  const { requestPiCheckpoint } = await import("../scripts/lib/piCheckpointBroker.ts");
  const task = runPiAgent(request({ applyMode: "default" }), {
    signal: controller.signal,
    streamFn: scriptedStream([], [{ name: "set_project_settings", args: { title: "waiting" } }]) as never,
    onCheckpoint: (checkpoint, signal) => requestPiCheckpoint(checkpoint, () => { controller.abort(); }, signal!),
  });
  await expect(task).rejects.toThrow("중단");
});
