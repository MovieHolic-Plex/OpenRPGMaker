// LLM 네트워크 오류 재시도(도그푸딩 결함 ⑥) 회귀 테스트.
// - llmClient.chatCompletion: 일시 오류(네트워크/429/5xx) 자동 재시도 1회(백오프),
//   영구 오류(401/402)·스트리밍 도중 끊김은 재시도하지 않음, 이중 실패 시 원인 표기.
// - AssistantSession.retryLastTurn: 오류로 끊긴 턴을 같은 문맥에서 재개하고
//   이전에 누적된 제안을 잃지 않는다.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chatCompletion,
  isRetryableLlmError,
  LlmError,
  LLM_RETRY_BACKOFF_MS,
  type AiConfig,
} from "@/ai/llmClient";
import { AssistantSession } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";
import type { ChatResult } from "@/ai/llmClient";

const CONFIG: AiConfig = {
  baseUrl: "http://llm.test/v1",
  model: "test-model",
  apiKey: "sk-test",
  maxToolCalls: 8,
  maxTokens: 512,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function okResponse(): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content: "복구됨" }, finish_reason: "stop" }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("isRetryableLlmError", () => {
  it("네트워크(상태 없음)/429/5xx는 재시도, 401/402는 재시도 안 함", () => {
    expect(isRetryableLlmError(new LlmError("네트워크 오류"))).toBe(true);
    expect(isRetryableLlmError(new LlmError("한도", 429))).toBe(true);
    expect(isRetryableLlmError(new LlmError("서버", 503))).toBe(true);
    expect(isRetryableLlmError(new LlmError("인증", 401))).toBe(false);
    expect(isRetryableLlmError(new LlmError("크레딧", 402))).toBe(false);
    expect(isRetryableLlmError(new Error("일반"))).toBe(false);
  });
});

describe("chatCompletion 자동 재시도", () => {
  it("네트워크 오류 1회 후 성공하면 백오프 뒤 결과를 돌려준다", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed");
      return okResponse();
    }));

    const pending = chatCompletion(CONFIG, { messages: [{ role: "user", content: "hi" }] });
    await vi.advanceTimersByTimeAsync(LLM_RETRY_BACKOFF_MS + 10);
    const result = await pending;

    expect(calls).toBe(2);
    expect(result.message.content).toBe("복구됨");
  });

  it("이중 실패 시 '(자동 재시도 1회 실패)'를 원인에 표기한다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));

    const pending = chatCompletion(CONFIG, { messages: [{ role: "user", content: "hi" }] }).catch((cause: unknown) => cause);
    await vi.advanceTimersByTimeAsync(LLM_RETRY_BACKOFF_MS + 10);
    const error = await pending;

    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).message).toContain("네트워크 오류");
    expect((error as LlmError).message).toContain("자동 재시도 1회 실패");
  });

  it("401(인증)은 재시도 없이 즉시 던진다", async () => {
    const fetchSpy = vi.fn(async () => new Response("no key", { status: 401 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(chatCompletion(CONFIG, { messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ status: 401 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("AssistantSession.retryLastTurn — 수동 재시도", () => {
  function toolCallResult(name: string, args: unknown): ChatResult {
    return {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id: `c_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
      },
      finishReason: "tool_calls",
    };
  }

  it("오류로 끊긴 턴을 재개하면 이전 제안이 유지된 채 완주한다", async () => {
    let round = 0;
    const chat = async (): Promise<ChatResult> => {
      round += 1;
      if (round === 1) return toolCallResult("create_map", { id: "m_retry", name: "재시도 맵", width: 6, height: 6 });
      if (round === 2) throw new LlmError("네트워크 오류: LLM 엔드포인트에 연결할 수 없습니다");
      return { message: { role: "assistant", content: "완료했습니다.", tool_calls: undefined }, finishReason: "stop" };
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

    const first = await session.sendUserMessage("맵 만들어줘", () => {});
    expect(first.stoppedReason).toBe("error");
    expect(first.proposedCalls.map((call) => call.name)).toEqual(["create_map"]);
    expect(session.canRetryLastTurn()).toBe(true);

    const retried = await session.retryLastTurn(() => {});
    expect(retried.stoppedReason).toBe("final");
    expect(retried.assistantText).toBe("완료했습니다.");
    // 오류 이전에 누적된 제안을 잃지 않는다.
    expect(retried.proposedCalls.map((call) => call.name)).toEqual(["create_map"]);
    expect(session.canRetryLastTurn()).toBe(false);
  });

  it("오류가 없던 세션에서 retryLastTurn은 아무것도 하지 않는다", async () => {
    const chat = async (): Promise<ChatResult> => ({
      message: { role: "assistant", content: "네.", tool_calls: undefined },
      finishReason: "stop",
    });
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    await session.sendUserMessage("안녕", () => {});
    expect(session.canRetryLastTurn()).toBe(false);
    const noop = await session.retryLastTurn(() => {});
    expect(noop.stoppedReason).toBe("final");
    expect(noop.assistantText).toBe("");
  });
});
