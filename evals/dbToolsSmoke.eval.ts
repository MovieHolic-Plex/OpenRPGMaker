// 일회성 라이브 스모크: 신규 DB 툴(upsert_skill/upsert_state 등)을 실 LLM이 활용하는지 확인.
// 실행: OPENROUTER_API_KEY 로드 후 `npx vitest run --config evals/vitest.config.mjs evals/dbToolsSmoke.eval.ts`
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";

describe("live smoke — 신규 DB 툴", () => {
  it.skipIf(!process.env.OPENROUTER_API_KEY)("파이어 스킬 + 화상 상태 생성 제안", async () => {
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: process.env.OPENROUTER_API_KEY ?? "", maxToolCalls: 12 },
    });
    const toolLog: string[] = [];
    const result = await session.sendUserMessage(
      "화상 상태이상을 만들고, 그 상태를 거는 '파이어' 스킬을 추가해줘",
      (event) => {
        if (event.type === "tool_call") {
          toolLog.push(`${event.result.ok ? "OK" : "FAIL"} ${event.name} — ${event.result.summary}`);
        }
      }
    );
    console.log(JSON.stringify({ toolLog, stoppedReason: result.stoppedReason, proposals: result.proposedCalls.map((c) => `${c.name}: ${c.summary}`), error: result.error ?? null }, null, 2));
    expect(result.error).toBeUndefined();
    const names = result.proposedCalls.map((call) => call.name);
    expect(names).toContain("upsert_skill");
    expect(names).toContain("upsert_state");
  }, 300000);
});
