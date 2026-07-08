import { describe, expect, it } from "vitest";

async function load() {
  const [{ AssistantSession, hasRawToolCallMarkup, sanitizeAssistantText }, { createBlankProject }, llm] = await Promise.all([
    import("@/ai/assistantSession"),
    import("@/project/defaults"),
    import("@/ai/llmClient"),
  ]);
  return { AssistantSession, createBlankProject, llm, hasRawToolCallMarkup, sanitizeAssistantText };
}

type ChatResult = import("@/ai/llmClient").ChatResult;
type ChatRequest = import("@/ai/llmClient").ChatRequest;

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
const ORCH_CONFIG = { ...CONFIG, model: "supervisor-model", liteModel: "executor-model", maxToolCalls: 12 };
const RAW_TOOL_MARKUP_FIXTURE = `적용됨이어서 길을 깐 뒤 NPC 5명을 배치하겠습니다...]<]minimax[>[<tool_call>]<]minimax[>[<invoke name="proposetilevocabulary">...`;

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

  it("쓰기 툴이 시작되면 이후 호출은 실행 모델로 전환하고 검수는 감독 모델로 돌아온다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      assistantFinal("실행 완료"),
      assistantFinal("완료: 타이틀을 바꿨습니다."),
    ];
    let index = 0;
    const seenModels: string[] = [];
    const requests: ChatRequest[] = [];
    const chat = async (config: { readonly model: string }, req: ChatRequest): Promise<ChatResult> => {
      seenModels.push(config.model);
      requests.push({ ...req, messages: [...req.messages] });
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage("타이틀을 새 제목으로 바꿔줘", (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("타이틀을 바꿨습니다.");
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["set_title_screen"]);
    expect(seenModels).toEqual(["supervisor-model", "executor-model", "supervisor-model"]);
    expect(phases).toEqual(["plan", "execute", "review"]);
    expect(requests[1]?.messages.some((message) => message.role === "user" && message.content === "[오케스트레이션] 실행 단계: 계획을 충실히 수행, 누락 없이 완료 후 종료. 새 질문 금지")).toBe(true);
    expect(requests[2]?.tool_choice).toBeUndefined();
    expect(requests[2]?.tools).toBeUndefined();
    expect(requests[2]?.messages.some((message) => message.role === "user" && typeof message.content === "string" && message.content.startsWith("[오케스트레이션] 검수 단계:"))).toBe(true);
    expect(session.getMessages().some((message) => message.role === "system" && message.content === "실행 단계: 계획을 충실히 수행, 누락 없이 완료 후 종료. 새 질문 금지")).toBe(false);
    expect(session.getMessages().some((message) => typeof message.content === "string" && message.content.startsWith("[오케스트레이션] "))).toBe(false);
  }, 30000);

  it("검수가 미이행을 발견하면 실행 모델로 한 번 재투입한 뒤 감독 모델이 최종 응답한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    const mapId = project.startMapId;
    const spec = {
      mapId,
      title: "길과 꽃",
      assets: [
        { id: "길", kind: "road", x: 1, y: 1, w: 2, h: 2 },
        { id: "꽃", kind: "decor", x: 4, y: 1, w: 2, h: 2 },
      ],
    };
    const steps = [
      assistantToolCall("set_build_spec", spec, "c_spec"),
      assistantToolCall("paint_tiles", { mapId, mode: "rect", layer: "lower", tile: 240, from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }, "c_road"),
      assistantFinal("1차 실행 완료"),
      assistantFinal("재실행: 꽃 영역도 칠하세요."),
      assistantToolCall("paint_tiles", { mapId, mode: "rect", layer: "upper", tile: 88, from: { x: 4, y: 1 }, to: { x: 5, y: 2 } }, "c_flowers"),
      assistantFinal("보완 실행 완료"),
      assistantFinal("완료: 길과 꽃을 모두 제안했습니다."),
    ];
    let index = 0;
    const seenModels: string[] = [];
    const chat = async (config: { readonly model: string }): Promise<ChatResult> => {
      seenModels.push(config.model);
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(project, { config: ORCH_CONFIG, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage("길과 꽃을 칠해줘", (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("길과 꽃을 모두 제안했습니다.");
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["paint_tiles", "paint_tiles"]);
    expect(seenModels).toEqual([
      "supervisor-model",
      "supervisor-model",
      "executor-model",
      "supervisor-model",
      "executor-model",
      "executor-model",
      "supervisor-model",
    ]);
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
  }, 30000);

  it("검수 응답이 raw 툴콜 마크업이면 원문 노출 없이 1회 재투입한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      assistantFinal("실행 완료"),
      assistantFinal(RAW_TOOL_MARKUP_FIXTURE),
      assistantFinal("보완 실행 완료"),
      assistantFinal("완료: 타이틀 변경을 제안했습니다."),
    ];
    let index = 0;
    const requests: ChatRequest[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      requests.push({ ...req, messages: [...req.messages] });
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage("타이틀을 새 제목으로 바꿔줘", (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("타이틀 변경을 제안했습니다.");
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
    expect(requests[3]?.messages.some((message) =>
      message.role === "user" &&
      typeof message.content === "string" &&
      message.content.includes("[오케스트레이션] 검수 보완 지시: 검수 응답이 툴콜 원시 마크업으로 깨졌습니다")
    )).toBe(true);
    const serializedMessages = JSON.stringify(session.getMessages());
    expect(serializedMessages).not.toContain("<tool_call>");
    expect(serializedMessages).not.toContain("]<]minimax[>[");
    expect(serializedMessages).not.toContain("<invoke name=");
  }, 30000);

  it("집 3채 NPC 5명 요청에서 집 1채만 제안되면 검수가 완료라고 답해도 missingWarnings로 재투입한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const spec = {
      mapId: "m1",
      title: "작은 집 3채와 NPC 5명",
      assets: [
        { id: "house1", kind: "house", x: 2, y: 2, w: 6, h: 6 },
        { id: "house2", kind: "house", x: 12, y: 2, w: 6, h: 6 },
        { id: "house3", kind: "house", x: 22, y: 2, w: 6, h: 6 },
        { id: "npc1", kind: "npc", x: 4, y: 12, w: 1, h: 1 },
        { id: "npc2", kind: "npc", x: 8, y: 12, w: 1, h: 1 },
        { id: "npc3", kind: "npc", x: 12, y: 12, w: 1, h: 1 },
        { id: "npc4", kind: "npc", x: 16, y: 12, w: 1, h: 1 },
        { id: "npc5", kind: "npc", x: 20, y: 12, w: 1, h: 1 },
      ],
    };
    const steps = [
      assistantToolCall("create_map", { id: "m1", name: "작은 마을", width: 40, height: 40 }, "c_map"),
      assistantToolCall("set_build_spec", spec, "c_spec"),
      assistantToolCall("build_house_kit", { mapId: "m1", kitId: "blue-stone", wings: [{ x: 2, y: 2, w: 6, h: 6 }], interior: false, windows: false }, "c_house1"),
      assistantFinal("집 1채를 제안했습니다."),
      assistantFinal("완료: 충분합니다."),
      assistantFinal("보완 실행 완료"),
      assistantFinal("완료: 현재 제안과 부족분을 보고합니다."),
    ];
    let index = 0;
    const requests: ChatRequest[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      requests.push({ ...req, messages: [...req.messages] });
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { config: { ...ORCH_CONFIG, maxToolCalls: 16 }, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage("40x40 맵에 작은 집 3채 NPC 5명 배치해줘", (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
    expect(requests[5]?.messages.some((message) =>
      message.role === "user" &&
      typeof message.content === "string" &&
      message.content.includes("[오케스트레이션] 검수 보완 지시: 검수에서 아래 미이행이 발견되었습니다")
    )).toBe(true);
    expect(JSON.stringify(requests[5]?.messages)).toContain("house2");
    expect(JSON.stringify(requests[5]?.messages)).toContain("npc1");
  }, 30000);

  it("최종 텍스트의 minimax raw 툴콜 마크업은 잘라내고 안내로 대체한다", async () => {
    const { AssistantSession, createBlankProject, hasRawToolCallMarkup, sanitizeAssistantText } = await load();
    expect(hasRawToolCallMarkup(RAW_TOOL_MARKUP_FIXTURE)).toBe(true);
    expect(sanitizeAssistantText(RAW_TOOL_MARKUP_FIXTURE)).toBe("적용됨이어서 길을 깐 뒤 NPC 5명을 배치하겠습니다...…(형식 오류로 일부 생략)");

    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: scriptedChat([assistantFinal(RAW_TOOL_MARKUP_FIXTURE)]) });
    const result = await session.sendUserMessage("이어 진행해", () => {});

    expect(result.assistantText).toContain("형식 오류로 일부 생략");
    expect(result.assistantText).not.toContain("<tool_call>");
    expect(result.assistantText).not.toContain("]<]minimax[>[");
    expect(result.assistantText).not.toContain("<invoke name=");
  }, 30000);

  it("단순 대화 턴은 전환 없이 감독 모델 한 번으로 끝난다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seenModels: string[] = [];
    const chat = async (config: { readonly model: string }): Promise<ChatResult> => {
      seenModels.push(config.model);
      return assistantFinal("안녕하세요.");
    };
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage("안녕", (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("안녕하세요.");
    expect(result.proposedCalls).toEqual([]);
    expect(seenModels).toEqual(["supervisor-model"]);
    expect(phases).toEqual(["plan"]);
  }, 30000);
});
