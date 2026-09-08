import { describe, expect, it } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import type { ChatMessage } from "@/ai/llmClient";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const contract = { project: false, collections: ["items"], references: true };
const writeArgs = { item: { id: "item_potion", price: 654 } };
function fixture() {
  const project = createBlankProject();
  const evidence = new ToolReadEvidence();
  evidence.begin(contract);
  const args = { collection: "items", ids: ["item_potion"], include: "full" };
  const result = runTool({ project }, "get_database_records", args);
  expect(result.ok).toBe(true);
  evidence.queue({ toolCallId: "read_receipt", name: "get_database_records", args, result });
  const message: ChatMessage = { role: "tool", tool_call_id: "read_receipt", name: "get_database_records", content: JSON.stringify(result) };
  return { project, evidence, args, result, message };
}

describe("exact native receipts", () => {
  it.each([
    ["stripped data", (message: ChatMessage): ChatMessage => {
      const result: { ok: boolean; summary: string } = JSON.parse(String(message.content));
      return { ...message, content: JSON.stringify({ ok: result.ok, summary: result.summary }) };
    }],
    ["failed result", (message: ChatMessage): ChatMessage => ({ ...message, content: String(message.content).replace('"ok":true', '"ok":false') })],
    ["rewritten record", (message: ChatMessage): ChatMessage => ({ ...message, content: String(message.content).replace('"price":50', '"price":51') })],
    ["truncated JSON", (message: ChatMessage): ChatMessage => ({ ...message, content: String(message.content).slice(0, -1) })],
    ["wrong call identity", (message: ChatMessage): ChatMessage => ({ ...message, tool_call_id: "another_read" })],
    ["wrong tool", (message: ChatMessage): ChatMessage => ({ ...message, name: "get_event" })],
    ["summary-only context", (message: ChatMessage): ChatMessage => ({ ...message, role: "user" })],
  ] as const)("does not credit %s but permits later complete delivery", (_label, rewrite) => {
    const { project, evidence, message } = fixture();
    expect(evidence.beforeWrite(project, "upsert_item", writeArgs)).not.toBeNull();
    const changed = rewrite(message);
    expect(changed).not.toEqual(message);
    evidence.observeDelivered([changed]);
    expect(evidence.beforeWrite(project, "upsert_item", writeArgs)?.issues?.map(issue => issue.code)).toContain("read-before-write-required");
    evidence.observeDelivered([message]);
    expect(evidence.beforeWrite(project, "upsert_item", writeArgs)).toBeNull();
  });

  it("keeps actually delivered credit after removal from history, until the current record changes", () => {
    const { project, evidence, message } = fixture();
    evidence.observeDelivered([message]);
    evidence.observeDelivered([]);
    evidence.observeDelivered([{ ...message, content: JSON.stringify({ ok: true }) }]);
    expect(evidence.beforeWrite(project, "upsert_item", writeArgs)).toBeNull();
    const item = project.database.items.find(entry => entry.id === "item_potion");
    if (!item) throw new Error("Missing fixture item");
    item.price = 88;
    evidence.observeDelivered([message]);
    expect(evidence.beforeWrite(project, "upsert_item", writeArgs)).not.toBeNull();
  });

  it("does not let later mutations rewrite a pending receipt", () => {
    const { project, evidence, message, result } = fixture();
    const item = project.database.items.find(entry => entry.id === "item_potion");
    if (!item) throw new Error("Missing fixture item");
    item.price = 88;
    evidence.observeDelivered([{ ...message, content: JSON.stringify(result) }]);
    evidence.observeDelivered([message]);
    expect(evidence.beforeWrite(project, "upsert_item", writeArgs)).not.toBeNull();
  });

  it("clears pending and delivered receipts for a new goal and cannot import another session's history", () => {
    const { project, evidence, message } = fixture();
    evidence.begin(contract);
    evidence.observeDelivered([message]);
    expect(evidence.beforeWrite(project, "upsert_item", writeArgs)).not.toBeNull();
    const delivered = fixture();
    delivered.evidence.observeDelivered([delivered.message]);
    expect(delivered.evidence.beforeWrite(delivered.project, "upsert_item", writeArgs)).toBeNull();
    delivered.evidence.begin(contract);
    delivered.evidence.observeDelivered([delivered.message]);
    expect(delivered.evidence.beforeWrite(delivered.project, "upsert_item", writeArgs)).not.toBeNull();
    const nextSession = new ToolReadEvidence();
    nextSession.begin(contract);
    nextSession.observeDelivered([message]);
    expect(nextSession.beforeWrite(project, "upsert_item", writeArgs)).not.toBeNull();
  });
});
