import { afterEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { defaultAiConfig, type AiConfig, type ChatResult } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";
import { goblinId, monsterContext } from "./monsterAiFixture";

afterEach(() => vi.restoreAllMocks());

it.each(["failed", "cancelled"])("does not grant monster or native read credit after a %s writer delivery", async outcome => {
  const { project } = monsterContext();
  const live = structuredClone(project);
  const item = live.database.items.find(entry => entry.id === "item_potion");
  if (!item) throw new Error("Missing fixture item");
  item.price = 77; // Captured originals cannot satisfy the current-record fingerprint.
  const nativeWrite = { name: "upsert_item", args: { item: { id: item.id, price: 654 } } };
  const monsterWrite = { name: "upsert_enemy", args: {
    enemy: { id: "delivery_enemy", name: "Custom Boss", monsterResourceId: goblinId }, appearanceTags: ["goblin"],
  } };
  const reads = [
    { name: "get_database_records", args: { collection: "items", ids: [item.id], include: "full" } },
    { name: "get_monster_resource", args: { resourceId: goblinId } },
  ];
  const owners: ToolReadEvidence[] = [];
  const queue = ToolReadEvidence.prototype.queue;
  // Observe the real session's evidence owner without replacing registration or authorization.
  vi.spyOn(ToolReadEvidence.prototype, "queue").mockImplementation(function (this: ToolReadEvidence, read) {
    owners.push(this);
    queue.call(this, read);
  });
  const abort = new AbortController();
  let round = 0;
  const config: AiConfig = { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 2 };
  const session = new AssistantSession(project, {
    config,
    declareIntent: facts => fixedDeclarer({ mode: "modify", needsPlan: false,
      source: round === 0 ? "llm" : "continuation", tools: [nativeWrite.name, monsterWrite.name],
      readBeforeWrite: { project: false, collections: ["items"], references: true },
    })(facts),
    chat: async (_config, request): Promise<ChatResult> => {
      round++;
      if (round === 1) session.rebaseProject(live);
      else {
        for (const read of reads) {
          const message = request.messages.find(message => message.role === "tool" && message.name === read.name);
          if (typeof message?.content !== "string") throw new Error("Missing serialized read");
          expect(JSON.parse(message.content)).toMatchObject({ ok: true, data: expect.any(Object) });
        }
      }
      if (round === 2) {
        if (outcome === "failed") throw new Error("fixture rejected writer request");
        abort.abort(); // A provider resolving despite cancellation must not grant credit either.
      }
      const calls = round === 1 ? reads : [nativeWrite, monsterWrite];
      return { message: { role: "assistant", content: null, tool_calls: calls.map((call, index) => ({
        id: `delivery_${round}_${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" };
    },
  });
  const result = await session.sendUserMessage("Read current records before editing", undefined, abort.signal);
  expect(result.stoppedReason).toBe(outcome === "failed" ? "error" : "aborted");
  expect(round).toBe(2);
  const evidence = owners[0];
  if (!evidence) throw new Error("No session read registration");
  expect(new Set(owners).size).toBe(1);
  expect(evidence.beforeWrite(live, monsterWrite.name, monsterWrite.args)?.issues?.[0]?.code).toBe("monster-resource-read-required");
  expect(evidence.beforeWrite(live, nativeWrite.name, nativeWrite.args)?.issues?.[0]?.code).toBe("read-before-write-required");
  expect(session.getProposedProject().database.items.find(entry => entry.id === item.id)?.price).toBe(77);
  expect(session.getProposedProject().database.enemies.some(entry => entry.id === "delivery_enemy")).toBe(false);

  session.updateConfig({ ...config, maxToolCalls: 1 });
  const continued = await session.sendUserMessage("Continue the same edit");
  expect(continued.stoppedReason, continued.error).toBe("max-tool-calls");
  expect(round).toBe(3);
  expect(session.getProposedProject().database.items.find(entry => entry.id === item.id)?.price).toBe(654);
  expect(session.getProposedProject().database.enemies.find(entry => entry.id === "delivery_enemy")?.monsterResourceId).toBe(goblinId);
  expect(continued.proposedCalls.map(call => call.name)).toEqual([nativeWrite.name, monsterWrite.name]);
});
