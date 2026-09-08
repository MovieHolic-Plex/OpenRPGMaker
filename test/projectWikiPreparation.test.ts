import { describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { extractProjectWiki } from "@/ai/projectWikiClient";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { createProjectWikiCoordinator } from "@/editor/projectWikiCoordinator";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ProjectWikiPatch, ProjectWorld } from "@/project/world";
import wireResponse from "./fixtures/project-wiki/wire-response-100.json";
import { fixedDeclarer } from "./intentFixture";

const capturedContent = wireResponse.choices[0]!.message.content;
const fence = (json: string) => `Extraction result:\n\n\`\`\`json\n${json}\n\`\`\`\nEnd of result.`;

function preparation(content: string | ((request: ChatRequest) => string)) {
  const project = createEmptyToolProject("Extraction boundary");
  project.worldCanon = { name: "Canon", body: "Manually maintained" };
  project.world = { entities: [
    { id: "w_existing", type: "concept", name: "Moon", summary: "Glass moon", origin: "ai",
      wiki: { kind: "knowledge", basis: "explicit", topic: "moon",
        sources: [{ id: "earlier", kind: "user", text: "Glass moon", at: 1 }] } },
    { id: "w_manual", type: "place", name: "Archive", summary: "Keep intact", origin: "user", locked: true },
  ], relations: [{ a: "w_existing", b: "w_manual", kind: "custom" }] };
  const before = structuredClone(project);
  const order: string[] = [];
  const patches: ProjectWikiPatch[] = [];
  const chat = vi.fn(async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
    order.push("extraction");
    return { message: { role: "assistant", content: typeof content === "string" ? content : content(request) }, finishReason: "stop" };
  });
  const updateWorld = vi.fn((world: ProjectWorld) => { project.world = world; });
  const flush = vi.fn(async () => { order.push("saved"); return { kind: "saved" as const }; });
  const coordinator = createProjectWikiCoordinator({
    getProject: () => project, getIdentity: () => "isolated-fixture", history: async () => [],
    getConfig: defaultAiConfig, updateWorld, flush,
    extract: async (input, options) => {
      const patch = await extractProjectWiki(input, { ...options, chat });
      patches.push(patch);
      return patch;
    },
  });
  const prepare = () => coordinator.prepare({ text: "Proceed with the pending work", mapId: project.startMapId, composerMode: "do" });
  return { project, before, order, patches, chat, updateWorld, flush, coordinator, prepare };
}

function validRecord(request: ChatRequest) {
  const payload = JSON.parse(String(request.messages.find((message) => message.role === "user")?.content));
  return { id: "w_new", type: "concept", name: "Archive rule", summary: "Keep {braces}, [lists] and ``` literally.",
    wiki: { kind: "knowledge", basis: "explicit", topic: "archive", sourceIds: [payload.sources[0].id] } };
}

describe("project-record preparation response boundary", () => {
  it.each([capturedContent, '{"upserts":[]}', fence('{"upserts":[]}')])("completes a no-op without changing any project data %#", async (content) => {
    const h = preparation(content);
    const world = h.project.world;

    expect(await h.prepare()).toBe(world);

    expect(h.patches).toEqual([{ upserts: [] }]);
    expect(h.project).toEqual(h.before);
    expect(h.updateWorld).not.toHaveBeenCalled();
    // Existing wiki checkpoints still await their normal save path, even for no-ops.
    expect(h.order).toEqual(["extraction", "saved"]);
    expect(h.flush).toHaveBeenCalledTimes(1);
    expect(h.chat).toHaveBeenCalledTimes(1);
  });

  it("lets the captured stop response finish preparation before intent selection", async () => {
    expect(wireResponse.choices[0]!.finish_reason).toBe("stop");
    const h = preparation(capturedContent);
    const session = new AssistantSession(h.project, {
      config: { ...defaultAiConfig(), agentMode: "chat" },
      prepareProjectWiki: h.coordinator.prepare,
      declareIntent: async (...args: Parameters<ReturnType<typeof fixedDeclarer>>) => {
        h.order.push("intent");
        return fixedDeclarer({ mode: "question" })(...args);
      },
      chat: async (): Promise<ChatResult> => {
        h.order.push("main-loop");
        return { message: { role: "assistant", content: "" }, finishReason: "stop" };
      },
    });

    const result = await session.sendUserMessage("Proceed with the pending work");

    expect(result.stoppedReason).not.toBe("error");
    expect(result.proposedCalls).toEqual([]);
    expect(h.order).toEqual(["extraction", "saved", "intent", "main-loop"]);
    expect(h.project).toEqual(h.before);
    expect(session.getProposedProject()).toEqual(h.before);
    expect(h.updateWorld).not.toHaveBeenCalled();
  });

  it.each([false, true])("preserves complete valid records (fenced=%s)", async (fenced) => {
    const h = preparation((request) => {
      const json = JSON.stringify({ upserts: [validRecord(request)] });
      return fenced ? fence(json) : json;
    });

    await h.prepare();

    expect(h.patches[0]?.upserts).toHaveLength(1);
    const added = h.project.world?.entities[2];
    expect(added).toMatchObject({ id: "w_new", summary: "Keep {braces}, [lists] and ``` literally.", origin: "ai",
      wiki: { kind: "knowledge", basis: "explicit", topic: "archive" } });
    expect(added?.wiki?.sources).toEqual([expect.objectContaining({ kind: "user", text: "Proceed with the pending work" })]);
    expect(h.project).toEqual({ ...h.before, world: { ...h.before.world, entities: [...h.before.world!.entities, added] } });
    expect(h.updateWorld).toHaveBeenCalledTimes(1);
    expect(h.flush).toHaveBeenCalledTimes(1);
  });

  it.each([
    "not json", "", "{}", "null", "[]", '{"upserts":null}', '{"upserts":{}}',
    '{"upserts":[],"extra":1}', '{"upserts":[null]}',
    fence('{"upserts":['), fence('{}'), fence('{"upserts":[{}]}'),
    '{"upserts":[]}\n{"upserts":[]}',
    fence('{"upserts":[]}') + '\n' + fence('{"upserts":[]}'),
    '{"upserts":[]}\n' + fence('{"upserts":[]}'),
    fence('{"upserts":[]}') + '\n{"upserts":[]}',
    '[]\n' + fence('{"upserts":[]}'),
    '```text\nnot json\n```\n' + fence('{"upserts":[]}'),
    'Explanation: {"upserts":[]}',
  ])("rejects invalid or ambiguous output atomically %#", async (content) => {
    const h = preparation(content);

    await expect(h.prepare()).rejects.toThrow();

    expect(h.patches).toEqual([]);
    expect(h.project).toEqual(h.before);
    expect(h.updateWorld).not.toHaveBeenCalled();
    expect(h.flush).not.toHaveBeenCalled();
    expect(h.chat).toHaveBeenCalledTimes(1);
  });

  it.each(["invalid-schema", "unknown-source", "unknown-ref"])("does not skip an invalid record beside a valid one: %s", async (kind) => {
    const h = preparation((request) => {
      const valid = validRecord(request);
      const invalid = kind === "invalid-schema" ? { ...valid, id: "w_invalid", refs: null }
        : kind === "unknown-source" ? { ...valid, id: "w_invalid", wiki: { ...valid.wiki, sourceIds: ["fabricated"] } }
        : { ...valid, id: "w_invalid", refs: [{ kind: "map", id: "missing" }] };
      return fence(JSON.stringify({ upserts: [valid, invalid] }));
    });

    await expect(h.prepare()).rejects.toThrow();

    expect(h.project).toEqual(h.before);
    expect(h.updateWorld).not.toHaveBeenCalled();
    expect(h.flush).not.toHaveBeenCalled();
  });
});
