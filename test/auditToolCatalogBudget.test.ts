import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults/defaultProject";

/**
 * 2026-09-10 실측 회귀: `tools:exposed` 가 매 라운드 227개 도구 이름 전체를 감사에 찍었다.
 * clipText 상한(4KB)에 걸린 행이 라운드마다 쌓여 AUDIT_BUDGET_BYTES(384KB)를 상수 문자열로
 * 소진하고, fitWithinBudget 이 가운데를 버려 **대화 기록 472건이 축출**됐다 —
 * planner:replan 원문이 사라져 사후 진단 자체가 불가능해졌다.
 * 카탈로그가 바뀔 때만 전체 목록을 남긴다.
 */
const CHAT_CONFIG = {
  authMode: "apiKey" as const,
  baseUrl: "x",
  model: "test-model",
  liteModel: "test-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 512,
  agentMode: "chat" as const,
};

function final(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
}

function exposures(session: AssistantSession): string[] {
  return session.getAuditEntries().flatMap(entry =>
    entry.kind === "status" && entry.text.startsWith("tools:exposed") ? [entry.text] : []);
}

describe("tools:exposed 감사 예산", () => {
  it("같은 카탈로그를 반복해서 전체 목록으로 찍지 않는다", async () => {
    const session = new AssistantSession(createBlankProject(), {
      config: CHAT_CONFIG,
      chat: async () => final("확인했습니다."),
    });

    await session.sendUserMessage("첫 질문", () => {}, undefined, { composerMode: "ask" });
    await session.sendUserMessage("둘째 질문", () => {}, undefined, { composerMode: "ask" });

    const entries = exposures(session);
    expect(entries.length).toBe(2);

    // 첫 노출은 진단을 위해 전체 목록을 남긴다.
    expect(entries[0]).toContain("get_map_region");
    // 이후 동일 카탈로그는 개수만 — 이름 목록을 반복하지 않는다.
    expect(entries[1]).not.toContain("get_map_region");
    expect(entries[1]).toContain("카탈로그 동일");
    expect(entries[1]!.length).toBeLessThan(64);
  });
});
