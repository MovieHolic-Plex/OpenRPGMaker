import { describe, expect, it } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { runTool } from "@/editor/tools";
import { goblinId, monsterContext, monsterWriters } from "./monsterAiFixture";
import { compactMessagesForRequest } from "@/ai/messageBudget";
import type { ChatMessage } from "@/ai/llmClient";
import { isolateTimers } from "./mergedTeardown";

describe("monsterAppearanceEvidence", () => {
  isolateTimers();
  describe.each(monsterWriters)("$name informed appearance", writer => {
    it("requires a full selected resource read when the generic read contract is absent", () => {
      // Given a request without generic read requirements.
      const ctx = monsterContext();
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      // When selecting new art without observing metadata.
      const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["goblin"] });
      // Then a valid registered ID alone cannot authorize the write.
      expect(result?.ok).toBe(false);
      expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
    });

    it.each(["index", "failed"])("rejects %s lookup as full appearance evidence", readKind => {
      // Given a successful index or failed detail.
      const ctx = monsterContext();
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      const args = readKind === "index" ? {} : { resourceId: "missing" };
      const tool = readKind === "index" ? "list_monster_resources" : "get_monster_resource";
      evidence.observe(tool, args, runTool(ctx, tool, args));
      // When selecting new art.
      const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["goblin"] });
      // Then neither lookup authorizes it.
      expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
    });

    it("preserves intentional transparency without requiring an appearance read", () => {
      // Given an intentional invisible monster.
      const ctx = monsterContext();
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      // When authoring transparency rather than selecting art.
      const result = evidence.beforeWrite(ctx.project, writer.name, writer.args({ transparent: true }));
      // Then no appearance evidence is required.
      expect(result).toBeNull();
    });
  });
});

describe("monsterAppearanceIdentity", () => {
  isolateTimers();
  const genericTags = ["monster", "enemy", "괴물", "적", "green", "초록색"];
  describe.each(monsterWriters)("$name meaningful appearance identity", writer => {
    it.each([...genericTags.map(tag => ({ appearanceTags: [tag] })), { appearanceTags: genericTags }])("rejects generic-only tags $appearanceTags even when metadata matches", ({ appearanceTags }) => {
      // Given matching, current metadata with only broad class/color evidence requested.
      const ctx = monsterContext();
      ctx.project.monsterMetadata = { [goblinId]: { tags: ["goblin", ...genericTags] } };
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      const read = { resourceId: goblinId };
      evidence.observe("get_monster_resource", read, runTool(ctx, "get_monster_resource", read));
      // When trying to authorize art using shared nonidentity tags.
      const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags });
      // Then broad labels cannot stand in for creature identity.
      expect(result?.issues?.[0]?.code).toBe("monster-appearance-identity-required");
    });

    it("accepts specific user-authored identity tags without a closed species vocabulary", () => {
      // Given a project-authored identity, not a built-in creature name.
      const ctx = monsterContext();
      ctx.project.monsterMetadata = { [goblinId]: { tags: ["verdant-clockwork-exile", "green"] } };
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      const read = { resourceId: goblinId };
      evidence.observe("get_monster_resource", read, runTool(ctx, "get_monster_resource", read));
      // When matching that specific identity plus an optional generic color.
      const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["verdant-clockwork-exile", "green"] });
      // Then the custom display name and open identity vocabulary remain legal.
      expect(result).toBeNull();
    });
  });
});

describe("monsterAppearanceTransport", () => {
  isolateTimers();
  function fixture() {
    const ctx = monsterContext();
    const args = { resourceId: goblinId };
    const result = runTool(ctx, "get_monster_resource", args);
    const read = { name: "get_monster_resource", args, result, toolCallId: "current_read" };
    const messages: ChatMessage[] = [
      { role: "system", content: "test" },
      { role: "user", content: "read then write" },
      { role: "assistant", content: null, tool_calls: [{ id: read.toolCallId, type: "function", function: { name: read.name, arguments: JSON.stringify(args) } }] },
      { role: "tool", name: read.name, tool_call_id: read.toolCallId, content: JSON.stringify(result) },
    ];
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    const write = { enemy: { id: "new_enemy", name: "Custom Boss", monsterResourceId: goblinId }, appearanceTags: ["goblin"] };
    return { ctx, read, messages, evidence, write };
  }
  it("does not authorize a successful full lookup whose response was lost to the request budget", () => {
    // Given a successful executed read that the actual transport budget drops.
    const { ctx, read, messages, evidence, write } = fixture();
    evidence.queue(read);
    const recent: ChatMessage[] = Array.from({ length: 6 }, () => ({ role: "user", content: "preserved instruction" }));
    const transmitted = compactMessagesForRequest([...messages, ...recent], 1);
    expect(transmitted.some(message => message.tool_call_id === read.toolCallId)).toBe(false);
    // When consuming the request copy, not raw execution results.
    evidence.observeDelivered(transmitted);
    // Then the unobserved full result is not authorization.
    expect(evidence.beforeWrite(ctx.project, "upsert_enemy", write)?.issues?.[0]?.code).toBe("monster-resource-read-required");
  });
  it("authorizes full metadata only after the actual model request contains it", () => {
    // Given a successful current-request full lookup and a sufficient transport budget.
    const { ctx, read, messages, evidence, write } = fixture();
    evidence.queue(read);
    const transmitted = compactMessagesForRequest(messages);
    // When consuming its actual serialized payload.
    evidence.observeDelivered(transmitted);
    // Then exact, current, delivered metadata authorizes selection.
    expect(evidence.beforeWrite(ctx.project, "upsert_enemy", write)).toBeNull();
  });
  it("cannot reuse historical full responses after a new user request begins", () => {
    // Given historical full responses still present in the conversation.
    const { ctx, messages, evidence, write } = fixture();
    // When the new request sees old tool messages without a current-request lookup.
    evidence.observeDelivered(messages);
    // Then a prior user's lookup cannot authorize a new selection.
    expect(evidence.beforeWrite(ctx.project, "upsert_enemy", write)?.issues?.[0]?.code).toBe("monster-resource-read-required");
  });
});
