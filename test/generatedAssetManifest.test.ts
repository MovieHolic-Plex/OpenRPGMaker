import { describe, expect, it } from "vitest";
import { validateGeneratedAssetManifest, type GeneratedAssetManifestInput } from "@/assets/generatedAssetManifest";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";

describe("generatedAssetManifest", () => {
  it("accepts the planned Wave 1 RM2K3 asset batch when every target has contract metadata", () => {
    const result = validateGeneratedAssetManifest(GENERATED_ASSET_PLAN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.assets.filter((entry) => entry.target === "actorFace")).toHaveLength(2);
      expect(result.manifest.assets.filter((entry) => entry.target === "actorCharset")).toHaveLength(2);
      expect(result.manifest.assets.filter((entry) => entry.target === "actorBattleCharset")).toHaveLength(4);
      expect(result.manifest.assets.filter((entry) => entry.target === "enemyMonster")).toHaveLength(5);
      expect(result.manifest.assets.filter((entry) => entry.target === "itemImage" || entry.target === "itemIcon")).toHaveLength(4);
      expect(result.manifest.assets.filter((entry) => entry.target === "equipmentImage" || entry.target === "equipmentIcon")).toHaveLength(4);
      expect(result.manifest.assets.filter((entry) => entry.target === "troopPreview")).toHaveLength(1);
      expect(
        result.manifest.assets.every(
          (entry) => entry.prompt.length > 0 && (entry.provenance.generator === "agy" || entry.provenance.generator === "imagegen")
        )
      ).toBe(true);
      expect(result.manifest.assets.some((entry) => entry.provenance.generator === "imagegen")).toBe(true);
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

  it("keeps promoted battle-generated magenta assets registered in the manifest", () => {
    const result = validateGeneratedAssetManifest(GENERATED_ASSET_PLAN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const magentaAssets = result.manifest.assets.filter((asset) => asset.provenance.promptVersion === "battle-magenta-v2");
    expect(magentaAssets.map((asset) => asset.id).sort()).toEqual(["monster-slime-01", "troop-preview-slime"]);
    expect(magentaAssets.every((asset) => asset.promotedPath?.startsWith("public/assets/generated/starter/") === true)).toBe(true);
    expect(magentaAssets.every((asset) => asset.sha256 !== null && asset.sha256.length === 64)).toBe(true);
  });

  it("keeps promoted battle charsets extracted from bundled actor charsets registered in the manifest", () => {
    const result = validateGeneratedAssetManifest(GENERATED_ASSET_PLAN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const extractedAssets = result.manifest.assets.filter((asset) => asset.provenance.promptVersion === "bundled-charset-extract-v1");
    expect(extractedAssets.map((asset) => asset.id).sort()).toEqual([
      "hero-01-battle",
      "hero-02-battle",
      "hero-03-battle",
      "hero-04-battle",
    ]);
    expect(extractedAssets.every((asset) => asset.promotedPath?.startsWith("public/assets/generated/starter/") === true)).toBe(true);
    expect(extractedAssets.every((asset) => asset.sha256 !== null && asset.sha256.length === 64)).toBe(true);
  });
});
