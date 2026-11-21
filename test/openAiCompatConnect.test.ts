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

  test("프리셋의 허용·차단·그림 설정을 저장하고, 다음 연결에서 빼면 유지한다", async () => {
    const base = "http://127.0.0.1:8318/v1";
    let chats = 0;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "gemini-4-argon-high" }, { id: "claude-sonnet" }] }), { status: 200 });
      }
      chats += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      expect(body.model).toBe("gemini-4-argon-high");
      return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "pong" } }] }), { status: 200 });
    }) as typeof fetch;
    const first = await connectOpenAiCompat({
      kind: "custom", name: "CLIProxyAPI Argon", baseUrl: base, apiKey: KEY, model: "gemini-4-argon-high",
      allowModels: ["gemini-4-argon*"], blockModels: ["claude-*"],
      supportsImages: true, imageModels: ["gemini-4-argon-high"],
    }, fetchImpl);
    expect(first.ok).toBe(true);
    expect(first.endpoint?.allowModels).toEqual(["gemini-4-argon*"]);
    expect(first.endpoint?.blockModels).toEqual(["claude-*"]);
    expect(first.endpoint?.supportsImages).toBe(true);
    expect(first.endpoint?.imageModels).toEqual(["gemini-4-argon-high"]);
    expect(first.test?.models).toContain("gemini-4-argon-high");
    expect(first.test?.models).not.toContain("claude-sonnet");
    expect(chats).toBe(1);

    chats = 0;
    const again = await connectOpenAiCompat({
      kind: "custom", name: "CLIProxyAPI Argon", baseUrl: base, apiKey: KEY, model: "gemini-4-argon-high",
    }, fetchImpl);
    expect(again.ok).toBe(true);
    expect(again.endpoint?.id).toBe(first.endpoint?.id);
    expect(again.endpoint?.allowModels).toEqual(["gemini-4-argon*"]);
    expect(again.endpoint?.blockModels).toEqual(["claude-*"]);
    expect(again.endpoint?.supportsImages).toBe(true);
    expect(again.endpoint?.imageModels).toEqual(["gemini-4-argon-high"]);
    expect(again.endpoint?.models).not.toContain("claude-sonnet");
    expect(again.test?.models).not.toContain("claude-sonnet");
    expect(chats).toBe(1);
  });

  test("다시 연결할 때 패턴을 빼도 저장된 차단 모델에는 채팅을 보내지 않는다", async () => {
    const base = "http://127.0.0.1:8320/v1";
    let chats = 0;
    const fetchImpl = (async (url: string | URL | Request) => {
      const path = String(url);
      if (path.endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "gemini-4-argon-high" }, { id: "claude-sonnet" }] }), { status: 200 });
      }
      chats += 1;
      return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "pong" } }] }), { status: 200 });
    }) as typeof fetch;
    const first = await connectOpenAiCompat({
      kind: "custom", name: "CLIProxyAPI Argon", baseUrl: base, apiKey: KEY, model: "gemini-4-argon-high",
      allowModels: ["gemini-4-argon*"], blockModels: ["claude-*"],
    }, fetchImpl);
    expect(first.ok).toBe(true);
    chats = 0;
    const blocked = await connectOpenAiCompat({
      kind: "custom", name: "CLIProxyAPI Argon", baseUrl: base, apiKey: KEY, model: "claude-sonnet",
    }, fetchImpl);
    expect(blocked.ok).toBe(false);
    expect(chats).toBe(0);
    expect(blocked.message).toContain("호출하지 않았어요");
    expect(blocked.message).not.toContain(KEY);
    expect(listOpenAiCompatPublic().find((row) => row.baseUrl === base)?.defaultModel).toBe("gemini-4-argon-high");
    expect(listOpenAiCompatPublic().find((row) => row.baseUrl === base)?.blockModels).toEqual(["claude-*"]);

    chats = 0;
    const cleared = await connectOpenAiCompat({
      kind: "custom", name: "CLIProxyAPI Argon", baseUrl: base, apiKey: KEY, model: "claude-sonnet",
      allowModels: [], blockModels: [],
    }, fetchImpl);
    expect(cleared.ok).toBe(true);
    expect(chats).toBe(1);
    expect(cleared.endpoint?.allowModels).toEqual([]);
    expect(cleared.endpoint?.blockModels).toEqual([]);
    expect(cleared.endpoint?.defaultModel).toBe("claude-sonnet");
  });
});
