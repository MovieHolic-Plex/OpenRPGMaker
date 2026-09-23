// 로컬 호스트(개인 실행기·serve:project·Electron)의 동반 서비스는 실행별 토큰을 요구한다(설계 7.4).
// 실측 2026-09-23: /auth/* 만 토큰을 실어, 칩은 「연결됨」인데 조수 요청(/v1/chat/completions)은
// 403 `companion token required` 로 막혀 「의도 읽는 중…」에서 조용히 멈췄다.
// 조수·에이전트·그림 요청 모두 같은 토큰을 실어야 한다.
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// 첫 import 가 무겁다(llmClient 가 끌어오는 모듈 그래프) — 기본 15초로는 콜드 로드에서 넘친다.
vi.setConfig({ testTimeout: 60_000 });

const TOKEN = "run-token-1234";
let calls: { url: string; headers: Record<string, string> }[] = [];

function headersOf(init: RequestInit | undefined): Record<string, string> {
  return Object.fromEntries(new Headers(init?.headers).entries());
}

beforeEach(() => {
  calls = [];
  (globalThis as unknown as { window: unknown }).window = { oprn: { companionToken: TOKEN } };
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), headers: headersOf(init) });
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" } }] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  });
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

it("조수 채팅 요청이 동반 서비스 토큰을 싣는다", async () => {
  const { chatCompletion, defaultAiConfig } = await import("@/ai/llmClient");
  await chatCompletion({ ...defaultAiConfig(), authMode: "chatgpt" }, { messages: [{ role: "user", content: "hi" }] }).catch(() => undefined);
  const chat = calls.find(c => c.url.endsWith("/chat/completions"));
  expect(chat?.headers["x-oprn-companion-token"]).toBe(TOKEN);
});

it("API 키 게이트웨이 요청에는 동반 서비스 토큰을 싣지 않는다", async () => {
  const { chatCompletion, defaultAiConfig } = await import("@/ai/llmClient");
  await chatCompletion(
    { ...defaultAiConfig(), authMode: "apiKey", baseUrl: "https://gateway.invalid/v1", apiKey: "sk-x" },
    { messages: [{ role: "user", content: "hi" }] },
  ).catch(() => undefined);
  const chat = calls.find(c => c.url.endsWith("/chat/completions"));
  expect(chat).toBeDefined();
  expect(chat?.headers["x-oprn-companion-token"]).toBeUndefined();
});

it("Pi 에이전트 실행 요청이 동반 서비스 토큰을 싣는다", async () => {
  const { runPiAgentViaCompanion } = await import("@/ai/piAgent/client");
  await runPiAgentViaCompanion({ provider: "google-antigravity" } as never).catch(() => undefined);
  const run = calls.find(c => c.url.includes("/v1/agent/run"));
  expect(run?.headers["x-oprn-companion-token"]).toBe(TOKEN);
});

it("그림 생성 요청이 동반 서비스 토큰을 싣는다", async () => {
  const { generateAiImage } = await import("@/ai/imageGenerationClient");
  await generateAiImage({ prompt: "슬라임" }).catch(() => undefined);
  const image = calls.find(c => c.url.endsWith("/images/generations"));
  expect(image?.headers["x-oprn-companion-token"]).toBe(TOKEN);
});
