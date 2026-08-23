import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasCpenTilesetApiKey,
  normalizeCpenResponseText,
  requestCpenTilesetMapping,
} from "@/editor/panels/tilesetAiCpenClient";

const LOCAL_STORAGE_KEY = "oprn:llmApiKey";

describe("requestCpenTilesetMapping", () => {
  beforeEach(() => {
    const windowStub = testWindow();
    vi.stubGlobal("window", windowStub);
    vi.stubGlobal("localStorage", windowStub.localStorage);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("Given OAuth When requesting a tileset mapping Then it goes to the companion with no client key", async () => {
    // 인증이 무조건 OAuth 이므로 저장된 게이트웨이 baseUrl·키는 승격 과정에서 버려진다.
    // 이 스펙이 막는 결함: 이 클라이언트는 llmClient 를 우회해 직접 fetch 하므로, OAuth 에서
    // apiKey·proxyAuth 가 모두 없어 "AI 설정이 아직 연결되지 않았습니다" 로 첫 줄에서 막혔다.
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );

    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_YUNWU_API_KEY", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubEnv("VITE_LLM_API_URL", "https://example.invalid/v1");
    vi.stubGlobal("window", testWindow());

    await requestCpenTilesetMapping({
      imageDataUrl: "",
      prompt: "타일셋을 분석해줘",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/v1/chat/completions");
    expect(typeof init?.body).toBe("string");
    // 동반 서비스가 자격 증명을 들고 있다 — 브라우저는 키를 보내지 않고 제공자만 지목한다.
    expect(readHeader(init, "Authorization")).toBeNull();
    expect(readHeader(init, "X-Rpgzzu-Provider")).toBe("openai-codex");
    const body = parseBody(readStringBody(init));
    // 저장된 게이트웨이 모델(google/gemini-3.1-flash-lite)은 Codex 카탈로그 밖 → 권장 기본으로 교정.
    expect(body.model).toBe("gpt-5.6-sol");
    expect(body.messages?.[0]?.role).toBe("system");
    expect(body.messages?.[1]?.content).toBe("타일셋을 분석해줘");
    // routing 은 cpenrouter 전용 필드 — 동반 서비스로는 보내지 않는다.
    expect(body.routing).toBeUndefined();
    expect(body.max_tokens).toBe(8192);
  });

  it("Given a tileset image When requesting a mapping Then it sends a multimodal image part", async () => {
    // Given
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_YUNWU_API_KEY", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubEnv("VITE_LLM_API_URL", "https://example.invalid/v1");
    vi.stubGlobal("window", testWindow());
    const imageDataUrl = "data:image/png;base64,dGlsZXNldA==";

    // When
    await requestCpenTilesetMapping({ imageDataUrl, prompt: "Analyze every tile" });

    // Then
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = parseBody(readStringBody(init));
    expect(body.messages?.[1]?.content).toEqual([
      { text: "Analyze every tile", type: "text" },
      { image_url: { url: imageDataUrl }, type: "image_url" },
    ]);
  });

  it("Given a stored gateway proxy config When analyzing Then it is promoted to the OAuth companion", async () => {
    // 저장된 apiKey/프록시 설정은 loadAiConfig 가 OAuth 로 승격한다 — 게이트웨이 경로로 가지 않는다.
    // ready 판정도 키가 아니라 OAuth 여부로 봐야 한다(옛 판정은 OAuth 에서 버튼을 영구히 잠갔다).
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );
    const windowStub = proxyWindow();
    vi.stubGlobal("window", windowStub);
    vi.stubGlobal("localStorage", windowStub.localStorage);
    vi.stubGlobal("fetch", fetchMock);

    // When
    const ready = hasCpenTilesetApiKey();
    await requestCpenTilesetMapping({ imageDataUrl: "", prompt: "Analyze" });

    // Then
    expect(ready).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/v1/chat/completions");
    expect(readHeader(init, "Authorization")).toBeNull();
    expect(readHeader(init, "X-Rpgzzu-Provider")).toBe("openai-codex");
  });

  it("Given the LLM rejects the request When requesting a tileset mapping Then it reports the failure body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, _init: RequestInit) => new Response("invalid_grant", { status: 400 })),
    );
    vi.stubGlobal("window", testWindow());

    const result = await requestCpenTilesetMapping({
      imageDataUrl: "",
      prompt: "타일셋을 분석해줘",
    });

    expect(result).toContain("HTTP 400");
    expect(result).toContain("invalid_grant");
  });
});

describe("normalizeCpenResponseText", () => {
  it("Given JSON inside a markdown fence When normalizing Then it returns the JSON object", () => {
    const json = JSON.stringify({
      summary: "물 타일",
      tiles: [{ tile: 120, label: "물", description: "수면", terrainTag: 1, defaultLayer: "lower", role: "body", repeatability: "repeat" }],
    });

    expect(normalizeCpenResponseText(`좋습니다.\n\`\`\`json\n${json}\n\`\`\``)).toBe(json);
  });

  it("Given a schema quote and reasoning text When normalizing Then it keeps the invalid response as-is", () => {
    const response = '"\n```json\npreviewMaps:\n[\nLet me double check the schema.';

    expect(normalizeCpenResponseText(response)).toBe(response);
  });
});

type TestWindow = {
  readonly clearTimeout: typeof clearTimeout;
  readonly localStorage: Pick<Storage, "getItem">;
  readonly setTimeout: typeof setTimeout;
};

type ParsedChatBody = {
  readonly max_tokens?: number;
  readonly messages?: readonly {
    readonly content?: string | readonly ParsedContentPart[];
    readonly role?: string;
  }[];
  readonly model?: string;
  readonly routing?: {
    readonly max_input_per_1m?: number;
  };
};

type ParsedContentPart =
  | { readonly text: string; readonly type: "text" }
  | { readonly image_url: { readonly url: string }; readonly type: "image_url" };

function testWindow(): TestWindow {
  return {
    clearTimeout,
    localStorage: {
      getItem: (key: string) => {
        if (key === LOCAL_STORAGE_KEY) return "test-key";
        if (key === "oprn:ai-config") {
          return JSON.stringify({
            baseUrl: "https://example.invalid/v1",
            apiKey: "test-key",
            model: "google/gemini-3.1-flash-lite",
            liteModel: "google/gemini-3.1-flash-lite",
            maxToolCalls: 8,
            maxTokens: 1024,
          });
        }
        return null;
      },
    },
    setTimeout,
  };
}

function readStringBody(init: RequestInit | undefined): string {
  const body = init?.body;
  if (typeof body !== "string") throw new TypeError("Expected request body to be a string.");
  return body;
}

function parseBody(bodyText: string): ParsedChatBody {
  const parsed: unknown = JSON.parse(bodyText);
  if (!parsed || typeof parsed !== "object") return {};
  const result: {
    max_tokens?: number;
    messages?: readonly { readonly content?: string | readonly ParsedContentPart[] }[];
    model?: string;
    routing?: { max_input_per_1m?: number };
  } = {};
  if ("model" in parsed && typeof parsed.model === "string") result.model = parsed.model;
  if ("max_tokens" in parsed && typeof parsed.max_tokens === "number") result.max_tokens = parsed.max_tokens;
  if ("messages" in parsed && Array.isArray(parsed.messages)) result.messages = readMessages(parsed.messages);
  if (!("routing" in parsed) || !parsed.routing || typeof parsed.routing !== "object") return result;
  const routing = parsed.routing;
  if ("max_input_per_1m" in routing && typeof routing.max_input_per_1m === "number") {
    result.routing = { max_input_per_1m: routing.max_input_per_1m };
  }
  return result;
}

function readHeader(init: RequestInit | undefined, headerName: string): string | null {
  const headers = init?.headers;
  if (!headers || Array.isArray(headers) || headers instanceof Headers) return null;
  const value = headers[headerName];
  return typeof value === "string" ? value : null;
}

function readMessages(messages: readonly unknown[]): readonly {
  readonly content?: string | readonly ParsedContentPart[];
  readonly role?: string;
}[] {
  return messages.map((message) => {
    if (!message || typeof message !== "object" || !("content" in message)) return {};
    const content = typeof message.content === "string" ? message.content : readContentParts(message.content);
    return content === undefined
      ? {}
      : { content, ...("role" in message && typeof message.role === "string" ? { role: message.role } : {}) };
  });
}

function proxyWindow(): TestWindow {
  return {
    clearTimeout,
    localStorage: {
      getItem: (key: string) => key === "oprn:ai-config"
        ? JSON.stringify({ authMode: "apiKey", baseUrl: "/fake-ai", model: "cpen/gpt-5-6-luna" })
        : null,
    },
    setTimeout,
  };
}

function readContentParts(value: unknown): readonly ParsedContentPart[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parts = value.flatMap((part): readonly ParsedContentPart[] => {
    if (!part || typeof part !== "object" || !("type" in part)) return [];
    if (part.type === "text" && "text" in part && typeof part.text === "string") {
      return [{ text: part.text, type: "text" }];
    }
    if (
      part.type === "image_url"
      && "image_url" in part
      && part.image_url
      && typeof part.image_url === "object"
      && "url" in part.image_url
      && typeof part.image_url.url === "string"
    ) {
      return [{ image_url: { url: part.image_url.url }, type: "image_url" }];
    }
    return [];
  });
  return parts.length === value.length ? parts : undefined;
}
