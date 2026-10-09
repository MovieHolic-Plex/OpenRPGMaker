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
  test("a provider error after writes marks the run as stopped early", async () => {
    let call = 0;
    const streamFn = () => {
      call += 1;
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        if (call === 1) {
          const message = assistantMessage([{ type: "toolCall", id: "c1", name: "set_project_settings", arguments: { title: "half" } }], "toolUse");
          stream.push({ type: "start", partial: message } as never);
          stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: (message as never as { content: never[] }).content[0], partial: message } as never);
          stream.push({ type: "done", reason: "toolUse", message } as never);
        } else {
          const message = { ...(assistantMessage([], "error") as object), errorMessage: "thought-only response" } as never;
          stream.push({ type: "start", partial: message } as never);
          stream.push({ type: "error", reason: "error", error: message } as never);
        }
      });
      return stream;
    };
    const done = await runPiAgent(request({ applyMode: "default" }), { streamFn: streamFn as never, onCheckpoint: async () => {} });
    expect(done.project.meta.title).toBe("half");
    expect(done.stoppedEarly).toContain("thought-only");
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

test("a content rejection reverts only that write and the run continues", async () => {
  const calls: ScriptedCall[] = [];
  const events: PiAgentEvent[] = [];
  const done = await runPiAgent(request({ applyMode: "default" }), {
    onEvent: event => events.push(event),
    streamFn: scriptedStream(calls, [
      { name: "set_project_settings", args: { title: "rejected" } },
      { name: "set_project_settings", args: { title: "accepted" } },
    ]) as never,
    onCheckpoint: async checkpoint => {
      if (checkpoint.project.meta.title === "rejected") throw new Error("적용 실패(commit-rejected): 직렬화 왕복 실패: movement.speed가 숫자가 아닙니다.");
    },
  });
  expect(calls.length).toBe(3);
  expect(done.project.meta.title).toBe("accepted");
  const failed = events.find(event => event.type === "tool_end" && !(event as { ok?: boolean }).ok) as { summary?: string } | undefined;
  expect(failed?.summary).toContain("되돌렸습니다");
});

// 2026-10-05 스트레스 g-ashen-chase: 맵 소실 확인에서 「그만두기」를 고르자 실행이 통째로 끝났다.
test("a declined map-loss checkpoint reverts only that write and the run continues", async () => {
  const { PI_MAP_LOSS_DECLINED_PREFIX } = await import("../src/ai/piAgent/protocol.ts");
  const calls: ScriptedCall[] = [];
  const events: PiAgentEvent[] = [];
  const done = await runPiAgent(request({ applyMode: "default" }), {
    onEvent: event => events.push(event),
    streamFn: scriptedStream(calls, [
      { name: "set_project_settings", args: { title: "declined" } },
      { name: "set_project_settings", args: { title: "kept" } },
    ]) as never,
    onCheckpoint: async checkpoint => {
      if (checkpoint.project.meta.title === "declined") throw new Error(`${PI_MAP_LOSS_DECLINED_PREFIX} 맵 1개 삭제를 취소했습니다 — 프로젝트는 그대로입니다.`);
    },
  });
  expect(calls.length).toBe(3);
  expect(done.project.meta.title).toBe("kept");
  const failed = events.find(event => event.type === "tool_end" && !(event as { ok?: boolean }).ok) as { summary?: string } | undefined;
  expect(failed?.summary).toContain("거절해 되돌렸습니다");
  expect(failed?.summary).not.toContain(PI_MAP_LOSS_DECLINED_PREFIX);
});

// 2026-10-05 스트레스 r4 p-inn·r7 g-ashen-chase: 워커의 event_command_assist 가 편집기 기본 주소(상대 /v1)로 LLM 을 불러
// 매번 「fetch() URL is invalid」 네트워크 오류로 끝났다. 이제 이 실행의 제공자로 부른다(스텁 응답은 JSON 이 아니라 검증 실패).
test("event_command_assist inside a Pi run asks the run's own provider", async () => {
  const previous = process.env.OPRN_OH_MY_PI_TEST_STUB;
  process.env.OPRN_OH_MY_PI_TEST_STUB = "1";
  try {
    const project = createBlankProject();
    project.maps[project.startMapId]!.events.push({ id: "ev_t", x: 2, y: 2, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, graphic: { transparent: true }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }] } as never);
    const events: PiAgentEvent[] = [];
    await runPiAgent(request({ project, toolDomains: ["core", "event"] }), {
      onEvent: event => events.push(event),
      streamFn: scriptedStream([], [
        { name: "event_command_assist", args: { mapId: project.startMapId, eventId: "ev_t", pageId: "p1", prompt: "인사 한 줄" } },
      ]) as never,
    });
    const end = events.find(event => event.type === "tool_end" && (event as { name?: string }).name === "event_command_assist") as { summary?: string } | undefined;
    expect(end?.summary ?? "").not.toContain("네트워크 오류");
  } finally {
    if (previous === undefined) delete process.env.OPRN_OH_MY_PI_TEST_STUB; else process.env.OPRN_OH_MY_PI_TEST_STUB = previous;
  }
});

// 2026-10-05 스트레스 p-team-delete-declined: 팀장 get_database_records 가 시작 사본만 읽어 끝까지 「maps 1건」 —
// 팀원이 만든 「작은 숲」을 못 보고 같은 맵을 두 번 더 짓게 배정했다.
test("liveProject lets a read-only lead see members' published maps", async () => {
  const base = createBlankProject();
  const live = structuredClone(base);
  live.maps.map_forest = { ...structuredClone(base.maps[base.startMapId]!), id: "map_forest", name: "작은 숲" };
  const events: PiAgentEvent[] = [];
  const done = await runPiAgent(request({ project: base }), {
    toolNames: ["get_database_records"],
    liveProject: () => live,
    onEvent: event => events.push(event),
    streamFn: scriptedStream([], [{ name: "get_database_records", args: { collection: "maps" } }]) as never,
  });
  const end = events.find(event => event.type === "tool_end" && (event as { name?: string }).name === "get_database_records") as { summary?: string } | undefined;
  expect(end?.summary).toContain("2건");
  // 도구가 끝나면 제 사본으로 돌아간다 — 남의 변경을 이 실행의 결과로 내보내지 않는다.
  expect(done.project.maps.map_forest).toBeUndefined();
});
