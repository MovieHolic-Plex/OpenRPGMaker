import { describe, expect, it } from "vitest";

async function load() {
  const [{ AssistantSession }, { createBlankProject }, llm] = await Promise.all([
    import("@/ai/assistantSession"),
    import("@/project/defaults"),
    import("@/ai/llmClient"),
  ]);
  return { AssistantSession, createBlankProject, llm };
}

type ChatResult = import("@/ai/llmClient").ChatResult;

// 스크립트된 응답을 순서대로 돌려주는 가짜 chat.
function scriptedChat(steps: readonly ChatResult[]) {
  let i = 0;
  return async (): Promise<ChatResult> => {
    if (i >= steps.length) throw new Error("scripted chat exhausted");
    return steps[i++];
  };
}

function assistantToolCall(name: string, args: unknown, id = `c_${name}`, content: string | null = null): ChatResult {
  return {
    message: { role: "assistant", content, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
  } as ChatResult;
}

function assistantFinal(text: string): ChatResult {
  return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
}

const CONFIG = { baseUrl: "x", model: "minimax/minimax-m3", liteModel: "minimax/minimax-m3", apiKey: "sk", maxToolCalls: 8, maxTokens: 512 };

describe("AssistantSession 툴콜 루프", () => {
  it("메인 세션은 config.model을 그대로 chat 함수에 전달한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seenModels: string[] = [];
    const chat = async (config: { readonly model: string }): Promise<ChatResult> => {
      seenModels.push(config.model);
      return assistantFinal("완료");
    };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...CONFIG, model: "main-session-model", liteModel: "lite-session-model" },
      chat,
    });

    await session.sendUserMessage("안녕", () => {});

    expect(seenModels).toEqual(["main-session-model"]);
    expect(JSON.parse(session.exportAudit()).model).toBe("main-session-model");
  }, 30000);

  it("연쇄 툴콜 2개(읽기→쓰기) 후 최종 응답을 반환하고 쓰기만 제안에 담는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([
      assistantToolCall("get_project_summary", {}),
      assistantToolCall("create_map", { id: "m1", name: "새 맵", width: 6, height: 6 }, "c_create_map"),
      assistantFinal("맵을 만들었습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

    const events: string[] = [];
    const result = await session.sendUserMessage("맵 하나 만들어줘", (e) => {
      if (e.type === "tool_call") events.push(`${e.name}:${e.result.ok}`);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("맵을 만들었습니다.");
    expect(events).toEqual(["get_project_summary:true", "create_map:true"]);
    // 읽기 툴은 제안에서 제외, 쓰기 툴만 포함.
    expect(result.proposedCalls.map((c) => c.name)).toEqual(["create_map"]);
    expect(result.proposedCalls[0].result.diff?.mapsAdded).toBe(1);
  }, 30000);

  it("자가수정: 커밋/검증 실패 → issues 반환 → 재시도 → 성공", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([
      assistantToolCall("create_map", { id: "m1", name: "t", width: 5, height: 5 }, "c_create_map"),
      // 맵 밖 좌표 → ToolError → ok:false + issues.
      assistantToolCall("set_start_position", { mapId: "m1", x: 99, y: 99 }, "c_sp1"),
      // 통행 가능한 내부 좌표로 수정 → 성공.
      assistantToolCall("set_start_position", { mapId: "m1", x: 2, y: 2 }, "c_sp2"),
      assistantFinal("시작 위치를 고쳤습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

    const toolEvents: { name: string; ok: boolean }[] = [];
    const result = await session.sendUserMessage("시작 위치 잡아줘", (e) => {
      if (e.type === "tool_call") toolEvents.push({ name: e.name, ok: e.result.ok });
    });

    expect(result.stoppedReason).toBe("final");
    // 실패한 시도와 성공한 시도가 모두 관측되어야 한다.
    const startAttempts = toolEvents.filter((e) => e.name === "set_start_position");
    expect(startAttempts.map((e) => e.ok)).toEqual([false, true]);

    // 실패 결과가 tool 메시지로 모델에 되돌려졌는지(자가수정 신호) 확인.
    const toolMessages = session.getMessages().filter((m) => m.role === "tool");
    const failedMsg = toolMessages.find((m) => typeof m.content === "string" && m.content.includes('"ok":false'));
    expect(failedMsg).toBeDefined();
    expect(failedMsg!.content).toContain("issues");

    // 제안에는 성공한 쓰기 툴콜만(create_map + 성공한 set_start_position).
    const names = result.proposedCalls.map((c) => c.name).sort();
    expect(names).toEqual(["create_map", "set_start_position"]);
  }, 30000);

  it("maxToolCalls 상한에 도달하면 현재까지의 제안을 반환한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    // 항상 툴콜만 반복(최종 응답 없음).
    let n = 0;
    const chat = async (): Promise<ChatResult> => {
      n += 1;
      return assistantToolCall("get_project_summary", {}, `c${n}`);
    };
    const session = new AssistantSession(createBlankProject(), { config: { ...CONFIG, maxToolCalls: 3 }, chat });
    const result = await session.sendUserMessage("계속 조회해", () => {});
    expect(result.stoppedReason).toBe("max-tool-calls");
    expect(n).toBe(3);
  }, 30000);

  it("감사 로그를 JSON으로 내보낸다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([assistantFinal("안녕하세요.")]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    await session.sendUserMessage("안녕", () => {});
    const audit = JSON.parse(session.exportAudit());
    expect(audit.model).toBe(CONFIG.model);
    // at(ISO 타임스탬프)는 결함 ⑬(구조화 세션 로그)에서 추가 — 내용 필드만 고정 검증.
    expect(audit.entries[0]).toMatchObject({ kind: "user", text: "안녕" });
    expect(typeof audit.entries[0].at).toBe("string");
    expect(audit.entries.some((e: { kind: string }) => e.kind === "assistant")).toBe(true);
  }, 30000);
});
