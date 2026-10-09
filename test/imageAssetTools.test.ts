import { describe, expect, it } from "vitest";
import { generateImageAsset } from "@/editor/imageAssetGeneration";
import { getTool, runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";

describe("generic image asset authoring", () => {
  it("exposes the three reusable asset kinds through the editor registry — no monster art (2026-10-02)", () => {
    const tool = getTool("generate_image_asset");
    expect(tool?.mode).toBe("read");
    expect(tool?.domains).toEqual(["system"]);
    expect((tool?.parameters.properties?.kind as { enum?: string[] } | undefined)?.enum).toEqual([
      "picture", "title", "backdrop",
    ]);
  });

  it("returns a UI handoff in a headless tool call and rejects invalid requests", () => {
    const ctx = { project: createBlankProject() };
    const handoff = runTool(ctx, "generate_image_asset", { kind: "picture", prompt: "푸른 수정 검" });
    expect(handoff.ok).toBe(true);
    expect(handoff.data).toMatchObject({ status: "ui-required", kind: "picture", prompt: "푸른 수정 검" });

    expect(runTool(ctx, "generate_image_asset", { kind: "unknown", prompt: "몬스터" }).ok).toBe(false);
    expect(runTool(ctx, "generate_image_asset", { kind: "picture", prompt: "짧" }).ok).toBe(false);
    // 몬스터 그림은 더 만들지 않는다 — 전투 몬스터는 도트 측면 시트에서 고른다.
    expect(runTool(ctx, "generate_image_asset", { kind: "monster", prompt: "눈 덮인 산의 얼음 늑대", tags: ["늑대"] }).ok).toBe(false);
    // tags 는 이제 어느 kind 에도 필수가 아니다.
    expect(runTool(ctx, "generate_image_asset", { kind: "backdrop", prompt: "불타는 화산 동굴" }).ok).toBe(true);
  });

  it("generates a resource-shaped result without putting text in the art prompt", async () => {
    let modelPrompt = "";
    const result = await generateImageAsset(
      { kind: "picture", name: "얼음 검", tags: ["얼음", "검"], prompt: "서리가 맺힌 푸른 얼음 검" },
      { generateImage: async request => { modelPrompt = request.prompt; return { dataUrl: "data:image/png;base64,AAAA", mimeType: "image/png", model: "test", provider: "test" }; } },
    );
    expect(result).toMatchObject({ ok: true, kind: "picture", name: "얼음 검", dataUrl: "data:image/png;base64,AAAA" });
    if (result.ok) {
      expect(result.resourceId).toMatch(/^generated_picture_/u);
      expect(result.prompt).toBe("서리가 맺힌 푸른 얼음 검");
    }
    expect(modelPrompt).toContain("Do not add letters");
    expect(modelPrompt).toContain("uniform solid white background");
  });

  it("keeps uploaded monster tags discoverable for the appearance evidence gate", () => {
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
