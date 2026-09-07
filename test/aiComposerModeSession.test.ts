// 컴포저 모드(지시/질문/계획)의 세션 계약. 모드는 프롬프트 문장이 아니라 하네스가 강제한다:
//   질문(ask)  — 쓰기 툴 스키마를 모델에 노출하지 않고, 불러도 거부한다. 프로젝트 초안은 불변.
//   계획(plan) — 플래너를 항상 돌려 계획만 세우고 그 턴은 실행 없이 끝난다. 「계속」이 실행이다.
//   지시(do)   — 종전 그대로.
// 이전 구현은 [컨텍스트] 꼬리에 "모드: 질문 — …" 한 줄만 실었고 세션은 모드를 몰랐다(2026-09-03 감사).
import { describe, expect, it } from "vitest";
import { fixedDeclarer } from "./intentFixture";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import { getTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const CONFIG = {
  authMode: "apiKey" as const,
  baseUrl: "x",
  model: "stub-model",
  liteModel: "stub-model",
  apiKey: "sk",
  maxToolCalls: 6,
  maxTokens: 512,
  agentMode: "chat" as const,
};

function finalResult(text: string): ChatResult {
  return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
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

const PLAN = {
  goal: "타이틀 2단계 개선",
  layers: [
    {
      title: "타이틀",
      items: [
        { title: "1차 제목", instruction: "set_title_screen {title:'t1'}", successTools: ["set_title_screen"] },
        { title: "2차 제목", instruction: "set_title_screen {title:'t2'}", successTools: ["set_title_screen"] },
      ],
    },
  ],
};
const NEW_PLAN_JSON = JSON.stringify({ action: "new_plan", ...PLAN });
const DIRECT_JSON = JSON.stringify({ action: "direct", reason: "한 턴으로 충분" });

/** 스크립트를 순서대로 돌려주고, 각 호출의 요청(tools 포함)을 기록하는 chat. */
function scriptedChat(steps: ChatResult[]) {
  const requests: ChatRequest[] = [];
  const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
    requests.push(req);
    const next = steps.shift();
    if (!next) {
      throw new (class extends Error {
        readonly status = 401;
        constructor() {
          super("scripted chat exhausted");
          this.name = "LlmError";
        }
      })();
    }
    return next;
  };
  return { chat, requests };
}

const toolNames = (req: ChatRequest | undefined): string[] => (req?.tools ?? []).map((tool) => tool.function.name);
const writeToolNames = (req: ChatRequest | undefined): string[] =>
  toolNames(req).filter((name) => getTool(name)?.mode === "write" || name === "set_build_spec");

describe("컴포저 모드 — 질문(ask)", () => {
  it("쓰기 툴 스키마를 모델에 노출하지 않는다 (읽기 툴은 남는다)", async () => {
    // Break: 노출 필터가 없으면 도메인 기본 세트의 write 툴(paint_tiles 등)이 그대로 실린다.
    const { chat, requests } = scriptedChat([finalResult("이 맵은 20×15 입니다.")]);
    const session = new AssistantSession(createBlankProject(), {
      config: CONFIG,
      chat,
      // 선언자가 「생성」이라고 읽어도 사용자가 고른 질문 모드가 이긴다.
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
    });

    const result = await session.sendUserMessage("이 맵 크기가 얼마야?", () => {}, undefined, { composerMode: "ask" });

    expect(requests).toHaveLength(1);
    expect(writeToolNames(requests[0])).toEqual([]);
    expect(toolNames(requests[0]).some((name) => getTool(name)?.mode === "read")).toBe(true);
    expect(result.proposedCalls).toEqual([]);
  });

  it("모델이 쓰기 툴을 불러도 거부하고 프로젝트 초안은 불변이다", async () => {
    // Break: 실행 게이트가 없으면 노출 안 된 write 툴콜도 runTool 로 실행된다(exposedNames 는 감사용).
    const { chat } = scriptedChat([
      toolCallResult("set_title_screen", { title: "몰래 바꾼 제목" }, "c_write"),
      finalResult("알겠습니다."),
    ]);
    const project = createBlankProject();
    const before = structuredClone(project);
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat,
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
    });

    const result = await session.sendUserMessage("타이틀이 뭐야?", (event) => events.push(event), undefined, { composerMode: "ask" });

    const toolEvents = events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
    expect(toolEvents).toHaveLength(1);
    expect(toolEvents[0]?.result.ok).toBe(false);
    expect(toolEvents[0]?.result.issues?.some((issue) => issue.code === "composer-mode-ask")).toBe(true);
    expect(result.proposedCalls).toEqual([]);
    expect(session.getProposedProject()).toEqual(before);
  });
});

describe("컴포저 모드 — 계획(plan)", () => {
  it("플래너만 돌려 계획 카드를 내고 그 턴은 실행 없이 끝난다 (자율 진입도 자동 계속 0회)", async () => {
    // Break: 계획 생성 뒤 runTurnLoop 로 넘어가면 chat 이 2회 이상 불리고 tools 가 실린다.
    const { chat, requests } = scriptedChat([finalResult(NEW_PLAN_JSON)]);
    const events: SessionEvent[] = [];
    const session = new AssistantSession(createBlankProject(), {
      config: CONFIG,
      chat,
      // needsPlan:false — 지시 모드라면 플래너를 건너뛰는 선언. 계획 모드는 그래도 플래너를 돈다.
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
    });

    const result = await session.sendUserMessage(
      "타이틀을 두 단계로 다듬어줘",
      (event) => events.push(event),
      undefined,
      { composerMode: "plan", autonomous: true },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]?.tools ?? []).toEqual([]);
    expect(events.some((event) => event.type === "work_plan")).toBe(true);
    expect(result.workPlan?.layers[0]?.items).toHaveLength(2);
    expect(result.proposedCalls).toEqual([]);
    expect(result.assistantText).toContain("계속");
  });

  it("플래너가 direct 를 내도 1항목 계획을 세우고 멈춘다", async () => {
    const { chat, requests } = scriptedChat([finalResult(DIRECT_JSON)]);
    const session = new AssistantSession(createBlankProject(), {
      config: CONFIG,
      chat,
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
    });

    const result = await session.sendUserMessage("타이틀 제목을 바꿔줘", () => {}, undefined, { composerMode: "plan" });

    expect(requests).toHaveLength(1);
    expect(result.workPlan?.layers.flatMap((layer) => layer.items)).toHaveLength(1);
    expect(result.proposedCalls).toEqual([]);
  });

  it("계획 뒤 「계속」은 툴 루프를 돌려 실행한다", async () => {
    const { chat, requests } = scriptedChat([
      finalResult(NEW_PLAN_JSON),
      // 「계속」 턴: 이어가기 선언은 플래너를 부르지 않고(resume 은 활성 계획이 있으면 플래너가 판단)
      // 본문 루프가 tools 와 함께 돈다.
      JSON.parse(JSON.stringify(finalResult(JSON.stringify({ action: "resume", reason: "같은 목표 계속" })))) as ChatResult,
      toolCallResult("set_title_screen", { title: "t1" }, "c_t1"),
      finalResult("1차 제목을 적용했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), {
      config: CONFIG,
      chat,
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
    });

    await session.sendUserMessage("타이틀을 두 단계로 다듬어줘", () => {}, undefined, { composerMode: "plan" });
    const planOnlyCalls = requests.length;
    const result = await session.sendUserMessage("계속", () => {}, undefined, { composerMode: "do", goalAction: "resume" });

    expect(planOnlyCalls).toBe(1);
    expect(requests.length).toBeGreaterThan(planOnlyCalls);
    expect(requests.slice(planOnlyCalls).some((req) => (req.tools ?? []).length > 0)).toBe(true);
    expect(result.proposedCalls.some((call) => call.name === "set_title_screen")).toBe(true);
  });
});

describe("컴포저 모드 — 지시(do)", () => {
  it("기본/지시 모드는 쓰기 툴을 그대로 노출한다", async () => {
    const { chat, requests } = scriptedChat([finalResult("바꿨습니다.")]);
    const session = new AssistantSession(createBlankProject(), {
      config: CONFIG,
      chat,
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
    });

    await session.sendUserMessage("타이틀 제목을 바꿔줘", () => {}, undefined, { composerMode: "do" });

    expect(requests).toHaveLength(1);
    expect(writeToolNames(requests[0]).length).toBeGreaterThan(0);
  });
});
