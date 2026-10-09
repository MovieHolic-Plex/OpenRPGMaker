import { describe, expect, it } from "vitest";
import {
  buildContactSheetMetadata,
  buildDryRunPathPlan,
  buildLiveAgyCommand,
  buildPromotionMetadata,
  createFakeGeneratedAsset,
  validateGeneratedAssetBytes,
} from "@/assets/generatedAssetHarness";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { createFakePngBytes } from "@/assets/pngFake";

describe("generatedAssetHarness", () => {
  it("validates dry-run PNGs without re-promoting retired starter entries", async () => {
    const entry = GENERATED_ASSET_PLAN.assets[1];
    const plan = buildDryRunPathPlan(GENERATED_ASSET_PLAN, ".omo/evidence/oprn-generated-assets-execution/raw");
    const bytes = createFakeGeneratedAsset(entry);

    const validation = await validateGeneratedAssetBytes({ entry, path: plan[1]?.rawPath ?? "", bytes });
    const promotion = buildPromotionMetadata(entry, validation);
    const contactSheet = buildContactSheetMetadata(GENERATED_ASSET_PLAN);
    const command = buildLiveAgyCommand(entry, "C:/tmp/generated.png");

    expect(plan[1]?.rawPath).toMatch(/hero-01-charset-[0-9a-f]{8}\.png$/);
    expect(command).toContain("agy");
    expect(command.join(" ")).toContain("180s");
    expect(validation.ok).toBe(true);
    expect(validation.inspection?.width).toBe(288);
    expect(validation.inspection?.height).toBe(256);
    expect(validation.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(promotion).toBeNull();
    expect(contactSheet.cells).toHaveLength(GENERATED_ASSET_PLAN.assets.length);
  });

  it("rejects missing, non-PNG, wrong-size, blank, and unsafe generated outputs", async () => {
    const entry = GENERATED_ASSET_PLAN.assets.find((asset) => asset.id === "potion-red-icon");
    expect(entry).toBeDefined();
    if (!entry) return;
    const missing = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: null });
    const nonPng = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: new Uint8Array([1, 2, 3]) });
    const wrongSize = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: createFakePngBytes({ width: 64, height: 64 }) });
    const blank = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: createFakePngBytes({ width: 32, height: 32, blank: true }) });
    const unsafeName = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/output.png", bytes: createFakePngBytes({ width: 32, height: 32 }) });

    expect(missing.issues).toContain("file is missing");
    expect(nonPng.issues).toContain("file is not a PNG");
    expect(wrongSize.issues).toContain("PNG dimensions 64x64 do not match 32x32");
    expect(blank.issues).toContain("PNG appears blank");
    expect(unsafeName.issues).toContain("output path must be a unique generated PNG outside public/assets/easyrpg");
  });
});
