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

const CONFIG = { authMode: "apiKey" as const, baseUrl: "x", model: "minimax/minimax-m3", liteModel: "minimax/minimax-m3", apiKey: "sk", maxToolCalls: 8, maxTokens: 512 };
const ORCH_CONFIG = { ...CONFIG, model: "supervisor-model", liteModel: "executor-model", maxToolCalls: 12 };
// 플래너 라운드(오케스트레이션 게이트 통과 시 항상 선행)가 소비하는 1스텝 — direct 로 통과시킨다.
const PLANNER_DIRECT = assistantFinal('{"action":"direct","reason":"한 턴으로 충분"}');
const RAW_TOOL_MARKUP_FIXTURE = `적용됨이어서 길을 깐 뒤 NPC 5명을 배치하겠습니다...]<]minimax[>[<tool_call>]<]minimax[>[<invoke name="proposetilevocabulary">...`;

/** 검수 단계 진입 조건(writeToolAttempts > 8)을 맞추기 위한 채움용 쓰기 9회(단일 응답).
 *  paint_tiles 는 tilesChanged>0 의 의미있는 diff 를 내고(미이행 휴리스틱 오염 방지),
 *  동일 인자 반복이므로 제안 키가 같아 1건으로 중복제거된다. */
function nineWriteCalls(args: Record<string, unknown> = { mapId: "map_blank_start", mode: "rect", layer: "lower", tile: 240, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }): ChatResult {
  const calls = Array.from({ length: 9 }, (_, i) => ({
    id: `c_filler_${i}`,
    type: "function" as const,
    function: { name: "paint_tiles", arguments: JSON.stringify(args) },
  }));
  return {
    message: { role: "assistant" as const, content: null, tool_calls: calls },
    finishReason: "tool_calls",
  } as ChatResult;
}

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

    // 이원화 config 라 플래너 라운드가 선행한다 — 플래너도 감독(config.model)을 쓰므로 두 호출 모두 main 모델.
    expect(seenModels).toEqual(["main-session-model", "main-session-model"]);
    expect(JSON.parse(session.exportAudit()).model).toBe("main-session-model");
  }, 30000);

  it("집만 요청하면 LLM 전에 실내/야외 선택지를 되묻고 툴을 호출하지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let chatCalls = 0;
    const chat = async (): Promise<ChatResult> => {
      chatCalls += 1;
      return assistantFinal("이 응답은 나오면 안 됨");
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const result = await session.sendUserMessage("집 하나 만들어줘", () => {});
    expect(chatCalls).toBe(0);
    expect(result.proposedCalls).toEqual([]);
    expect(result.assistantText).toContain("실내 맵으로");
    expect(result.assistantText).toContain("[선택지]");
    const audit = JSON.parse(session.exportAudit()) as { entries: { kind: string; text?: string }[] };
    expect(audit.entries.some((entry) => entry.kind === "status" && entry.text?.includes("의도 확인"))).toBe(true);
  }, 30000);

  it("실내 표지가 있으면 되묻지 않고 LLM으로 진행한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let chatCalls = 0;
    const chat = async (): Promise<ChatResult> => {
      chatCalls += 1;
      return assistantFinal("실내 준비");
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const result = await session.sendUserMessage("연금술사의 집 이라는 실내 를 하나 만드렁줘", () => {});
    expect(chatCalls).toBe(1);
    expect(result.assistantText).toBe("실내 준비");
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
      PLANNER_DIRECT,
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      // 검수 단계 진입 조건(writeToolAttempts > 8)을 맞추는 채움 쓰기 — paint_tiles 채움이 제안에 함께 남는다.
      nineWriteCalls(),
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
    // 채움 paint_tiles 는 실패 툴이라 제안에 남지 않는다 — 주 쓰기 1건만.
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["set_title_screen"]);
    // 플래너 라운드가 앞에 하나 더 붙는다(감독 모델). 채움 쓰기 응답이 execute 라운드 하나 더를 만든다:
    // planner(감독) → plan(감독) → execute(실행) → 채움(실행) → review(감독).
    expect(seenModels).toEqual(["supervisor-model", "supervisor-model", "executor-model", "executor-model", "supervisor-model"]);
    expect(phases).toEqual(["plan", "execute", "review"]);
    expect(requests[2]?.messages.some((message) => message.role === "user" && typeof message.content === "string" && message.content.startsWith("[오케스트레이션] 실행 단계:"))).toBe(true);
    expect(requests[4]?.tool_choice).toBeUndefined();
    expect(requests[4]?.tools).toBeUndefined();
    expect(requests[4]?.messages.some((message) => message.role === "user" && typeof message.content === "string" && message.content.startsWith("[오케스트레이션] 검수 단계:"))).toBe(true);
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
      PLANNER_DIRECT,
      assistantToolCall("set_build_spec", spec, "c_spec"),
      assistantToolCall("paint_tiles", { mapId, mode: "rect", layer: "lower", tile: 240, from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }, "c_road"),
      // 검수 단계 진입 조건(writeToolAttempts > 8) — 같은 제안 키로 덮어쓰여 제안 1건 유지.
      nineWriteCalls(),
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
    // 길 + 꽃 + 검수 진입용 paint_tiles 채움(동일 인자 반복이라 1건) 3건.
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["paint_tiles", "paint_tiles", "paint_tiles"]);
    expect(seenModels).toEqual([
      "supervisor-model",
      "supervisor-model",
      "supervisor-model",
      "executor-model",
      // 검수 진입 조건 충족용 paint_tiles 채움 라운드(실행 모델).
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
      PLANNER_DIRECT,
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      // 검수 단계 진입 조건(writeToolAttempts > 8).
      nineWriteCalls(),
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
    const session = new AssistantSession(createBlankProject(), { config: { ...ORCH_CONFIG, maxToolCalls: 24 }, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage("타이틀을 새 제목으로 바꿔줘", (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("타이틀 변경을 제안했습니다.");
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
    expect(requests[5]?.messages.some((message) =>
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
      PLANNER_DIRECT,
      assistantToolCall("create_map", { id: "m1", name: "작은 마을", width: 40, height: 40 }, "c_map"),
      assistantToolCall("set_build_spec", spec, "c_spec"),
      assistantToolCall("build_house_kit", { mapId: "m1", kitId: "blue-stone", wings: [{ x: 2, y: 2, w: 6, h: 6 }], interior: false, windows: false }, "c_house1"),
      // 검수 단계 진입 조건(writeToolAttempts > 8).
      nineWriteCalls(),
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
    const session = new AssistantSession(createBlankProject(), { config: { ...ORCH_CONFIG, maxToolCalls: 32, maxTokens: 8192 }, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage("40x40 맵에 작은 집 3채 NPC 5명 배치해줘", (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
    expect(requests[7]?.messages.some((message) =>
      message.role === "user" &&
      typeof message.content === "string" &&
      message.content.includes("[오케스트레이션] 검수 보완 지시: 검수에서 아래 미이행이 발견되었습니다")
    )).toBe(true);
    expect(JSON.stringify(requests[8]?.messages)).toContain("house2");
    expect(JSON.stringify(requests[8]?.messages)).toContain("npc1");
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

  it("오케스트레이션에서 변경 기대 요청이 0건 비질문으로 끝나면 한 번 재킥해 실행한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      PLANNER_DIRECT,
      assistantFinal("먼저 확인하겠습니다."),
      assistantToolCall("set_title_screen", { title: "재킥 제목" }, "c_title"),
      // 검수 단계 진입 조건(writeToolAttempts > 8).
      nineWriteCalls(),
      assistantFinal("실행 완료"),
      assistantFinal("완료: 타이틀을 바꿨습니다."),
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

    const result = await session.sendUserMessage("타이틀을 재킥 제목으로 바꿔줘", (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["set_title_screen"]);
    expect(result.assistantText).toBe("타이틀을 바꿨습니다.");
    expect(phases).toEqual(["plan", "execute", "review"]);
    expect(requests[2]?.messages.some((message) =>
      message.role === "user" &&
      message.content === "[오케스트레이션] 사용자는 변경을 기대합니다. 질문이 아니면 지금 계획을 세우고 실행하세요"
    )).toBe(true);
  }, 30000);

  it("오케스트레이션 0건 종료라도 질문이면 재킥하지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let calls = 0;
    const chat = async (): Promise<ChatResult> => {
      calls += 1;
      // 첫 호출은 플래너 라운드 — direct 로 통과시킨다.
      if (calls === 1) return assistantFinal('{"action":"direct","reason":"단순 요청"}');
      return assistantFinal("어떤 제목으로 바꿀까요?\n[선택지] 숲 | 바다");
    };
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });

    const result = await session.sendUserMessage("타이틀을 바꿔줘", () => {});

    expect(result.stoppedReason).toBe("final");
    expect(result.proposedCalls).toEqual([]);
    expect(result.assistantText).toContain("어떤 제목");
    // 플래너 1 + 본문 1.
    expect(calls).toBe(2);
  }, 30000);

  it("0건 조기 종료 재킥은 한 턴에 한 번만 쓴다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      PLANNER_DIRECT,
      assistantFinal("먼저 확인하겠습니다."),
      assistantFinal("곧 진행하겠습니다."),
    ];
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });

    const result = await session.sendUserMessage("마을을 꾸며줘", () => {});

    expect(result.stoppedReason).toBe("final");
    expect(result.proposedCalls).toEqual([]);
    expect(result.assistantText).toBe("곧 진행하겠습니다.");
    // 플래너 1 + 재킥 전 1 + 재킥 후 1.
    expect(index).toBe(3);
  }, 30000);

  it("비오케스트레이션 세션은 0건 조기 종료 재킥을 하지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let calls = 0;
    const chat = async (): Promise<ChatResult> => {
      calls += 1;
      return assistantFinal("먼저 확인하겠습니다.");
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

    const result = await session.sendUserMessage("타이틀을 바꿔줘", () => {});

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("먼저 확인하겠습니다.");
    expect(result.proposedCalls).toEqual([]);
    expect(calls).toBe(1);
  }, 30000);

  it("단순 대화 턴은 전환 없이 감독 모델 한 번으로 끝난다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seenModels: string[] = [];
    const chat = async (config: { readonly model: string }): Promise<ChatResult> => {
      seenModels.push(config.model);
      // 첫 호출은 플래너(감독 모델) — direct 로 통과. 본문 턴도 감독 모델 한 번.
      if (seenModels.length === 1) return assistantFinal('{"action":"direct","reason":"인사"}');
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
    // 플래너 1 + 본문 1 — 모두 감독 모델, 모델 전환 없음.
    expect(seenModels).toEqual(["supervisor-model", "supervisor-model"]);
    expect(phases).toEqual(["plan"]);
  }, 30000);
});

describe("agentMode 오케스트레이션 게이트", () => {
  const PLANNER_START = "planner:start";

  function plannerStarted(audit: readonly { kind: string; text?: string }[]): boolean {
    return audit.some((entry) => entry.kind === "status" && entry.text === PLANNER_START);
  }

  it("기본 설정(agentMode auto)은 단일 모델에서도 플래너 라운드를 돈다", async () => {
    const { AssistantSession, createBlankProject, llm } = await load();
    const chat = scriptedChat([
      assistantFinal('{"action":"direct","reason":"간단한 요청"}'),
      assistantFinal("완료했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: llm.defaultAiConfig(), chat });

    await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});

    // default config = agentMode "auto" → model === liteModel 여부와 무관하게 플래너가 돈다.
    expect(plannerStarted(session.getAuditEntries())).toBe(true);
  }, 30000);

  it("agentMode chat + 단일 모델은 종래대로 플래너를 돌지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([assistantFinal("완료했습니다.")]);
    // CONFIG 는 model === liteModel 단일 모델.
    const session = new AssistantSession(createBlankProject(), { config: { ...CONFIG, authMode: "apiKey" as const, agentMode: "chat" as const }, chat });

    await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});

    expect(plannerStarted(session.getAuditEntries())).toBe(false);
  }, 30000);

  it("agentMode chat + 이원화 모델은 여전히 플래너를 돈다 (종래 동작 유지)", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([
      assistantFinal('{"action":"direct","reason":"한 턴으로 충분"}'),
      assistantFinal("완료했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: { ...ORCH_CONFIG, authMode: "apiKey" as const, agentMode: "chat" as const }, chat });

    await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});

    expect(plannerStarted(session.getAuditEntries())).toBe(true);
  }, 30000);

  it("형상 고정(사전 agentMode 없음): 이원화 모델은 플래너가 돈다 — 종래 동작", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([
      assistantFinal('{"action":"direct","reason":"한 턴으로 충분"}'),
      assistantFinal("완료했습니다."),
    ]);
    // agentMode 키를 아예 설정하지 않은 세션(구형 저장 blob/테스트 주입 config)은 종래 판정을 유지한다.
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });

    await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});

    expect(plannerStarted(session.getAuditEntries())).toBe(true);
  }, 30000);

  it("노출 증명: auto+단일 모델은 set_work_plan 계획 툴이 노출되고, chat+단일 모델은 노출되지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const exposedToolNames = async (config: Record<string, unknown>): Promise<string[]> => {
      const names: string[] = [];
      const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
        for (const tool of req.tools ?? []) names.push(tool.function.name);
        if (names.length === 0) return assistantFinal('{"action":"direct","reason":"한 턴으로 충분"}');
        return assistantFinal("완료했습니다.");
      };
      const session = new AssistantSession(createBlankProject(), { config: config as never, chat });
      await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});
      return [...new Set(names)];
    };

    const autoNames = await exposedToolNames({ ...CONFIG, authMode: "apiKey" as const, agentMode: "auto" as const });
    expect(autoNames).toContain("set_work_plan");

    const chatNames = await exposedToolNames({ ...CONFIG, authMode: "apiKey" as const, agentMode: "chat" as const });
    expect(chatNames).not.toContain("set_work_plan");
  }, 30000);
});

// 하네스 관측(2026-07-09): 오케스트레이션 주입·토큰 사용이 감사 로그에 남고,
// getHarnessSnapshot이 뷰어(🔬)/window.__rpgzzuAiHarness에 원본을 제공한다.
describe("하네스 관측", () => {
  it("오케스트레이션 주입 원문이 감사 로그에 남고 턴 종료 라인에 출력 토큰이 붙는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      PLANNER_DIRECT,
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      // 검수 단계 진입 조건(writeToolAttempts > 8) — 주입 2건(실행 힌트+검수 프롬프트)을 내기 위함.
      nineWriteCalls(),
      assistantFinal("실행 완료"),
      assistantFinal("완료: 타이틀을 바꿨습니다."),
    ];
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat: scriptedChat(steps) });

    await session.sendUserMessage("타이틀을 새 제목으로 바꿔줘", () => {});

    const entries = session.getAuditEntries();
    const injections = entries.filter(
      (entry) => entry.kind === "status" && entry.text.startsWith("오케스트레이션 주입: ")
    );
    // 실행 힌트 + 검수 프롬프트 — 주입이 UI에 전혀 안 보이던 공백을 감사 로그가 메운다.
    expect(injections.length).toBeGreaterThanOrEqual(2);
    const turnEnd = entries.find((entry) => entry.kind === "status" && entry.text.startsWith("턴 종료(final)"));
    expect(turnEnd?.kind).toBe("status");
    expect(turnEnd && turnEnd.kind === "status" ? turnEnd.text : "").toMatch(/출력 토큰 ~\d+/);
  }, 30000);

  it("getHarnessSnapshot은 모델 구성과 메시지·감사 로그 사본을 돌려준다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      assistantFinal("실행 완료"),
      assistantFinal("완료: 타이틀을 바꿨습니다."),
    ];
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat: scriptedChat(steps) });
    await session.sendUserMessage("타이틀을 새 제목으로 바꿔줘", () => {});

    const snapshot = session.getHarnessSnapshot();

    expect(snapshot.model).toBe("supervisor-model");
    expect(snapshot.liteModel).toBe("executor-model");
    expect(snapshot.maxTokens).toBe(512);
    expect(snapshot.messages.length).toBe(session.getMessages().length);
    expect(snapshot.audit.length).toBe(session.getAuditEntries().length);
    // 사본 계약: 스냅샷 배열은 세션 내부 배열과 다른 인스턴스여야 한다(외부 조작 차단).
    expect(snapshot.audit).not.toBe(session.getAuditEntries());
  }, 30000);
});

/**
 * 실측 결함(2026-07-29 region-task-log): 어시스턴트가 `set_build_spec`(밑그림)만 확정하고
 * 실제 쓰기 툴(place_npc)을 한 번도 호출하지 않은 채 "승인 후 진행됩니다"라고 말하고 끝냈다.
 * proposedCalls=0 이므로 승인할 대상이 없고, UI 에는 승인 버튼이 뜰 수 없다 —
 * 사용자는 없는 버튼을 찾게 된다. 진짜 결함은 "아무것도 안 하고 했다고 말한 것"이다.
 *
 * 원인 두 가지를 각각 고정한다:
 *  (1) 빈손 종료 안전망(zero-change-rekick)이 `orchestrated` 게이트 뒤에 있었다.
 *      model === liteModel 인 단일 모델 설정에서는 orchestrated=false 라 안전망이 꺼진다.
 *  (2) 밑그림만 확정한 턴을 완료로 인정했다. 명세에 에셋이 있는데 그 에셋을 지은
 *      쓰기 툴이 0건이면 그 턴은 미완이다.
 */
describe("밑그림만 그리고 끝내는 턴", () => {
  const SPEC_ARGS = {
    mapId: "map_blank_start",
    title: "선택 영역 잡화점 상인 배치",
    assets: [{ id: "merchant_npc", kind: "npc", x: 5, y: 5, w: 1, h: 1, style: "잡화점 상인", overExisting: "keep" }],
    buildOrder: ["npc"],
    density: "normal",
    layoutStyle: "straight",
    pathWidth: 1,
  };

  it("단일 모델에서도 쓰기 0건 종료를 감지해 실행을 다시 요구한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    // CONFIG 는 model === liteModel — 감독님 로그와 같은 단일 모델 조건이다.
    const chat = scriptedChat([
      assistantToolCall("set_build_spec", SPEC_ARGS),
      assistantFinal("잡화점 상인 NPC 1명을 배치할 예정입니다. 실제 배치는 사용자 승인 후 진행됩니다."),
      assistantFinal("다시 확인했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: { ...CONFIG, authMode: "apiKey" as const }, chat });

    await session.sendUserMessage("이 자리에 잡화점 상인 NPC 하나 배치해줘", () => {});

    const audit = session.getAuditEntries();
    const rekicked = audit.some((entry) => entry.kind === "status" && String(entry.text).includes("zero-change-rekick"));
    expect(rekicked).toBe(true);
  }, 30000);

  it("밑그림 에셋을 지은 쓰기 툴이 없으면 미이행 경고를 남긴다", async () => {
    const { proposalCompletenessWarnings } = await import("@/ai/proposalCompleteness");

    // 쓰기 툴이 하나도 없는 상태 = 감독님 로그의 실제 상황(calls: []).
    const warnings = proposalCompletenessWarnings({
      requestText: "이 자리에 잡화점 상인 NPC 하나 배치해줘",
      assistantText: "배치할 예정입니다. 사용자 승인 후 진행됩니다.",
      buildSpec: SPEC_ARGS as unknown as import("@/ai/buildSpec").BuildSpec,
      calls: [],
    });

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes("미이행"))).toBe(true);
  }, 30000);

  it("모델이 place_npc 를 부르지 않아도 밑그림의 npc 에셋을 직접 배치해 이벤트를 만든다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    // 모델은 끝까지 place_npc 를 부르지 않는다 — 밑그림만 내고 "승인 후 진행"이라 말한다.
    // 재킥(1회) 후에도 같은 태도를 유지하는, 감독 로그보다 더 나쁜 시나리오다.
    const chat = scriptedChat([
      assistantToolCall("set_build_spec", SPEC_ARGS),
      assistantFinal("잡화점 상인을 배치할 예정입니다. 사용자 승인 후 진행됩니다."),
      assistantFinal("밑그림은 이미 확정했습니다. 승인해 주세요."),
    ]);
    const session = new AssistantSession(createBlankProject(), {
      config: { ...CONFIG, authMode: "apiKey" as const },
      chat,
    });

    const result = await session.sendUserMessage("이 자리에 잡화점 상인 NPC 하나 배치해줘", () => {});

    // 코드가 직접 실행했으므로 승인할 제안이 생긴다(이전에는 0건이라 승인 버튼이 없었다).
    const npcProposals = result.proposedCalls.filter((call) => call.name === "place_npc");
    expect(npcProposals.length).toBe(1);

    // 감사 로그에 자동 실행 흔적이 남는다.
    const audit = session.getAuditEntries();
    expect(audit.some((e) => e.kind === "status" && String(e.text).includes("spec-npc-autobuild"))).toBe(true);

    // 핵심: 실제 이벤트가 페이지·커맨드까지 컴파일됐는가. 상점 역할이므로 shop 커맨드가 있어야 한다.
    const diff = npcProposals[0]!.result.diff;
    expect(diff).toBeTruthy();
    expect(diff?.eventsAdded ?? 0).toBe(1);
  }, 30000);
});
