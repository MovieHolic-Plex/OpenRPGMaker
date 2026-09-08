import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { runTool } from "@/editor/tools";

function original(request: ChatRequest) {
  for (const message of request.messages) {
    if (message.role !== "user" || typeof message.content !== "string") continue;
    try {
      const parsed = JSON.parse(message.content);
      if (parsed.originalContext) return parsed.originalContext;
    } catch { /* Ordinary conversation text is not the structured envelope. */ }
  }
  return undefined;
}

describe("grounded first working request", () => {
  it("delivers complete target originals and grants only their real read evidence before the first write", async () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events = [{ id: "original_event", x: 2, y: 3, trigger: { kind: "action" }, commands: [], pages: [
      { id: "original_page", name: "Original", trigger: { kind: "action" }, conditions: [],
        graphic: {}, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [
        { kind: "text", body: "Existing dialogue ".repeat(700) },
        { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 },
      ] },
    ] }];
    const requests: ChatRequest[] = [];
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), model: "gemini-3.7-flash", agentMode: "chat", apiKey: "PRIVATE_CONFIG_SENTINEL" },
      contextOptions: { currentMapId: map.id, budgetChars: 1 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: map.id, tools: ["upsert_item"],
        readBeforeWrite: { project: true, collections: ["items"], references: true } }),
      chat: async (_config, request): Promise<ChatResult> => {
        requests.push(request);
        if (requests.length === 1) return { message: { role: "assistant", content: null, tool_calls: [{
          id: "grounded_write", type: "function", function: { name: "upsert_item",
            arguments: JSON.stringify({ item: { id: "item_potion", price: 321 }, reason: "Update the existing record" }) },
        }] }, finishReason: "tool_calls" };
        return { message: { role: "assistant", content: "확인했습니다." }, finishReason: "stop" };
      },
    });
    await session.sendUserMessage("선택한 기존 데이터를 수정해줘");
    const context = original(requests[0]!);
    expect(context).toBeDefined();
    expect(context.target.mapId).toBe(map.id);
    const values = context.entries.map((entry: { value: unknown }) => entry.value);
    expect(values).toContainEqual(expect.objectContaining({ event: map.events[0] }));
    expect(values).toContainEqual(expect.objectContaining({ records: [project.database.items.find(item => item.id === "item_potion")] }));
    expect(JSON.stringify(context)).not.toContain("PRIVATE_CONFIG_SENTINEL");
    const writes = session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === "upsert_item");
    expect(writes.map(entry => entry.ok), JSON.stringify(writes)).toEqual([true]);
    expect(session.getProposedProject().database.items.find(item => item.id === "item_potion")?.price).toBe(321);
    expect(project.database.items.find(item => item.id === "item_potion")?.price).not.toBe(321);
  });

  it("makes a missing explicit target visible rather than grounding on the start map", async () => {
    let request: ChatRequest | undefined;
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat" },
      declareIntent: fixedDeclarer({ mode: "question", targetMapId: "missing_target" }),
      chat: async (_config, req) => { request = req; return { message: { role: "assistant", content: "확인" }, finishReason: "stop" }; },
    });
    await session.sendUserMessage("대상 확인", () => {}, undefined, { composerMode: "ask" });
    expect(original(request!)?.missing).toContainEqual({ kind: "map", id: "missing_target" });
  });

});

describe("session original snapshot lifecycle", () => {
  it("pages an oversized original through the actual session tool and waits for delivered full evidence", async () => {
    const project = createBlankProject();
    const item = project.database.items.find(item => item.id === "item_potion")!;
    item.description = "Original description with exact authored values. ".repeat(6000);
    const expected = structuredClone(item);
    const originalData = runTool({ project }, "get_database_records", { collection: "items", ids: [item.id], include: "full" }).data;
    // Stop at the first verified mutation. A latest write result containing this entire
    // oversized record cannot itself fit the narrow model; that is an explicit window error,
    // not permission for this input-pipeline component to discard arbitrary tool output.
    const maxToolCalls = Math.ceil(JSON.stringify(originalData).length / 24000) + 2;
    const raw = "기존 설명은 보존하고 가격만 321로 수정";
    let offset = 0;
    let received = "";
    let totalChars = Infinity;
    let round = 0;
    const calls = (specs: { name: string; args: object }[]): ChatResult => ({ message: { role: "assistant", content: null,
      tool_calls: specs.map((spec, index) => ({ id: `call_${round}_${index}`, type: "function", function: {
        name: spec.name, arguments: JSON.stringify({ ...spec.args, reason: "Read before changing the original record" }),
      } })) }, finishReason: "tool_calls" });
    const write = { name: "upsert_item", args: { item: { id: item.id, price: 321 } } };
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), authMode: "apiKey", model: "unknown-window-fixture", agentMode: "chat", maxToolCalls },
      declareIntent: fixedDeclarer({ mode: "modify", tools: ["upsert_item"], readBeforeWrite: { project: false, collections: ["items"], references: true },
        requestRequirements: { entries: [{ source: [{ start: 0, end: raw.length, quote: raw }], criteria: [
          { kind: "entityPreserve", subject: { kind: "database", collection: "items", id: item.id }, path: ["description"] },
          { kind: "valueEquals", subject: { kind: "database", collection: "items", id: item.id }, path: ["price"], value: 321 },
        ], bindings: [
          { source: { start: raw.indexOf("보존"), end: raw.indexOf("보존") + 2, quote: "보존" }, role: "preserve", criterionIndex: 0, fieldPath: [] },
          { source: { start: raw.indexOf("321"), end: raw.indexOf("321") + 3, quote: "321" }, role: "value", criterionIndex: 1, fieldPath: ["value"] },
        ] }] },
      }),
      chat: async (_config, request) => {
        round++;
        const context = original(request);
        expect(context.entries.some((entry: { entryId: string }) => entry.entryId === "/database/items/item_potion")).toBe(false);
        expect(context.omitted.count).toBeGreaterThan(0);
        expect(request.tools?.some(tool => tool.function.name === "get_original_context")).toBe(true);
        if (round === 1) return calls([write]);
        if (request.messages.some(message => message.role === "tool" && message.name === "upsert_item" && JSON.parse(message.content as string).ok)) {
          return { message: { role: "assistant", content: "확인" }, finishReason: "stop" };
        }
        const previousPage = request.messages.filter(message => message.role === "tool" && message.name === "get_original_context").at(-1);
        if (previousPage) {
          const data = JSON.parse(previousPage.content as string).data;
          expect(data.offset).toBe(offset);
          received += data.text;
          totalChars = data.totalChars;
          if (data.nextOffset === null) {
            expect(JSON.parse(received).records).toEqual([JSON.parse(JSON.stringify(expected))]);
            return calls([write]);
          }
          offset = data.nextOffset;
        }
        return calls([{ name: "get_original_context", args: { snapshotId: context.snapshotId, action: "read", entryId: "/database/items/item_potion", offset, limit: 24000 } },
          ...(offset + 24000 >= totalChars ? [write] : [])]);
      },
    });
    const result = await session.sendUserMessage(raw);
    expect(result.stoppedReason, result.error).toBe("max-tool-calls");
    expect(session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === "upsert_item").map(entry => entry.ok)).toEqual([false, false, true]);
    expect(session.getProposedProject().database.items.find(item => item.id === expected.id)).toEqual({ ...expected, price: 321 });
    expect(project.database.items.find(item => item.id === expected.id)).toEqual(expected);
  }, 30000);

  it("retains original identity over continuation, recaptures a new request and keeps ask mode read-only", async () => {
    const project = createBlankProject();
    const seen: ChatRequest[] = [];
    let declarations = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat" },
      declareIntent: facts => fixedDeclarer({ mode: "modify", tools: ["upsert_item"], source: ++declarations === 2 ? "continuation" : "llm" })(facts),
      chat: async (_config, request) => { seen.push(request); return { message: { role: "assistant", content: "확인" }, finishReason: "stop" }; },
    });
    await session.sendUserMessage("기존 데이터 확인", () => {}, undefined, { composerMode: "ask" });
    const first = original(seen.at(-1)!);
    await session.sendUserMessage("계속", () => {}, undefined, { composerMode: "ask" });
    expect(original(seen.at(-1)!).snapshotId).toBe(first.snapshotId);
    await session.sendUserMessage("새 요청 데이터 확인", () => {}, undefined, { composerMode: "ask" });
    expect(original(seen.at(-1)!).snapshotId).not.toBe(first.snapshotId);
    expect(session.getProposedProject()).toEqual(project);
    for (const request of seen) expect(request.tools?.some(tool => tool.function.name === "get_original_context")).toBe(true);
  });

  it("stops before calling a provider when the actual native model window cannot fit the full catalog", async () => {
    let calls = 0;
    const project = createBlankProject();
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), model: "tab_flash_lite_preview", agentMode: "chat" },
      chat: async () => { calls++; return { message: { role: "assistant", content: "unexpected" }, finishReason: "stop" }; },
    });
    const result = await session.sendUserMessage("현재 데이터 확인");
    expect(result.stoppedReason).toBe("error");
    expect(result.error).toContain("original-context-window-exceeded");
    expect(calls).toBe(0);
    expect(session.getProposedProject()).toEqual(project);
  });
});
