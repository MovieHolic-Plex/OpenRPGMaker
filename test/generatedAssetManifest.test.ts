import { describe, expect, it } from "vitest";
import { validateGeneratedAssetManifest, type GeneratedAssetManifestInput } from "@/assets/generatedAssetManifest";
import { RM2K3_GENERATED_ASSET_PLAN } from "@/assets/rm2k3GeneratedAssetPlan";

describe("generatedAssetManifest", () => {
  it("accepts the planned Wave 1 RM2K3 asset batch when every target has contract metadata", () => {
    const result = validateGeneratedAssetManifest(RM2K3_GENERATED_ASSET_PLAN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.assets.filter((entry) => entry.target === "actorFace")).toHaveLength(2);
      expect(result.manifest.assets.filter((entry) => entry.target === "actorCharset")).toHaveLength(2);
      expect(result.manifest.assets.filter((entry) => entry.target === "actorBattleCharset")).toHaveLength(2);
      expect(result.manifest.assets.filter((entry) => entry.target === "enemyMonster")).toHaveLength(3);
      expect(result.manifest.assets.filter((entry) => entry.target === "itemImage" || entry.target === "itemIcon")).toHaveLength(4);
      expect(result.manifest.assets.filter((entry) => entry.target === "equipmentImage" || entry.target === "equipmentIcon")).toHaveLength(4);
      expect(result.manifest.assets.filter((entry) => entry.target === "troopPreview")).toHaveLength(1);
      expect(result.manifest.assets.every((entry) => entry.prompt.length > 0 && entry.provenance.generator === "agy")).toBe(true);
    }
  });

  it("rejects manifests with missing prompt, bad dimensions, or EasyRPG paths", () => {
    const invalid: GeneratedAssetManifestInput = {
      version: 1,
      assets: [
        {
          id: "bad-actor",
          target: "actorCharset",
          resourceKind: "charset",
          expectedDimensions: { width: 320, height: 240 },
          negativePrompt: "watermarks",
          status: "generated",
          rawPath: "public/assets/easyrpg/charset/output.png",
          resourceId: "bad-actor-resource",
          provenance: {
            generator: "agy",
            mode: "fake",
            promptVersion: "test",
            createdAt: "2026-06-22T00:00:00.000Z",
          },
        },
      ],
    };

    const result = validateGeneratedAssetManifest(invalid);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field)).toContain("prompt");
      expect(result.issues.map((issue) => issue.field)).toContain("expectedDimensions");
      expect(result.issues.map((issue) => issue.field)).toContain("path");
    }
  });
});
