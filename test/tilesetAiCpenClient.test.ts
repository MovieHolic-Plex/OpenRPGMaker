import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import { loadAiConfig, resetAiTransportHealth } from "@/ai/llmClient";
import { getAiConnectionStatus, refreshAiConnectionStatus, resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import {
  hasCpenTilesetApiKey,
  normalizeCpenResponseText,
  requestCpenTilesetMapping,
} from "@/editor/panels/tilesetAiCpenClient";
import { JobSubmitError } from "@/editor/aiJobs/jobSubmitError";

describe("requestCpenTilesetMapping", () => {
  it("does not offer a success-shaped browser mapping fallback", async () => {
    await expect(requestCpenTilesetMapping({ imageDataUrl: "", prompt: "타일셋을 분석해줘" }))
      .rejects.toBeInstanceOf(JobSubmitError);
    await expect(requestCpenTilesetMapping({ imageDataUrl: "", prompt: "타일셋을 분석해줘" }))
      .rejects.toThrow("타일셋 분석은 작업함으로 맡깁니다.");
  });
});

describe("hasCpenTilesetApiKey", () => {
  beforeEach(() => {
    vi.stubGlobal("window", testWindow());
    vi.stubGlobal("localStorage", testWindow().localStorage);
    resetAiConnectionStatusCache();
    resetAiTransportHealth();
  });

  afterEach(() => {
    resetAiConnectionStatusCache();
    resetAiTransportHealth();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("Given stored browser config When live auth changes Then tileset and assistant readiness stay identical", async () => {
    const authFetch = vi.fn(async () => new Response(JSON.stringify({ connected: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", authFetch);

    await refreshAiConnectionStatus();
    let config = loadAiConfig();
    let status = getAiConnectionStatus(config);
    expect(status.kind).toBe("disconnected");
    expect(hasCpenTilesetApiKey()).toBe(isAssistantEndpointReady(config, status));
    expect(hasCpenTilesetApiKey()).toBe(false);

    resetAiConnectionStatusCache();
    authFetch.mockResolvedValue(new Response(JSON.stringify({ connected: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    await refreshAiConnectionStatus();
    config = loadAiConfig();
    status = getAiConnectionStatus(config);
    expect(status.kind).toBe("ready");
    expect(hasCpenTilesetApiKey()).toBe(isAssistantEndpointReady(config, status));
    expect(hasCpenTilesetApiKey()).toBe(true);
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

function testWindow(): { readonly localStorage: Pick<Storage, "getItem"> } {
  return {
    localStorage: {
      getItem: (key: string) => key === "oprn:ai-config"
        ? JSON.stringify({ authMode: "apiKey", baseUrl: "/fake-ai", model: "cpen/gpt-5-6-luna" })
        : null,
    },
  };
}
