import { describe, expect, it } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { runTool } from "@/editor/tools";
import { goblinId, monsterContext, monsterWriters } from "./monsterAiFixture";

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
