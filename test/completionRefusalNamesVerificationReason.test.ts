import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { unboundCriterionCheck } from "./fixtures/verificationOwnership";

/**
 * 2026-09-11 실 LLM 턴 계측으로 확정한 회귀.
 *
 * 검증 미충족이면 세션은 그 툴의 성공 기록을 지운다(verification:unmet 분기). 그러면
 * complete_work_item 은 「필수 successTools 중 X 성공 기록이 없습니다」로 거부하는데,
 * 모델 입장에서 X 는 **방금 성공했다**. 그래서 모델은 X 를 다시 돌린다 —
 * 2026-09-10 로그가 정확히 그 결과다(run_lint 21회·check_reachability 15회 동일 인자 반복,
 * complete_work_item 7/12 거부, 예산 소진으로 종료).
 *
 * problems() 문구는 감사 행과 사용자 노출 텍스트로만 나가고 **모델 입력에는 들어가지 않는다**
 * (실 LLM 턴에서 request.messages 를 직접 확인했다). 모델이 읽는 유일한 채널은 이 툴 결과다.
 * 따라서 성공 기록이 지워진 이유를 여기에 실어야 한다.
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

describe("complete_work_item 거부 문구", () => {
  it("성공 기록이 지워진 이유를 모델이 읽는 채널에 실어 보낸다", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;

    // 채택되지 않은 승인 약속을 가리키는 선언 — 스펙 미지정(args: null) 요구가 된다.
    const plan = {
      goal: "시작 맵 통행 점검",
      acceptance: [{ id: "preserve", title: "보존", criteria: [{ kind: "preserve", target: { mapId } }] }],
      layers: [{
        title: "QA",
        items: [{
          id: "reach-item", title: "도달성 점검", instruction: "도달 불가 영역이 없는지 확인",
          successTools: ["check_reachability"], mapTargets: [mapId],
          verificationChecks: [unboundCriterionCheck("check_reachability")],
        }],
      }],
    };
    const rounds: { name: string; args: unknown }[][] = [
      [{ name: "set_work_plan", args: plan }],
      // 검증 툴을 **성공**시킨 다음 완료를 시도한다 — 로그와 같은 동선.
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

    const results: { name: string; ok: boolean; summary: string }[] = [];
    await session.sendUserMessage("도달성을 점검하고 항목을 완료해줘.", (event) => {
      if (event.type === "tool_call") {
        results.push({ name: event.name, ok: event.result?.ok !== false, summary: String(event.result?.summary ?? "") });
      }
    });

    // 검증 툴은 실제로 성공했다 — 그런데도 완료는 거부된다.
    const reach = results.find((entry) => entry.name === "check_reachability");
    expect(reach?.ok).toBe(true);
    const complete = results.find((entry) => entry.name === "complete_work_item");
    expect(complete?.ok).toBe(false);

    // 종래 문구는 "성공 기록이 없습니다" 뿐이었다 — 모델은 방금 성공한 툴을 다시 돌렸다.
    expect(complete?.summary).toContain("성공 기록이 없습니다");
    // 지워진 **이유**와 유일한 해소 경로가 같은 결과에 들어가야 한다.
    expect(complete?.summary).toContain("검증 스펙 미지정");
    expect(complete?.summary).toContain("set_work_plan");
    // 어느 선언이 막고 있는지 지목해야 한다 — id 형식은 고정하지 않는다.
    const pending = session.getVerificationSnapshot().requirements.find((entry) => entry.args === null);
    expect(pending).toBeDefined();
    expect(complete?.summary).toContain(pending!.checkId);
  });
});
