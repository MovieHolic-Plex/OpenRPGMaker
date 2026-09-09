import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { isCompactionSummaryMessage } from "@/ai/contextCompaction";
import { defaultAiConfig, type AiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

type Call = { name: string; args: Record<string, unknown> };
function calls(round: number, specs: Call[]): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: specs.map((spec, index) => ({
    id: `native_${round}_${index}`, type: "function", function: {
      name: spec.name, arguments: JSON.stringify({ ...spec.args, reason: "Preserve the existing record" }),
    },
  })) }, finishReason: "tool_calls" };
}

function envelope(request: ChatRequest): { snapshotId: string; entries: { entryId: string }[]; omitted: { count: number } } {
  const message = request.messages.at(-1);
  if (typeof message?.content !== "string") throw new Error("Missing original envelope");
  return JSON.parse(message.content).originalContext;
}

describe("native read delivery credit", () => {
  it("carries an intact pending live read across a genuine continuation, not into its own response", async () => {
    const project = createBlankProject();
    const item = project.database.items.find(entry => entry.id === "item_potion");
    if (!item) throw new Error("Missing fixture item");
    item.description = "R4_OMITTED_ORIGINAL:".padEnd(512_029, " exact authored values ");
    const live = structuredClone(project);
    const liveItem = live.database.items.find(entry => entry.id === item.id);
    if (!liveItem) throw new Error("Missing live fixture item");
    liveItem.description = "R4_COMPLETE_LIVE_RECORD";
    liveItem.price = 77;
    const write: Call = { name: "upsert_item", args: { item: { id: item.id, price: 654 } } };
    let round = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), authMode: "apiKey", model: "native-delivery-fixture", agentMode: "chat", maxToolCalls: 1 },
      declareIntent: facts => fixedDeclarer({ mode: "modify", tools: [write.name], source: round === 0 ? "llm" : "continuation",
        readBeforeWrite: { project: false, collections: ["items"], references: true } })(facts),
      chat: async (_config, request) => {
        round++;
        expect(request.tools?.length).toBeGreaterThan(0);
        expect(envelope(request).entries.some(entry => entry.entryId === "/database/items/item_potion")).toBe(false);
        if (round === 1) {
          // A real host rebase changes the current record after the immutable original was captured.
          session.rebaseProject(live);
          return calls(round, [{ name: "get_database_records", args: { collection: "items", ids: [item.id], include: "full" } }, write]);
        }
        const delivered = request.messages.find(message => message.role === "tool" && message.name === "get_database_records");
        expect(JSON.parse(String(delivered?.content)).data.records).toEqual([JSON.parse(JSON.stringify(liveItem))]);
        return calls(round, [write]);
      },
    });
    expect((await session.sendUserMessage("Read before editing")).stoppedReason).toBe("max-tool-calls");
    expect(session.getProposedProject().database.items.find(entry => entry.id === item.id)).toEqual(liveItem);
    expect((await session.sendUserMessage("Continue the same edit")).stoppedReason).toBe("max-tool-calls");
    expect(round).toBe(2);
    expect(session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === write.name).map(entry => entry.ok)).toEqual([false, true]);
    expect(session.getProposedProject().database.items.find(entry => entry.id === item.id)).toEqual({ ...liveItem, price: 654 });
    expect(liveItem.price).toBe(77);
  });

  it("refuses a native full read stripped before its first writer delivery, then permits complete original paging", async () => {
    const project = createBlankProject();
    const item = project.database.items.find(entry => entry.id === "item_potion");
    if (!item) throw new Error("Missing fixture item");
    item.description = "R4_NATIVE_ORIGINAL:".padEnd(512_029, " exact authored values ");
    const expected = structuredClone(item);
    const write: Call = { name: "upsert_item", args: { item: { id: item.id, price: 654 } } };
    const read: Call = { name: "get_database_records", args: { collection: "items", ids: [item.id], include: "full" } };
    let round = 0;
    let summaries = 0;
    let offset = 0;
    let received = "";
    let pageCount = 0;
    const pageLimit = 24_000;
    // The latest oversized write result need not fit: stop immediately after the mutation.
    const pageTotal = Math.ceil(JSON.stringify({ collection: "items", records: [item], total: 1, nextOffset: null }).length / pageLimit);
    const config: AiConfig = { ...defaultAiConfig(), authMode: "apiKey", model: "native-delivery-fixture", agentMode: "chat",
      maxToolCalls: 2, maxTokens: 4_000_000 };
    const session = new AssistantSession(project, {
      config,
      declareIntent: facts => fixedDeclarer({ mode: "modify", tools: [write.name], source: round === 0 ? "llm" : "continuation",
        readBeforeWrite: { project: false, collections: ["items"], references: true } })(facts),
      chat: async (_config, request) => {
        if (!request.tools?.length) {
          summaries++;
          return { message: { role: "assistant", content: "R4_COMPACTED_WITHOUT_RECORD" }, finishReason: "stop" };
        }
        round++;
        const original = envelope(request);
        expect(original.entries.some(entry => entry.entryId === "/database/items/item_potion")).toBe(false);
        expect(original.omitted.count).toBeGreaterThan(0);
        if (round === 1) {
          expect(JSON.stringify(request.messages)).not.toContain(expected.description);
          return calls(round, [read, ...Array.from({ length: 6 }, (): Call => ({ name: "get_project_summary", args: {} }))]);
        }
        if (round === 2) {
          expect(summaries).toBe(1);
          expect(request.messages.some(isCompactionSummaryMessage)).toBe(true);
          expect(JSON.stringify(request.messages)).not.toContain(expected.description);
          const stripped = request.messages.find(message => message.role === "tool" && message.name === read.name);
          expect(stripped).toBeDefined();
          expect(typeof stripped?.content).toBe("string");
          expect(JSON.parse(String(stripped?.content))).toEqual({ ok: true, summary: expect.any(String) });
          return calls(round, [write]);
        }
        if (round === 3) {
          const denied = session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === write.name);
          expect(denied.map(entry => entry.ok)).toEqual([false]);
          expect(denied[0]?.issueCodes).toContain("read-before-write-required");
          expect(session.getProposedProject().database.items.find(entry => entry.id === item.id)).toEqual(expected);
        }
        const previousPage = request.messages.filter(message => message.role === "tool" && message.name === "get_original_context").at(-1);
        if (previousPage) {
          const data: { offset: number; text: string; nextOffset: number | null } = JSON.parse(String(previousPage.content)).data;
          expect(data.offset).toBe(offset);
          received += data.text;
          pageCount++;
          if (data.nextOffset === null) {
            expect(JSON.parse(received).records).toEqual([JSON.parse(JSON.stringify(expected))]);
            return calls(round, [write]);
          }
          offset = data.nextOffset;
        }
        return calls(round, [{ name: "get_original_context", args: { snapshotId: original.snapshotId,
          action: "read", entryId: "/database/items/item_potion", offset, limit: pageLimit } },
        // Even the last page cannot authorize arguments composed in the same response.
        ...(pageCount === pageTotal - 1 ? [write] : [])]);
      },
    });
    const result = await session.sendUserMessage("Preserve the description and change only the price");
    const firstWrite = session.getAuditEntries().find(entry => entry.kind === "tool" && entry.name === write.name);
    expect(round).toBeGreaterThanOrEqual(2);
    expect(summaries).toBe(1);
    expect(firstWrite?.ok, "An executed read stripped before first writer delivery cannot authorize a write").toBe(false);
    expect(result.stoppedReason, result.error).toBe("max-tool-calls");
    // Continue the same goal under the existing per-turn cap; paging must retain its receipts.
    for (let remaining = pageTotal + 3 - round; remaining > 0; remaining = pageTotal + 3 - round) {
      session.updateConfig({ ...config, maxToolCalls: Math.min(16, remaining) });
      const continued = await session.sendUserMessage("Continue the same repair");
      expect(continued.stoppedReason, continued.error).toBe("max-tool-calls");
    }
    expect(pageCount).toBe(pageTotal);
    expect(round).toBe(pageTotal + 3);
    const writes = session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === write.name);
    expect(writes.map(entry => entry.ok), JSON.stringify(writes))
      .toEqual([false, false, true]);
    expect(session.getProposedProject().database.items.find(entry => entry.id === item.id)).toEqual({ ...expected, price: 654 });
    expect(project.database.items.find(entry => entry.id === item.id)).toEqual(expected);
  });
});
