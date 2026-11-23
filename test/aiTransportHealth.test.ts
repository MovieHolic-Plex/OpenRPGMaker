// 상태바 "AI 연결됨" 칩 진실화 — 실제 요청 성패(전송 건강)를 함께 판정하는지.
// 배경(2026-08-19 적대 평가 P0): 설정 모양만 보고 ready 를 내보내, 모든 턴이 404 로
// 죽는 동안에도 "AI 연결됨"이라고 표시했다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCompanion } from "@/ai/companionConnection";
import { getAiTransportHealth, reportTransportHealth, resetAiTransportHealth, type AiConfig } from "@/ai/llmClient";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";

const proxyConfig: AiConfig = {
  authMode: "apiKey",
  baseUrl: "/api/cliproxy",
  model: "test-model",
  apiKey: "",
  maxToolCalls: 8,
  maxTokens: 1024,
};

describe("AI 연동 칩 × 전송 건강", () => {
  beforeEach(() => {
    resetAiTransportHealth();
  });

  it("프록시 설정이면 기본은 연결됨", () => {
    const status = getAiConnectionStatus(proxyConfig);
    expect(status.kind).toBe("ready");
    expect(status.label).toBe("Google 연결됨");
  });

  it("404 실패가 기록되면 '연결됨' 대신 응답 오류를 보고한다", () => {
    reportTransportHealth(false, 404, "요청 실패(404)");
    const status = getAiConnectionStatus(proxyConfig);
    expect(status.kind).toBe("offline");
    expect(status.label).toContain("404");
    expect(status.title).toContain("실패");
  });

  it("성공이 기록되면 자동으로 연결됨으로 복구된다", () => {
    reportTransportHealth(false, 404, "요청 실패(404)");
    reportTransportHealth(true, 200);
    const status = getAiConnectionStatus(proxyConfig);
    expect(status.kind).toBe("ready");
  });

  it("429 뒤 내 PC 프로그램 감지(/v1/local-agents) 성공은 한도 표시를 지우지 않고, 모델 호출 성공만 지운다", async () => {
    const reply = (status: number, headers: Record<string, string> = {}) => async () => new Response("{}", { status, headers });
    await fetchCompanion("/v1/agent/run", { method: "POST", body: "{}" }, { fetchImpl: reply(429, { "retry-after": "600" }) });
    await vi.waitFor(() => expect(getAiTransportHealth()?.status).toBe(429));
    expect(getAiTransportHealth()?.message).toContain("Retry-After 600");

    await fetchCompanion("/v1/local-agents", undefined, { fetchImpl: reply(200) });
    // fetchCompanion 은 해제를 `import("@/ai/llmClient").then(...)` 으로 미룬다 — 같은 import 를 기다리면 그보다 먼저 걸린 해제가 끝난 뒤다.
    await import("@/ai/llmClient");
    expect(getAiTransportHealth()?.status).toBe(429);

    await fetchCompanion("/v1/agent/run", { method: "POST", body: "{}" }, { fetchImpl: reply(200) });
    await vi.waitFor(() => expect(getAiTransportHealth()?.ok).toBe(true));
  });

  it("429(사용량 제한)는 연결 문제로 취급하지 않는다", () => {
    // llmClient 는 429 를 아예 기록하지 않지만, 방어적으로 기록되더라도 칩은 붉히지 않는다.
    reportTransportHealth(false, 429, "사용량 제한");
    const status = getAiConnectionStatus(proxyConfig);
    expect(status.kind).toBe("ready");
  });

  it("네트워크 오류(상태 코드 없음)도 응답 오류로 보고한다", () => {
    reportTransportHealth(false, undefined, "네트워크 오류(/api/x)");
    const status = getAiConnectionStatus(proxyConfig);
    expect(status.kind).toBe("offline");
  });
});
