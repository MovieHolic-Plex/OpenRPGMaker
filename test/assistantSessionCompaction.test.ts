// AssistantSession ↔ contextCompaction 배선 회귀 테스트.
//
// 계약: 요청 조립(compactMessagesForRequest) **직전에** 대화가 모델 컨텍스트 창을 넘봤는지
// 판정하고, 넘봤다면 LLM 요약 1회로 앞부분을 갈아치운다. 요약이 실패하면 대화를 그대로 두고
// 턴은 계속된다 — 압축은 성능 최적화이지 턴을 죽일 권리가 없다.
//
// 임계는 "직전 요청에 공급자가 과금한 prompt_tokens" 로 넘긴다(recordPromptUsage → lastPromptTokens).
// 로컬 추정만으로 넘기려면 픽스처가 45만 자를 넘어야 하고, 그러면 어느 라운드에서 넘는지가
// 시스템 프롬프트 길이에 딸려 흔들린다. 과금 값을 주면 트리거 지점이 하나로 고정된다.
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import {
  isCompactionSummaryMessage,
  SUMMARIZATION_SYSTEM_PROMPT,
} from "@/ai/contextCompaction";
import type { AiConfig, ChatMessage, ChatRequest, ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";

// 알 수 없는 모델 = DEFAULT_CONTEXT_WINDOW 128,000. reserve 16,384 → 임계 111,616 토큰.
// agentMode "chat" + liteModel === model → 플래너 라운드 없음(콜 수가 결정적이다).
const CONFIG: AiConfig = {
  authMode: "apiKey",
  baseUrl: "x",
  model: "compaction-test-model",
  liteModel: "compaction-test-model",
  apiKey: "sk",
  maxToolCalls: 8,
  maxTokens: 4_000_000,
  agentMode: "chat",
};

/** 어시스턴트 1개당 40,000자(≈10,000토큰) — 잔존 창(keepRecentTokens 20,000)이 두 개로 채워진다. */
const FILLER = "마을 광장 타일 배치와 NPC 배치 결과를 상세히 기록한 진행 로그 문장. ".repeat(1000).slice(0, 40_000);
/** 픽스처를 쌓는 동안은 창이 한가하다고 보고한다(압축 미발동). */
const IDLE_PROMPT_TOKENS = 1_000;
/** 창이 거의 찼다고 보고하는 과금 값 — 임계 111,616 초과. */
const NEARLY_FULL_PROMPT_TOKENS = 130_000;
const SUMMARY_TEXT = "## Goal\n마을 정비 계속\n\n## Next Steps\n1. 남은 NPC 배치";
const INSTRUCTION = "압축 후에도 남아야 하는 지시문을 지켜줘";

function isSummarizationRequest(req: ChatRequest): boolean {
  return req.messages[0]?.content === SUMMARIZATION_SYSTEM_PROMPT;
}

interface StubChat {
  readonly chat: (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;
  readonly summarizationRequests: ChatRequest[];
  readonly mainRequests: ChatRequest[];
  /** 다음 본문 응답이 보고할 과금 prompt_tokens. 테스트가 턴 사이에 바꾼다. */
  billedPromptTokens: number;
}

/**
 * 요약 콜과 본문 콜을 갈라 기록하는 스텁. 본문 콜은 홀수 라운드 = 큰 텍스트 + 읽기 툴콜,
 * 짝수 라운드 = 큰 텍스트 최종 응답 — 즉 턴당 정확히 2콜이고 히스토리에 tool 메시지가 남는다.
 */
function stubChat(summarize: (req: ChatRequest) => Promise<ChatResult>): StubChat {
  const stub: StubChat = {
    summarizationRequests: [],
    mainRequests: [],
    billedPromptTokens: IDLE_PROMPT_TOKENS,
    chat: async (_config, req) => {
      if (isSummarizationRequest(req)) {
        stub.summarizationRequests.push(req);
        return summarize(req);
      }
      stub.mainRequests.push(req);
      const usage = { completion_tokens: 10, prompt_tokens: stub.billedPromptTokens };
      if (stub.mainRequests.length % 2 === 1) {
        return {
          message: {
            role: "assistant",
            content: FILLER,
            tool_calls: [
              {
                id: `call_${stub.mainRequests.length}`,
                type: "function",
                function: { name: "get_project_summary", arguments: "{}" },
              },
            ],
          },
          finishReason: "tool_calls",
          usage,
        };
      }
      return { message: { role: "assistant", content: FILLER }, finishReason: "stop", usage };
    },
  };
  return stub;
}

function successSummaryStub(): StubChat {
  return stubChat(async () => ({ message: { role: "assistant", content: SUMMARY_TEXT }, finishReason: "stop" }));
}

/** 4턴 × 80,000자 = 320,000자(≈80,000토큰). 추정만으로는 임계에 못 닿는다 — 압축 미발동. */
async function growLongConversation(session: AssistantSession): Promise<void> {
  for (let turn = 0; turn < 4; turn += 1) {
    await session.sendUserMessage(`${turn}번째 진행 상황을 정리해줘`, () => {});
  }
}

/** role "tool" 메시지 중 창 안에 짝(assistant.tool_calls)이 없는 것들. */
function orphanToolMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  const answered = new Set<string>();
  const orphans: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role === "tool") {
      if (message.tool_call_id === undefined || !answered.has(message.tool_call_id)) orphans.push(message);
      continue;
    }
    for (const call of message.tool_calls ?? []) answered.add(call.id);
  }
  return orphans;
}

function statusTexts(session: AssistantSession): string[] {
  return session.getAuditEntries().filter((entry) => entry.kind === "status").map((entry) => String(entry.text));
}

describe("AssistantSession 컨텍스트 압축 배선", () => {
  it("(a) 임계를 넘긴 대화는 요약 콜 1회로 압축되고 다음 요청이 [시스템, 요약, 잔존 꼬리]로 재조립된다", async () => {
    const stub = successSummaryStub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: stub.chat });
    await growLongConversation(session);
    expect(stub.summarizationRequests).toHaveLength(0); // 픽스처 단계는 임계 미달

    stub.billedPromptTokens = NEARLY_FULL_PROMPT_TOKENS;
    await session.sendUserMessage(INSTRUCTION, () => {});

    expect(stub.summarizationRequests).toHaveLength(1);
    // 요약 콜에는 툴을 실어 보내지 않는다(요약 모델이 툴을 부르면 안 된다).
    expect(stub.summarizationRequests[0]!.tools).toBeUndefined();

    const sent = stub.mainRequests.at(-1)!.messages;
    expect(sent[0]!.role).toBe("system");
    expect(isCompactionSummaryMessage(sent[1]!)).toBe(true);
    expect(String(sent[1]!.content)).toContain("남은 NPC 배치");
    expect(orphanToolMessages(sent)).toEqual([]);
    // 영구 대화도 같은 모양이다 — 시스템 프롬프트는 인덱스 0 유지(refreshSystemPromptBudget 계약).
    const messages = session.getMessages();
    expect(messages[0]!.role).toBe("system");
    expect(isCompactionSummaryMessage(messages[1]!)).toBe(true);
    expect(statusTexts(session).some((text) => text.startsWith("대화 압축:"))).toBe(true);
  });

  it("(b) 압축 후에도 사용자 지시문이 대화와 요청에 남는다", async () => {
    const stub = successSummaryStub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: stub.chat });
    await growLongConversation(session);

    stub.billedPromptTokens = NEARLY_FULL_PROMPT_TOKENS;
    await session.sendUserMessage(INSTRUCTION, () => {});

    expect(stub.summarizationRequests).toHaveLength(1);
    const hasInstruction = (messages: readonly ChatMessage[]): boolean =>
      messages.some((message) => message.role === "user" && String(message.content).includes("남아야 하는 지시문"));
    expect(hasInstruction(session.getMessages())).toBe(true);
    expect(hasInstruction(stub.mainRequests.at(-1)!.messages)).toBe(true);
  });

  it("(c) 요약 콜이 실패하면 대화는 그대로 유지되고 턴은 정상 종료된다", async () => {
    const stub = stubChat(async () => {
      throw new Error("요약 공급자 500");
    });
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: stub.chat });
    await growLongConversation(session);
    const before = structuredClone(session.getMessages()) as ChatMessage[];

    stub.billedPromptTokens = NEARLY_FULL_PROMPT_TOKENS;
    const result = await session.sendUserMessage("압축 실패에도 진행해줘", () => {});

    // 실패는 턴당 1회만 시도한다 — 라운드마다 같은 요약 콜을 다시 때리지 않는다.
    expect(stub.summarizationRequests).toHaveLength(1);
    expect(result.stoppedReason).toBe("final");
    const after = session.getMessages();
    // 픽스처 구간은 한 글자도 바뀌지 않았고, 이번 턴 메시지만 뒤에 붙었다.
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.length).toBeGreaterThan(before.length);
    expect(after.some((message) => isCompactionSummaryMessage(message))).toBe(false);
    expect(statusTexts(session).some((text) => text.startsWith("대화 압축 건너뜀:"))).toBe(true);
  });

  it("(d) 작은 대화는 요약 콜을 만들지 않는다", async () => {
    const stub = successSummaryStub();
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: stub.chat });

    await session.sendUserMessage("간단한 질문 하나만 정리해줘", () => {});

    expect(stub.summarizationRequests).toHaveLength(0);
    expect(session.getMessages().some((message) => isCompactionSummaryMessage(message))).toBe(false);
  });
});
