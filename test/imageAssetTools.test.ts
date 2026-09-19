import { describe, expect, it } from "vitest";
import { generateImageAsset } from "@/editor/imageAssetGeneration";
import { getTool, runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";

describe("generic image asset authoring", () => {
  it("exposes the four reusable asset kinds through the editor registry", () => {
    const tool = getTool("generate_image_asset");
    expect(tool?.mode).toBe("read");
    expect(tool?.domains).toEqual(["system"]);
    expect((tool?.parameters.properties?.kind as { enum?: string[] } | undefined)?.enum).toEqual([
      "picture", "title", "backdrop", "monster",
    ]);
  });

  it("returns a UI handoff in a headless tool call and rejects invalid requests", () => {
    const ctx = { project: createBlankProject() };
    const handoff = runTool(ctx, "generate_image_asset", { kind: "picture", prompt: "푸른 수정 검" });
    expect(handoff.ok).toBe(true);
    expect(handoff.data).toMatchObject({ status: "ui-required", kind: "picture", prompt: "푸른 수정 검" });

    expect(runTool(ctx, "generate_image_asset", { kind: "unknown", prompt: "몬스터" }).ok).toBe(false);
    expect(runTool(ctx, "generate_image_asset", { kind: "monster", prompt: "짧" }).ok).toBe(false);
  });

  it("generates a resource-shaped result without putting text in the art prompt", async () => {
    let modelPrompt = "";
    const result = await generateImageAsset(
      { kind: "monster", name: "얼음 늑대", tags: ["얼음", "늑대"], prompt: "눈 덮인 산에서 포효하는 얼음 늑대" },
      { generateImage: async request => { modelPrompt = request.prompt; return { dataUrl: "data:image/png;base64,AAAA", mimeType: "image/png", model: "test", provider: "test" }; } },
    );
    expect(result).toMatchObject({ ok: true, kind: "monster", name: "얼음 늑대", dataUrl: "data:image/png;base64,AAAA" });
    if (result.ok) {
      expect(result.resourceId).toMatch(/^generated_monster_/u);
      expect(result.prompt).toBe("눈 덮인 산에서 포효하는 얼음 늑대");
    }
    expect(modelPrompt).toContain("Do not add letters");
    expect(modelPrompt).toContain("uniform solid white background");
  });

  it("keeps generated monster tags discoverable for the appearance evidence gate", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_resource", {
      resource: {
        id: "generated_monster_wolf",
        name: "얼음 늑대",
        kind: "monster",
        dataUrl: "data:image/png;base64,AAAA",
        monsterMetadata: { name: "얼음 늑대", tags: ["얼음", "늑대"], description: "눈 덮인 산의 얼음 늑대" },
      },
    });
    expect(result.ok).toBe(true);
    expect(listMonsterResources(ctx.project).find(resource => resource.resourceId === "generated_monster_wolf")).toMatchObject({
      name: "얼음 늑대",
      tags: ["얼음", "늑대"],
    });
  });
});
