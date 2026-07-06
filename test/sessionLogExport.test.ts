// 구조화 세션 로그 export(도그푸딩 결함 ⑬) 회귀 테스트.
// AI 패널 "로그" 내보내기 확장: 감사 항목에 ISO 타임스탬프(at) + 턴 수명주기 status 항목,
// UI 상태 배지 전이 타임라인(statusTimeline), exportedAt을 JSON에 포함한다.
import { describe, expect, it } from "vitest";
import { AssistantSession, type AuditEntry } from "@/ai/assistantSession";
import { combineAuditJson } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import type { AiConfig, ChatResult } from "@/ai/llmClient";

const CONFIG: AiConfig = {
  baseUrl: "x",
  model: "test-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 512,
};

describe("세션 감사 로그 타임라인", () => {
  it("모든 감사 항목에 타임스탬프가 붙고, 턴 종료/오류가 status 항목으로 남는다", async () => {
    let round = 0;
    const chat = async (): Promise<ChatResult> => {
      round += 1;
      if (round === 1) return { message: { role: "assistant", content: "네." }, finishReason: "stop" };
      throw new Error("네트워크 오류: 연결 실패");
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

    await session.sendUserMessage("안녕", () => {});
    await session.sendUserMessage("두 번째", () => {});

    const entries = session.getAuditEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(typeof entry.at).toBe("string");
      expect(() => new Date(entry.at as string)).not.toThrow();
    }
    const statuses = entries.filter((entry): entry is Extract<AuditEntry, { kind: "status" }> => entry.kind === "status");
    expect(statuses.some((entry) => entry.text.includes("턴 종료(final)"))).toBe(true);
    expect(statuses.some((entry) => entry.text.includes("턴 중단(error)"))).toBe(true);
    expect(statuses.some((entry) => entry.text.includes("네트워크 오류"))).toBe(true);
  });

  it("combineAuditJson이 statusTimeline과 exportedAt을 포함한다", () => {
    const history: AuditEntry[] = [{ kind: "user", text: "요청", at: "2026-07-07T00:00:00.000Z" }];
    const timeline = [{ at: "2026-07-07T00:00:01.000Z", status: "검토 대기" }];
    const json = combineAuditJson(history, null, "test-model", timeline);
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json as string) as {
      model: string;
      exportedAt: string;
      entries: AuditEntry[];
      statusTimeline: { at: string; status: string }[];
    };
    expect(parsed.model).toBe("test-model");
    expect(typeof parsed.exportedAt).toBe("string");
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.statusTimeline).toEqual(timeline);
  });

  it("빈 로그(항목·타임라인 모두 없음)는 null", () => {
    expect(combineAuditJson([], null, "test-model", [])).toBeNull();
  });
});
