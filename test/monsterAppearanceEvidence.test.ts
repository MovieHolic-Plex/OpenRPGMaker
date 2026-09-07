import { describe, expect, it } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { runTool } from "@/editor/tools";
import { goblinId, monsterContext, monsterWriters } from "./monsterAiFixture";

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
