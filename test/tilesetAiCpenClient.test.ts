import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeCpenResponseText, requestCpenTilesetMapping } from "@/editor/panels/tilesetAiCpenClient";

const LOCAL_STORAGE_KEY = "rpg-zzu.llmApiKey";

describe("requestCpenTilesetMapping", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("Given an API key When requesting a tileset mapping Then it sends the default OpenRouter request", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );

    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_YUNWU_API_KEY", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubGlobal("window", testWindow());

    await requestCpenTilesetMapping({
      imageDataUrl: "",
      prompt: "타일셋을 분석해줘",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(typeof init?.body).toBe("string");
    expect(readHeader(init, "Authorization")).toBe("Bearer test-key");
    const body = parseBody(readStringBody(init));
    expect(body.model).toBe("minimax/minimax-m3");
    expect(body.messages?.[0]?.role).toBe("system");
    expect(body.messages?.[1]?.content).toBe("타일셋을 분석해줘");
    expect(body.routing?.max_input_per_1m).toBe(0.1);
    expect(body.max_tokens).toBe(8192);
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
    readonly content?: string;
    readonly role?: string;
  }[];
  readonly model?: string;
  readonly routing?: {
    readonly max_input_per_1m?: number;
  };
};

function testWindow(): TestWindow {
  return {
    clearTimeout,
    localStorage: {
      getItem: (key: string) => (key === LOCAL_STORAGE_KEY ? "test-key" : null),
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
    messages?: readonly { readonly content?: string }[];
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

function readMessages(messages: readonly unknown[]): readonly { readonly content?: string }[] {
  return messages.map((message) => {
    if (!message || typeof message !== "object" || !("content" in message) || typeof message.content !== "string") {
      return {};
    }
    return { content: message.content, ...("role" in message && typeof message.role === "string" ? { role: message.role } : {}) };
  });
}
