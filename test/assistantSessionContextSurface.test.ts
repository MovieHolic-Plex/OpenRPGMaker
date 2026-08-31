// test/assistantSessionContextSurface.test.ts
// 조수 세션이 UI 에 새로 내주는 표면 5개의 계약:
//   compactNow(수동 압축) · undoLastCompaction(압축 되돌리기) · getContextUsage(게이지 숫자)
//   getUsageTotals(토큰 집계) · priorTranscript(이전 대화 주입) · refreshProjectContext(지침 반영)
//
// 자동 압축(임계 기반)은 test/assistantSessionCompaction.test.ts 가 이미 잠근다. 여기서는
// **사람이 눌렀을 때** 의 경로만 본다 — 임계와 턴 회로차단기를 무시하고 한 번은 시도한다.

import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { isCompactionSummaryMessage, SUMMARIZATION_SYSTEM_PROMPT } from "@/ai/contextCompaction";
import { isRestoredTranscriptMessage } from "@/ai/conversationReplay";
import type { AiConfig, ChatMessage, ChatRequest, ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";

const CONFIG: AiConfig = {
  authMode: "apiKey",
  baseUrl: "x",
  model: "manual-compaction-model",
  liteModel: "manual-compaction-model",
  apiKey: "sk",
  maxToolCalls: 8,
  maxTokens: 4_000_000,
  agentMode: "chat",
};

/** 턴당 어시스턴트 응답 40,000자 — 4턴이면 잔존 창(수동 6,000토큰) 밖에 앞부분이 생긴다. */
const FILLER = "마을 광장 타일 배치와 NPC 배치 결과를 상세히 기록한 진행 로그 문장. ".repeat(1000).slice(0, 40_000);
const SUMMARY_TEXT = "## Goal\n마을 정비 계속\n\n## Next Steps\n1. 남은 NPC 배치";

interface Stub {
  readonly chat: (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;
  readonly summarizationRequests: ChatRequest[];
  readonly mainRequests: ChatRequest[];
  summarizeFails: boolean;
}

function stub(): Stub {
  const state: Stub = {
    summarizationRequests: [],
    mainRequests: [],
    summarizeFails: false,
    chat: async (_config, req) => {
      if (req.messages[0]?.content === SUMMARIZATION_SYSTEM_PROMPT) {
        state.summarizationRequests.push(req);
        if (state.summarizeFails) throw new Error("요약 공급자 500");
        return {
          message: { role: "assistant", content: SUMMARY_TEXT },
          finishReason: "stop",
          usage: { prompt_tokens: 900, completion_tokens: 40 },
        };
      }
      state.mainRequests.push(req);
      return {
        message: { role: "assistant", content: FILLER },
        finishReason: "stop",
        usage: { prompt_tokens: 1_000 * state.mainRequests.length, completion_tokens: 10 },
      };
    },
  };
  return state;
}

async function grow(session: AssistantSession, turns = 4): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await session.sendUserMessage(`${turn}번째 진행 상황을 정리해줘`, () => {});
  }
}

describe("compactNow — 사람이 누른 압축", () => {
  it("Given 임계 미달의 긴 대화 When 수동 압축 Then 요약 1회로 압축되고 토큰이 줄어든다", async () => {
    const chat = stub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: chat.chat });
    await grow(session);
    // 자동 압축은 임계에 못 닿아 한 번도 안 돌았다 — 그래서 수동 진입점이 필요한 것이다.
    expect(chat.summarizationRequests).toHaveLength(0);
    const before = session.getContextUsage();

    const outcome = await session.compactNow();

    expect(outcome.kind).toBe("done");
    if (outcome.kind !== "done") return;
    expect(outcome.afterTokens).toBeLessThan(outcome.beforeTokens);
    expect(chat.summarizationRequests).toHaveLength(1);
    expect(chat.summarizationRequests[0]!.tools).toBeUndefined();
    const messages = session.getMessages();
    expect(messages[0]!.role).toBe("system");
    expect(isCompactionSummaryMessage(messages[1]!)).toBe(true);
    expect(session.getLatestCompactionSummary()).toContain("남은 NPC 배치");
    expect(session.getContextUsage().contextTokens).toBeLessThan(before.contextTokens);
  });

  it("Given 방금 시작한 세션 When 수동 압축 Then 요약 콜 없이 사유를 돌려준다", async () => {
    const chat = stub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: chat.chat });

    const outcome = await session.compactNow();

    expect(outcome.kind).toBe("skipped");
    if (outcome.kind !== "skipped") return;
    expect(outcome.reason).toBeTruthy();
    expect(chat.summarizationRequests).toHaveLength(0);
  });

  it("Given 요약이 실패하는 공급자 When 수동 압축 Then 대화는 한 글자도 안 바뀌고 사유가 온다", async () => {
    const chat = stub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: chat.chat });
    await grow(session);
    const before = structuredClone(session.getMessages()) as ChatMessage[];
    chat.summarizeFails = true;

    const outcome = await session.compactNow();

    expect(outcome.kind).toBe("skipped");
    expect(session.getMessages()).toEqual(before);
    expect(session.canUndoCompaction()).toBe(false);
  });
});

describe("undoLastCompaction", () => {
  it("Given 압축 직후 When 되돌리기 Then 요약 전 메시지 배열로 정확히 복귀한다", async () => {
    const chat = stub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: chat.chat });
    await grow(session);
    const before = structuredClone(session.getMessages()) as ChatMessage[];
    expect(session.canUndoCompaction()).toBe(false);

    await session.compactNow();
    expect(session.canUndoCompaction()).toBe(true);
    const undone = session.undoLastCompaction();

    expect(undone).toBe(true);
    expect(session.getMessages()).toEqual(before);
    expect(session.getLatestCompactionSummary()).toBeNull();
    // 한 단계만 되돌린다 — 두 번째 호출은 되돌릴 것이 없다.
    expect(session.canUndoCompaction()).toBe(false);
    expect(session.undoLastCompaction()).toBe(false);
  });
});

describe("getContextUsage / getUsageTotals", () => {
  it("Given 새 세션 When 사용량 조회 Then 창은 양수, 비율은 0..1, 호출 집계는 0 이다", () => {
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: stub().chat });

    const usage = session.getContextUsage();

    expect(usage.contextWindow).toBeGreaterThan(0);
    expect(usage.thresholdTokens).toBeGreaterThan(0);
    expect(usage.thresholdTokens).toBeLessThan(usage.contextWindow);
    expect(usage.ratio).toBeGreaterThanOrEqual(0);
    expect(usage.overThreshold).toBe(false);
    expect(session.getUsageTotals().calls).toBe(0);
  });

  it("Given 턴 두 번 When 집계 조회 Then 모델별 호출/토큰이 누적된다", async () => {
    const chat = stub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: chat.chat });
    await grow(session, 2);

    const totals = session.getUsageTotals();

    expect(totals.calls).toBe(chat.mainRequests.length);
    expect(totals.promptTokens).toBeGreaterThan(0);
    expect(totals.byModel.map((entry) => entry.model)).toEqual([CONFIG.model]);
  });

  it("Given 수동 압축 When 집계 조회 Then 요약 콜도 집계에 들어간다(구 정규식 방식은 놓쳤다)", async () => {
    const chat = stub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: chat.chat });
    await grow(session);
    const beforeCalls = session.getUsageTotals().calls;

    await session.compactNow();

    expect(session.getUsageTotals().calls).toBe(beforeCalls + 1);
  });
});

describe("priorTranscript — 이전 대화 주입", () => {
  it("Given 기록을 들고 만든 세션 When 첫 요청 Then 시스템 프롬프트 뒤에 복원 기록이 실린다", async () => {
    const chat = stub();
    const session = new AssistantSession(createBlankProject(), {
      config: CONFIG,
      chat: chat.chat,
      priorTranscript: "[사용자] 우물을 놔줘\n[조수] 놨습니다.",
    });

    const messages = session.getMessages();
    expect(messages[0]!.role).toBe("system");
    expect(isRestoredTranscriptMessage(messages[1]!)).toBe(true);
    expect(String(messages[1]!.content)).toContain("우물을 놔줘");

    await session.sendUserMessage("이어서 우물 옆에 벤치", () => {});
    const sent = chat.mainRequests.at(-1)!.messages;
    expect(sent.some((message) => isRestoredTranscriptMessage(message))).toBe(true);
    // 주입 사실은 감사 로그에도 남는다(사용자가 "왜 첫 요청이 이렇게 큰가" 를 추적할 수 있게).
    expect(session.getAuditEntries().some((entry) => entry.kind === "status" && String(entry.text).includes("이전 대화 기록 주입"))).toBe(true);
  });

  it("Given 기록 없이 만든 세션 When 메시지 확인 Then 복원 메시지가 없다", () => {
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: stub().chat });

    expect(session.getMessages().some((message) => isRestoredTranscriptMessage(message))).toBe(false);
  });
});

describe("refreshProjectContext — 감독 지침 즉시 반영", () => {
  it("Given 진행 중 세션 When 지침을 바꿔 갈아끼움 Then 시스템 프롬프트만 갱신되고 대화는 남는다", async () => {
    const chat = stub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: chat.chat });
    await session.sendUserMessage("첫 지시", () => {});
    const conversationLength = session.getMessages().length;
    expect(String(session.getMessages()[0]!.content)).not.toContain("## 감독 지침");

    session.refreshProjectContext({ ...createBlankProject(), aiInstructions: "사이드뷰 전투는 쓰지 마라." });

    expect(String(session.getMessages()[0]!.content)).toContain("사이드뷰 전투는 쓰지 마라.");
    expect(session.getMessages()).toHaveLength(conversationLength);
  });
});
