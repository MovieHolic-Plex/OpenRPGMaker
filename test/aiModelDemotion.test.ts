// 모델 조용한 강등 회귀 스펙.
//
// 동반 서비스의 resolveModel 은 카탈로그 밖 모델 ID 를 오류가 아니라 제공자 기본 모델로
// 바꿔 버린다 — **68종 전부에서.** isModelValidForAuthMode 화이트리스트는 openai-codex
// 하나만 막으므로 나머지 제공자는 무방비였고, 감독이 고른 모델이 아닌 것이 답해도 신호가 없었다.
//
// 다행히 응답 본문의 `model` 은 해석된 모델이다(assistantToOpenAI). 서버를 고치지 않고도
// 요청 모델과 비교하면 강등이 보인다 — 이 스펙이 그 비교를 고정한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  chatCompletion,
  getAiModelDemotion,
  reportModelDemotion,
  resetAiModelDemotion,
  resetAiTransportHealth,
  type AiConfig,
} from "@/ai/llmClient";

const CONFIG: AiConfig = {
  authMode: "apiKey",
  baseUrl: "https://example.invalid/v1",
  model: "glm-5.2-ultrafast",
  apiKey: "sk-test",
  maxToolCalls: 8,
  maxTokens: 1024,
};

function completion(model: string): Response {
  return new Response(
    JSON.stringify({
      model,
      choices: [{ message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

beforeEach(() => {
  resetAiModelDemotion();
  resetAiTransportHealth();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetAiModelDemotion();
});

describe("reportModelDemotion", () => {
  it("요청 모델과 응답 모델이 같으면 아무것도 기록하지 않는다", () => {
    reportModelDemotion("gpt-5.6-sol", "gpt-5.6-sol");
    expect(getAiModelDemotion()).toBeNull();
  });

  it("대소문자만 다른 것은 강등이 아니다", () => {
    reportModelDemotion("GPT-5.6-Sol", "gpt-5.6-sol");
    expect(getAiModelDemotion()).toBeNull();
  });

  it("빈 값은 무시한다", () => {
    reportModelDemotion("", "gpt-5.6-sol");
    reportModelDemotion("gpt-5.6-sol", "   ");
    expect(getAiModelDemotion()).toBeNull();
  });

  it("다르면 요청·응답 모델을 함께 기록한다", () => {
    reportModelDemotion("glm-5.2-ultrafast", "gpt-5.5");
    expect(getAiModelDemotion()).toMatchObject({
      requested: "glm-5.2-ultrafast",
      served: "gpt-5.5",
    });
  });
});

describe("실제 응답에서 강등을 잡아낸다", () => {
  it("응답 model 이 요청과 다르면 기록된다 (서버 변경 없이)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => completion("gpt-5.5")));

    const result = await chatCompletion(CONFIG, { messages: [{ role: "user", content: "hi" }] });

    // 강등된 응답도 쓸 수 있는 응답이다 — 크게 말하되 치명적으로 만들지 않는다.
    expect(result.message.content).toBe("OK");
    expect(getAiModelDemotion()).toMatchObject({
      requested: "glm-5.2-ultrafast",
      served: "gpt-5.5",
    });
  });

  it("응답 model 이 요청과 같으면 기록하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => completion("glm-5.2-ultrafast")));

    await chatCompletion(CONFIG, { messages: [{ role: "user", content: "hi" }] });

    expect(getAiModelDemotion()).toBeNull();
  });

  it("응답에 model 필드가 없으면 판단하지 않는다 (지어내지 않는다)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { role: "assistant", content: "OK" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));

    await chatCompletion(CONFIG, { messages: [{ role: "user", content: "hi" }] });

    expect(getAiModelDemotion()).toBeNull();
  });
});
