// 빠른 연결(/auth/openai-compat/connect) — 도구 달린 채팅 시험이 통과할 때만 키를 저장한다.
import { afterAll, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "oprn-compat-connect-"));
process.env.OPRN_OPENAI_COMPAT_PATH = join(dir, "endpoints.json");
const { connectOpenAiCompat, listOpenAiCompatPublic } = await import("../scripts/lib/openAiCompatRuntime.ts");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const BASE = "http://127.0.0.1:9/v1";
const KEY = "sk-test-secret-123";
type Reply = { status: number; body: unknown };
const fakeFetch = (chat: (body: Record<string, unknown>) => Reply) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "m1" }] }), { status: 200 });
    const reply = chat(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
const ok: Reply = { status: 200, body: { choices: [{ message: { role: "assistant", content: "pong" } }] } };

describe("connectOpenAiCompat", () => {
  test("OpenRouter 는 키가 없으면 호출 없이 거절한다", async () => {
    const result = await connectOpenAiCompat({ kind: "openrouter" }, (() => { throw new Error("no call"); }) as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid");
    expect(listOpenAiCompatPublic()).toHaveLength(0);
  });

  test("채팅이 401 이면 저장하지 않고 키를 문장에 싣지 않는다", async () => {
    const result = await connectOpenAiCompat({ kind: "custom", baseUrl: BASE, apiKey: KEY, model: "m1" },
      fakeFetch(() => ({ status: 401, body: { error: { message: `invalid api key ${KEY}` } } })));
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain(KEY);
    expect(listOpenAiCompatPublic()).toHaveLength(0);
  });

  test("도구를 못 쓰는 모델이면 저장하지 않는다", async () => {
    const result = await connectOpenAiCompat({ kind: "custom", baseUrl: BASE, apiKey: KEY, model: "m1" },
      fakeFetch((body) => (body.tools ? { status: 400, body: { error: "tools is not supported" } } : ok)));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("tools");
    expect(listOpenAiCompatPublic()).toHaveLength(0);
  });

  test("모델 목록만 물을 때는 채팅을 보내지 않고 키를 문장에 싣지 않는다", async () => {
    const { testOpenAiCompat } = await import("../scripts/lib/openAiCompatRuntime.ts");
    let chats = 0;
    const result = await testOpenAiCompat({
      name: "OpenDesign", baseUrl: "https://amr-link.open-design.ai/v1", apiKey: KEY,
    }, (async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      expect(path).toBe("https://amr-link.open-design.ai/v1/models");
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${KEY}`);
      if (!path.endsWith("/models")) chats += 1;
      return new Response(JSON.stringify({ data: [{ id: "deepseek-v4.1-flash-eco" }, { id: "glm-5.3-flash" }] }), { status: 200 });
    }) as typeof fetch);
    expect(chats).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.models).toContain("deepseek-v4.1-flash-eco");
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  test("통과하면 기본 모델과 함께 저장하고, 다시 연결해도 한 줄만 남는다", async () => {
    const first = await connectOpenAiCompat({ kind: "custom", baseUrl: BASE, apiKey: KEY, model: "m1" }, fakeFetch(() => ok));
    expect(first.ok).toBe(true);
    expect(first.endpoint?.hasKey).toBe(true);
    expect(first.endpoint?.defaultModel).toBe("m1");
    expect(first.endpoint?.lastTest?.toolsOk).toBe(true);
    const again = await connectOpenAiCompat({ kind: "custom", baseUrl: BASE, apiKey: KEY, model: "m1" }, fakeFetch(() => ok));
    expect(again.endpoint?.id).toBe(first.endpoint?.id);
    expect(listOpenAiCompatPublic()).toHaveLength(1);
    expect(JSON.stringify(listOpenAiCompatPublic())).not.toContain(KEY);
  });

  test("OpenDesign 프리셋 주소와 추론 방식을 저장하고 공개 보기에는 키가 없다", async () => {
    const result = await connectOpenAiCompat({
      kind: "custom", name: "OpenDesign", baseUrl: "https://amr-link.open-design.ai/v1",
      apiKey: KEY, model: "deepseek-v4.1-flash-eco", reasoningMode: "none",
    }, fakeFetch(() => ok));
    expect(result.ok).toBe(true);
    expect(result.endpoint?.baseUrl).toBe("https://amr-link.open-design.ai/v1");
    expect(result.endpoint?.defaultModel).toBe("deepseek-v4.1-flash-eco");
    expect(result.endpoint?.reasoningMode).toBe("none");
    expect(result.endpoint?.hasKey).toBe(true);
    const exported = { project: { name: "demo" }, ai: { providerId: result.endpoint?.id, apiKey: "", baseUrl: "" } };
    expect(JSON.stringify(exported)).not.toContain(KEY);
    expect(JSON.stringify(result.endpoint)).not.toContain(KEY);
  });
});
