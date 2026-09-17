import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults/defaultProject";

/**
 * 2026-09-11 설계 변경: 하네스는 **해소 불가능한 검증 요구를 만들지 않는다.**
 *
 * 예전에는 플래너가 `successTools` 에 검증 툴을 넣고 `verificationChecks` 를 빼면
 * 세션이 `args: null` 요구를 심었다. 뜻은 "이 툴을 통과해야 한다, 단 무슨 입력으로
 * 통과해야 하는지는 알려주지 않겠다" 였고, 일을 해서는 만족시킬 수 없었다:
 *   - 실행은 반영되지 않는다 — observe 의 matching 은 args !== null 만 고른다
 *   - correct_verification 도 거부한다 — correction 의 `if (!stored?.args) return null`
 *   - set_work_plan 재선언만이 유일한 경로
 * 2026-09-11 실 LLM 턴에서 gemini-3.8-flash·3.1-flash·3.1-flash-lite 셋 다 이유와 checkId 를
 * 툴 결과로 받고도 재선언하지 못했다. 2026-09-10 로그의 예산 소진(complete_work_item 7/12
 * 거부, run_lint 21회·check_reachability 15회 동일 인자 반복)이 그 결과다.
 *
 * 이제 검증 계약은 `verificationChecks` 만 담고, 스펙 없는 `successTools` 는 원래 의미대로
 * "이 툴을 성공시켜라"로만 판정한다.
 */
const CHAT_CONFIG = {
  authMode: "apiKey" as const,
  baseUrl: "x",
  model: "test-model",
  liteModel: "test-model",
  apiKey: "sk",
  maxToolCalls: 8,
  maxTokens: 4096,
  agentMode: "chat" as const,
};

/** 모듈 스코프에 둔다 — fixture 클로저를 잡으면 spy 레지스트리가 세션을 붙잡는다. */
function toolCallResponse(calls: { name: string; args: unknown }[], round: number): ChatResult {
  return {
    message: {
      role: "assistant", content: null,
      tool_calls: calls.map((call, index) => ({
        id: `scripted-${round}-${index}`, type: "function" as const,
        function: { name: call.name, arguments: JSON.stringify(call.args) },
      })),
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

describe("스펙 없는 검증 successTools", () => {
  it("요구를 만들지 않고, 툴을 성공시키면 항목이 완료된다", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const plan = {
      goal: "시작 맵 통행 점검",
      layers: [{
        title: "QA",
        items: [{
          id: "reach-item", title: "도달성 점검", instruction: "도달 불가 영역이 없는지 확인",
          // verificationChecks 없음 — 검증 계약을 선언하지 않았다.
          successTools: ["check_reachability"], mapTargets: [mapId],
        }],
      }],
    };
    const rounds: { name: string; args: unknown }[][] = [
      [{ name: "set_work_plan", args: plan }],
      [{ name: "check_reachability", args: { mapId, from: { x: 1, y: 1 }, targets: [{ x: 5, y: 5 }] } }],
      [{ name: "complete_work_item", args: {} }],
    ];

    let round = 0;
    const session = new AssistantSession(project, {
      config: CHAT_CONFIG,
      chat: async () => {
        const calls = rounds[round];
        round += 1;
        return calls
          ? toolCallResponse(calls, round)
          : ({ message: { role: "assistant", content: "확인했습니다." }, finishReason: "stop" } as ChatResult);
      },
    });

    const results: { name: string; ok: boolean }[] = [];
    await session.sendUserMessage("도달성을 점검하고 항목을 완료해줘.", (event) => {
      if (event.type === "tool_call") results.push({ name: event.name, ok: event.result?.ok !== false });
    });

    // 해소 불가능한 요구가 애초에 생기지 않는다.
    expect(session.getVerificationSnapshot().requirements).toEqual([]);
    // 툴을 성공시킨 것으로 완료 조건이 충족된다.
    expect(results.find((entry) => entry.name === "check_reachability")?.ok).toBe(true);
    expect(results.find((entry) => entry.name === "complete_work_item")?.ok).toBe(true);
    expect(session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
  });
});
