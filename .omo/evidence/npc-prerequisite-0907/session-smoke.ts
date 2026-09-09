import assert from "node:assert/strict";
import { AssistantSession, type SessionEvent } from "../../../src/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "../../../src/ai/llmClient";
import { fixedDeclarer } from "../../../test/intentFixture";
import { prerequisiteFixture } from "../../../test/npcPrerequisiteFixture";

// Native session-tool surface; deterministic model/declaration boundary only, no network.
const fixture = prerequisiteFixture();
const before = structuredClone(fixture.project);
const brokenChest = structuredClone(fixture.chest);
brokenChest.pages![0].commands = [];
const calls = [
  { name: "verify_npc_reward", args: { requirementIndex: 0, prelude: fixture.prelude } },
  { name: "upsert_event", args: { mapId: fixture.cellar.id, event: brokenChest } },
];
const events: SessionEvent[] = [];
const session = new AssistantSession(fixture.project, {
  config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12, maxTokens: 32000 },
  declareIntent: fixedDeclarer({ mode: "modify", npcRewards: [fixture.requirement] }),
  chat: async (): Promise<ChatResult> => {
    const call = calls.shift();
    return call ? { message: { role: "assistant", content: null, tool_calls: [{ id: call.name, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } }] }, finishReason: "tool_calls" }
      : { message: { role: "assistant", content: "SMOKE_COMPLETE" }, finishReason: "stop" };
  },
});
const result = await session.sendUserMessage("Verify the chief reward after the cellar key", event => events.push(event));
const proof = events.find(event => event.type === "tool_call" && event.name === "verify_npc_reward");
assert.ok(proof?.type === "tool_call");
assert.equal(proof.result.ok, true);
assert.ok(!result.assistantText.includes("SMOKE_COMPLETE"));
assert.deepEqual(fixture.project, before);
console.log(JSON.stringify({ proof: proof.result.data, afterChestMutationCompleted: false, originalProjectUnchanged: true, stoppedReason: result.stoppedReason }, null, 2));
