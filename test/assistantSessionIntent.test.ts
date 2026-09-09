// 세션 라우팅은 의도 선언(모델이 읽은 것)만 소비한다 — 되묻기·플래너 스킵·플래너 direct 존중·볼륨 막대·
// 툴 노출·선택 영역 노트·수정 대상 맵. 문장 키워드로 추측하는 경로가 없음을 세션 루프로 증명한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import type { SessionEvent } from "@/ai/assistantSession";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { declaredIntent, fixedDeclarer } from "./intentFixture";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";

beforeEach(resetIntentDeclarationCache);
afterEach(() => {
  resetIntentDeclarationCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function load() {
  const [assistantSession, defaults] = await Promise.all([
    import("@/ai/assistantSession"),
    import("@/project/defaults"),
  ]);
  return { AssistantSession: assistantSession.AssistantSession, isWriteToolName: assistantSession.isWriteToolName, createBlankProject: defaults.createBlankProject };
}

function toolCallResult(name: string, args: unknown, id: string): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalResult(text: string): ChatResult {
  return { message: { role: "assistant" as const, content: text }, finishReason: "stop" } as ChatResult;
}

function exhausted(): never {
  throw new (class extends Error {
    readonly status = 401;
    constructor() {
      super("scripted chat exhausted");
      this.name = "LlmError";
    }
  })();
}

function scriptedChat(steps: readonly ChatResult[], seen: ChatRequest[] = []): (config: unknown, req: ChatRequest) => Promise<ChatResult> {
  let index = 0;
  return async (_config, req) => {
    seen.push(req);
    return index < steps.length ? steps[index++]! : exhausted();
  };
}

const CHAT_CONFIG = {
  authMode: "apiKey" as const,
  agentMode: "chat" as const,
  baseUrl: "x",
  model: "single-model",
  liteModel: "single-model",
  apiKey: "sk",
  maxToolCalls: 6,
  maxTokens: 512,
};
const AUTO_CONFIG = { ...CHAT_CONFIG, agentMode: "auto" as const };

function statuses(session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] {
  return session.getAuditEntries().filter((entry) => entry.kind === "status").map((entry) => String(entry.text));
}

function installHermetic(project: Project): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-test-project");
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
}

describe("의도 선언이 세션 라우팅을 정한다", () => {
  it("선언이 질문을 냈으면 chat 모드는 모델을 부르지 않고 그 질문으로 턴을 끝낸다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seen: ChatRequest[] = [];
    const session = new AssistantSession(createBlankProject(), {
      config: CHAT_CONFIG,
      chat: scriptedChat([finalResult("나오면 안 됨")], seen),
      declareIntent: fixedDeclarer({ space: "unclear", clarify: "집을 실내 맵으로 만들까요, 야외 외장으로 만들까요?", clarifyOptions: ["실내 맵", "야외 외장"] }),
    });
    const result = await session.sendUserMessage("집 하나 만들어줘", () => {});
    expect(seen).toHaveLength(0);
    expect(result.proposedCalls).toEqual([]);
    expect(result.assistantText).toContain("실내 맵으로 만들까요");
    expect(result.assistantText).toContain("[선택지] 실내 맵 | 야외 외장");
    expect(statuses(session).some((text) => text.startsWith("의도 확인:"))).toBe(true);
  }, 30000);

  it("auto 모드는 되묻기를 건너뛰지만 미완성 acceptance 를 성공으로 게시하지 않는다(F-05)", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seen: ChatRequest[] = [];
    const project = createBlankProject();
    installHermetic(project);
    const published: string[] = [];
    const session = new AssistantSession(project, {
      config: AUTO_CONFIG,
      chat: async (_config, request) => {
        seen.push(request);
        return finalResult("WRITER_SUCCESS_SENTINEL");
      },
      declareIntent: fixedDeclarer({ space: "unclear", clarify: "실내인가요 야외인가요?", needsPlan: false }),
    });
    const result = await session.sendUserMessage("집 하나 만들어줘", event => {
      if (event.type === "assistant_message") published.push(event.content);
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.length).toBeLessThanOrEqual(AUTO_CONFIG.maxToolCalls);
    expect(seen[0]?.tools?.length).toBeGreaterThan(0);
    expect(result.stoppedReason).toBe("error");
    expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(result.proposedCalls).toEqual([]);
    expect(result.appliedCalls ?? []).toEqual([]);
    expect(session.isDraftReviewApproved()).toBe(false);
    expect(result.assistantText).not.toContain("WRITER_SUCCESS_SENTINEL");
    expect(published.join("\n")).not.toContain("WRITER_SUCCESS_SENTINEL");
  }, 30000);

  it("선언자가 없으면 폴백 선언이다 — 되묻지 않고, 계획 여부는 플래너(direct)에게 넘긴다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seen: ChatRequest[] = [];
    const session = new AssistantSession(createBlankProject(), {
      config: AUTO_CONFIG,
      chat: scriptedChat([finalResult(JSON.stringify({ action: "direct", reason: "한 턴" })), finalResult("완료")], seen),
    });
    await session.sendUserMessage("집 하나 만들어줘", () => {});
    const audit = statuses(session);
    expect(audit.some((text) => text.startsWith("intent:fallback"))).toBe(true);
    expect(audit).toContain("planner:start");
    expect(audit.some((text) => text.startsWith("planner:direct"))).toBe(true);
    expect(audit.some((text) => text.startsWith("의도 확인"))).toBe(false);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(String(seen[0]!.messages[0]!.content)).toContain("planner");
    // chat 모드(오케스트레이션 없음)는 플래너 없이 본문으로 간다.
    const chatSeen: ChatRequest[] = [];
    const chat = new AssistantSession(createBlankProject(), { config: CHAT_CONFIG, chat: scriptedChat([finalResult("완료")], chatSeen) });
    await chat.sendUserMessage("집 하나 만들어줘", () => {});
    expect(chatSeen).toHaveLength(1);
  }, 30000);

  it("질문 선언은 플래너를 건너뛰고, 계획 필요 선언은 플래너를 돈다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const questionSeen: ChatRequest[] = [];
    const question = new AssistantSession(createBlankProject(), {
      config: AUTO_CONFIG,
      chat: scriptedChat([finalResult("여관은 숙박 시설입니다.")], questionSeen),
      declareIntent: fixedDeclarer({ mode: "question" }),
    });
    const answer = await question.sendUserMessage("여관이 뭐야", () => {});
    // Planner requests have no tools; the sole request must be the normal answer round.
    expect(questionSeen).toHaveLength(1);
    const questionRequest = questionSeen[0];
    if (!questionRequest?.tools) throw new Error("Missing question tool-loop request");
    expect(questionRequest.tools.length).toBeGreaterThan(0);
    expect(questionRequest.tool_choice).toBe("auto");
    expect(statuses(question)).not.toContain("planner:start");
    expect(question.getWorkPlan()).toBeNull();
    expect(answer.error).toBeUndefined();
    expect(answer.runOutcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "no-change" });

    const plannedSeen: ChatRequest[] = [];
    const planned = new AssistantSession(createBlankProject(), {
      config: AUTO_CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "direct", reason: "한 턴으로 충분" })),
        finalResult("완료"),
      ], plannedSeen),
      declareIntent: fixedDeclarer({ needsPlan: true }),
    });
    await planned.sendUserMessage("마을 만들어줘", () => {});
    expect(statuses(planned)).toContain("planner:start");
    expect(plannedSeen.filter(request => request.tools === undefined)).toHaveLength(1);
    const [plannerRequest, executionRequest] = plannedSeen;
    if (!plannerRequest || !executionRequest?.tools) throw new Error("Missing planner-to-execution requests");
    expect(plannerRequest.tools).toBeUndefined();
    expect(plannerRequest.tool_choice).toBeUndefined();
    expect(executionRequest.tools.length).toBeGreaterThan(0);
    expect(executionRequest.tool_choice).toBe("auto");
  }, 30000);

  it("플래너의 direct 는 존중한다 — 「마을」이라도 코드가 계획을 강제하지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermetic(project);
    const session = new AssistantSession(project, {
      config: AUTO_CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "direct", reason: "단일 상인 NPC 배치" })),
        finalResult("상인을 배치했습니다."),
      ]),
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true, tools: ["place_npc"] }),
    });
    await session.sendUserMessage("이 마을에 상인 하나 추가해줘", () => {});
    const audit = statuses(session);
    expect(audit.some((text) => text.startsWith("planner:direct"))).toBe(true);
    expect(audit.some((text) => text.includes("direct-rejected") || text.includes("forced-plan"))).toBe(false);
    expect(audit.some((text) => text.startsWith("volume-contract:"))).toBe(false);
    expect(session.getWorkPlan()).toBeNull();
  }, 30000);

  it("플래너가 volume 을 선언한 계획만 막대를 세우고, 막대 미달로 끝내면 재주입한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermetic(project);
    const plan = {
      action: "new_plan",
      goal: "마을 시공",
      volume: { authoredMaps: 1, multiPageNpcs: 0, shops: 0, quests: 0 },
      // 항목은 게이트 없는 쓰기 하나로 완료되게 둔다 — 여기서 재는 것은 계획이 끝난 뒤에도 볼륨 막대가 턴을
      // 붙잡는지다(빈 맵·한 줄 NPC 는 항목 게이트가 먼저 잡아 Ralph 가 돈다).
      layers: [{ title: "메타", items: [{ title: "제목", instruction: "타이틀 설정", doneWhen: "타이틀", successTools: ["set_title_screen"] }] }],
    };
    const session = new AssistantSession(project, {
      config: { ...AUTO_CONFIG, maxToolCalls: 4 },
      chat: scriptedChat([
        finalResult(JSON.stringify(plan)),
        toolCallResult("set_title_screen", { reason: "타이틀", title: "마을" }, "c_title"),
        finalResult("타이틀을 정했습니다."),
        finalResult("할 일이 없습니다."),
        finalResult("정말 없습니다."),
      ]),
      declareIntent: fixedDeclarer({ needsPlan: true, tools: ["set_title_screen"] }),
    });
    await session.sendUserMessage("마을 만들어줘", () => {});
    const audit = statuses(session);
    expect(audit.some((text) => text.startsWith("volume-contract:armed maps+1")), audit.join("\n")).toBe(true);
    // 계획은 끝났지만 채워진 맵 +0 → 막대 미달 → 코드가 재주입한다(사용자 「계속」이 아니다).
    expect(audit.some((text) => text.startsWith("volume-contract:continue")), audit.filter((t) => !t.startsWith("tools:")).join("\n")).toBe(true);
  }, 30000);

  it("volume 없는 계획은 막대가 없다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermetic(project);
    const plan = {
      action: "new_plan",
      goal: "여관",
      layers: [{ title: "여관", items: [{ title: "여관", instruction: "place_concept", doneWhen: "여관 맵", requiresAnyWrite: true }] }],
    };
    const session = new AssistantSession(project, {
      config: { ...AUTO_CONFIG, maxToolCalls: 4 },
      chat: scriptedChat([finalResult(JSON.stringify(plan)), finalResult("끝"), finalResult("끝"), finalResult("끝")]),
      declareIntent: fixedDeclarer({ needsPlan: true, space: "interior", facility: "여관" }),
    });
    await session.sendUserMessage("여관 지어줘", () => {});
    expect(statuses(session).some((text) => text.startsWith("volume-contract:"))).toBe(false);
  }, 30000);

  it("선언한 툴은 도메인 상한과 무관하게 이번 라운드 스키마에 실린다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seen: ChatRequest[] = [];
    const session = new AssistantSession(createBlankProject(), {
      config: CHAT_CONFIG,
      chat: scriptedChat([finalResult("완료")], seen),
      declareIntent: fixedDeclarer({ tools: ["define_ending", "script_cutscene"] }),
    });
    await session.sendUserMessage("엔딩 조건 하나 걸어줘", () => {});
    const names = (seen[0]!.tools ?? []).map((tool) => tool.function.name);
    expect(names).toContain("define_ending");
    expect(names).toContain("script_cutscene");
  }, 30000);

  it.each([false, true])("지시 모드의 툴 이름 언급은 사용자 발화에서만 읽고 footer 는 보지 않는다 (explicit instruction=%s)", async explicitInstruction => {
    const { AssistantSession, createBlankProject } = await load();
    const seen: ChatRequest[] = [];
    const declareIntent = vi.fn(fixedDeclarer({ mode: "modify" }));
    const session = new AssistantSession(createBlankProject(), {
      config: CHAT_CONFIG,
      chat: scriptedChat([finalResult("완료")], seen),
      declareIntent,
    });
    const instruction = "define_ending 툴로 엔딩 조건을 설정해줘";
    await session.sendUserMessage(
      `${instruction}\n\n[컨텍스트] 현재 맵: 시작 맵 (map_blank_start) · set_type_chart`,
      () => {},
      undefined,
      { composerMode: "do", ...(explicitInstruction ? { instruction } : {}) },
    );
    expect(seen).toHaveLength(1);
    const request = seen[0];
    if (!request?.tools) throw new Error("Missing authorized Do tool schemas");
    const names = request.tools.map(tool => tool.function.name);
    // PR667 exposes the complete Do catalog regardless of mentions. The trusted
    // instruction boundary is the declarer's actual input, not schema absence.
    expect(names).toContain("define_ending");
    expect(names).toContain("set_type_chart");
    expect(request.tools).toEqual(expect.arrayContaining(toOpenAiTools()));
    expect(declareIntent).toHaveBeenCalledTimes(1);
    expect(declareIntent.mock.calls[0]?.[0].userText).toBe(instruction);
  }, 30000);

  it.each(["ask", "question"] as const)("%s 는 언급·선언된 쓰기도 노출하거나 실행하지 않고 조회는 허용한다", async mode => {
    const { AssistantSession, isWriteToolName, createBlankProject } = await load();
    const project = createBlankProject();
    const before = structuredClone(project);
    const seen: ChatRequest[] = [];
    const events: SessionEvent[] = [];
    const declareIntent = vi.fn(fixedDeclarer({
      mode: mode === "ask" ? "modify" : "question", needsPlan: true,
      tools: ["define_ending", "set_type_chart", "list_endings"],
    }));
    const session = new AssistantSession(project, {
      config: AUTO_CONFIG,
      chat: scriptedChat([
        toolCallResult("define_ending", { id: "ending_test", name: "Test ending", conditions: [] }, "c_write"),
        toolCallResult("list_endings", {}, "c_read"),
        finalResult("응답"),
      ], seen),
      declareIntent,
    });
    const result = await session.sendUserMessage(
      "define_ending 툴이 뭐야\n\n[컨텍스트] 현재 맵: 시작 맵 (map_blank_start) · set_type_chart",
      event => events.push(event), undefined,
      { instruction: "define_ending 툴이 뭐야", composerMode: mode === "ask" ? "ask" : "do" },
    );
    expect(declareIntent).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(3);
    for (const request of seen) {
      if (!request.tools) throw new Error("Missing read-only tool schemas");
      const names = request.tools.map(tool => tool.function.name);
      expect(names).toContain("list_endings");
      expect(names).not.toContain("define_ending");
      expect(names).not.toContain("set_type_chart");
      expect(names.filter(isWriteToolName)).toEqual([]);
      expect(request.tool_choice).toBe("auto");
    }
    expect(statuses(session)).not.toContain("planner:start");
    const toolEvents = events.filter(event => event.type === "tool_call");
    expect(toolEvents).toHaveLength(2);
    expect(toolEvents[0]).toMatchObject({ name: "define_ending", result: {
      ok: false, issues: [{ severity: "error", code: "composer-mode-ask" }],
    } });
    expect(toolEvents[1]).toMatchObject({ name: "list_endings", result: { ok: true, data: { endings: [] } } });
    const readRequest = seen[1];
    if (!readRequest) throw new Error("Missing request after refused write");
    const refused = readRequest.messages.find(message => message.role === "tool" && message.tool_call_id === "c_write");
    if (!refused) throw new Error("Missing write refusal in provider request");
    expect(JSON.parse(String(refused.content))).toMatchObject({ ok: false, issues: [{ code: "composer-mode-ask" }] });
    expect(result.error).toBeUndefined();
    expect(result.proposedCalls).toEqual([]);
    expect(session.getProposedProject()).toEqual(before);
    expect(session.getWorkPlan()).toBeNull();
    expect(result.runOutcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "no-change" });
  });

  it("선택 영역은 사실로 붙고 선언에 따라 경계 또는 참고용 노트가 된다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    const mapId = project.startMapId!;
    const scope = { mapId, region: { x: 2, y: 2, width: 6, height: 5 } };
    const inside = new AssistantSession(project, {
      config: CHAT_CONFIG,
      chat: scriptedChat([finalResult("완료")]),
      declareIntent: fixedDeclarer({ useSelection: true }),
    });
    await inside.sendUserMessage("여기 나무 심어줘", () => {}, undefined, { instruction: "여기 나무 심어줘", scope });
    const insideNote = statuses(inside).find((text) => text.includes("[선택 영역]"));
    expect(insideNote).toContain("영역 밖 타일·이벤트는 수정하지 말 것");
    expect(insideNote).toContain(`mapId:"${mapId}"`);
    expect(statuses(inside)).toContain("planner:skip selection");

    const outside = new AssistantSession(createBlankProject(), {
      config: CHAT_CONFIG,
      chat: scriptedChat([finalResult("완료")]),
      declareIntent: fixedDeclarer({ space: "interior", facility: "여관", useSelection: false }),
    });
    await outside.sendUserMessage("여관 지어줘", () => {}, undefined, { instruction: "여관 지어줘", scope });
    expect(statuses(outside).find((text) => text.includes("[선택 영역]"))).toContain("참고용");
  }, 30000);

  it("수정 선언은 계획의 대상 맵을 현재 맵으로 고정하고, 생성 선언은 고정하지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const plan = {
      action: "new_plan",
      goal: "담장 수정",
      layers: [{ title: "수정", items: [{ title: "담장", instruction: "tile_erase 후 build_wall", doneWhen: "담장 정리", successTools: ["tile_erase"], mapTargets: ["map_blank_start"] }] }],
    };
    const modify = new AssistantSession(createBlankProject(), {
      config: AUTO_CONFIG,
      contextOptions: { currentMapId: "map_blank_start" },
      chat: scriptedChat([finalResult(JSON.stringify(plan)), finalResult("끝"), finalResult("끝")]),
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
    });
    await modify.sendUserMessage("이 마을 담장 좀 손봐줘", () => {});
    const modifyPlan = modify.getWorkPlan();
    expect(modifyPlan).not.toBeNull();
    expect(modifyPlan?.targetMapId).toBe("map_blank_start");
    expect(modifyPlan?.layers[0].items[0]).toMatchObject({
      status: "in_progress", successTools: ["tile_erase"], mapTargets: ["map_blank_start"],
    });

    const create = new AssistantSession(createBlankProject(), {
      config: AUTO_CONFIG,
      contextOptions: { currentMapId: "map_blank_start" },
      chat: scriptedChat([finalResult(JSON.stringify(plan)), finalResult("끝"), finalResult("끝")]),
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: true }),
    });
    await create.sendUserMessage("새 마을 만들어줘", () => {});
    const createPlan = create.getWorkPlan();
    expect(createPlan).not.toBeNull();
    expect(createPlan?.targetMapId).toBeUndefined();
    expect(createPlan?.layers[0].items[0]).toMatchObject({
      status: "in_progress", successTools: ["tile_erase"], mapTargets: ["map_blank_start"],
    });
    expect(modify.getWorkPlan()).toEqual(modifyPlan);
  }, 30000);

  it("「계속」은 모델을 부르지 않고 진행 중 계획을 이어간다(continuation)", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let declarerCalls = 0;
    const plan = {
      action: "new_plan",
      goal: "두 단계",
      layers: [{ title: "L", items: [
        { title: "a", instruction: "a", doneWhen: "a", requiresAnyWrite: true },
        { title: "b", instruction: "b", doneWhen: "b", requiresAnyWrite: true },
      ] }],
    };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...AUTO_CONFIG, maxToolCalls: 3 },
      chat: scriptedChat([
        finalResult(JSON.stringify(plan)), finalResult("첫 단계"), finalResult("첫 단계 끝"), finalResult("끝"),
        finalResult(JSON.stringify({ action: "resume" })), finalResult("둘째"), finalResult("둘째 끝"), finalResult("끝"),
      ]),
      declareIntent: async (facts) => {
        declarerCalls += 1;
        return { intent: declaredIntent({ needsPlan: true, summary: facts.userText }), elapsedMs: 0 };
      },
    });
    await session.sendUserMessage("두 단계 작업", () => {});
    expect(declarerCalls).toBe(1);
    await session.sendUserMessage("계속", () => {});
    expect(declarerCalls).toBe(1);
    expect(statuses(session).some((text) => text.startsWith("intent:continuation"))).toBe(true);
  }, 30000);
});

// 플래너 페이로드에 선언 자세가 실리는지 — 유닛(workPlan.test.ts)이 통과해도 세션이 intent 를
// 넘기지 않으면 프로덕션에서는 배선이 죽어 있다(2026-09-09 진단: "마을을 만들어" 1항목).
describe("planner payload carries the declared scope posture", () => {
  function plannerUserPayload(seen: readonly ChatRequest[]): string {
    const planner = seen.find((request) => request.tools === undefined);
    if (!planner) throw new Error("planner request (tools=undefined) not found");
    const user = [...planner.messages].reverse().find(
      (message) => message.role === "user" && typeof message.content === "string" && message.content.includes("## User request"),
    );
    if (!user || typeof user.content !== "string") throw new Error("planner user payload not found");
    return user.content;
  }

  it("신축 다단계 요청은 분해 자세를 싣는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seen: ChatRequest[] = [];
    const session = new AssistantSession(createBlankProject(), {
      config: AUTO_CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({
          action: "new_plan",
          goal: "마을 시공",
          layers: [{ title: "마을", items: [{ title: "외곽", instruction: "author_village", doneWhen: "마을", successTools: ["author_village"] }] }],
        })),
        finalResult("완료"),
        finalResult("완료"),
      ], seen),
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: true, tools: ["author_village"] }),
    });
    await session.sendUserMessage("마을을 만들어", () => {});
    expect(plannerUserPayload(seen)).toContain("posture=decompose-greenfield");
  }, 30000);

  // 2026-09-03 폭주 회귀 방지: 「이 마을에 상인 하나 추가」는 수정이고, 분해 자세가 실리면 안 된다.
  it("수정 요청은 보존 자세를 싣고 direct 를 그대로 존중한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermetic(project);
    const seen: ChatRequest[] = [];
    const session = new AssistantSession(project, {
      config: AUTO_CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "direct", reason: "단일 상인 NPC 배치" })),
        finalResult("상인을 배치했습니다."),
      ], seen),
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true, tools: ["place_npc"] }),
    });
    await session.sendUserMessage("이 마을에 상인 하나 추가해줘", () => {});
    const payload = plannerUserPayload(seen);
    expect(payload).toContain("posture=respect-existing");
    expect(payload).not.toContain("posture=decompose-greenfield");
    expect(session.getWorkPlan()).toBeNull();
  }, 30000);
});
