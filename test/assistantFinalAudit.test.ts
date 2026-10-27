import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";

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
  });
});
