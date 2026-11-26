import { describe, expect, it } from "vitest";
import { fixedDeclarer } from "./intentFixture";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { type ChatRequest, type ChatResult, defaultAiConfig } from "@/ai/llmClient";
import { getTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

// 컴포저 모드(지시/질문/계획)의 세션 계약. 모드는 프롬프트 문장이 아니라 하네스가 강제한다:
//   질문(ask)  — 쓰기 툴 스키마를 모델에 노출하지 않고, 불러도 거부한다. 프로젝트 초안은 불변.
//   계획(plan) — 플래너를 항상 돌려 계획만 세우고 그 턴은 실행 없이 끝난다. 「계속」이 실행이다.
//   지시(do)   — 종전 그대로.
// 이전 구현은 [컨텍스트] 꼬리에 "모드: 질문 — …" 한 줄만 실었고 세션은 모드를 몰랐다(2026-09-03 감사).
describe("aiAskPendingPlan", () => {
  isolateTimers();
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
  describe("질문 중 미완료 계획 보존", () => {
    // 호스티드 러너에서 단독으로도 15~17초 걸린다(ci-vitest-files 45671861464, ci-full 45620536375) — 기본 15초 대신 60초.
    it("답변 뒤 계획을 재개하거나 자동 계속하지 않는다", async () => {
      const { chat, requests } = scriptedChat([finalResult(NEW_PLAN_JSON), finalResult("계획에는 두 단계가 있습니다.")]);
      const session = new AssistantSession(createBlankProject(), {
        config: CONFIG, chat, declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
      });
      const planned = await session.sendUserMessage("제목 개선 계획", () => {}, undefined, { composerMode: "plan", autonomous: true });
      const answered = await session.sendUserMessage("계획을 설명해줘", () => {}, undefined, { composerMode: "ask", autonomous: true });
      expect(requests).toHaveLength(2);
      expect(answered.stoppedReason).toBe("final");
      expect(answered.proposedCalls).toEqual([]);
      expect(answered.workPlan).toEqual(planned.workPlan);
      expect(writeToolNames(requests[1])).toEqual([]);
      expect(answered.assistantText).toContain("두 단계");
    }, 60_000);
  });
});

describe("assistantFinalAudit", () => {
  isolateTimers();
  describe("authoritative final response audit", () => {
    // 「수용 원장 blocked 판정이 모델 성공 문구를 대신한다」 케이스는 은퇴했다 — 수용(acceptance) 원장은 더 이상
    // 만들어지지 않고(acceptance:disabled, 2026-09-17 하네스 게이트 2차 해체) getAcceptanceSnapshot() 은 null 이다.

    it("does not duplicate an unchanged ordinary final response", async () => {
      // Given a nonspatial read-only response with no harness replacement.
      const session = new AssistantSession(createBlankProject(), {
        config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test" },
        declareIntent: fixedDeclarer({ mode: "question", needsPlan: false }),
        chat: async (): Promise<ChatResult> => ({ finishReason: "stop", message: { role: "assistant", content: "UNCHANGED_RESPONSE" } }),
      });
      // When the turn finishes, then the original audit remains a single ordinary response.
      await session.sendUserMessage("Inspect only");
      expect(session.getAuditEntries().filter(entry => entry.kind === "assistant")).toHaveLength(1);
    });

    // 호스티드 러너에서 단독으로도 15~17초 걸린다(ci-vitest-files 45671861464, ci-full 45620536375) — 기본 15초 대신 60초.
    it("does not lead with model success when explicit verification still fails", async () => {
      // 260(침엽수 상단) 고아 칸 lint 규칙은 옛 합본 마을 시트의 것이다 — 기본 버들항 시트에서는 오류가 아니다.
      const project = startOnRetiredCombinedTown(createBlankProject());
      const map = project.maps[project.startMapId];
      map.upperTiles[map.width + 5] = 260;
      let round = 0;
      const session = new AssistantSession(project, {
        config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test" },
        declareIntent: fixedDeclarer({ mode: "question", needsPlan: false, tools: ["run_lint"] }),
        chat: async (): Promise<ChatResult> => round++ === 0
          ? { finishReason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [
            { id: "lint", type: "function", function: { name: "run_lint", arguments: "{}" } },
          ] } }
          : { finishReason: "stop", message: { role: "assistant", content: "MODEL_SUCCESS_SENTINEL" } },
      });
      const result = await session.sendUserMessage("Check the authored map");
      expect(result.assistantText).not.toContain("MODEL_SUCCESS_SENTINEL");
      expect(session.getAuditEntries().filter(entry => entry.kind === "assistant").at(-1)?.text).toBe(result.assistantText);
    }, 60_000);
  });
});
