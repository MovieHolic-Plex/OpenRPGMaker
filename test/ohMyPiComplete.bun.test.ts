import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "rpgzzu-oh-my-pi-c-"));
process.env.RPG_ZZU_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");
delete process.env.RPG_ZZU_OH_MY_PI_TEST_STUB;

const {
  completeProvider,
  publicProviderStatus,
  refreshProvider,
  saveProviderApiKey,
  seedOAuthForTests,
} = await import("../scripts/lib/ohMyPiPiAiRuntime.ts");

function headerAuth(init?: RequestInit): string {
  const headers = init?.headers;
  if (!headers) return "";
  if (headers instanceof Headers) return headers.get("authorization") ?? headers.get("Authorization") ?? "";
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === "authorization");
    return hit?.[1] ?? "";
  }
  return String((headers as Record<string, string>).Authorization ?? (headers as Record<string, string>).authorization ?? "");
}

function openAiSse(text: string): Response {
  const delta = {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }],
  };
  const done = {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  };
  const body = `data: ${JSON.stringify(delta)}\n\ndata: ${JSON.stringify(done)}\n\ndata: [DONE]\n\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("oh-my-pi complete (real pi-ai + mock fetch)", () => {
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("Groq 키로 complete 가 api.groq.com 을 친다", async () => {
    saveProviderApiKey("groq", "gsk-complete-test");
    const urls: string[] = [];
    const auths: string[] = [];
    const result = await completeProvider(
      "groq",
      { model: "openai/gpt-oss-120b", messages: [{ role: "user", content: "ping" }] },
      {
        fetch: async (input, init) => {
          urls.push(String(input));
          auths.push(headerAuth(init));
          return openAiSse("pong-from-groq");
        },
      },
    );
    expect(urls.some((url) => url.includes("api.groq.com"))).toBe(true);
    expect(auths.some((header) => header.includes("gsk-complete-test"))).toBe(true);
    expect(result.completion.choices[0].message.content).toBe("pong-from-groq");
  });

  test("만료된 Anthropic 토큰 갱신은 api.anthropic.com OAuth 토큰 URL 을 친다", async () => {
    // github-copilot refreshToken 은 refresh 를 access 로 복사만 하고 네트워크를 안 탄다.
    seedOAuthForTests("anthropic", {
      access: "expired-access",
      refresh: "invalid-refresh",
      expires: Date.now() - 1000,
    });
    const urls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    let message = "";
    try {
      await refreshProvider("anthropic");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(urls.some((url) => url.includes("https://api.anthropic.com/v1/oauth/token"))).toBe(true);
    expect(message.length).toBeGreaterThan(0);
    expect(/anthropic|oauth|token|400|invalid/i.test(message)).toBe(true);
  });

  test("만료된 Anthropic 갱신은 실제 token 엔드포인트에서 거절된다", async () => {
    seedOAuthForTests("anthropic", {
      access: "expired-access",
      refresh: "rpgzzu-invalid-refresh",
      expires: Date.now() - 1000,
    });
    let message = "";
    try {
      await refreshProvider("anthropic");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("https://api.anthropic.com/v1/oauth/token");
  });

  test("Antigravity OAuth without projectId is not reported as connected", () => {
    // Break caught: publicProviderStatus used to treat any unexpired access/refresh
    // token as connected, even though Antigravity cannot complete without projectId.
    seedOAuthForTests("google-antigravity", {
      access: "incomplete-access",
      refresh: "incomplete-refresh",
      expires: Date.now() + 60_000,
    });

    expect(publicProviderStatus("google-antigravity").connected).toBe(false);
  });

  test("Antigravity OAuth with projectId remains connected", () => {
    seedOAuthForTests("google-antigravity", {
      access: "complete-access",
      refresh: "complete-refresh",
      expires: Date.now() + 60_000,
      projectId: "complete-project",
    });

    expect(publicProviderStatus("google-antigravity").connected).toBe(true);
  });

  test("Antigravity completion preserves projectId and reaches the provider", async () => {
    seedOAuthForTests("google-antigravity", {
      access: "complete-access",
      refresh: "complete-refresh",
      expires: Date.now() + 60_000,
      projectId: "complete-project",
    });
    const urls: string[] = [];

    try {
      await completeProvider(
        "google-antigravity",
        { model: "gemini-3.1-pro", messages: [{ role: "user", content: "ping" }] },
        {
          fetch: async (input) => {
            urls.push(String(input));
            return new Response("upstream test stop", { status: 400 });
          },
        },
      );
    } catch {
      // The mocked upstream intentionally stops after credential parsing.
    }

    expect(urls.some((url) => url.includes("cloudcode-pa.googleapis.com"))).toBe(true);
    expect(publicProviderStatus("google-antigravity").connected).toBe(true);
  });
});
