import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { extractProjectWiki } from "@/ai/projectWikiClient";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";

const config: AiConfig = { authMode: "chatgpt", providerId: "openai-codex", baseUrl: "", model: "user-selected", apiKey: "", maxToolCalls: 20, maxTokens: 4096 };
const source = { id: "turn-1", kind: "user", text: "The moon is glass", at: 1 } as const;
function input() { return { project: createBlankProject(), userText: source.text, sources: [source] }; }
function response(value: unknown): ChatResult { return { message: { role: "assistant", content: JSON.stringify(value) }, finishReason: "stop" }; }
const patch = { upserts: [{ id: "w_moon", type: "concept", name: "Moon", summary: "The moon is glass", wiki: { kind: "knowledge", basis: "explicit", sourceIds: [source.id], topic: "moon" } }] };

describe("OAuth wiki extraction adapter", () => {
  it("uses the existing user config and prepares sources, maps, current docs, and read-only canon", async () => {
    const requestInput = input();
    requestInput.project.system.genre = "adventure-jrpg";
    requestInput.project.worldCanon = { name: "Glass world", body: "The moon is ancient" };
    const chat = vi.fn(async (_config: AiConfig, request: ChatRequest) => {
      const user = request.messages.find((message) => message.role === "user");
      expect(typeof user?.content).toBe("string");
      const payload: unknown = JSON.parse(String(user?.content));
      expect(payload).toMatchObject({ sources: [source], userText: source.text, currentDocuments: [], observedConfiguration: { genre: "adventure-jrpg" }, readOnlyCanon: requestInput.project.worldCanon });
      expect(request.response_format).toEqual({ type: "json_object" });
      return response(patch);
    });
    const result = await extractProjectWiki(requestInput, { chat, getConfig: () => config });
    expect(result.upserts[0]?.wiki.sourceIds).toEqual([source.id]);
    expect(chat.mock.calls[0]?.[0]).toBe(config);
  });
  it("allows an actual no-new-fact model response", async () => {
    expect(await extractProjectWiki(input(), { chat: async () => response({ upserts: [] }), getConfig: () => config })).toEqual({ upserts: [] });
  });
  it("rejects a model that tries to turn an application source into a new work-log card", async () => {
    const requestInput = { ...input(), sources: [{ ...source, kind: "application" as const }] };
    const progress = { upserts: [{ ...patch.upserts[0], wiki: { kind: "progress", basis: "observed", sourceIds: [source.id] } }] };
    await expect(extractProjectWiki(requestInput, { chat: async () => response(progress), getConfig: () => config }))
      .rejects.toThrow("Work history cannot be extracted into project knowledge");
  });
  it.each(["network failure", "OAuth expired"])("propagates %s instead of successful empty fallback", async (message) => {
    await expect(extractProjectWiki(input(), { chat: async () => { throw new Error(message); }, getConfig: () => config })).rejects.toThrow(message);
  });
  it("rejects malformed model JSON", async () => {
    await expect(extractProjectWiki(input(), { chat: async () => ({ message: { role: "assistant", content: "not json" }, finishReason: "stop" }), getConfig: () => config })).rejects.toThrow();
  });
  it("rejects a pre-aborted signal without calling chat", async () => {
    const controller = new AbortController();
    controller.abort();
    const chat = vi.fn(async () => response({ upserts: [] }));
    await expect(extractProjectWiki({ ...input(), signal: controller.signal }, { chat, getConfig: () => config })).rejects.toMatchObject({ name: "AbortError" });
    expect(chat).not.toHaveBeenCalled();
  });
  it("rejects cancellation even when the transport ignores the signal", async () => {
    const controller = new AbortController();
    let signalStarted: () => void = () => { throw new Error("start signal not subscribed"); };
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const pending = extractProjectWiki({ ...input(), signal: controller.signal }, { chat: () => { signalStarted(); return new Promise<ChatResult>(() => {}); }, getConfig: () => config });
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await started;
    controller.abort();
    await rejection;
  }, 1000);
  it("rejects invalid current map references before requesting extraction", async () => {
    const chat = vi.fn(async () => response({ upserts: [] }));
    await expect(extractProjectWiki({ ...input(), currentMapId: "missing" }, { chat, getConfig: () => config })).rejects.toThrow();
    expect(chat).not.toHaveBeenCalled();
  });
});
