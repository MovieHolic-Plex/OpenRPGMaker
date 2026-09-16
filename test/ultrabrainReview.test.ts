import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { defaultAiConfig, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { configForUltrabrain } from "@/ai/ultrabrainConfig";
import { parseHarmonyReview, reviewMapHarmony, unusableReviewReason } from "@/ai/ultrabrainReview";

const mocks = vi.hoisted(() => ({ chat: vi.fn(), render: vi.fn() }));
vi.mock("@/ai/llmClient", async importOriginal => ({ ...await importOriginal<typeof import("@/ai/llmClient")>(), chatCompletion: mocks.chat }));
vi.mock("@/ai/ultrabrainImage", () => ({ renderHarmonyMapImages: mocks.render }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.render.mockResolvedValue([{ dataUrl: "data:image/png;base64,AA==", label: "whole" }]);
  mocks.chat.mockResolvedValue({ finishReason: "stop", message: { content: JSON.stringify({ harmonious: true, summary: "전체 배치가 어울립니다.", findings: [] }) }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] });
});
afterEach(() => vi.unstubAllGlobals());

describe("Ultrabrain whole-map review", () => {
  it("keeps model and effort independent and round-trips explicit choices without substitution", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    const config = defaultAiConfig();
    expect(configForUltrabrain({ ...config, model: "other", reasoningEffort: "low" })).toMatchObject({ model: "gemini-3.8-flash", reasoningEffort: "high" });
    saveAiConfig({ ...config, model: "unknown-explicit", ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-5.5", ultrabrainReasoningEffort: "medium" });
    expect(loadAiConfig()).toMatchObject({ model: "unknown-explicit", ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-5.5", ultrabrainReasoningEffort: "medium" });
  });

  it("skips unchanged maps but reviews the whole map after even a one-tile edit", async () => {
    const before = createBlankProject();
    await reviewMapHarmony(before, before, "나무 수정", defaultAiConfig());
    expect(mocks.chat).not.toHaveBeenCalled();
    const after = structuredClone(before);
    const map = Object.values(after.maps)[0]!;
    map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
    await reviewMapHarmony(before, after, "나무 수정", defaultAiConfig());
    expect(mocks.render).toHaveBeenCalledWith(after, map);
    expect(mocks.chat).toHaveBeenCalledTimes(2);
    expect(mocks.chat.mock.calls[0]![0].maxTokens).toBe(4096);
    expect(mocks.chat.mock.calls[0]![1].messages[0].content).toContain("You are Vision");
    expect(mocks.chat.mock.calls[0]![1].messages[1].content[1])
      .toEqual(mocks.chat.mock.calls[1]![1].messages[1].content[1]);
    expect(mocks.chat.mock.calls[1]![1].messages[2].content).toContain("Vision 관찰 자료");
    const [config, request] = mocks.chat.mock.calls[1]!;
    expect(config).toMatchObject({ model: "gemini-3.8-flash", reasoningEffort: "high" });
    expect(request.messages[1].content.filter((p: { type: string }) => p.type === "image_url")).toHaveLength(1);
    expect(JSON.stringify(before)).not.toBe(JSON.stringify(after));
  });

  it("refuses missing image delivery, truncated output, inconsistent verdicts, and cancellation", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    Object.values(after.maps)[0]!.lowerTiles[0] = 123;
    mocks.chat.mockResolvedValue({ finishReason: "stop", message: { content: "{}" } });
    await expect(reviewMapHarmony(before, after, "검수", defaultAiConfig())).rejects.toThrow("imageDelivery=");
    mocks.chat.mockResolvedValue({ finishReason: "length", message: { content: "{}" }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] });
    await expect(reviewMapHarmony(before, after, "검수", defaultAiConfig())).rejects.toThrow("finish=length");
    expect(() => parseHarmonyReview('{"harmonious":true,"summary":"ok","findings":["bad"]}', "m")).toThrow();
    await expect(reviewMapHarmony(before, after, "검수", defaultAiConfig(), { signal: AbortSignal.abort() })).rejects.toThrow();
  });

  it("names the exact unusable condition instead of blaming the image path", () => {
    const ok = { message: { role: "assistant" as const, content: "{}" }, finishReason: "stop", imageDelivery: [{ messageIndex: 1, partIndex: 1 }] };
    expect(unusableReviewReason(ok)).toBeNull();
    expect(unusableReviewReason({ ...ok, finishReason: "length" })).toBe("finish=length");
    expect(unusableReviewReason({ ...ok, message: { role: "assistant" as const, content: "" } })).toBe("content=비어 있음");
    expect(unusableReviewReason({ ...ok, message: { role: "assistant" as const, content: [{ type: "text" as const, text: "x" }] } })).toBe("contentType=object");
    expect(unusableReviewReason({ ...ok, imageDelivery: [] })).toBe("imageDelivery=[]");
    expect(unusableReviewReason({ ...ok, message: { role: "assistant" as const, content: "{}", tool_calls: [{ id: "call_1", type: "function" as const, function: { name: "x", arguments: "{}" } }] } })).toBe("toolCalls=1");
  });

  it("retries a response that came back without final output and still accepts the verdict", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    Object.values(after.maps)[0]!.lowerTiles[0] = 123;
    mocks.chat
      .mockResolvedValueOnce({ finishReason: "stop", message: { content: "" }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] })
      .mockResolvedValue({ finishReason: "stop", message: { content: JSON.stringify({ harmonious: true, summary: "어울립니다.", findings: [] }) }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] });
    const reviews = await reviewMapHarmony(before, after, "검수", defaultAiConfig());
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ harmonious: true });
    expect(mocks.chat).toHaveBeenCalledTimes(3);
  });

  it("does not retry after cancellation", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    Object.values(after.maps)[0]!.lowerTiles[0] = 123;
    const controller = new AbortController();
    mocks.chat.mockImplementation(async () => {
      controller.abort();
      return { finishReason: "stop", message: { content: "" }, imageDelivery: [{ messageIndex: 1, partIndex: 1 }] };
    });
    await expect(reviewMapHarmony(before, after, "검수", defaultAiConfig(), { signal: controller.signal })).rejects.toThrow();
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending image load without calling the reviewer", async () => {
    const before = createBlankProject(), after = structuredClone(before);
    Object.values(after.maps)[0]!.lowerTiles[0] = 123;
    mocks.render.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const pending = reviewMapHarmony(before, after, "검수", defaultAiConfig(), { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});
