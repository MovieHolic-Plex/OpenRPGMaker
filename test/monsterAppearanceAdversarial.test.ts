import { describe, expect, it } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { runTool } from "@/editor/tools";
import { goblinId, slimeId, monsterContext, monsterWriters } from "./monsterAiFixture";

const readArgs = { resourceId: goblinId };

describe.each(monsterWriters)("$name adversarial appearance boundary", writer => {
  it("rejects declared goblin identity when full selected metadata describes slime", () => {
    // Given full current slime metadata.
    const ctx = monsterContext();
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    const args = { resourceId: slimeId };
    evidence.observe("get_monster_resource", args, runTool(ctx, "get_monster_resource", args));
    // When desired visible identity conflicts with that resource.
    const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: slimeId }), appearanceTags: ["goblin"] });
    // Then mismatch is explicit, not a fallback or name comparison.
    expect(result?.issues?.[0]?.code).toBe("monster-appearance-mismatch");
  });

  it.each([undefined, [], [""], ["   "], [1], "goblin", ["goblin".repeat(20)], Array(33).fill("goblin")])(
    "rejects missing or malformed appearanceTags %j after full lookup", appearanceTags => {
      // Given an observed, full, current resource.
      const ctx = monsterContext();
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      evidence.observe("get_monster_resource", readArgs, runTool(ctx, "get_monster_resource", readArgs));
      // When the selection lacks a valid declared identity.
      const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags });
      // Then full lookup alone cannot replace the appearance declaration.
      expect(result?.issues?.[0]?.code).toBe("monster-appearance-tags-required");
    },
  );

  it("accepts intentional custom names without persisting appearanceTags", () => {
    // Given a full goblin lookup and an unrelated boss display name.
    const ctx = monsterContext();
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    evidence.observe("get_monster_resource", readArgs, runTool(ctx, "get_monster_resource", readArgs));
    const args = { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: [" GOBLIN "] };
    expect(evidence.beforeWrite(ctx.project, writer.name, args)).toBeNull();
    // When executing the writer through its public schema.
    const result = runTool(ctx, writer.name, args);
    // Then the custom name and exact art survive, while the envelope is not data.
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject(writer.name === "make_action_enemy" ? { enemyId: "enemy_ai_test" } : { name: "The Last Emperor" });
    expect(result.data).not.toHaveProperty("appearanceTags");
    expect(JSON.stringify(ctx.project.database)).not.toContain('"appearanceTags"');
  });

  it("invalidates evidence when effective description changes without changing the ID", () => {
    // Given successful full metadata evidence.
    const ctx = monsterContext();
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    evidence.observe("get_monster_resource", readArgs, runTool(ctx, "get_monster_resource", readArgs));
    Object.assign(ctx.project, { monsterMetadata: { [goblinId]: { tags: ["goblin"], description: "changed after read" } } });
    // When writing with a stale snapshot of the same exact resource.
    const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["goblin"] });
    // Then stale evidence cannot authorize it.
    expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
  });

  it("keeps unchanged art edits valid without rereading metadata", () => {
    // Given an existing record with explicitly chosen art.
    const ctx = monsterContext();
    expect(runTool(ctx, writer.name, writer.args({ monsterResourceId: goblinId })).ok).toBe(true);
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    // When writing the same graphic with no appearance declaration.
    const result = evidence.beforeWrite(ctx.project, writer.name, writer.args({ monsterResourceId: goblinId }));
    // Then this is not a new selection.
    expect(result).toBeNull();
  });

  it("does not allow malformed or partial full-read payloads to authorize", () => {
    // Given a nominally successful but incomplete payload.
    const ctx = monsterContext();
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    evidence.observe("get_monster_resource", readArgs, { ok: true, summary: "", data: { resource: { resourceId: goblinId, description: "" } } });
    // When attempting to use it as full current metadata.
    const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["goblin"] });
    // Then exact metadata equality fails closed.
    expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
  });
});

it("authorizes only returned full page IDs, not all requested IDs", () => {
  // Given an explicit two-ID full lookup with a one-record page.
  const ctx = monsterContext();
  const evidence = new ToolReadEvidence();
  evidence.begin(undefined);
  const args = { ids: [goblinId, slimeId], include: "full", limit: 1 };
  evidence.observe("list_monster_resources", args, runTool(ctx, "list_monster_resources", args));
  // When writing the unreturned second resource.
  const result = evidence.beforeWrite(ctx.project, "upsert_enemy", { enemy: { id: "new", name: "Boss", monsterResourceId: slimeId }, appearanceTags: ["slime"] });
  // Then requested IDs are not evidence of delivered data.
  expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
});
