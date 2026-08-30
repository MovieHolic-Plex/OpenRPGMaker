import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "rpgzzu-oh-my-pi-c-"));
process.env.RPG_ZZU_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");
delete process.env.RPG_ZZU_OH_MY_PI_TEST_STUB;

// 경계가 갈렸다: 자격·갱신·상태는 Node 쪽 aiAuthRuntime, 모델 호출만 pi-ai 런타임이다.
const { completeProvider } = await import("../scripts/lib/ohMyPiPiAiRuntime.ts");
const {
  publicProviderStatus,
  refreshProvider,
  resolveRequestApiKey,
  seedOAuthForTests,
} = await import("../scripts/lib/aiAuthRuntime.ts");

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

function antigravityImageSse(base64: string): string {
  const chunk = {
    response: {
      candidates: [{
        content: {
          role: "model",
          parts: [
            { text: "완료" },
            { inlineData: { mimeType: "image/jpeg", data: base64 } },
          ],
        },
        finishReason: "STOP",
      }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    },
  };
  return `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
}

function responseWithUrl(body: string, url: string): Response {
  const response = new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  Object.defineProperty(response, "url", { value: url, configurable: true });
  return response;
}

describe("oh-my-pi complete (real pi-ai + mock fetch)", () => {
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("해결된 자격이 실제 요청의 Authorization 으로 나간다", async () => {
    // 원래 이 케이스는 groq API 키가 api.groq.com 으로 나가는지 봤다. 제공자가 둘로 줄어
    // groq 는 사라졌지만 지켜야 할 것은 같다: **우리가 만든 자격이 와이어에 실제로 실린다.**
    seedOAuthForTests("openai-codex", {
      access: "codex-access-on-wire",
      refresh: "codex-refresh",
      expires: Date.now() + 60_000,
    });
    const apiKey = await resolveRequestApiKey("openai-codex");
    expect(apiKey).toBe("codex-access-on-wire");

    const urls: string[] = [];
    const auths: string[] = [];
    try {
      await completeProvider(
        "openai-codex",
        { model: "gpt-5.6-sol", messages: [{ role: "user", content: "ping" }] },
        {
          apiKey,
          fetch: async (input, init) => {
            urls.push(String(input));
            auths.push(headerAuth(init));
            return new Response("upstream test stop", { status: 400 });
          },
        },
      );
    } catch {
      // 모의 상류는 요청 직렬화 직후 의도적으로 멈춘다.
    }

    expect(urls.some((url) => /chatgpt\.com|openai\.com/.test(url))).toBe(true);
    expect(auths.some((header) => header.includes("codex-access-on-wire"))).toBe(true);
  });

  test("만료된 Antigravity 갱신은 우리 코드로 Google token URL 을 친다", async () => {
    // 원래 이 자리에는 Anthropic 갱신 케이스 둘이 있었다. Anthropic 은 레지스트리에서 사라졌지만
    // 지켜야 할 계약은 같다: 갱신이 **제공자의 실제 토큰 엔드포인트**를 치고, 실패가 삼켜지지 않는다.
    seedOAuthForTests("google-antigravity", {
      access: "expired-access",
      refresh: "invalid-refresh",
      expires: Date.now() - 1000,
      projectId: "proj-refresh",
    });
    const urls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    let message = "";
    try {
      await refreshProvider("google-antigravity");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(urls).toContain("https://oauth2.googleapis.com/token");
    expect(message.length).toBeGreaterThan(0);
    expect(/antigravity|token|refresh|400|invalid/i.test(message)).toBe(true);
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
          apiKey: await resolveRequestApiKey("google-antigravity"),
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

  test("Antigravity 이미지 요청에 modality를 주입하고 SSE inlineData를 반환한다", async () => {
    seedOAuthForTests("google-antigravity", {
      access: "image-access",
      refresh: "image-refresh",
      expires: Date.now() + 60_000,
      projectId: "image-project",
    });
    const { generateProviderImage } = await import("../scripts/lib/ohMyPiImageRuntime.ts");
    const base64 = "aGFydmVzdGVkLWltYWdl";
    let requestBody: Record<string, any> | undefined;

    const image = await generateProviderImage(
      "google-antigravity",
      { model: "gemini-3.1-flash-image", prompt: "슬라임" },
      {
        apiKey: await resolveRequestApiKey("google-antigravity"),
        fetch: async (input, init) => {
          requestBody = JSON.parse(String(init?.body ?? "{}"));
          return responseWithUrl(antigravityImageSse(base64), String(input));
        },
      },
    );

    expect(requestBody?.request?.generationConfig?.responseModalities).toEqual(["TEXT", "IMAGE"]);
    expect(image.mimeType).toBe("image/jpeg");
    expect(image.base64).toBe(base64);
  });

  test("Antigravity 빈 스트림 재시도에서도 응답 URL을 보존해 이미지를 반환한다", async () => {
    seedOAuthForTests("google-antigravity", {
      access: "retry-access",
      refresh: "retry-refresh",
      expires: Date.now() + 60_000,
      projectId: "retry-project",
    });
    const { generateProviderImage } = await import("../scripts/lib/ohMyPiImageRuntime.ts");
    const base64 = "cmV0cmllZC1pbWFnZQ==";
    let fetchCalls = 0;

    const image = await generateProviderImage(
      "google-antigravity",
      { model: "gemini-3.1-flash-image", prompt: "슬라임" },
      {
        apiKey: await resolveRequestApiKey("google-antigravity"),
        fetch: async (input) => {
          fetchCalls += 1;
          return responseWithUrl(fetchCalls === 1 ? "" : antigravityImageSse(base64), String(input));
        },
      },
    );

    expect(fetchCalls).toBeGreaterThan(1);
    expect(image.mimeType).toBe("image/jpeg");
    expect(image.base64).toBe(base64);
  });

  test("Antigravity 안전 정책 차단은 로그인 오류로 오인하지 않는다", async () => {
    seedOAuthForTests("google-antigravity", {
      access: "safety-access",
      refresh: "safety-refresh",
      expires: Date.now() + 60_000,
      projectId: "safety-project",
    });
    const { generateProviderImage } = await import("../scripts/lib/ohMyPiImageRuntime.ts");
    const body = JSON.stringify({
      error: {
        code: 400,
        message: "Request blocked: forbidden content under safety policy",
        status: "INVALID_ARGUMENT",
      },
    });
    let failure: unknown;
    try {
      await generateProviderImage(
        "google-antigravity",
        { model: "gemini-3.1-flash-image", prompt: "슬라임" },
        {
          apiKey: await resolveRequestApiKey("google-antigravity"),
          fetch: async () => new Response(body, { status: 400 }),
        },
      );
    } catch (error) {
      failure = error;
    }

    expect((failure as { status?: number }).status).toBe(502);
    expect((failure as Error).message).toContain("Request blocked: forbidden content under safety policy");
    expect((failure as Error).message).not.toContain("Google Antigravity 로그인");
  });

  test("Antigravity 상류 401은 제품 로그인 경로를 안내한다", async () => {
    seedOAuthForTests("google-antigravity", {
      access: "expired-access",
      refresh: "expired-refresh",
      expires: Date.now() + 60_000,
      projectId: "expired-project",
    });
    const { generateProviderImage } = await import("../scripts/lib/ohMyPiImageRuntime.ts");
    let failure: unknown;
    try {
      await generateProviderImage(
        "google-antigravity",
        { model: "gemini-3.1-flash-image", prompt: "슬라임" },
        {
          apiKey: await resolveRequestApiKey("google-antigravity"),
          fetch: async () => new Response(
            JSON.stringify({ error: { code: 401, message: "OAuth session expired", status: "PERMISSION_DENIED" } }),
            { status: 401 },
          ),
        },
      );
    } catch (error) {
      failure = error;
    }

    expect((failure as { status?: number }).status).toBe(401);
    expect((failure as Error).message).toBe(
      "이미지를 만들려면 AI 설정 → Google Antigravity 로그인에서 연결해 주세요.",
    );
  });

  test("Antigravity follow-up sends prior tool-call arguments as an object", async () => {
    // Break caught: openaiToContext forwarded OpenAI's JSON-string function
    // arguments verbatim, but Gemini requires functionCall.args to be an object.
    seedOAuthForTests("google-antigravity", {
      access: "complete-access",
      refresh: "complete-refresh",
      expires: Date.now() + 60_000,
      projectId: "complete-project",
    });
    let requestBody: Record<string, any> | undefined;

    try {
      await completeProvider(
        "google-antigravity",
        {
          model: "gemini-3.7-flash",
          messages: [
            { role: "user", content: "Read the current map." },
            {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "call_probe",
                type: "function",
                function: { name: "read_editor_probe", arguments: '{"probe":"current_map"}' },
              }],
            },
            {
              role: "tool",
              tool_call_id: "call_probe",
              name: "read_editor_probe",
              content: '{"width":20,"height":15}',
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "read_editor_probe",
              description: "Read the current editor map.",
              parameters: {
                type: "object",
                properties: { probe: { type: "string" } },
                required: ["probe"],
              },
            },
          }],
        },
        {
          apiKey: await resolveRequestApiKey("google-antigravity"),
          fetch: async (_input, init) => {
            requestBody = JSON.parse(String(init?.body ?? "{}"));
            return new Response("upstream test stop", { status: 400 });
          },
        },
      );
    } catch {
      // The mocked upstream intentionally stops after request serialization.
    }

    const contents = requestBody?.request?.contents as Array<{ parts?: Array<Record<string, any>> }> | undefined;
    const functionCall = contents
      ?.flatMap((content) => content.parts ?? [])
      .find((part) => part.functionCall)?.functionCall;
    expect(functionCall?.name).toBe("read_editor_probe");
    expect(functionCall?.args).toEqual({ probe: "current_map" });
  });
});
