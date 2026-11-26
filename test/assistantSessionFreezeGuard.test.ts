import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createSharedTilesetBlankProject } from "./support/sharedBlankProject";

// 턴이 도는 동안에만 탭 freeze 가드를 쥔다. 놓치면 백그라운드에서 턴이 통째로 얼어붙는다.
function makeSession(chat: () => Promise<unknown>, log: string[]) {
  return new AssistantSession(createSharedTilesetBlankProject(), {
    config: { ...defaultAiConfig(), agentMode: "chat", apiKey: "sk-test" },
    chat: chat as never,
    yieldToUi: async () => {},
    freezeGuard: async () => {
      log.push("acquire");
      return () => log.push("release");
    },
  });
}

describe("AssistantSession freezeGuard", () => {
  // 호스티드 ci-full 샤드에서 16초 걸렸다(ci-full 45687718517 tests (2)) — 기본 15초 대신 60초(두 시험).
  it("턴이 도는 동안 가드를 쥐고 끝나면 놓는다", async () => {
    const log: string[] = [];
    const session = makeSession(async () => {
      log.push("chat");
      return { message: { role: "assistant", content: "요약했습니다." }, finishReason: "stop" };
    }, log);

    const result = await session.sendUserMessage("프로젝트 요약해줘", () => {});

    expect(result.stoppedReason).toBe("final");
    // 첫 항목이 acquire 여야 플래너 라운드까지 덮는다 — 예전엔 플래너 chat 이 가드 밖이었다.
    expect(log[0]).toBe("acquire");
    expect(log.at(-1)).toBe("release");
    expect(log.filter((entry) => entry === "acquire")).toHaveLength(1);
    expect(log.filter((entry) => entry === "release")).toHaveLength(1);
    expect(log.filter((entry) => entry === "chat").length).toBeGreaterThan(0);
  }, 60_000);

  it("턴이 실패해도 가드를 놓는다", async () => {
    const log: string[] = [];
    const session = makeSession(async () => {
      log.push("chat");
      throw new Error("공급자 폭발");
    }, log);

    await session.sendUserMessage("프로젝트 요약해줘", () => {}).catch(() => {});

    expect(log.at(-1)).toBe("release");
    expect(log.filter((entry) => entry === "release")).toHaveLength(1);
  }, 60_000);
});
