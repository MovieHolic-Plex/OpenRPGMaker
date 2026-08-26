// LLM 네트워크 오류 재시도(도그푸딩 결함 ⑥) 회귀 테스트.
// - llmClient.chatCompletion: 일시 오류(네트워크/429/5xx) 자동 재시도 1회(백오프),
//   영구 오류(401/402)·스트리밍 도중 끊김은 LlmError로 정규화하되 단독 호출에서는 재시도하지 않음.
// - AssistantSession: 스트리밍 도중 끊김을 같은 LLM 라운드 처음부터 최대 3회 재시도하고
//   사용자 중단은 재시도하지 않음.
// - AssistantSession.retryLastTurn: 오류로 끊긴 턴을 같은 문맥에서 재개하고
//   이전에 누적된 제안을 잃지 않는다.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chatCompletion,
  isRetryableLlmError,
  LlmError,
  LlmAbortError,
  LLM_REQUEST_TIMEOUT_MS,
  LLM_RETRY_BACKOFF_MS,
  type AiConfig,
  type ChatRequest,
} from "@/ai/llmClient";
import { AssistantSession } from "@/ai/assistantSession";
import type { SessionEvent } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";
import type { ChatResult } from "@/ai/llmClient";

const CONFIG: AiConfig = {
  baseUrl: "http://llm.test/v1",
  model: "minimax/minimax-m3",
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

function cutStreamResponse(): Response {
  const encoder = new TextEncoder();
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls > 1) {
        controller.error(new TypeError("terminated"));
        return;
      }
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"부분"}}]}\n\n'));
    },
  });
  return new Response(stream, { status: 200 });
}

async function advanceRetryBackoffs(count: number): Promise<void> {
  for (let attempt = 1; attempt <= count; attempt += 1) {
    await vi.advanceTimersByTimeAsync(LLM_RETRY_BACKOFF_MS * attempt + 10);
  }
}

describe("isRetryableLlmError", () => {
  it("네트워크(상태 없음)/429/5xx는 재시도, 401/402는 재시도 안 함", () => {
    expect(isRetryableLlmError(new LlmError("네트워크 오류"))).toBe(true);
    expect(isRetryableLlmError(new LlmError("전송 상태 오류", 0))).toBe(true);
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

  it("스트림 reader 절단은 네트워크 LlmError로 정규화하고 단독 호출에서는 재시도하지 않는다", async () => {
    const fetchSpy = vi.fn(async () => cutStreamResponse());
    vi.stubGlobal("fetch", fetchSpy);
    const tokens: string[] = [];

    const error = await chatCompletion(CONFIG, {
      messages: [{ role: "user", content: "hi" }],
      onToken: (delta) => tokens.push(delta),
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).message).toContain("스트리밍 연결이 끊겼습니다");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(["부분"]);
  });

  it("응답 없는 매달림은 요청 타임아웃(504, 재시도 가능)으로 정규화한다", async () => {
    vi.useFakeTimers();
    // fetch 가 영원히 resolve 되지 않는 매달림 — 타임아웃 타이머가 abort 를 걸면 reject 된다.
    const hangFetch = vi.fn((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );
    vi.stubGlobal("fetch", hangFetch);

    const promise = chatCompletion(CONFIG, {
      messages: [{ role: "user", content: "hi" }],
      disableTransientRetry: true, // 매달림 타임아웃 자체를 검증 — 재시도 경로는 isRetryableLlmError 로 확인한다.
    });
    const assertion = promise.then(
      () => null,
      (cause: unknown) => cause,
    );
    await vi.advanceTimersByTimeAsync(LLM_REQUEST_TIMEOUT_MS + 1000);
    const error = await assertion;

    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).status).toBe(504);
    expect((error as LlmError).message).toContain("요청 시간 초과");
    expect(isRetryableLlmError(error)).toBe(true);
  });

  it("호출자 signal 중단은 매달림 타임아웃보다 우선해 LlmAbortError로 끝난다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
      ),
    );
    const controller = new AbortController();

    const promise = chatCompletion(CONFIG, {
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
      disableTransientRetry: true,
    });
    const assertion = promise.then(
      () => null,
      (cause: unknown) => cause,
    );
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    const error = await assertion;

    expect(error).toBeInstanceOf(LlmAbortError);
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
      if (round === 2) throw new Error("일반 오류: 수동 재시도 확인");
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

  it("일시 LLM 오류는 같은 턴에서 자동 재시도해 수동 재시도 없이 완주한다", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const chat = async (): Promise<ChatResult> => {
      calls += 1;
      if (calls === 1) throw new LlmError("서버 오류", 503);
      return { message: { role: "assistant", content: "자동 복구됨", tool_calls: undefined }, finishReason: "stop" };
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

    const pending = session.sendUserMessage("안녕", () => {});
    await vi.advanceTimersByTimeAsync(LLM_RETRY_BACKOFF_MS + 10);
    const result = await pending;

    expect(calls).toBe(2);
    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("자동 복구됨");
    expect(session.canRetryLastTurn()).toBe(false);
  });

  it("oh-my-pi worker crash 500은 한 번만 재시도하고 멈춘다", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const chat = async (): Promise<ChatResult> => {
      calls += 1;
      throw new LlmError(
        '서버 오류(500): 공급자 측 문제입니다. 잠시 후 재시도하세요. — {"error":"oh-my-pi worker exited (3221225794)"}',
        500,
      );
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: SessionEvent[] = [];

    const pending = session.sendUserMessage("야외 집 한 채", (event) => events.push(event));
    await advanceRetryBackoffs(1);
    const result = await pending;

    expect(calls).toBe(2);
    expect(result.stoppedReason).toBe("error");
    expect(events.filter((event) => event.type === "status").map((event) => event.text)).toEqual([
      "일시 오류 — 재시도 중(1/1)",
    ]);
  });

  it("토큰 일부 수신 후 스트림이 끊기면 부분 출력을 초기화하고 같은 라운드를 재시도한다", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const partial = "부분 출력 ".repeat(80);
    const chat = async (_config: AiConfig, req: ChatRequest): Promise<ChatResult> => {
      calls += 1;
      if (calls === 1) {
        req.onReasoning?.("중간 추론");
        req.onToken?.(partial);
        throw new LlmError("네트워크 오류: 스트리밍 연결이 끊겼습니다.");
      }
      req.onToken?.("완료");
      return { message: { role: "assistant", content: "완료", tool_calls: undefined }, finishReason: "stop" };
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: SessionEvent[] = [];
    let displayed = "";

    const pending = session.sendUserMessage("안녕", (event) => {
      events.push(event);
      if (event.type === "assistant_token") displayed += event.delta;
      if (event.type === "assistant_stream_reset") displayed = "";
    });
    await advanceRetryBackoffs(1);
    const result = await pending;

    expect(calls).toBe(2);
    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("완료");
    expect(displayed).toBe("완료");
    expect(displayed).not.toContain("부분 출력");
    expect(events.some((event) => event.type === "assistant_stream_reset")).toBe(true);
    expect(events.some((event) => event.type === "status" && event.text === "연결 끊김 — 재시도 중(1/3)")).toBe(true);
  });

  it("스트림 절단이 재시도 3회를 모두 소진하면 오류로 종료하고 수동 재시도를 허용한다", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const chat = async (_config: AiConfig, req: ChatRequest): Promise<ChatResult> => {
      calls += 1;
      req.onReasoning?.(`추론 ${calls}`);
      req.onToken?.(`부분 ${calls} `.repeat(80));
      throw new LlmError("네트워크 오류: 스트리밍 연결이 끊겼습니다.");
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: SessionEvent[] = [];

    const pending = session.sendUserMessage("긴 작업", (event) => events.push(event));
    await advanceRetryBackoffs(3);
    const result = await pending;

    expect(calls).toBe(4);
    expect(result.stoppedReason).toBe("error");
    expect(result.error).toContain("일시적 네트워크 문제로 보이면 재시도를 눌러 주세요");
    expect(session.canRetryLastTurn()).toBe(true);
    expect(events.filter((event) => event.type === "assistant_stream_reset")).toHaveLength(3);
    expect(events.filter((event) => event.type === "status").map((event) => event.text)).toEqual([
      "연결 끊김 — 재시도 중(1/3)",
      "연결 끊김 — 재시도 중(2/3)",
      "연결 끊김 — 재시도 중(3/3)",
    ]);
  });

  it("사용자 중단은 스트리밍 후에도 재시도하지 않는다", async () => {
    let calls = 0;
    const chat = async (_config: AiConfig, req: ChatRequest): Promise<ChatResult> => {
      calls += 1;
      req.onToken?.("중단 전 ".repeat(80));
      throw new LlmAbortError();
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const events: SessionEvent[] = [];

    const result = await session.sendUserMessage("중단 테스트", (event) => events.push(event));

    expect(calls).toBe(1);
    expect(result.stoppedReason).toBe("aborted");
    expect(session.canRetryLastTurn()).toBe(false);
    expect(events.some((event) => event.type === "assistant_stream_reset")).toBe(false);
    expect(events.some((event) => event.type === "status" && event.text.includes("재시도 중"))).toBe(false);
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
