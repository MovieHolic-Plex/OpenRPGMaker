// 일회성 라이브 스모크: 감사 로그(2026-07-04) 시나리오 "npc 3명 넣어줘" 재현.
// list_resources 어휘 보강 + place_npc 그래픽 해석 수정 후 실 LLM으로 검증한다.
// 실행: node evals/run.mjs 경유가 아니라 직접 —
//   VITE_LLM_API_KEY 로드 후 `npx vitest run --config evals/vitest.config.mjs evals/npcSmoke.eval.ts`
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";

describe("live smoke — npc 3명 넣어줘", () => {
  it.skipIf(!process.env.VITE_LLM_API_KEY)("place_npc 제안이 생성된다", async () => {
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: process.env.VITE_LLM_API_KEY ?? "" },
    });
    const toolLog: string[] = [];
    const result = await session.sendUserMessage("npc 3명 넣어줘", (event) => {
      if (event.type === "tool_call") {
        toolLog.push(`${event.result.ok ? "OK" : "FAIL"} ${event.name} — ${event.result.summary}`);
      }
    });
    // 관측 로그를 남긴다(키/원문 미포함).
    console.log(JSON.stringify({ toolLog, stoppedReason: result.stoppedReason, proposals: result.proposedCalls.map((c) => c.summary), error: result.error ?? null }, null, 2));
    expect(result.error).toBeUndefined();
    const npcProposals = result.proposedCalls.filter((call) => call.name === "place_npc");
    expect(npcProposals.length).toBeGreaterThanOrEqual(1);
  }, 300000);
});
