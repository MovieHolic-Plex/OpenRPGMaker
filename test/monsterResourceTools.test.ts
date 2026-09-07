import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";
import { goblinId, monsterContext, monsterWriters } from "./monsterAiFixture";

describe("monster resource lookup", () => {
  it("returns every entry when no pagination is requested", () => {
    // Given a project exceeding the generic lookup cap.
    const ctx = monsterContext();
    const ids = Array.from({ length: 61 }, (_, i) => `upload-monster-${i}`);
    for (const id of ids) ctx.project.assets.uploaded[id] = { id, name: id, kind: "monster", dataUrl: "", meta: {} };
    // When the model asks for the default index.
    const result = runTool(ctx, "list_monster_resources", {});
    // Then no registered entry is silently paginated.
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ complete: true, nextOffset: null, unknownIds: [], resources: expect.arrayContaining(ids.map(resourceId => expect.objectContaining({ resourceId, name: resourceId, tags: expect.any(Array), origin: "uploaded", reviewStatus: "unreviewed", sources: expect.any(Object) }))) });
  });

  it.each([{ limit: 0 }, { offset: -1 }, { offset: 0.5 }, { include: "summary" }, { ids: [1] }, { query: {} }, { surprise: true }])(
    "rejects malformed arguments %j", args => {
      // Given a registered lookup boundary.
      const ctx = monsterContext();
      // When malformed arguments cross it.
      const result = runTool(ctx, "list_monster_resources", args);
      // Then the failure is argument validation, not an unknown tool.
      expect(result.issues?.[0]?.code).toBe("invalid-args");
    },
  );

  it("reports exact unknown IDs when an explicit ID query contains missing resources", () => {
    // Given known and unknown exact identities.
    const ctx = monsterContext();
    // When querying them together.
    const result = runTool(ctx, "list_monster_resources", { ids: [goblinId, "missing"], include: "full" });
    // Then the missing identity is not replaced by a fuzzy match.
    expect(result.data).toMatchObject({ total: 1, returned: 1, unknownIds: ["missing"], complete: true, resources: [expect.objectContaining({ resourceId: goblinId })] });
  });

  it("reports explicit pagination without pretending the page is complete", () => {
    // Given more resources than the requested page.
    const ctx = monsterContext();
    // When requesting one entry.
    const result = runTool(ctx, "list_monster_resources", { limit: 1 });
    // Then the continuation describes the exact returned page.
    expect(result.data).toMatchObject({ returned: 1, nextOffset: 1, complete: false });
  });

  it("rejects a missing exact detail instead of substituting a similar identity", () => {
    // Given only real registered resources.
    const ctx = monsterContext();
    // When requesting an invented identity.
    const result = runTool(ctx, "get_monster_resource", { resourceId: `${goblinId}-missing` });
    // Then lookup fails explicitly.
    expect(result.issues?.[0]?.code).toBe("monster-resource-not-found");
  });

  it("exposes monster reads in trimmed database tools", () => {
    // Given the production trimmed exposure.
    const tools = toOpenAiTools(undefined, { domains: new Set(["core", "database"]) });
    // When inspecting the machine-consumed function names.
    const names = tools.map(tool => tool.function.name);
    // Then all appearance writers can discover full selected metadata.
    expect(names).toEqual(expect.arrayContaining(["list_monster_resources", "get_monster_resource", ...monsterWriters.map(writer => writer.name)]));
  });
});

describe.each(monsterWriters)("$name monster-kind safety", writer => {
  it.each(["picture", "music"] as const)("rejects uploaded %s even with a monster-looking ID", kind => {
    // Given an explicitly non-monster upload with a misleading identity.
    const ctx = monsterContext();
    ctx.project.assets.uploaded[goblinId].kind = kind;
    ctx.project.resourceProfiles.push({ kind: "monster", name: "Misleading profile", assetId: goblinId });
    const before = ctx.project;
    // When attempting to persist it as monster art.
    const result = runTool(ctx, writer.name, writer.args({ monsterResourceId: goblinId }));
    // Then no mutation escapes the transactional runner.
    expect(result.ok).toBe(false);
    expect(ctx.project).toBe(before);
  });
});
