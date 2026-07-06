// 라이브 스모크: 감사 로그(2026-07-04 "맵+집+깊은 대화 NPC") 시나리오 재현.
// 에이전틱 개선 검증 — 토큰 예산 루프, NPC 자동 착지, 대사 별칭, 깊은 대화(choices) 유도.
// 실행: OPENROUTER_API_KEY 로드 후 `npx vitest run --config evals/vitest.config.mjs evals/agenticSmoke.eval.ts`
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage } from "@/project/types";

function countTextCommands(commands: readonly Command[]): number {
  let count = 0;
  for (const command of commands) {
    if (command.kind === "text") count += 1;
    if (command.kind === "choices") for (const option of command.options) count += countTextCommands(option.branch as Command[]);
  }
  return count;
}

describe("live smoke — 맵+집+깊은 대화 NPC 3명", () => {
  it.skipIf(!process.env.OPENROUTER_API_KEY)("NPC 여러 명이 대사와 함께 생성된다", async () => {
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: process.env.OPENROUTER_API_KEY ?? "" },
    });
    const toolLog: string[] = [];
    const result = await session.sendUserMessage(
      "맵을 하나 만들고, 거기에 집을 만들어. npc 3명을 배치하고 각자 깊은 대화(선택지 포함)가 가능해야 해.",
      (event) => {
        if (event.type === "tool_call") toolLog.push(`${event.result.ok ? "OK" : "FAIL"} ${event.name} — ${event.result.summary}`);
      }
    );
    const npcCalls = result.proposedCalls.filter((call) => call.name === "place_npc");
    // 배치된 NPC들의 페이지에서 대사 커맨드 수 확인(별칭 유실 방지 검증).
    const project = session.getProposedProject();
    const dialogueCounts: number[] = [];
    for (const map of Object.values(project.maps)) {
      for (const event of map.events) {
        for (const page of (event.pages ?? []) as EventPage[]) {
          dialogueCounts.push(countTextCommands(page.commands as Command[]));
        }
      }
    }
    console.log(JSON.stringify({
      toolLog,
      stoppedReason: result.stoppedReason,
      npcCount: npcCalls.length,
      dialogueCounts,
      failCount: toolLog.filter((line) => line.startsWith("FAIL")).length,
      error: result.error ?? null,
    }, null, 2));
    expect(result.error).toBeUndefined();
    expect(npcCalls.length).toBeGreaterThanOrEqual(3);
    expect(dialogueCounts.some((count) => count > 0)).toBe(true);
  }, 300000);
});
