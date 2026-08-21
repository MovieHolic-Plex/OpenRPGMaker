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

  it("Given an API key When requesting a tileset mapping Then it sends the default LLM request", async () => {
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
    expect(url).toBe("https://example.invalid/v1/chat/completions");
    expect(typeof init?.body).toBe("string");
    expect(readHeader(init, "Authorization")).toBe("Bearer test-key");
    const body = parseBody(readStringBody(init));
    expect(body.model).toBe("google/gemini-3.1-flash-lite");
    expect(body.messages?.[0]?.role).toBe("system");
    expect(body.messages?.[1]?.content).toBe("타일셋을 분석해줘");
    expect(body.routing?.max_input_per_1m).toBe(0.1);
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

  it("Given a relative AI proxy When analyzing without a browser key Then the proxy authenticates server-side", async () => {
    // Given
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
    expect(url).toBe("/fake-ai/chat/completions");
    expect(readHeader(init, "Authorization")).toBeNull();
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
